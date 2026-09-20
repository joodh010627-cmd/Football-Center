/**
 * Everything that has no table yet.
 *
 * The CRM pipeline, the form links and the coach's pentagon overrides all live
 * here, in the browser, for exactly as long as the tab is open. That is a
 * deliberate stopping point rather than an oversight: the shapes are settled
 * (`src/data/crm.ts`), the screens are real, and the one thing still missing is
 * a migration — which waits on a pilot academy, because a schema authored
 * against imagined requirements is a schema we write twice.
 *
 * Two rules keep this honest while it is local:
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
  useMemo,
  useReducer,
  type ReactNode,
} from 'react';
import type { AxisScores } from '@/lib/axes';
import type { ID, ISODate } from '@/types';
import {
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

interface WorkspaceState {
  leads: Lead[];
  formLinks: FormLink[];
  overrides: Record<ID, EvaluationOverride>;
  /** Appended live. Merged with the derived ledger on read. */
  recorded: ActivityEvent[];
  seeded: boolean;
}

type WorkspaceAction =
  | { type: 'seed'; leads: Lead[]; formLinks: FormLink[] }
  | { type: 'lead/add'; lead: Lead; event: ActivityEvent }
  | { type: 'lead/patch'; leadId: ID; patch: Partial<Lead>; event: ActivityEvent }
  | { type: 'form/add'; link: FormLink; event: ActivityEvent }
  | { type: 'form/toggle'; linkId: ID; event: ActivityEvent }
  | { type: 'evaluation/save'; override: EvaluationOverride; event: ActivityEvent }
  | { type: 'record'; event: ActivityEvent };

const EMPTY: WorkspaceState = {
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
  leads: Lead[];
  formLinks: FormLink[];
  overrides: Record<ID, EvaluationOverride>;
  /** Derived + recorded, newest first. */
  activity: ActivityEvent[];
  getLead: (id: ID) => Lead | undefined;

  addLead: (fields: Partial<Lead>) => Lead;
  /** Move a lead to a new stage, stamping the clock and writing the ledger row. */
  advanceLead: (leadId: ID, stage: LeadStage, note?: string) => void;
  bookTrial: (leadId: ID, date: ISODate, classId: ID | null) => void;
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
  const actorName = session.membership.displayName || session.email;

  // Seeding waits for the first fetch so trial leads can point at real classes.
  // Doing it in render rather than an effect keeps the very first paint of the
  // 폼 tab from flashing an empty state it is about to fill.
  if (!ws.seeded && !loading && state.classes.length > 0) {
    dispatch({
      type: 'seed',
      leads: seedLeads(academyId, state.classes.map((c) => c.id)),
      formLinks: seedFormLinks(academyId),
    });
  }

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
      return lead;
    },
    [academyId, make],
  );

  const advanceLead = useCallback(
    (leadId: ID, stage: LeadStage, note = '') => {
      const kind =
        stage === 'enrolled' ? 'lead.enrolled' : stage === 'lost' ? 'lead.lost' : 'lead.advanced';
      const lead = ws.leads.find((l) => l.id === leadId);

      dispatch({
        type: 'lead/patch',
        leadId,
        patch: {
          stage,
          stageChangedAt: new Date().toISOString(),
          ...(stage === 'lost' ? { lostReason: note } : {}),
          ...(note && stage !== 'lost' ? { memo: note } : {}),
        },
        event: make({
          kind,
          subjectType: 'lead',
          subjectId: leadId,
          subjectLabel: lead?.childName ?? '',
          summary: `${STAGE_META[stage].label}(으)로 이동`,
          detail: note || undefined,
        }),
      });
    },
    [make, ws.leads],
  );

  const bookTrial = useCallback(
    (leadId: ID, date: ISODate, classId: ID | null) => {
      const lead = ws.leads.find((l) => l.id === leadId);
      dispatch({
        type: 'lead/patch',
        leadId,
        patch: {
          stage: 'trial_booked',
          trialDate: date,
          trialClassId: classId,
          stageChangedAt: new Date().toISOString(),
        },
        event: make({
          kind: 'lead.trial_booked',
          subjectType: 'lead',
          subjectId: leadId,
          subjectLabel: lead?.childName ?? '',
          summary: `${date} 체험 수업 예약`,
        }),
      });
    },
    [make, ws.leads],
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
    },
    [make, ws.leads],
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
      return link;
    },
    [academyId, make],
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
    },
    [make, ws.formLinks],
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
        override: { studentId, scores, note, ratedBy: actorName, ratedAt: new Date().toISOString() },
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

  const activity = useMemo(
    () => mergeActivity(derived, ws.recorded),
    [derived, ws.recorded],
  );

  const getLead = useCallback((id: ID) => ws.leads.find((l) => l.id === id), [ws.leads]);

  const value = useMemo<WorkspaceValue>(
    () => ({
      leads: ws.leads,
      formLinks: ws.formLinks,
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
      ws.leads,
      ws.formLinks,
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
