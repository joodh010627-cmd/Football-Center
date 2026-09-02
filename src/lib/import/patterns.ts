/**
 * Low-level value predicates and parsers.
 *
 * These are the whole basis of the claim "hand us any file". Header names are
 * an unreliable signal — they get renamed, abbreviated, merged, or omitted — so
 * the classifier leans on what the cells *contain*. A column that is 80%
 * `010-xxxx-xxxx` is a phone number no matter what sits above it.
 *
 * Kept separate from `classify.ts` so `structure.ts` can use them too without
 * a cycle.
 */

import type { CellValue } from './grid';
import { cellText } from './grid';
import { AGE_GROUP_BANDS } from '@/data/importSchema';
import type { AgeGroup } from '@/types';

// ---------------------------------------------------------------------------
// Phone
// ---------------------------------------------------------------------------

/** Korean mobile/landline, tolerating spaces, dots, dashes and a +82 prefix. */
export function parsePhone(raw: string): string | null {
  let s = raw.trim().replace(/^\+?82[-.\s]?/, '0');
  s = s.replace(/[^\d]/g, '');
  if (s.length < 9 || s.length > 11) return null;
  if (!s.startsWith('0')) {
    // Excel eats the leading zero when a phone column is stored as a number.
    if (s.length === 9 || s.length === 10) s = '0' + s;
    else return null;
  }
  if (s.length === 11) return `${s.slice(0, 3)}-${s.slice(3, 7)}-${s.slice(7)}`;
  if (s.length === 10) {
    return s.startsWith('02')
      ? `${s.slice(0, 2)}-${s.slice(2, 6)}-${s.slice(6)}`
      : `${s.slice(0, 3)}-${s.slice(3, 6)}-${s.slice(6)}`;
  }
  return `${s.slice(0, 2)}-${s.slice(2, 5)}-${s.slice(5)}`;
}

export const isPhoneLike = (t: string): boolean => parsePhone(t) !== null;

/** Mobile specifically — a stronger signal than a generic 9-11 digit run. */
export function isMobileLike(t: string): boolean {
  const p = parsePhone(t);
  return p !== null && p.startsWith('01');
}

// ---------------------------------------------------------------------------
// Money / numbers
// ---------------------------------------------------------------------------

/** Handles `150,000` · `150000원` · `15만원` · `15만`. */
export function parseMoney(raw: string | number): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? Math.round(raw) : null;
  const s = raw.trim().replace(/[,\s]/g, '');
  if (s === '') return null;

  const man = s.match(/^(\d+(?:\.\d+)?)만원?$/);
  if (man) return Math.round(parseFloat(man[1]) * 10000);

  const plain = s.match(/^(\d+(?:\.\d+)?)원?$/);
  if (plain) return Math.round(parseFloat(plain[1]));

  return null;
}

export const isNumericLike = (t: string): boolean =>
  /^-?[\d,]+(\.\d+)?$/.test(t.trim()) && /\d/.test(t);

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

/** `2025-03-04` · `2025.3.4` · `2025/3/4` · `25.3.4` · `2025년 3월 4일`. */
export function parseDate(value: CellValue): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  // Excel serial dates that came through as raw numbers.
  if (typeof value === 'number') {
    if (value > 20000 && value < 60000) {
      const ms = Math.round((value - 25569) * 86400 * 1000);
      const d = new Date(ms);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    return null;
  }

  const t = cellText(value);
  if (!t) return null;

  const m =
    t.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/) ??
    t.match(/^(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일$/);
  if (m) return makeDate(+m[1], +m[2], +m[3]);

  const short = t.match(/^(\d{2})[-./](\d{1,2})[-./](\d{1,2})$/);
  if (short) {
    const yy = +short[1];
    return makeDate(yy > 50 ? 1900 + yy : 2000 + yy, +short[2], +short[3]);
  }
  return null;
}

function makeDate(y: number, m: number, d: number): Date | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date;
}

export const isDateLike = (v: CellValue): boolean => parseDate(v) !== null;

export const toISODate = (d: Date): string => d.toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// Names / labels
// ---------------------------------------------------------------------------

/** Korean personal name. Deliberately narrow — long strings are memos. */
export const isKoreanName = (t: string): boolean => /^[가-힣]{2,5}$/.test(t.trim());

/** Roll-up rows an owner leaves at the bottom of a roster. */
export const isTotalLabel = (t: string): boolean =>
  /^(합계|총계|소계|계|총원|누계|total|sum)\s*$/i.test(t.trim());

// ---------------------------------------------------------------------------
// Age group
// ---------------------------------------------------------------------------

const AGE_GROUP_TOKENS: AgeGroup[] = ['U7', 'U9', 'U11', 'U13', 'U15'];

export function parseAgeGroup(t: string): AgeGroup | null {
  const s = t.trim().toUpperCase().replace(/[\s-]/g, '');
  const direct = AGE_GROUP_TOKENS.find((g) => g === s);
  if (direct) return direct;

  // `초3` / `초등3` / `3학년` — grade streaming is common in Korean academies.
  const grade = s.match(/^(?:초등?)?(\d)(?:학년)?$/);
  if (grade) return ageToGroup(+grade[1] + 6);
  return null;
}

export function ageToGroup(age: number): AgeGroup {
  for (const band of AGE_GROUP_BANDS) if (age <= band.maxAge) return band.group;
  return 'U15';
}

/** Korean 만 나이 at a reference date. */
export function ageAt(birth: Date, asOf: Date): number {
  let age = asOf.getUTCFullYear() - birth.getUTCFullYear();
  const before =
    asOf.getUTCMonth() < birth.getUTCMonth() ||
    (asOf.getUTCMonth() === birth.getUTCMonth() && asOf.getUTCDate() < birth.getUTCDate());
  if (before) age--;
  return age;
}

// ---------------------------------------------------------------------------
// Weekdays
// ---------------------------------------------------------------------------

const WEEKDAY_CHARS = ['일', '월', '화', '수', '목', '금', '토'];

/** `월,수,금` · `월수금` · `화/목` → `[1,3,5]` (0 = Sunday, matches Date.getDay). */
export function parseWeekdays(t: string): number[] {
  const found = new Set<number>();
  for (const ch of t) {
    const i = WEEKDAY_CHARS.indexOf(ch);
    if (i >= 0) found.add(i);
  }
  return [...found].sort((a, b) => a - b);
}
