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
  AttendanceLog,
  AttendanceStatus,
  BehaviorTag,
  ChurnSignal,
  Class,
  ClassFinance,
  Coach,
  CsAction,
  ID,
  ISODate,
  Session,
  SessionPlan,
  SessionSlots,
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

export interface AppState {
  // --- Tables -----------------------------------------------------------
  students: Student[];
  classes: Class[];
  coaches: Coach[];
  trainingBlocks: TrainingBlock[];
  behaviorTags: BehaviorTag[];
  attendanceLogs: AttendanceLog[];
  sessionPlans: SessionPlan[];
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
  draftSlots: SessionSlots;
  draftPlanClassId: ID | null;
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
  csActions: CsAction[];
  billing: Record<ID, number>;
  finances: Record<ID, ClassFinance>;
  evaluations: Record<ID, number>;
}

export type AppAction =
  | { type: 'data/loaded'; data: LoadedData }
  | { type: 'builder/selectClass'; classId: ID }
  | { type: 'builder/setSlot'; category: TrainingCategory; blockId: ID | null }
  | { type: 'builder/clear' }
  | { type: 'builder/commit'; classId: ID; date: ISODate }
  | { type: 'attendance/start'; classId: ID; date: ISODate }
  | { type: 'attendance/setStatus'; studentId: ID; status: AttendanceStatus }
  | { type: 'attendance/toggleTag'; studentId: ID; tag: string }
  | { type: 'attendance/discard' }
  | { type: 'attendance/submit'; sessionPlanId?: ID }
  | { type: 'churn/resolve'; studentId: ID; note: string };

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const EMPTY_SLOTS: SessionSlots = { warmup: null, skill: null, game: null };

export function createInitialState(session: Session): AppState {
  return {
    students: [],
    classes: [],
    coaches: [],
    trainingBlocks: [],
    behaviorTags: [],
    attendanceLogs: [],
    sessionPlans: [],
    csActions: [],
    billing: {},
    finances: {},
    evaluations: {},
    academyId: session.membership.academyId,
    currentCoachId: session.membership.coachId,
    resolvedStudentIds: [],
    draftSlots: EMPTY_SLOTS,
    draftPlanClassId: null,
    attendanceDraft: null,
  };
}

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

    case 'builder/selectClass':
      return { ...state, draftPlanClassId: action.classId };

    case 'builder/setSlot':
      return {
        ...state,
        draftSlots: { ...state.draftSlots, [action.category]: action.blockId },
      };

    case 'builder/clear':
      return { ...state, draftSlots: EMPTY_SLOTS };

    case 'builder/commit': {
      const plan: SessionPlan = {
        id: uid(),
        academyId: state.academyId,
        classId: action.classId,
        coachId: state.currentCoachId ?? '',
        date: action.date,
        slots: state.draftSlots,
        createdAt: new Date().toISOString(),
        status: 'ready',
      };

      // Usage counts are what turn a coach's history into a portfolio.
      const usedIds = Object.values(state.draftSlots).filter(Boolean) as ID[];
      const trainingBlocks = state.trainingBlocks.map((b) =>
        usedIds.includes(b.id) ? { ...b, usageCount: b.usageCount + 1 } : b,
      );

      return {
        ...state,
        sessionPlans: [plan, ...state.sessionPlans],
        trainingBlocks,
        draftSlots: EMPTY_SLOTS,
      };
    }

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
    table('session_plans'),
    // Skipping these for a coach saves four round trips that RLS would answer
    // with zero rows anyway. The permission check is an optimisation here —
    // the guarantee is in the policies.
    seesFinance ? table('cs_actions') : empty(),
    seesFinance ? table('student_billing') : empty(),
    seesFinance ? table('class_finances') : empty(),
    seesFinance ? table('coach_evaluations') : empty(),
  ]);

  const failed = [students, classes, coaches, blocks, tags, logs, plans].find((r) => r.error);
  if (failed?.error) throw failed.error;

  return {
    students: (students.data ?? []).map(map.toStudent),
    classes: (classes.data ?? []).map(map.toClass),
    coaches: (coaches.data ?? []).map(map.toCoach),
    trainingBlocks: (blocks.data ?? []).map(map.toTrainingBlock),
    behaviorTags: (tags.data ?? []).map(map.toBehaviorTag),
    attendanceLogs: (logs.data ?? []).map(map.toAttendanceLog),
    sessionPlans: (plans.data ?? []).map(map.toSessionPlan),
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
    case 'builder/commit': {
      const plan = next.sessionPlans[0];
      const { error } = await supabase.from('session_plans').insert(map.fromSessionPlan(plan));
      if (error) throw error;

      const usedIds = Object.values(plan.slots).filter(Boolean) as ID[];
      if (usedIds.length > 0) {
        // Coaches have no write access to training_blocks; this RPC is the only
        // door, and it only opens for usage_count.
        const { error: rpcError } = await supabase.rpc('increment_block_usage', {
          p_block_ids: usedIds,
        });
        if (rpcError) throw rpcError;
      }
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
  'builder/commit',
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

  const getStudent = useCallback((id: ID) => studentMap.get(id), [studentMap]);
  const getClass = useCallback((id: ID) => classMap.get(id), [classMap]);
  const getCoach = useCallback((id: ID) => coachMap.get(id), [coachMap]);
  const getBlock = useCallback((id: ID) => blockMap.get(id), [blockMap]);
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
