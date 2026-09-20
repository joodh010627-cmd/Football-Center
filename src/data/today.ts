/**
 * What is happening on one day.
 *
 * The 클래스 and 일정 screens are the same question asked at two zoom levels —
 * "what do I do now" and "what does the week look like" — so they read the same
 * builder rather than each deriving a day from the raw tables. Anything that
 * disagreed between them would be the app contradicting itself about today.
 */

import type { AttendanceLog, Class, ID, ISODate, SessionPlan } from '@/types';
import type { Lead } from './crm';
import { trialsOn } from './crm';
import { meetsOn, planFor, studentsInClass } from './selectors';
import type { DataSlice } from './selectors';

/**
 * A session's state on the day it is held.
 *
 * Distinct from `ScheduleState` on the calendar, which answers a planning
 * question ("is this day designed yet"). This answers an operational one: what
 * is this coach supposed to do about it in the next hour. The two states that
 * only exist here — `now` and `needs_log` — are the whole reason for the split.
 */
export type SessionState =
  /** Not yet started. */
  | 'upcoming'
  /** Between start and end time, right now. */
  | 'now'
  /** Over, attendance recorded. Nothing left to do. */
  | 'done'
  /** Over, and nobody wrote down who was there. The one thing the home nags about. */
  | 'needs_log';

export interface DayEntry {
  cls: Class;
  plan: SessionPlan | null;
  state: SessionState;
  /** `HH:mm`. */
  startTime: string;
  endTime: string;
  /** Minutes from now until it starts. Negative once it has started. */
  minutesUntil: number;
  headcount: number;
  /** True when the class meets but no blocks have been chosen. */
  unplanned: boolean;
}

const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

export const fromMinutes = (total: number): string => {
  const wrapped = ((total % 1440) + 1440) % 1440;
  return `${`${Math.floor(wrapped / 60)}`.padStart(2, '0')}:${`${wrapped % 60}`.padStart(2, '0')}`;
};

/** Minutes since midnight, for "is it running right now". */
export const minutesNow = (now: Date = new Date()): number =>
  now.getHours() * 60 + now.getMinutes();

function stateOf(
  cls: Class,
  plan: SessionPlan | null,
  logs: AttendanceLog[],
  date: ISODate,
  today: ISODate,
  clock: number,
): SessionState {
  const logged =
    plan?.status === 'completed' || logs.some((l) => l.classId === cls.id && l.date === date);
  if (logged) return 'done';

  // A future day is never "needs_log" no matter what the wall clock says.
  if (date > today) return 'upcoming';

  const start = toMinutes(cls.schedule.startTime);
  const end = start + cls.schedule.durationMin;

  if (date < today) return 'needs_log';
  if (clock < start) return 'upcoming';
  if (clock < end) return 'now';
  return 'needs_log';
}

/**
 * Every class meeting on `date`, in the order the day runs.
 *
 * `coachId` narrows to one coach's own sessions; `null` means the whole centre,
 * which is what an owner sees. RLS has usually narrowed the rows already — this
 * is the lens, not the fence.
 */
export function buildDay(
  slice: Pick<DataSlice, 'classes' | 'sessionPlans' | 'attendanceLogs' | 'students'>,
  date: ISODate,
  today: ISODate,
  coachId: ID | null = null,
  clock = minutesNow(),
): DayEntry[] {
  return slice.classes
    .filter((cls) => (coachId ? cls.coachId === coachId : true))
    .filter((cls) => meetsOn(cls, date))
    .map((cls) => {
      const plan = planFor(slice.sessionPlans, cls.id, date);
      const start = toMinutes(cls.schedule.startTime);

      return {
        cls,
        plan,
        state: stateOf(cls, plan, slice.attendanceLogs, date, today, clock),
        startTime: cls.schedule.startTime,
        endTime: fromMinutes(start + cls.schedule.durationMin),
        minutesUntil: date === today ? start - clock : (date > today ? 1 : -1) * 24 * 60,
        headcount: studentsInClass(slice.students, cls.id).filter((s) => s.status !== 'inactive')
          .length,
        unplanned: !plan || plan.items.every((i) => !i.blockId),
      };
    })
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}

export interface DaySummary {
  total: number;
  done: number;
  upcoming: number;
  needsLog: number;
}

export function summarise(entries: DayEntry[]): DaySummary {
  return {
    total: entries.length,
    done: entries.filter((e) => e.state === 'done').length,
    // A session running right now is still ahead of you as far as the
    // counter is concerned — you have not finished with it.
    upcoming: entries.filter((e) => e.state === 'upcoming' || e.state === 'now').length,
    needsLog: entries.filter((e) => e.state === 'needs_log').length,
  };
}

/**
 * The one session to put in the hero card.
 *
 * Running now beats starting soon, and both beat an unlogged session from this
 * morning — but an unlogged session still wins over nothing, because a day with
 * only loose ends should open on the loose end.
 */
export function upNext(entries: DayEntry[]): DayEntry | null {
  return (
    entries.find((e) => e.state === 'now') ??
    entries.find((e) => e.state === 'upcoming') ??
    entries.find((e) => e.state === 'needs_log') ??
    null
  );
}

/** How long until it starts, in the words a person would use. */
export function countdown(entry: DayEntry): string {
  if (entry.state === 'now') return '진행 중';
  if (entry.state === 'done') return '완료';
  if (entry.state === 'needs_log') return '기록 대기';
  if (entry.minutesUntil >= 24 * 60) return '';
  if (entry.minutesUntil < 60) return `${Math.max(entry.minutesUntil, 1)}분 후 시작`;
  return `${Math.floor(entry.minutesUntil / 60)}시간 후 시작`;
}

// ---------------------------------------------------------------------------
// The whole day, classes and trials together
// ---------------------------------------------------------------------------

/**
 * A trial booked for this day.
 *
 * Trials sit on the same timeline as classes on purpose. A 체험 is the highest
 * stakes hour in the week — a parent deciding whether to hand over a year of
 * tuition — and keeping it on a separate CRM screen is how centres forget to
 * tell the coach a stranger is coming.
 */
export interface TrialEntry {
  lead: Lead;
  cls: Class | null;
  startTime: string;
}

export function trialsForDay(
  leads: Lead[],
  classes: Class[],
  date: ISODate,
): TrialEntry[] {
  const classMap = new Map(classes.map((c) => [c.id, c]));
  return trialsOn(leads, date)
    .map((lead) => {
      const cls = lead.trialClassId ? (classMap.get(lead.trialClassId) ?? null) : null;
      return { lead, cls, startTime: cls?.schedule.startTime ?? '--:--' };
    })
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}
