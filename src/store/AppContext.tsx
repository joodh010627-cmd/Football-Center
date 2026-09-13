/**
 * Tenant data store.
 *
 * The original prototype kept everything in `useReducer` and left a note that
 * the reducer bodies should become awaited client calls, with the local
 * mutation surviving as the optimistic update. That is exactly what happened:
 * every case below still computes the same next state, and the three cases that
 * represent real work (`builder/commit`, `attendance/submit`, `churn/resolve`)
 * now also get written to Postgres. No component changed.
 *
 * What the components *cannot* see is which rows arrived. A coach's session
 * gets their classes, their students and their logs, because that is all the
 * RLS policies return for `auth.uid()`. The owner-only maps (`billing`,
 * `finances`, `evaluations`) come back empty for a coach — not blanked by the
 * UI, never sent at all.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
} from 'react';
import type {
  ApprovalStatus,
  AttendanceLog,
  AttendanceStatus,
  BehaviorTag,
  ChurnSignal,
  Class,
  ClassFinance,
  Coach,
  CsAction,
  Curriculum,
  ID,
  ISODate,
  Session,
  SessionItem,
  SessionPlan,
  SessionTemplate,
  Student,
  TrainingBlock,
  TrainingCategory,
} from '@/types';
import { TODAY } from '@/data/dates';
import { buildChurnSignals, rescoreStudents } from '@/data/churn';
import type { DataSlice } from '@/data/selectors';
import { supabase, friendlyError } from '@/lib/supabase';
import { can } from '@/lib/permissions';
import { useSession } from '@/store/AuthContext';
import * as map from '@/data/mappers';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/** In-flight attendance edits for one class, before [제출] commits them. */
export interface AttendanceDraft {
  classId: ID;
  date: ISODate;
  entries: Record<ID, { status: AttendanceStatus; tags: string[] }>;
}

/**
 * A session being designed, for one class on one date.
 *
 * The date is part of the draft rather than implicitly "today". That is the
 * whole difference between a tool for running today's class and a tool for
 * planning a month: the builder is now reached by tapping a square on a
 * calendar, and it has to remember which square.
 */
export interface SessionDraft {
  classId: ID;
  date: ISODate;
  /** Ordered. Length and category order are the coach's to choose. */
  items: SessionItem[];
  /** The standard session this started from, if any. */
  templateId: ID | null;
  /** True once the coach has committed a composition and is filling blocks. */
  shaped: boolean;
}

export interface AppState {
  // --- Tables -----------------------------------------------------------
  students: Student[];
  classes: Class[];
  coaches: Coach[];
  trainingBlocks: TrainingBlock[];
  behaviorTags: BehaviorTag[];
  attendanceLogs: AttendanceLog[];
  sessionPlans: SessionPlan[];
  curricula: Curriculum[];
  sessionTemplates: SessionTemplate[];
  csActions: CsAction[];

  // --- Owner-only tables. Empty for a coach session. ---------------------
  billing: Record<ID, number>;
  finances: Record<ID, ClassFinance>;
  evaluations: Record<ID, number>;

  // --- Session identity -------------------------------------------------
  academyId: ID;
  /** The `Coach` row this login acts as. `null` for owners. */
  currentCoachId: ID | null;

  // --- Ephemeral UI state ------------------------------------------------
  /** Students the owner has already handled — hidden from the alert queue. */
  resolvedStudentIds: ID[];
  /** The session currently being assembled in the builder. */
  draft: SessionDraft | null;
  attendanceDraft: AttendanceDraft | null;
}

/** Everything the initial fetch returns, in one shot. */
export interface LoadedData {
  students: Student[];
  classes: Class[];
  coaches: Coach[];
  trainingBlocks: TrainingBlock[];
  behaviorTags: BehaviorTag[];
  attendanceLogs: AttendanceLog[];
  sessionPlans: SessionPlan[];
  curricula: Curriculum[];
  sessionTemplates: SessionTemplate[];
  csActions: CsAction[];
  billing: Record<ID, number>;
  finances: Record<ID, ClassFinance>;
  evaluations: Record<ID, number>;
}

export type AppAction =
  | { type: 'data/loaded'; data: LoadedData }
  // --- Session design ---------------------------------------------------
  | { type: 'builder/open'; classId: ID; date: ISODate }
  | { type: 'builder/shape'; categories: TrainingCategory[] }
  | { type: 'builder/applyTemplate'; templateId: ID }
  | { type: 'builder/setBlock'; index: number; blockId: ID | null }
  | { type: 'builder/setDuration'; index: number; durationMin: number | null }
  | { type: 'builder/addItem'; category: TrainingCategory }
  | { type: 'builder/removeItem'; index: number }
  | { type: 'builder/moveItem'; index: number; delta: -1 | 1 }
  | { type: 'builder/reshape' }
  | { type: 'builder/close' }
  | { type: 'plan/schedule' }
  | { type: 'plan/complete'; planId: ID }
  // --- Curriculum authoring ---------------------------------------------
  | { type: 'template/save'; template: SessionTemplate }
  | { type: 'template/review'; templateId: ID; status: ApprovalStatus; note: string }
  | { type: 'template/withdraw'; templateId: ID }
  | { type: 'block/propose'; block: TrainingBlock }
  | { type: 'block/review'; blockId: ID; status: ApprovalStatus }
  // --- Attendance -------------------------------------------------------
  | { type: 'attendance/start'; classId: ID; date: ISODate }
  | { type: 'attendance/setStatus'; studentId: ID; status: AttendanceStatus }
  | { type: 'attendance/toggleTag'; studentId: ID; tag: string }
  | { type: 'attendance/discard' }
  | { type: 'attendance/submit'; sessionPlanId?: ID }
  | { type: 'churn/resolve'; studentId: ID; note: string };

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

export function createInitialState(session: Session): AppState {
  return {
    students: [],
    classes: [],
    coaches: [],
    trainingBlocks: [],
    behaviorTags: [],
    attendanceLogs: [],
    sessionPlans: [],
    curricula: [],
    sessionTemplates: [],
    csActions: [],
    billing: {},
    finances: {},
    evaluations: {},
    academyId: session.membership.academyId,
    currentCoachId: session.membership.coachId,
    resolvedStudentIds: [],
    draft: null,
    attendanceDraft: null,
  };
}

/** The default shape a coach starts from — still the classic three, just no
 *  longer the only shape the data model can hold. */
export const DEFAULT_SHAPE: TrainingCategory[] = ['warmup', 'skill', 'game'];

const emptyItems = (categories: TrainingCategory[]): SessionItem[] =>
  categories.map((category) => ({ category, blockId: null, durationMin: null }));

/**
 * Ids are minted client-side so the optimistic row and the persisted row are
 * the same row. Generating them in Postgres would mean the local id is a lie
 * until the insert returns — and `attendance/submit` references the plan id it
 * was handed a moment earlier.
 */
const uid = (): ID =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;

/**
 * Is the draft still the standard session it claims to be?
 *
 * Swapping one block out makes the answer no, and the link has to drop — the
 * owner's adherence figure is only worth reading if "ran the standard session"
 * means the blocks were the standard session's blocks.
 */
function matchesTemplate(state: AppState, items: SessionItem[]): boolean {
  const template = state.sessionTemplates.find((t) => t.id === state.draft?.templateId);
  if (!template) return false;
  const chosen = items.map((i) => i.blockId).filter(Boolean);
  return (
    chosen.length === template.blockIds.length &&
    chosen.every((id, i) => id === template.blockIds[i])
  );
}

// ---------------------------------------------------------------------------
// Reducer — pure, local, and identical to the prototype's
// ---------------------------------------------------------------------------

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'data/loaded': {
      const { students, attendanceLogs } = action.data;
      return {
        ...state,
        ...action.data,
        // Stored score and status are a cache; the engine owns both. Recomputing
        // here means a row that was written weeks ago can't show a stale badge.
        // Classes come along because the score depends on how often each class
        // actually meets — a fortnight away means very different things at 주1회
        // and 주3회.
        students: rescoreStudents(students, attendanceLogs, TODAY, action.data.classes),
      };
    }

    // --- Session design --------------------------------------------------

    case 'builder/open': {
      // Reopening a day that already has a plan is editing, not starting over.
      // Anything else would quietly discard the session the coach registered.
      const existing = state.sessionPlans.find(
        (p) => p.classId === action.classId && p.date === action.date,
      );
      return {
        ...state,
        draft: {
          classId: action.classId,
          date: action.date,
          items: existing ? existing.items : emptyItems(DEFAULT_SHAPE),
          templateId: existing?.templateId ?? null,
          shaped: Boolean(existing),
        },
      };
    }

    case 'builder/shape': {
      if (!state.draft) return state;
      // Keep whatever blocks already sit on a matching category in the same
      // position, so nudging the shape doesn't empty the board.
      const previous = state.draft.items;
      const items = action.categories.map((category, i) => {
        const prev = previous[i];
        return prev && prev.category === category
          ? prev
          : { category, blockId: null, durationMin: null };
      });
      return { ...state, draft: { ...state.draft, items, shaped: true } };
    }

    case 'builder/reshape':
      return state.draft ? { ...state, draft: { ...state.draft, shaped: false } } : state;

    case 'builder/applyTemplate': {
      if (!state.draft) return state;
      const template = state.sessionTemplates.find((t) => t.id === action.templateId);
      if (!template) return state;
      const blockMap = new Map(state.trainingBlocks.map((b) => [b.id, b]));
      const items: SessionItem[] = template.blockIds.flatMap((blockId) => {
        const block = blockMap.get(blockId);
        // A template can outlive a block the owner retired. Dropping the item
        // is right: the alternative is a slot the coach cannot fill or clear.
        return block ? [{ category: block.category, blockId, durationMin: null }] : [];
      });
      return {
        ...state,
        draft: { ...state.draft, items, templateId: template.id, shaped: true },
      };
    }

    case 'builder/setBlock': {
      if (!state.draft) return state;
      const items = state.draft.items.map((item, i) =>
        i === action.index ? { ...item, blockId: action.blockId } : item,
      );
      // Diverging from the standard session means this is no longer that
      // session. Keeping the link would inflate the adherence metric.
      const templateId = matchesTemplate(state, items) ? state.draft.templateId : null;
      return { ...state, draft: { ...state.draft, items, templateId } };
    }

    case 'builder/setDuration': {
      if (!state.draft) return state;
      const items = state.draft.items.map((item, i) =>
        i === action.index ? { ...item, durationMin: action.durationMin } : item,
      );
      return { ...state, draft: { ...state.draft, items } };
    }

    case 'builder/addItem': {
      if (!state.draft) return state;
      return {
        ...state,
        draft: {
          ...state.draft,
          items: [
            ...state.draft.items,
            { category: action.category, blockId: null, durationMin: null },
          ],
          templateId: null,
        },
      };
    }

    case 'builder/removeItem': {
      if (!state.draft) return state;
      const items = state.draft.items.filter((_, i) => i !== action.index);
      return { ...state, draft: { ...state.draft, items, templateId: null } };
    }

    case 'builder/moveItem': {
      if (!state.draft) return state;
      const target = action.index + action.delta;
      if (target < 0 || target >= state.draft.items.length) return state;
      const items = [...state.draft.items];
      [items[action.index], items[target]] = [items[target], items[action.index]];
      return { ...state, draft: { ...state.draft, items, templateId: null } };
    }

    case 'builder/close':
      return { ...state, draft: null };

    case 'plan/schedule': {
      const draft = state.draft;
      if (!draft) return state;

      const previous = state.sessionPlans.find(
        (p) => p.classId === draft.classId && p.date === draft.date,
      );

      const plan: SessionPlan = {
        // Reuse the id when re-registering a day, so the unique (class, date)
        // index treats it as the same row and the attendance logs that point at
        // it keep pointing at it.
        id: previous?.id ?? uid(),
        academyId: state.academyId,
        classId: draft.classId,
        coachId: state.currentCoachId ?? previous?.coachId ?? '',
        date: draft.date,
        items: draft.items.filter((i) => i.blockId),
        templateId: draft.templateId,
        createdAt: previous?.createdAt ?? new Date().toISOString(),
        // A day that already ran stays completed; re-registering it is an edit
        // to the record of what happened, not a reopening.
        status: previous?.status === 'completed' ? 'completed' : 'scheduled',
      };

      // Usage counts are what turn a coach's history into a portfolio — and
      // what orders the library next time. Only count a day once.
      const usedIds = new Set(plan.items.map((i) => i.blockId as ID));
      const alreadyCounted = new Set(
        (previous?.items ?? []).map((i) => i.blockId).filter(Boolean) as ID[],
      );
      const trainingBlocks = state.trainingBlocks.map((b) =>
        usedIds.has(b.id) && !alreadyCounted.has(b.id)
          ? { ...b, usageCount: b.usageCount + 1 }
          : b,
      );

      const countTemplate = plan.templateId && plan.templateId !== previous?.templateId;
      const sessionTemplates = countTemplate
        ? state.sessionTemplates.map((t) =>
            t.id === plan.templateId ? { ...t, usageCount: t.usageCount + 1 } : t,
          )
        : state.sessionTemplates;

      return {
        ...state,
        sessionPlans: [
          plan,
          ...state.sessionPlans.filter(
            (p) => !(p.classId === draft.classId && p.date === draft.date),
          ),
        ],
        trainingBlocks,
        sessionTemplates,
        draft: null,
      };
    }

    case 'plan/complete':
      return {
        ...state,
        sessionPlans: state.sessionPlans.map((p) =>
          p.id === action.planId ? { ...p, status: 'completed' } : p,
        ),
      };

    // --- Curriculum authoring --------------------------------------------

    case 'template/save': {
      const exists = state.sessionTemplates.some((t) => t.id === action.template.id);
      return {
        ...state,
        sessionTemplates: exists
          ? state.sessionTemplates.map((t) =>
              t.id === action.template.id ? action.template : t,
            )
          : [...state.sessionTemplates, action.template],
      };
    }

    case 'template/review':
      return {
        ...state,
        sessionTemplates: state.sessionTemplates.map((t) =>
          t.id === action.templateId
            ? { ...t, status: action.status, reviewNote: action.note }
            : t,
        ),
      };

    case 'template/withdraw':
      return {
        ...state,
        sessionTemplates: state.sessionTemplates.filter((t) => t.id !== action.templateId),
      };

    case 'block/propose':
      return { ...state, trainingBlocks: [...state.trainingBlocks, action.block] };

    case 'block/review':
      return {
        ...state,
        trainingBlocks: state.trainingBlocks.map((b) =>
          b.id === action.blockId ? { ...b, status: action.status } : b,
        ),
      };

    // --- Attendance -------------------------------------------------------

    case 'attendance/start': {
      const roster = state.students.filter((s) => s.classId === action.classId);
      // Default everyone to present: the common case costs zero taps, and the
      // coach only touches the exceptions.
      const entries: AttendanceDraft['entries'] = {};
      for (const s of roster) entries[s.id] = { status: 'present', tags: [] };
      return {
        ...state,
        attendanceDraft: { classId: action.classId, date: action.date, entries },
      };
    }

    case 'attendance/setStatus': {
      const draft = state.attendanceDraft;
      if (!draft) return state;
      const prev = draft.entries[action.studentId] ?? { status: 'present', tags: [] };
      return {
        ...state,
        attendanceDraft: {
          ...draft,
          entries: {
            ...draft.entries,
            // Tags describe what happened on the pitch — meaningless for a
            // student who wasn't there, so drop them on a non-present status.
            [action.studentId]: {
              status: action.status,
              tags: action.status === 'present' ? prev.tags : [],
            },
          },
        },
      };
    }

    case 'attendance/toggleTag': {
      const draft = state.attendanceDraft;
      if (!draft) return state;
      const prev = draft.entries[action.studentId] ?? { status: 'present', tags: [] };
      const tags = prev.tags.includes(action.tag)
        ? prev.tags.filter((t) => t !== action.tag)
        : [...prev.tags, action.tag];
      return {
        ...state,
        attendanceDraft: {
          ...draft,
          entries: { ...draft.entries, [action.studentId]: { ...prev, tags } },
        },
      };
    }

    case 'attendance/discard':
      return { ...state, attendanceDraft: null };

    case 'attendance/submit': {
      const draft = state.attendanceDraft;
      if (!draft) return state;

      const newLogs: AttendanceLog[] = Object.entries(draft.entries).map(
        ([studentId, entry]) => ({
          id: uid(),
          academyId: state.academyId,
          studentId,
          classId: draft.classId,
          date: draft.date,
          status: entry.status,
          tags: entry.tags,
          coachComment: '',
          sessionPlanId: action.sessionPlanId,
          coachId: state.currentCoachId ?? undefined,
          loggedAt: new Date().toISOString(),
        }),
      );

      // Same-day re-submission overwrites rather than double-counts. The DB
      // agrees: attendance_logs is unique on (student_id, date).
      const kept = state.attendanceLogs.filter(
        (l) => !(l.classId === draft.classId && l.date === draft.date),
      );
      const attendanceLogs = [...newLogs, ...kept];

      // A present student resets their recency clock, and logging is itself a
      // parent-facing report — both feed straight back into the churn score.
      const students = state.students.map((s) => {
        const entry = draft.entries[s.id];
        if (!entry) return s;
        return {
          ...s,
          lastAttendanceDate: entry.status === 'present' ? draft.date : s.lastAttendanceDate,
          lastParentContactDate: draft.date,
        };
      });

      // The draft deliberately survives submission: the notification preview
      // opens on top of the roster, and clearing it here would unmount the
      // screen out from under the modal. `attendance/discard` ends the session.
      return {
        ...state,
        attendanceLogs,
        students: rescoreStudents(students, attendanceLogs, TODAY, state.classes),
      };
    }

    case 'churn/resolve': {
      const csAction: CsAction = {
        id: uid(),
        academyId: state.academyId,
        studentId: action.studentId,
        actedAt: new Date().toISOString(),
        actorId: '',
        note: action.note,
      };
      return {
        ...state,
        csActions: [csAction, ...state.csActions],
        resolvedStudentIds: state.resolvedStudentIds.includes(action.studentId)
          ? state.resolvedStudentIds
          : [...state.resolvedStudentIds, action.studentId],
        // Contact just happened — reflect it so the score decays honestly.
        students: state.students.map((s) =>
          s.id === action.studentId ? { ...s, lastParentContactDate: TODAY } : s,
        ),
      };
    }

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

/**
 * Attendance history is the one unbounded table here — 100 students times
 * every session they ever attended. The churn engine looks back 30 days and
 * the report views a season, so a 180-day window keeps the payload flat as an
 * academy's second and third year accumulate.
 */
const HISTORY_DAYS = 180;

async function fetchAll(session: Session): Promise<LoadedData> {
  const academyId = session.membership.academyId;
  const since = new Date();
  since.setDate(since.getDate() - HISTORY_DAYS);
  const sinceISO = since.toISOString().slice(0, 10);

  const seesFinance = can(session, 'finance:read');

  const table = (name: string) => supabase.from(name).select('*').eq('academy_id', academyId);

  const [
    students,
    classes,
    coaches,
    blocks,
    tags,
    logs,
    plans,
    curricula,
    templates,
    csActions,
    billing,
    finances,
    evaluations,
  ] = await Promise.all([
    table('students'),
    table('classes'),
    table('coaches'),
    table('training_blocks'),
    supabase.from('behavior_tags').select('*').eq('academy_id', academyId).order('sort_order'),
    supabase
      .from('attendance_logs')
      .select('*')
      .eq('academy_id', academyId)
      .gte('date', sinceISO),
    // Plans are fetched unbounded on purpose. They are the calendar, and a coach
    // paging back to last term must see what was run — one row per class per
    // session day is two orders of magnitude smaller than the attendance table.
    table('session_plans'),
    supabase.from('curricula').select('*').eq('academy_id', academyId).order('sort_order'),
    table('session_templates'),
    // Skipping these for a coach saves four round trips that RLS would answer
    // with zero rows anyway. The permission check is an optimisation here —
    // the guarantee is in the policies.
    seesFinance ? table('cs_actions') : empty(),
    seesFinance ? table('student_billing') : empty(),
    seesFinance ? table('class_finances') : empty(),
    seesFinance ? table('coach_evaluations') : empty(),
  ]);

  const failed = [students, classes, coaches, blocks, tags, logs, plans, curricula, templates].find(
    (r) => r.error,
  );
  if (failed?.error) throw failed.error;

  return {
    students: (students.data ?? []).map(map.toStudent),
    classes: (classes.data ?? []).map(map.toClass),
    coaches: (coaches.data ?? []).map(map.toCoach),
    trainingBlocks: (blocks.data ?? []).map(map.toTrainingBlock),
    behaviorTags: (tags.data ?? []).map(map.toBehaviorTag),
    attendanceLogs: (logs.data ?? []).map(map.toAttendanceLog),
    sessionPlans: (plans.data ?? []).map(map.toSessionPlan),
    curricula: (curricula.data ?? []).map(map.toCurriculum),
    sessionTemplates: (templates.data ?? []).map(map.toSessionTemplate),
    csActions: (csActions.data ?? []).map(map.toCsAction),
    billing: map.billingMap(billing.data ?? []),
    finances: map.financeMap(finances.data ?? []),
    evaluations: map.evaluationMap(evaluations.data ?? []),
  };
}

const empty = async () => ({ data: [] as Record<string, unknown>[], error: null });

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

/**
 * Write the action that just ran optimistically.
 *
 * Called after the reducer, with the state it produced, so the rows written are
 * literally the rows on screen. Throwing here surfaces a sync error and
 * triggers a refetch — the screen never silently disagrees with the database.
 */
async function persist(action: AppAction, next: AppState, session: Session): Promise<void> {
  switch (action.type) {
    case 'plan/schedule': {
      const plan = next.sessionPlans[0];
      // Upsert, not insert: re-registering a day edits the row the unique
      // (class_id, date) index already holds.
      const { error } = await supabase
        .from('session_plans')
        .upsert(map.fromSessionPlan(plan), { onConflict: 'class_id,date' });
      if (error) throw error;

      const usedIds = plan.items.map((i) => i.blockId).filter(Boolean) as ID[];
      if (usedIds.length > 0) {
        // Coaches have no write access to training_blocks; this RPC is the only
        // door, and it only opens for usage_count.
        const { error: rpcError } = await supabase.rpc('increment_block_usage', {
          p_block_ids: usedIds,
        });
        if (rpcError) throw rpcError;
      }

      if (plan.templateId) {
        const { error: rpcError } = await supabase.rpc('increment_template_usage', {
          p_template_id: plan.templateId,
        });
        if (rpcError) throw rpcError;
      }
      return;
    }

    case 'plan/complete': {
      const { error } = await supabase
        .from('session_plans')
        .update({ status: 'completed' })
        .eq('id', action.planId);
      if (error) throw error;
      return;
    }

    case 'template/save': {
      const row = map.fromSessionTemplate(action.template);
      const { error } = await supabase.from('session_templates').upsert(row);
      if (error) throw error;
      return;
    }

    case 'template/review': {
      const { error } = await supabase
        .from('session_templates')
        .update({ status: action.status, review_note: action.note })
        .eq('id', action.templateId);
      if (error) throw error;
      return;
    }

    case 'template/withdraw': {
      const { error } = await supabase
        .from('session_templates')
        .delete()
        .eq('id', action.templateId);
      if (error) throw error;
      return;
    }

    case 'block/propose': {
      const { error } = await supabase
        .from('training_blocks')
        .insert(map.fromTrainingBlock(action.block));
      if (error) throw error;
      return;
    }

    case 'block/review': {
      const { error } = await supabase
        .from('training_blocks')
        .update({ status: action.status })
        .eq('id', action.blockId);
      if (error) throw error;
      return;
    }

    case 'attendance/submit': {
      const draft = next.attendanceDraft;
      if (!draft) return;

      const rows = next.attendanceLogs
        .filter((l) => l.classId === draft.classId && l.date === draft.date)
        .map(map.fromAttendanceLog);

      // Re-recording a class overwrites the day rather than duplicating it.
      const { error } = await supabase
        .from('attendance_logs')
        .upsert(rows, { onConflict: 'student_id,date' });
      if (error) throw error;

      // Coaches have no update rights on `students` — deliberately, since a
      // row-level policy could not stop them editing a name or reassigning a
      // class. This RPC touches only the two date columns.
      const studentIds = Object.keys(draft.entries);
      const presentIds = studentIds.filter((id) => draft.entries[id].status === 'present');

      const { error: datesError } = await supabase.rpc('touch_attendance_dates', {
        p_student_ids: studentIds,
        p_present_ids: presentIds,
        p_date: draft.date,
      });
      if (datesError) throw datesError;
      return;
    }

    case 'churn/resolve': {
      const record = next.csActions[0];
      const { error } = await supabase.from('cs_actions').insert({
        id: record.id,
        academy_id: record.academyId,
        student_id: record.studentId,
        actor_id: session.userId,
        note: record.note,
      });
      if (error) throw error;

      const { error: studentError } = await supabase
        .from('students')
        .update({ last_parent_contact_date: TODAY })
        .eq('id', action.studentId);
      if (studentError) throw studentError;
      return;
    }

    default:
      // Everything else is draft state that lives and dies in the browser.
      return;
  }
}

const PERSISTED: ReadonlySet<AppAction['type']> = new Set([
  'plan/schedule',
  'plan/complete',
  'template/save',
  'template/review',
  'template/withdraw',
  'block/propose',
  'block/review',
  'attendance/submit',
  'churn/resolve',
] as const);

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface AppContextValue {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  /** Narrowed view passed to selectors. */
  slice: DataSlice;
  churnSignals: Map<ID, ChurnSignal>;
  /** True until the first fetch resolves. */
  loading: boolean;
  /** Set when loading or a write failed. */
  error: string | null;
  refresh: () => void;
  getStudent: (id: ID) => Student | undefined;
  getClass: (id: ID) => Class | undefined;
  getCoach: (id: ID) => Coach | undefined;
  getBlock: (id: ID) => TrainingBlock | undefined;
  getCurriculum: (id: ID) => Curriculum | undefined;
  getTemplate: (id: ID) => SessionTemplate | undefined;
  /** Block lookup as a map — what `sessionDuration` wants. */
  blockMap: Map<ID, TrainingBlock>;
  /** Tuition for a student. 0 in a coach session, where it was never fetched. */
  getFee: (id: ID) => number;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const session = useSession();
  const [state, rawDispatch] = useReducer(appReducer, session, createInitialState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  // `persist` needs the state the reducer just produced, which the dispatching
  // component doesn't have. This ref is how the wrapper reads it back.
  const stateRef = useRef(state);
  stateRef.current = state;

  const refresh = useCallback(() => setReloadToken((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    setLoading(true);

    fetchAll(session)
      .then((data) => {
        if (!alive) return;
        rawDispatch({ type: 'data/loaded', data });
        setError(null);
      })
      .catch((e) => {
        if (alive) setError(friendlyError(e, '데이터를 불러오지 못했습니다'));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [session, reloadToken]);

  /**
   * Same signature as `useReducer`'s dispatch, so components stayed untouched.
   * The write is fire-and-forget on purpose: a coach tapping [제출] should see
   * the roster clear immediately, not wait on a round trip in a school gym with
   * two bars of signal. If the write loses, the refetch corrects the screen.
   */
  const dispatch = useCallback<Dispatch<AppAction>>(
    (action) => {
      rawDispatch(action);
      if (!PERSISTED.has(action.type)) return;

      // Deferred so `stateRef` has the post-reducer state.
      queueMicrotask(() => {
        persist(action, stateRef.current, session).catch((e) => {
          setError(friendlyError(e, '저장에 실패했습니다. 화면을 새로고침합니다'));
          refresh();
        });
      });
    },
    [session, refresh],
  );

  const slice = useMemo<DataSlice>(
    () => ({
      students: state.students,
      classes: state.classes,
      coaches: state.coaches,
      attendanceLogs: state.attendanceLogs,
      trainingBlocks: state.trainingBlocks,
      sessionPlans: state.sessionPlans,
      curricula: state.curricula,
      sessionTemplates: state.sessionTemplates,
      resolvedStudentIds: state.resolvedStudentIds,
      billing: state.billing,
      finances: state.finances,
      evaluations: state.evaluations,
    }),
    [
      state.students,
      state.classes,
      state.coaches,
      state.attendanceLogs,
      state.trainingBlocks,
      state.sessionPlans,
      state.curricula,
      state.sessionTemplates,
      state.resolvedStudentIds,
      state.billing,
      state.finances,
      state.evaluations,
    ],
  );

  const churnSignals = useMemo(
    () => buildChurnSignals(state.students, state.attendanceLogs, TODAY, state.classes),
    [state.students, state.attendanceLogs],
  );

  const studentMap = useMemo(() => new Map(state.students.map((s) => [s.id, s])), [state.students]);
  const classMap = useMemo(() => new Map(state.classes.map((c) => [c.id, c])), [state.classes]);
  const coachMap = useMemo(() => new Map(state.coaches.map((c) => [c.id, c])), [state.coaches]);
  const blockMap = useMemo(
    () => new Map(state.trainingBlocks.map((b) => [b.id, b])),
    [state.trainingBlocks],
  );

  const curriculumMap = useMemo(
    () => new Map(state.curricula.map((c) => [c.id, c])),
    [state.curricula],
  );
  const templateMap = useMemo(
    () => new Map(state.sessionTemplates.map((t) => [t.id, t])),
    [state.sessionTemplates],
  );

  const getStudent = useCallback((id: ID) => studentMap.get(id), [studentMap]);
  const getClass = useCallback((id: ID) => classMap.get(id), [classMap]);
  const getCoach = useCallback((id: ID) => coachMap.get(id), [coachMap]);
  const getBlock = useCallback((id: ID) => blockMap.get(id), [blockMap]);
  const getCurriculum = useCallback((id: ID) => curriculumMap.get(id), [curriculumMap]);
  const getTemplate = useCallback((id: ID) => templateMap.get(id), [templateMap]);
  const getFee = useCallback((id: ID) => state.billing[id] ?? 0, [state.billing]);

  const value = useMemo<AppContextValue>(
    () => ({
      state,
      dispatch,
      slice,
      churnSignals,
      loading,
      error,
      refresh,
      getStudent,
      getClass,
      getCoach,
      getBlock,
      getCurriculum,
      getTemplate,
      blockMap,
      getFee,
    }),
    [
      state,
      dispatch,
      slice,
      churnSignals,
      loading,
      error,
      refresh,
      getStudent,
      getClass,
      getCoach,
      getBlock,
      getCurriculum,
      getTemplate,
      blockMap,
      getFee,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}
