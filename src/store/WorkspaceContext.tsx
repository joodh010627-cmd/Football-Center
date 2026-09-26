/**
 * The CRM pipeline, the form links, and everything that still has no table.
 *
 * Leads and form links are real rows since migration 0006 — a parent filling
 * in a form link has to land somewhere that outlives the coach's browser tab.
 * The provider loads them, applies every change optimistically, and writes it
 * through. If the migration hasn't been applied to this Supabase project yet,
 * it says so (`mode: 'local'`) and falls back to the seeded in-memory pipeline,
 * so the app keeps working while the owner catches the database up.
 *
 * The pentagon overrides and the activity ledger are still local, and still
 * wait on a pilot: nobody outside this app needs to write them.
 *
 * Two rules keep this honest:
 *
 * 1. Everything routes through `record()`. A mutation that doesn't append to the
 *    ledger is a mutation that will be invisible when the real table lands, and
 *    the ledger is the feature.
 *
 * 2. Nothing here is read by the owner-only aggregates. Revenue, margin and
 *    coach evaluations still come from RLS-protected queries. A local array can
 *    never become a permission.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react';
import type { AxisScores } from '@/lib/axes';
import type { ID, ISODate } from '@/types';
import {
  formLinkFromRow,
  formLinkToRow,
  leadFromRow,
  leadToRow,
  newFormLink,
  newLead,
  seedFormLinks,
  seedLeads,
  STAGE_META,
  type FormLink,
  type Lead,
  type LeadStage,
} from '@/data/crm';
import {
  deriveActivity,
  mergeActivity,
  newEvent,
  type ActivityEvent,
  type EventDraft,
} from '@/data/activity';
import { formatDateKo } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { enqueue, isMissingSchema, type EnqueueResult } from '@/lib/alimtalk/outbox';
import { render } from '@/lib/alimtalk/templates';
import { useApp } from '@/store/AppContext';
import { useSession } from '@/store/AuthContext';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/** A coach's explicit rating, where they disagreed with what the tags implied. */
export interface EvaluationOverride {
  studentId: ID;
  scores: AxisScores;
  note: string;
  ratedBy: string;
  ratedAt: string;
}

/**
 * Where leads and form links live right now.
 *
 *   loading — first fetch in flight
 *   db      — the `leads` / `form_links` tables; changes are written through
 *   local   — migration 0006 not applied; seeded, in memory, gone on reload
 */
export type WorkspaceMode = 'loading' | 'db' | 'local';

interface WorkspaceState {
  mode: WorkspaceMode;
  /** The last write that failed, in words. Cleared by the next good load. */
  syncError: string | null;
  leads: Lead[];
  formLinks: FormLink[];
  overrides: Record<ID, EvaluationOverride>;
  /** Appended live. Merged with the derived ledger on read. */
  recorded: ActivityEvent[];
  seeded: boolean;
}

type WorkspaceAction =
  | { type: 'seed'; leads: Lead[]; formLinks: FormLink[] }
  | { type: 'load'; leads: Lead[]; formLinks: FormLink[] }
  | { type: 'local' }
  | { type: 'sync/error'; message: string }
  | { type: 'lead/add'; lead: Lead; event: ActivityEvent }
  | { type: 'lead/patch'; leadId: ID; patch: Partial<Lead>; event: ActivityEvent }
  | { type: 'form/add'; link: FormLink; event: ActivityEvent }
  | { type: 'form/toggle'; linkId: ID; event: ActivityEvent }
  | { type: 'evaluation/save'; override: EvaluationOverride; event: ActivityEvent }
  | { type: 'record'; event: ActivityEvent };

const EMPTY: WorkspaceState = {
  mode: 'loading',
  syncError: null,
  leads: [],
  formLinks: [],
  overrides: {},
  recorded: [],
  seeded: false,
};

function reducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  switch (action.type) {
    case 'seed':
      // Once only. A refetch of the tenant data must not wipe a lead the user
      // moved thirty seconds ago.
      if (state.seeded) return state;
      return { ...state, leads: action.leads, formLinks: action.formLinks, seeded: true };

    case 'load':
      // The server is the truth. A reload lands after every failed write, so
      // anything optimistic has either been persisted or been reported.
      return {
        ...state,
        mode: 'db',
        syncError: null,
        leads: action.leads,
        formLinks: action.formLinks,
        seeded: true,
      };

    case 'local':
      return state.mode === 'local' ? state : { ...state, mode: 'local' };

    case 'sync/error':
      return { ...state, syncError: action.message };

    case 'lead/add':
      return {
        ...state,
        leads: [action.lead, ...state.leads],
        recorded: [action.event, ...state.recorded],
      };

    case 'lead/patch':
      return {
        ...state,
        leads: state.leads.map((l) => (l.id === action.leadId ? { ...l, ...action.patch } : l)),
        recorded: [action.event, ...state.recorded],
      };

    case 'form/add':
      return {
        ...state,
        formLinks: [action.link, ...state.formLinks],
        recorded: [action.event, ...state.recorded],
      };

    case 'form/toggle':
      return {
        ...state,
        formLinks: state.formLinks.map((f) =>
          f.id === action.linkId ? { ...f, active: !f.active } : f,
        ),
        recorded: [action.event, ...state.recorded],
      };

    case 'evaluation/save':
      return {
        ...state,
        overrides: { ...state.overrides, [action.override.studentId]: action.override },
        recorded: [action.event, ...state.recorded],
      };

    case 'record':
      return { ...state, recorded: [action.event, ...state.recorded] };

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface WorkspaceValue {
  mode: WorkspaceMode;
  syncError: string | null;
  /** Re-read leads and form links — a parent may have just submitted a form. */
  reload: () => void;

  leads: Lead[];
  formLinks: FormLink[];
  overrides: Record<ID, EvaluationOverride>;
  /** Derived + recorded, newest first. */
  activity: ActivityEvent[];
  getLead: (id: ID) => Lead | undefined;

  addLead: (fields: Partial<Lead>) => Lead;
  /** Move a lead to a new stage, stamping the clock and writing the ledger row. */
  advanceLead: (leadId: ID, stage: LeadStage, note?: string) => void;
  /** Resolves with what happened to the 체험 안내 알림톡, or null when none was queued. */
  bookTrial: (leadId: ID, date: ISODate, classId: ID | null) => Promise<EnqueueResult | null>;
  updateLead: (leadId: ID, patch: Partial<Lead>, summary: string) => void;

  addFormLink: (fields: Partial<FormLink>) => FormLink;
  toggleFormLink: (linkId: ID) => void;
  shareFormLink: (linkId: ID) => void;

  saveEvaluation: (studentId: ID, label: string, scores: AxisScores, note: string) => void;

  /** The escape hatch: append a ledger row for anything not modelled above. */
  record: (event: EventDraft) => void;
}

const WorkspaceContext = createContext<WorkspaceValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { state, slice, loading } = useApp();
  const session = useSession();
  const [ws, dispatch] = useReducer(reducer, EMPTY);

  const academyId = state.academyId;
  const academyName = session.academy.name;
  const actorName = session.membership.displayName || session.email;

  // Local mode only: seeding waits for the first fetch so trial leads can point
  // at real classes.
  if (ws.mode === 'local' && !ws.seeded && !loading && state.classes.length > 0) {
    dispatch({
      type: 'seed',
      leads: seedLeads(
        academyId,
        state.classes.map((c) => c.id),
      ),
      formLinks: seedFormLinks(academyId),
    });
  }

  const reload = useCallback(() => {
    if (!academyId) return;
    void (async () => {
      const [leadsRes, linksRes] = await Promise.all([
        supabase
          .from('leads')
          .select('*')
          .eq('academy_id', academyId)
          .order('created_at', { ascending: false }),
        supabase
          .from('form_links')
          .select('*')
          .eq('academy_id', academyId)
          .order('created_at', { ascending: false }),
      ]);
      const error = leadsRes.error ?? linksRes.error;
      if (error) {
        if (isMissingSchema(error)) dispatch({ type: 'local' });
        else dispatch({ type: 'sync/error', message: '문의 목록을 불러오지 못했습니다' });
        return;
      }
      dispatch({
        type: 'load',
        leads: (leadsRes.data ?? []).map(leadFromRow),
        formLinks: (linksRes.data ?? []).map(formLinkFromRow),
      });
    })();
  }, [academyId]);

  // First load, then again whenever the app comes back to the foreground and
  // once a minute while it's visible — a form submission has no other way to
  // announce itself.
  useEffect(() => {
    if (!academyId) return;
    reload();
    const onVisible = () => {
      if (document.visibilityState === 'visible') reload();
    };
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(onVisible, 60_000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
    };
  }, [academyId, reload]);

  /**
   * Write through to Postgres when there is a Postgres to write to. On failure
   * the optimistic change is rolled back by reloading, and the user is told —
   * silently diverging from the server is the one outcome worse than an error.
   */
  const persist = useCallback(
    (label: string, write: () => PromiseLike<{ error: unknown }>): Promise<boolean> => {
      if (ws.mode !== 'db') return Promise.resolve(true);
      return Promise.resolve(write()).then(({ error }) => {
        if (!error) return true;
        console.error('[workspace]', label, error);
        dispatch({ type: 'sync/error', message: `${label}에 실패했습니다. 다시 시도해 주세요.` });
        reload();
        return false;
      });
    },
    [ws.mode, reload],
  );

  // Every event from this provider is attributed to whoever is signed in, and
  // a caller cannot override that — `actorName` is applied after the spread.
  const make = useCallback(
    (fields: EventDraft) => newEvent(academyId, { ...fields, actorName }),
    [academyId, actorName],
  );

  const record = useCallback(
    (fields: EventDraft) => {
      dispatch({ type: 'record', event: make(fields) });
    },
    [make],
  );

  const addLead = useCallback(
    (fields: Partial<Lead>) => {
      const lead = newLead(academyId, fields);
      dispatch({
        type: 'lead/add',
        lead,
        event: make({
          kind: 'lead.created',
          subjectType: 'lead',
          subjectId: lead.id,
          subjectLabel: lead.childName,
          summary: `${lead.ageLabel} 신규 문의 접수`,
          detail: lead.memo || undefined,
        }),
      });
      void persist('문의 등록', () => supabase.from('leads').insert(leadToRow(lead)));
      return lead;
    },
    [academyId, make, persist],
  );

  const advanceLead = useCallback(
    (leadId: ID, stage: LeadStage, note = '') => {
      const kind =
        stage === 'enrolled' ? 'lead.enrolled' : stage === 'lost' ? 'lead.lost' : 'lead.advanced';
      const lead = ws.leads.find((l) => l.id === leadId);
      const patch: Partial<Lead> = {
        stage,
        stageChangedAt: new Date().toISOString(),
        ...(stage === 'lost' ? { lostReason: note } : {}),
        ...(note && stage !== 'lost' ? { memo: note } : {}),
      };

      dispatch({
        type: 'lead/patch',
        leadId,
        patch,
        event: make({
          kind,
          subjectType: 'lead',
          subjectId: leadId,
          subjectLabel: lead?.childName ?? '',
          summary: `${STAGE_META[stage].label}(으)로 이동`,
          detail: note || undefined,
        }),
      });
      void persist('단계 변경', () =>
        supabase.from('leads').update(leadToRow(patch)).eq('id', leadId),
      );
    },
    [make, persist, ws.leads],
  );

  const bookTrial = useCallback(
    async (leadId: ID, date: ISODate, classId: ID | null): Promise<EnqueueResult | null> => {
      const lead = ws.leads.find((l) => l.id === leadId);
      const patch: Partial<Lead> = {
        stage: 'trial_booked',
        trialDate: date,
        trialClassId: classId,
        stageChangedAt: new Date().toISOString(),
      };

      dispatch({
        type: 'lead/patch',
        leadId,
        patch,
        event: make({
          kind: 'lead.trial_booked',
          subjectType: 'lead',
          subjectId: leadId,
          subjectLabel: lead?.childName ?? '',
          summary: `${date} 체험 수업 예약`,
        }),
      });

      const saved = await persist('체험 예약', () =>
        supabase.from('leads').update(leadToRow(patch)).eq('id', leadId),
      );
      if (ws.mode !== 'db' || !saved || !lead) return null;

      // After the update, not alongside it: the queue reads the lead's number
      // from the row, so the row has to be settled first.
      const variables = {
        학원명: academyName,
        보호자명: lead.parentName || '보호자',
        아이이름: lead.childName || '자녀',
        체험일: formatDateKo(date),
        반이름: state.classes.find((c) => c.id === classId)?.title ?? '상담 후 안내',
      };
      try {
        return await enqueue(academyId, [
          {
            templateCode: 'trial_booked',
            leadId,
            variables,
            body: render('trial_booked', variables),
            dedupeKey: `lead:${leadId}:trial:${date}`,
          },
        ]);
      } catch (error) {
        console.error('[workspace] 체험 안내 알림톡', error);
        return null;
      }
    },
    [academyId, academyName, make, persist, state.classes, ws.leads, ws.mode],
  );

  const updateLead = useCallback(
    (leadId: ID, patch: Partial<Lead>, summary: string) => {
      const lead = ws.leads.find((l) => l.id === leadId);
      dispatch({
        type: 'lead/patch',
        leadId,
        patch,
        event: make({
          kind: 'lead.advanced',
          subjectType: 'lead',
          subjectId: leadId,
          subjectLabel: lead?.childName ?? '',
          summary,
        }),
      });
      void persist('문의 수정', () =>
        supabase.from('leads').update(leadToRow(patch)).eq('id', leadId),
      );
    },
    [make, persist, ws.leads],
  );

  const addFormLink = useCallback(
    (fields: Partial<FormLink>) => {
      const link = newFormLink(academyId, fields);
      dispatch({
        type: 'form/add',
        link,
        event: make({
          kind: 'form.created',
          subjectType: 'form',
          subjectId: link.id,
          subjectLabel: link.title,
          summary: '새 폼 링크 생성',
        }),
      });
      void persist('폼 링크 생성', () => supabase.from('form_links').insert(formLinkToRow(link)));
      return link;
    },
    [academyId, make, persist],
  );

  const toggleFormLink = useCallback(
    (linkId: ID) => {
      const link = ws.formLinks.find((f) => f.id === linkId);
      dispatch({
        type: 'form/toggle',
        linkId,
        event: make({
          kind: 'form.created',
          subjectType: 'form',
          subjectId: linkId,
          subjectLabel: link?.title ?? '',
          summary: link?.active ? '폼 링크 중단' : '폼 링크 재개',
        }),
      });
      void persist('폼 링크 변경', () =>
        supabase.from('form_links').update({ active: !link?.active }).eq('id', linkId),
      );
    },
    [make, persist, ws.formLinks],
  );

  const shareFormLink = useCallback(
    (linkId: ID) => {
      const link = ws.formLinks.find((f) => f.id === linkId);
      record({
        kind: 'form.shared',
        subjectType: 'form',
        subjectId: linkId,
        subjectLabel: link?.title ?? '',
        summary: '폼 링크 복사',
      });
    },
    [record, ws.formLinks],
  );

  const saveEvaluation = useCallback(
    (studentId: ID, label: string, scores: AxisScores, note: string) => {
      dispatch({
        type: 'evaluation/save',
        override: {
          studentId,
          scores,
          note,
          ratedBy: actorName,
          ratedAt: new Date().toISOString(),
        },
        event: make({
          kind: 'student.evaluated',
          subjectType: 'student',
          subjectId: studentId,
          subjectLabel: label,
          summary: '5개 영역 성장 평가 저장',
          detail: note || undefined,
        }),
      });
    },
    [actorName, make],
  );

  // The derived half is recomputed only when the underlying rows change; the
  // recorded half is prepended. Both halves are already sorted, but a merge
  // sort over the union is what puts a lead logged at 14:02 between two
  // sessions from this morning and this evening.
  const derived = useMemo(
    () => deriveActivity(slice, state.csActions, academyId),
    [slice, state.csActions, academyId],
  );

  const activity = useMemo(() => mergeActivity(derived, ws.recorded), [derived, ws.recorded]);

  const getLead = useCallback((id: ID) => ws.leads.find((l) => l.id === id), [ws.leads]);

  // In the database a link's submission count is simply its leads. Locally the
  // seeded number stands in, since the seeded leads carry no link ids.
  const formLinks = useMemo(
    () =>
      ws.mode === 'db'
        ? ws.formLinks.map((f) => ({
            ...f,
            submissions: ws.leads.filter((l) => l.formLinkId === f.id).length,
          }))
        : ws.formLinks,
    [ws.mode, ws.formLinks, ws.leads],
  );

  const value = useMemo<WorkspaceValue>(
    () => ({
      mode: ws.mode,
      syncError: ws.syncError,
      reload,
      leads: ws.leads,
      formLinks,
      overrides: ws.overrides,
      activity,
      getLead,
      addLead,
      advanceLead,
      bookTrial,
      updateLead,
      addFormLink,
      toggleFormLink,
      shareFormLink,
      saveEvaluation,
      record,
    }),
    [
      ws.mode,
      ws.syncError,
      reload,
      ws.leads,
      formLinks,
      ws.overrides,
      activity,
      getLead,
      addLead,
      advanceLead,
      bookTrial,
      updateLead,
      addFormLink,
      toggleFormLink,
      shareFormLink,
      saveEvaluation,
      record,
    ],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used inside <WorkspaceProvider>');
  return ctx;
}
