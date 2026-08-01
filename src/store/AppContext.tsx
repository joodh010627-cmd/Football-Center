/**
 * Single source of truth for the prototype.
 *
 * The reducer only ever performs pure, local table mutations — the same shape
 * a Supabase `insert`/`update` would return. To go live, replace the dispatch
 * bodies with awaited client calls and keep the reducer as the optimistic
 * update; no component needs to change.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react';
import type {
  AttendanceLog,
  AttendanceStatus,
  ChurnSignal,
  Class,
  Coach,
  CsAction,
  ID,
  ISODate,
  SessionPlan,
  SessionSlots,
  Student,
  TrainingBlock,
  TrainingCategory,
} from '@/types';
import {
  CURRENT_COACH_ID,
  OWNER_ID,
  TODAY,
  attendanceLogs as seedLogs,
  classes as seedClasses,
  coaches as seedCoaches,
  csActions as seedCsActions,
  sessionPlans as seedPlans,
  students as seedStudents,
  trainingBlocks as seedBlocks,
} from '@/data/mockData';
import { buildChurnSignals, rescoreStudents } from '@/data/churn';
import type { DataSlice } from '@/data/selectors';

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
  attendanceLogs: AttendanceLog[];
  sessionPlans: SessionPlan[];
  csActions: CsAction[];

  // --- Session identity -------------------------------------------------
  currentCoachId: ID;

  // --- Ephemeral UI state ------------------------------------------------
  /** Students the owner has already handled — hidden from the alert queue. */
  resolvedStudentIds: ID[];
  /** The session currently being assembled in the builder. */
  draftSlots: SessionSlots;
  draftPlanClassId: ID | null;
  attendanceDraft: AttendanceDraft | null;
}

export type AppAction =
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

export function createInitialState(): AppState {
  // Seed students carry placeholder score/status — the engine owns both.
  const scored = rescoreStudents(seedStudents, seedLogs);

  return {
    students: scored,
    classes: seedClasses,
    coaches: seedCoaches,
    trainingBlocks: seedBlocks,
    attendanceLogs: seedLogs,
    sessionPlans: seedPlans,
    csActions: seedCsActions,
    currentCoachId: CURRENT_COACH_ID,
    resolvedStudentIds: [],
    draftSlots: EMPTY_SLOTS,
    draftPlanClassId: null,
    attendanceDraft: null,
  };
}

let idSeq = 0;
const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(idSeq++).toString(36)}`;

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
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
        id: uid('plan'),
        classId: action.classId,
        coachId: state.currentCoachId,
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
          id: uid('log'),
          studentId,
          classId: draft.classId,
          date: draft.date,
          status: entry.status,
          tags: entry.tags,
          coachComment: '',
          sessionPlanId: action.sessionPlanId,
          coachId: state.currentCoachId,
          loggedAt: new Date().toISOString(),
        }),
      );

      // Same-day re-submission overwrites rather than double-counts.
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
        students: rescoreStudents(students, attendanceLogs),
      };
    }

    case 'churn/resolve': {
      const csAction: CsAction = {
        id: uid('cs'),
        studentId: action.studentId,
        actedAt: new Date().toISOString(),
        actorId: OWNER_ID,
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
// Context
// ---------------------------------------------------------------------------

interface AppContextValue {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  /** Narrowed view passed to selectors. */
  slice: DataSlice;
  churnSignals: Map<ID, ChurnSignal>;
  getStudent: (id: ID) => Student | undefined;
  getClass: (id: ID) => Class | undefined;
  getCoach: (id: ID) => Coach | undefined;
  getBlock: (id: ID) => TrainingBlock | undefined;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, undefined, createInitialState);

  const slice = useMemo<DataSlice>(
    () => ({
      students: state.students,
      classes: state.classes,
      coaches: state.coaches,
      attendanceLogs: state.attendanceLogs,
      trainingBlocks: state.trainingBlocks,
      sessionPlans: state.sessionPlans,
      resolvedStudentIds: state.resolvedStudentIds,
    }),
    [
      state.students,
      state.classes,
      state.coaches,
      state.attendanceLogs,
      state.trainingBlocks,
      state.sessionPlans,
      state.resolvedStudentIds,
    ],
  );

  const churnSignals = useMemo(
    () => buildChurnSignals(state.students, state.attendanceLogs),
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

  const value = useMemo<AppContextValue>(
    () => ({ state, dispatch, slice, churnSignals, getStudent, getClass, getCoach, getBlock }),
    [state, slice, churnSignals, getStudent, getClass, getCoach, getBlock],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}
