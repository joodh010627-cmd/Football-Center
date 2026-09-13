/**
 * Date helpers, split out of `mockData.ts`.
 *
 * These used to live alongside the demo dataset, which was fine while the
 * dataset *was* the app. Now that rows come from Supabase and `mockData.ts` is
 * seed-only, importing it at runtime would pull 100 students and eight weeks of
 * generated attendance into the production bundle. Everything that only needs
 * a date lives here instead.
 */

import type { ISODate } from '@/types';

const NOW = new Date();

export function toISODate(d: Date): ISODate {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function daysAgo(n: number): ISODate {
  const d = new Date(NOW);
  d.setDate(d.getDate() - n);
  return toISODate(d);
}

/**
 * Local time, deliberately — `toISOString()` is UTC and would report yesterday
 * for a KST evening session, filing the whole class's attendance on the wrong
 * date.
 */
export const TODAY: ISODate = toISODate(NOW);

/** Whole days between two ISO dates (a − b). */
export function diffDays(a: ISODate, b: ISODate): number {
  const ms = new Date(`${a}T00:00:00`).getTime() - new Date(`${b}T00:00:00`).getTime();
  return Math.round(ms / 86_400_000);
}

export function addDays(iso: ISODate, n: number): ISODate {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

// ---------------------------------------------------------------------------
// Month grid — the coach calendar
// ---------------------------------------------------------------------------

/**
 * A month the calendar is looking at. Kept as `{ year, month }` with a 0-based
 * month rather than a `Date`, because a `Date` pinned to the 1st still carries a
 * time and a day-of-month that the next `setMonth` can overflow (31 Jan + 1
 * month = 3 Mar). Two integers cannot drift.
 */
export interface YearMonth {
  year: number;
  /** 0 = January, matching `Date.getMonth()`. */
  month: number;
}

export const monthOf = (iso: ISODate): YearMonth => {
  const d = new Date(`${iso}T00:00:00`);
  return { year: d.getFullYear(), month: d.getMonth() };
};

export const THIS_MONTH: YearMonth = monthOf(TODAY);

export function shiftMonth({ year, month }: YearMonth, delta: number): YearMonth {
  const total = year * 12 + month + delta;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}

export const monthLabel = ({ year, month }: YearMonth): string => `${year}년 ${month + 1}월`;

export const inMonth = (iso: ISODate, ym: YearMonth): boolean => {
  const d = new Date(`${iso}T00:00:00`);
  return d.getFullYear() === ym.year && d.getMonth() === ym.month;
};

/**
 * Six weeks of dates covering the month, Sunday-first, including the leading and
 * trailing days that belong to the neighbouring months.
 *
 * Always 42 cells, never 35: a grid that changes height between months makes the
 * controls under it jump when you page through, which is exactly the moment a
 * coach is aiming at [다음 달].
 */
export function monthGrid(ym: YearMonth): ISODate[] {
  const first = new Date(ym.year, ym.month, 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());

  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return toISODate(d);
  });
}

/** Status labels, shared by the roster table and the student detail modal. */
export const STUDENT_STATUS_LABEL = {
  active: '정상',
  at_risk: '이탈 위험',
  inactive: '휴원',
} as const;

export const TAG_DIMENSION_LABEL = {
  skill: '기술',
  attitude: '태도',
  teamwork: '팀워크',
  physical: '피지컬',
  caution: '주의',
} as const;
