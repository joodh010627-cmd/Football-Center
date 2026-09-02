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
