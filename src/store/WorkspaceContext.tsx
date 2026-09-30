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
import type { AgeGroup, ID, ISODate, Student } from '@/types';
import {
  buildFamilies,
  firstClassOn,
  seedOnboarding,
  OUTCOME_LABEL,
  STEP_LABEL,
  touchFromRow,
  touchToRow,
  type Family,
  type Touch,
  type TouchOutcome,
  type TouchStep,
} from '@/data/onboarding';
import { TODAY, addDays } from '@/data/dates';
import { toStudent } from '@/data/mappers';
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
import {
  newRecipient,
  newSurvey,
  recipientFromRow,
  recipientToRow,
  seedSurveys,
  surveyFromRow,
  surveyToRow,
  surveyUrl,
  type Survey,
  type SurveyRecipient,
} from '@/data/surveys';
import { formatDateKo } from '@/lib/format';
import { friendlyError, supabase } from '@/lib/supabase';
import { PREVIEW } from '@/dev/preview';
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

/** What a composer hands `sendSurvey`. Exactly one audience. */
export interface SurveyDraft {
  kind: Survey['kind'];
  title: string;
  questions: Survey['questions'];
  dueDate: ISODate | null;
  /** A whole class (or several). */
  classIds?: ID[];
  /** Or one family that hasn't enrolled yet — the 등록 신청서. */
  leadId?: ID;
}

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
  /**
   * Surveys have their own mode: an academy can have run 0006 and not 0008,
   * and the 문의 pipeline shouldn't drop to demo data because of it.
   */
  surveyMode: WorkspaceMode;
  surveys: Survey[];
  recipients: SurveyRecipient[];
  surveysSeeded: boolean;
  /** The contact ledger behind the onboarding journey (0009). Own mode, same reason. */
  touchMode: WorkspaceMode;
  touches: Touch[];
  touchesSeeded: boolean;
  /**
   * Local demo only — students shown as newly enrolled. The seeded roster was
   * all enrolled months ago, and an empty 첫 달 demonstrates nothing.
   */
  enrolledOverride: Record<ID, ISODate>;
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
  | { type: 'record'; event: ActivityEvent }
  | { type: 'surveys/load'; surveys: Survey[]; recipients: SurveyRecipient[] }
  | { type: 'surveys/local' }
  | { type: 'surveys/seed'; surveys: Survey[]; recipients: SurveyRecipient[] }
  | { type: 'survey/add'; survey: Survey; recipients: SurveyRecipient[]; event: ActivityEvent }
  | { type: 'survey/close'; surveyId: ID }
  | {
      type: 'recipients/patch';
      ids: ID[];
      patch: Partial<SurveyRecipient>;
      event?: ActivityEvent;
    }
  | { type: 'touches/load'; touches: Touch[] }
  | { type: 'touches/local' }
  | { type: 'touches/seed'; touches: Touch[]; enrolledOverride: Record<ID, ISODate> }
  | { type: 'touch/add'; touch: Touch; event: ActivityEvent };

const EMPTY: WorkspaceState = {
  mode: 'loading',
  syncError: null,
  leads: [],
  formLinks: [],
  overrides: {},
  recorded: [],
  seeded: false,
  surveyMode: 'loading',
  surveys: [],
  recipients: [],
  surveysSeeded: false,
  touchMode: 'loading',
  touches: [],
  touchesSeeded: false,
  enrolledOverride: {},
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

    case 'surveys/load':
      return {
        ...state,
        surveyMode: 'db',
        surveys: action.surveys,
        recipients: action.recipients,
        surveysSeeded: true,
      };

    case 'surveys/local':
      return state.surveyMode === 'local' ? state : { ...state, surveyMode: 'local' };

    case 'surveys/seed':
      if (state.surveysSeeded) return state;
      return {
        ...state,
        surveys: action.surveys,
        recipients: action.recipients,
        surveysSeeded: true,
      };

    case 'survey/add':
      return {
        ...state,
        surveys: [action.survey, ...state.surveys],
        recipients: [...action.recipients, ...state.recipients],
        recorded: [action.event, ...state.recorded],
      };

    case 'survey/close':
      return {
        ...state,
        surveys: state.surveys.map((v) => (v.id === action.surveyId ? { ...v, closed: true } : v)),
      };

    case 'touches/load':
      return { ...state, touchMode: 'db', touches: action.touches, touchesSeeded: true };

    case 'touches/local':
      return state.touchMode === 'local' ? state : { ...state, touchMode: 'local' };

    case 'touches/seed':
      if (state.touchesSeeded) return state;
      return {
        ...state,
        touches: action.touches,
        enrolledOverride: action.enrolledOverride,
        touchesSeeded: true,
      };

    case 'touch/add':
      return {
        ...state,
        touches: [action.touch, ...state.touches],
        recorded: [action.event, ...state.recorded],
      };

    case 'recipients/patch':
      return {
        ...state,
        recipients: state.recipients.map((r) =>
          action.ids.includes(r.id) ? { ...r, ...action.patch } : r,
        ),
        recorded: action.event ? [action.event, ...state.recorded] : state.recorded,
      };

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

  surveyMode: WorkspaceMode;
  surveys: Survey[];
  recipients: SurveyRecipient[];
  /**
   * Create the survey, one private link per family, and queue the 알림톡
   * that carries each link. Resolves with what happened to the messages
   * (`null` in local mode, where nothing can be sent).
   */
  sendSurvey: (draft: SurveyDraft) => Promise<{ survey: Survey; result: EnqueueResult | null }>;
  /** One more 알림톡 to the families who haven't answered — once per family, ever. */
  remindSurvey: (surveyId: ID) => Promise<EnqueueResult | null>;
  closeSurvey: (surveyId: ID) => void;
  /** Someone rang about a flagged answer; take the family off the call list. */
  markCalled: (recipientId: ID) => void;

  // --- Onboarding ---------------------------------------------------------
  touchMode: WorkspaceMode;
  touches: Touch[];
  /** Every family between 문의 and a finished 첫 달, with its next action. */
  families: Family[];
  getFamily: (key: string) => Family | undefined;
  /** Write down a contact and what came of it. */
  logTouch: (
    to: { leadId: ID } | { studentId: ID },
    step: TouchStep,
    outcome: TouchOutcome,
    note?: string,
  ) => void;
  /** 등록 확정: the lead becomes a student in a class. Resolves with the new student. */
  enrollLead: (leadId: ID, classId: ID, ageGroup: AgeGroup) => Promise<Student | null>;
  /** The day-one 알림톡 for a new student, then the touch that records it. */
  sendWelcome: (studentId: ID) => Promise<EnqueueResult | null>;

  /** The escape hatch: append a ledger row for anything not modelled above. */
  record: (event: EventDraft) => void;
}

const WorkspaceContext = createContext<WorkspaceValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { state, slice, loading, dispatch: appDispatch } = useApp();
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

  if (
    // Demo rows are built from the roster, so only in preview: on a real
    // academy they would dress up real children as surveyed or newly enrolled.
    PREVIEW &&
    ws.surveyMode === 'local' &&
    !ws.surveysSeeded &&
    !loading &&
    state.classes.length > 0
  ) {
    const seeded = seedSurveys(
      academyId,
      state.students,
      state.classes.map((c) => c.id),
    );
    dispatch({ type: 'surveys/seed', ...seeded });
  }

  // Waits for the leads too, so the seeded unanswered call can point at one.
  if (
    PREVIEW &&
    ws.touchMode === 'local' &&
    !ws.touchesSeeded &&
    ws.mode !== 'loading' &&
    (ws.mode === 'db' || ws.seeded) &&
    !loading &&
    state.students.length > 0
  ) {
    dispatch({ type: 'touches/seed', ...seedOnboarding(academyId, ws.leads, state.students) });
  }

  const reloadTouches = useCallback(() => {
    if (!academyId) return;
    void (async () => {
      const res = await supabase
        .from('onboarding_touches')
        .select('*')
        .eq('academy_id', academyId)
        .order('created_at', { ascending: false });
      if (res.error) {
        if (isMissingSchema(res.error)) dispatch({ type: 'touches/local' });
        else dispatch({ type: 'sync/error', message: '연락 기록을 불러오지 못했습니다' });
        return;
      }
      dispatch({ type: 'touches/load', touches: (res.data ?? []).map(touchFromRow) });
    })();
  }, [academyId]);

  // Separate from the leads fetch so a project with 0006 but not 0008 keeps its
  // real pipeline and only the surveys fall back.
  const reloadSurveys = useCallback(() => {
    if (!academyId) return;
    void (async () => {
      const [surveysRes, recipientsRes] = await Promise.all([
        supabase
          .from('surveys')
          .select('*')
          .eq('academy_id', academyId)
          .order('created_at', { ascending: false }),
        supabase.from('survey_recipients').select('*').eq('academy_id', academyId),
      ]);
      const error = surveysRes.error ?? recipientsRes.error;
      if (error) {
        if (isMissingSchema(error)) dispatch({ type: 'surveys/local' });
        else dispatch({ type: 'sync/error', message: '설문을 불러오지 못했습니다' });
        return;
      }
      dispatch({
        type: 'surveys/load',
        surveys: (surveysRes.data ?? []).map(surveyFromRow),
        recipients: (recipientsRes.data ?? []).map(recipientFromRow),
      });
    })();
  }, [academyId]);

  const reload = useCallback(() => {
    if (!academyId) return;
    if (PREVIEW) {
      // Preview has no database: every workspace table runs on its demo seed.
      dispatch({ type: 'local' });
      dispatch({ type: 'surveys/local' });
      dispatch({ type: 'touches/local' });
      return;
    }
    reloadSurveys();
    reloadTouches();
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
  }, [academyId, reloadSurveys, reloadTouches]);

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

  // --- Surveys --------------------------------------------------------------

  const surveyPersist = useCallback(
    (label: string, write: () => PromiseLike<{ error: unknown }>): Promise<boolean> => {
      if (ws.surveyMode !== 'db') return Promise.resolve(true);
      return Promise.resolve(write()).then(({ error }) => {
        if (!error) return true;
        console.error('[workspace]', label, error);
        dispatch({ type: 'sync/error', message: `${label}에 실패했습니다. 다시 시도해 주세요.` });
        reloadSurveys();
        return false;
      });
    },
    [ws.surveyMode, reloadSurveys],
  );

  /** Who a recipient row is, for the 알림톡 variables. */
  const addressOf = useCallback(
    (r: SurveyRecipient) => {
      if (r.studentId) {
        const s = state.students.find((x) => x.id === r.studentId);
        return { parent: s?.parentName || '보호자', child: s?.name || '자녀' };
      }
      const l = ws.leads.find((x) => x.id === r.leadId);
      return { parent: l?.parentName || '보호자', child: l?.childName || '자녀' };
    },
    [state.students, ws.leads],
  );

  const queueSurveyMessages = useCallback(
    async (
      survey: Survey,
      targets: SurveyRecipient[],
      code: 'survey_request' | 'survey_reminder',
    ): Promise<EnqueueResult | null> => {
      if (ws.surveyMode !== 'db' || targets.length === 0) return null;
      const due = survey.dueDate ? `${formatDateKo(survey.dueDate)}까지` : '따로 없음';
      const items = targets.map((r) => {
        const who = addressOf(r);
        const variables = {
          학원명: academyName,
          보호자명: who.parent,
          학생명: who.child,
          설문제목: survey.title,
          마감일: due,
          링크: surveyUrl(r.token),
        };
        return {
          templateCode: code,
          ...(r.studentId ? { studentId: r.studentId } : { leadId: r.leadId! }),
          variables,
          body: render(code, variables),
          dedupeKey: `survey:${r.id}:${code === 'survey_request' ? 'request' : 'remind'}`,
        };
      });

      try {
        // enqueue_alimtalk takes 200 at a time; a whole-centre survey can be more.
        let last: EnqueueResult | null = null;
        let queued = 0;
        for (let i = 0; i < items.length; i += 200) {
          last = await enqueue(academyId, items.slice(i, i + 200));
          if (last.state === 'unavailable') return last;
          queued += last.queued;
        }
        return last && last.state === 'queued' ? { ...last, queued } : last;
      } catch (error) {
        console.error('[workspace] 설문 알림톡', error);
        return null;
      }
    },
    [academyId, academyName, addressOf, ws.surveyMode],
  );

  const sendSurvey = useCallback(
    async (draft: SurveyDraft) => {
      const survey = newSurvey(academyId, {
        kind: draft.kind,
        title: draft.title,
        questions: draft.questions,
        classIds: draft.leadId ? [] : (draft.classIds ?? []),
        dueDate: draft.dueDate,
      });

      // 휴원 families are left out: a 대회 참가 조사 in their KakaoTalk is noise
      // from a centre they have stepped away from, not an invitation back.
      const recipients = draft.leadId
        ? [newRecipient(survey, { leadId: draft.leadId })]
        : state.students
            .filter((s) => survey.classIds.includes(s.classId) && s.status !== 'inactive')
            .map((s) => newRecipient(survey, { studentId: s.id }));

      const lead = draft.leadId ? ws.leads.find((l) => l.id === draft.leadId) : undefined;
      dispatch({
        type: 'survey/add',
        survey,
        recipients,
        event: make({
          kind: 'survey.sent',
          subjectType: lead ? 'lead' : 'form',
          subjectId: lead ? lead.id : survey.id,
          subjectLabel: lead ? lead.childName : survey.title,
          summary: lead ? `${survey.title} 발송` : `설문 발송 · ${recipients.length}가정`,
        }),
      });

      const saved =
        (await surveyPersist('설문 만들기', () =>
          supabase.from('surveys').insert(surveyToRow(survey)),
        )) &&
        (await surveyPersist('설문 받는 사람 저장', () =>
          supabase.from('survey_recipients').insert(recipients.map(recipientToRow)),
        ));
      if (!saved) return { survey, result: null };

      return { survey, result: await queueSurveyMessages(survey, recipients, 'survey_request') };
    },
    [academyId, make, queueSurveyMessages, state.students, surveyPersist, ws.leads],
  );

  const remindSurvey = useCallback(
    async (surveyId: ID) => {
      const survey = ws.surveys.find((v) => v.id === surveyId);
      if (!survey) return null;
      const targets = ws.recipients.filter(
        (r) => r.surveyId === surveyId && !r.answeredAt && !r.remindedAt,
      );
      if (targets.length === 0) return null;

      const now = new Date().toISOString();
      const ids = targets.map((r) => r.id);
      dispatch({ type: 'recipients/patch', ids, patch: { remindedAt: now } });
      const saved = await surveyPersist('다시 알림', () =>
        supabase.from('survey_recipients').update({ reminded_at: now }).in('id', ids),
      );
      if (!saved) return null;
      return queueSurveyMessages(survey, targets, 'survey_reminder');
    },
    [queueSurveyMessages, surveyPersist, ws.recipients, ws.surveys],
  );

  const closeSurvey = useCallback(
    (surveyId: ID) => {
      dispatch({ type: 'survey/close', surveyId });
      void surveyPersist('설문 마감', () =>
        supabase.from('surveys').update({ closed: true }).eq('id', surveyId),
      );
    },
    [surveyPersist],
  );

  const markCalled = useCallback(
    (recipientId: ID) => {
      const r = ws.recipients.find((x) => x.id === recipientId);
      if (!r) return;
      const survey = ws.surveys.find((v) => v.id === r.surveyId);
      const now = new Date().toISOString();
      dispatch({
        type: 'recipients/patch',
        ids: [recipientId],
        patch: { calledAt: now },
        event: make({
          kind: 'survey.called',
          subjectType: r.studentId ? 'student' : 'lead',
          subjectId: (r.studentId ?? r.leadId)!,
          subjectLabel: addressOf(r).child,
          summary: `${survey?.title ?? '설문'} 답변으로 통화`,
        }),
      });
      void surveyPersist('통화 기록', () =>
        supabase.from('survey_recipients').update({ called_at: now }).eq('id', recipientId),
      );
    },
    [addressOf, make, surveyPersist, ws.recipients, ws.surveys],
  );

  // --- Onboarding -----------------------------------------------------------

  const families = useMemo(
    () =>
      buildFamilies({
        leads: ws.leads,
        students: state.students,
        classes: state.classes,
        attendanceLogs: state.attendanceLogs,
        touches: ws.touches,
        surveys: ws.surveys,
        recipients: ws.recipients,
        enrolledOverride: ws.enrolledOverride,
      }),
    [
      ws.leads,
      state.students,
      state.classes,
      state.attendanceLogs,
      ws.touches,
      ws.surveys,
      ws.recipients,
      ws.enrolledOverride,
    ],
  );

  const getFamily = useCallback((key: string) => families.find((f) => f.key === key), [families]);

  const logTouch = useCallback(
    (
      to: { leadId: ID } | { studentId: ID },
      step: TouchStep,
      outcome: TouchOutcome,
      note = '',
    ) => {
      const leadId = 'leadId' in to ? to.leadId : null;
      const studentId = 'studentId' in to ? to.studentId : null;
      const touch: Touch = {
        id: crypto.randomUUID(),
        academyId,
        leadId,
        studentId,
        step,
        outcome,
        note: note.trim().slice(0, 500),
        actorName: actorName.slice(0, 60),
        at: new Date().toISOString(),
      };
      const label = leadId
        ? (ws.leads.find((l) => l.id === leadId)?.childName ?? '')
        : (state.students.find((s) => s.id === studentId)?.name ?? '');

      dispatch({
        type: 'touch/add',
        touch,
        event: make({
          kind: 'onboarding.touched',
          subjectType: leadId ? 'lead' : 'student',
          subjectId: (leadId ?? studentId)!,
          subjectLabel: label,
          summary: `${STEP_LABEL[step]} · ${OUTCOME_LABEL[outcome]}`,
          detail: touch.note || undefined,
        }),
      });

      if (ws.touchMode !== 'db') return;
      void Promise.resolve(supabase.from('onboarding_touches').insert(touchToRow(touch))).then(
        ({ error }) => {
          if (!error) return;
          console.error('[workspace] 연락 기록', error);
          dispatch({ type: 'sync/error', message: '연락 기록 저장에 실패했습니다. 다시 시도해 주세요.' });
          reloadTouches();
        },
      );
    },
    [academyId, actorName, make, reloadTouches, state.students, ws.leads, ws.touchMode],
  );

  const enrollLead = useCallback(
    async (leadId: ID, classId: ID, ageGroup: AgeGroup): Promise<Student | null> => {
      const lead = ws.leads.find((l) => l.id === leadId);
      if (!lead) return null;

      let student: Student;
      if (ws.mode === 'db') {
        const { data, error } = await supabase.rpc('enroll_lead', {
          p_lead_id: leadId,
          p_class_id: classId,
          p_age_group: ageGroup,
        });
        if (error || !data) {
          dispatch({ type: 'sync/error', message: friendlyError(error, '등록하지 못했습니다') });
          return null;
        }
        student = toStudent(data as Record<string, unknown>);
      } else {
        student = {
          id: crypto.randomUUID(),
          academyId,
          name: lead.childName || '이름 미상',
          ageGroup,
          status: 'active',
          lastAttendanceDate: null,
          churnScore: 0,
          classId,
          parentName: lead.parentName,
          parentPhone: lead.parentPhone,
          enrolledAt: TODAY,
          lastParentContactDate: null,
        };
      }

      appDispatch({ type: 'student/add', student });
      dispatch({
        type: 'lead/patch',
        leadId,
        patch: {
          stage: 'enrolled',
          stageChangedAt: new Date().toISOString(),
          enrolledStudentId: student.id,
          interestClassId: classId,
        },
        event: make({
          kind: 'lead.enrolled',
          subjectType: 'lead',
          subjectId: leadId,
          subjectLabel: student.name,
          summary: `${state.classes.find((c) => c.id === classId)?.title ?? ''} 등록 확정`,
        }),
      });
      return student;
    },
    [academyId, appDispatch, make, state.classes, ws.leads, ws.mode],
  );

  const sendWelcome = useCallback(
    async (studentId: ID): Promise<EnqueueResult | null> => {
      const s = state.students.find((x) => x.id === studentId);
      if (!s) return null;
      const cls = state.classes.find((c) => c.id === s.classId);
      const coach = state.coaches.find((c) => c.id === cls?.coachId);
      const enrolledAt = ws.enrolledOverride[s.id] ?? s.enrolledAt;
      const first = firstClassOn(cls, addDays(enrolledAt, 1));

      let result: EnqueueResult | null = null;
      if (ws.mode === 'db') {
        const variables = {
          학원명: academyName,
          보호자명: s.parentName || '보호자',
          학생명: s.name,
          반이름: cls?.title ?? '배정된 반',
          첫수업: first ? `${formatDateKo(first)} ${cls?.schedule.startTime ?? ''}`.trim() : '코치가 따로 안내드립니다',
          장소: cls?.venue || '센터',
          코치명: coach?.name ?? '담당',
        };
        try {
          result = await enqueue(academyId, [
            {
              templateCode: 'welcome',
              studentId,
              variables,
              body: render('welcome', variables),
              dedupeKey: `welcome:${studentId}`,
            },
          ]);
        } catch (error) {
          console.error('[workspace] 환영 안내', error);
        }
      }

      logTouch({ studentId }, 'welcome', 'done', '환영 안내 발송');
      return result;
    },
    [academyId, academyName, logTouch, state.classes, state.coaches, state.students, ws.enrolledOverride, ws.mode],
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
      surveyMode: ws.surveyMode,
      surveys: ws.surveys,
      recipients: ws.recipients,
      sendSurvey,
      remindSurvey,
      closeSurvey,
      markCalled,
      touchMode: ws.touchMode,
      touches: ws.touches,
      families,
      getFamily,
      logTouch,
      enrollLead,
      sendWelcome,
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
      ws.surveyMode,
      ws.surveys,
      ws.recipients,
      sendSurvey,
      remindSurvey,
      closeSurvey,
      markCalled,
      ws.touchMode,
      ws.touches,
      families,
      getFamily,
      logTouch,
      enrollLead,
      sendWelcome,
    ],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used inside <WorkspaceProvider>');
  return ctx;
}
