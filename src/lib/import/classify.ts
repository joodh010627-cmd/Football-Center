/**
 * Layer 3 — decide what each column means.
 *
 * Two independent signals per (column, field) pair:
 *
 *   header  — the synonym table in `importSchema.ts`. Precise when it hits,
 *             useless on renamed, abbreviated, or missing headers.
 *   content — what the cells actually look like. Works on a headerless file
 *             and cannot be fooled by a column titled `비고` that holds phones.
 *
 * Neither alone is enough, so we score both and let them reinforce each other.
 * That combination is what makes "just hand us the file" a real claim rather
 * than a demo that only works on files we wrote ourselves.
 */

import {
  PAYMENT_HEADER_PATTERNS,
  STUDENT_SYNONYMS,
  matchHeader,
  normalizeHeader,
  type StudentFieldKey,
} from '@/data/importSchema';
import { cellText, isBlank, type CellValue } from './grid';
import type { DataRow, TableRegion } from './structure';
import {
  isKoreanName,
  isMobileLike,
  isNumericLike,
  isPhoneLike,
  parseAgeGroup,
  parseDate,
  parseMoney,
} from './patterns';

export interface ColumnProfile {
  index: number;
  header: string;
  values: CellValue[];
  /** Non-blank values as text — the basis for every content detector. */
  texts: string[];
  fillRatio: number;
  uniqueRatio: number;
}

export interface ColumnAssignment {
  index: number;
  header: string;
  field: StudentFieldKey | null;
  confidence: number;
  /** Why we think so, in the owner's language. Rendered next to the column. */
  basis: string;
  samples: string[];
  /** Set when the column is one cell of the month-by-month payment grid. */
  paymentMonth?: string;
}

interface Signal {
  score: number;
  reason: string;
}

const NONE: Signal = { score: 0, reason: '' };

/** Applied automatically and shown in green. */
export const CONFIDENT = 0.75;
/** Applied but flagged amber for a glance. */
export const PLAUSIBLE = 0.45;

// ---------------------------------------------------------------------------
// Profiling
// ---------------------------------------------------------------------------

export function profileColumns(table: TableRegion): ColumnProfile[] {
  const out: ColumnProfile[] = [];
  for (let c = table.colStart; c <= table.colEnd; c++) {
    const values = table.rows.map((r) => r.cells[c] ?? null);
    const texts = values.filter((v) => !isBlank(v)).map(cellText);
    out.push({
      index: c,
      header: table.headers[c] ?? '',
      values,
      texts,
      fillRatio: values.length ? texts.length / values.length : 0,
      uniqueRatio: texts.length ? new Set(texts).size / texts.length : 0,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Content detectors
// ---------------------------------------------------------------------------

const ratio = (texts: string[], pred: (t: string) => boolean): number =>
  texts.length ? texts.filter(pred).length / texts.length : 0;

const pct = (r: number) => `${Math.round(r * 100)}%`;

function dateStats(p: ColumnProfile, asOf: Date) {
  const dates = p.values.map(parseDate).filter((d): d is Date => d !== null);
  if (dates.length === 0) return null;
  const years = dates.map((d) => d.getUTCFullYear()).sort((a, b) => a - b);
  const ages = dates.map((d) => (asOf.getTime() - d.getTime()) / 86400000);
  return {
    coverage: dates.length / Math.max(1, p.texts.length),
    medianYear: years[Math.floor(years.length / 2)],
    medianDaysAgo: ages.sort((a, b) => a - b)[Math.floor(ages.length / 2)],
    allPast: dates.every((d) => d.getTime() <= asOf.getTime()),
  };
}

function makeDetectors(asOf: Date): Partial<Record<StudentFieldKey, (p: ColumnProfile) => Signal>> {
  const year = asOf.getUTCFullYear();

  return {
    parentPhone: (p) => {
      const mobile = ratio(p.texts, isMobileLike);
      const any = ratio(p.texts, isPhoneLike);
      if (mobile >= 0.6) return { score: Math.min(1, mobile + 0.1), reason: `휴대폰 번호 ${pct(mobile)}` };
      if (any >= 0.6) return { score: any * 0.8, reason: `전화번호 형식 ${pct(any)}` };
      return NONE;
    },

    monthlyFee: (p) => {
      const money = p.texts
        .map((t) => parseMoney(t))
        .filter((n): n is number => n !== null && n >= 10000 && n <= 1_000_000);
      const cover = money.length / Math.max(1, p.texts.length);
      if (cover < 0.6) return NONE;
      // Tuition repeats across a class and lands on round numbers; a one-off
      // amount column looks nothing like this.
      const round = money.filter((n) => n % 1000 === 0).length / money.length;
      const repeats = p.uniqueRatio < 0.4 ? 0.15 : 0;
      return {
        score: Math.min(1, cover * 0.75 + round * 0.2 + repeats),
        reason: `금액 ${pct(cover)}${p.uniqueRatio < 0.4 ? ' · 반복되는 값' : ''}`,
      };
    },

    name: (p) => {
      const korean = ratio(p.texts, isKoreanName);
      if (korean < 0.7) return NONE;
      // A roster's name column is near-unique; a class column is not.
      if (p.uniqueRatio < 0.5) return { score: 0.3, reason: `한글 이름 ${pct(korean)} (중복 많음)` };
      return { score: Math.min(1, korean * 0.85 + p.uniqueRatio * 0.15), reason: `한글 이름 ${pct(korean)}` };
    },

    parentName: (p) => {
      const korean = ratio(p.texts, isKoreanName);
      if (korean < 0.7 || p.uniqueRatio < 0.5) return NONE;
      // Indistinguishable from a student name by content alone — deliberately
      // weak so the header decides, and greedy assignment breaks the tie.
      return { score: korean * 0.45, reason: `한글 이름 ${pct(korean)}` };
    },

    className: (p) => {
      if (p.texts.length === 0) return NONE;
      const distinct = new Set(p.texts).size;
      const short = ratio(p.texts, (t) => t.length <= 20 && !isNumericLike(t));
      if (distinct < 2 || distinct > 40 || p.uniqueRatio > 0.5 || short < 0.8) return NONE;
      return {
        score: Math.min(1, 0.55 + (1 - p.uniqueRatio) * 0.4),
        reason: `${distinct}종이 반복됨`,
      };
    },

    ageGroup: (p) => {
      const r = ratio(p.texts, (t) => parseAgeGroup(t) !== null);
      return r >= 0.7 ? { score: r, reason: `연령/학년 표기 ${pct(r)}` } : NONE;
    },

    birthDate: (p) => {
      const s = dateStats(p, asOf);
      if (!s || s.coverage < 0.7 || !s.allPast) return NONE;
      // Youth players: born roughly 4–20 years ago. Enrolment dates cluster
      // far more recently, which is the only thing separating these two.
      const age = year - s.medianYear;
      if (age < 4 || age > 22) return NONE;
      return { score: Math.min(1, s.coverage * 0.9), reason: `생년 ${s.medianYear}년대` };
    },

    enrolledAt: (p) => {
      const s = dateStats(p, asOf);
      if (!s || s.coverage < 0.7 || !s.allPast) return NONE;
      const age = year - s.medianYear;
      if (age > 8) return NONE;
      return { score: Math.min(1, s.coverage * 0.85), reason: `최근 ${Math.max(0, age)}년 내 날짜` };
    },

    lastAttendanceDate: (p) => {
      const s = dateStats(p, asOf);
      if (!s || s.coverage < 0.7 || !s.allPast) return NONE;
      if (s.medianDaysAgo > 180) return NONE;
      return { score: Math.min(1, s.coverage * 0.7), reason: '최근 날짜' };
    },

    memo: (p) => {
      if (p.texts.length === 0) return NONE;
      const avg = p.texts.reduce((a, t) => a + t.length, 0) / p.texts.length;
      if (avg < 8 || p.fillRatio > 0.9) return NONE;
      return { score: Math.min(0.7, 0.3 + avg / 60), reason: '긴 자유 문장' };
    },
  };
}

// ---------------------------------------------------------------------------
// Header signal
// ---------------------------------------------------------------------------

function headerSignal(header: string): { field: StudentFieldKey; signal: Signal } | null {
  if (!header) return null;

  const exact = matchHeader(header, STUDENT_SYNONYMS);
  if (exact) return { field: exact, signal: { score: 1, reason: `제목 "${header}"` } };

  // `보호자연락처(주)` or `학생 이름 *` — the synonym is in there somewhere.
  const norm = normalizeHeader(header);
  for (const key of Object.keys(STUDENT_SYNONYMS) as StudentFieldKey[]) {
    for (const syn of STUDENT_SYNONYMS[key]) {
      const s = normalizeHeader(syn);
      if (s.length >= 2 && norm.includes(s)) {
        return { field: key, signal: { score: 0.65, reason: `제목 "${header}"에 "${syn}" 포함` } };
      }
    }
  }
  return null;
}

/** `2026-06` · `26년 6월` · `6월` → canonical `YYYY-MM`. */
export function matchPaymentMonth(header: string, fallbackYear: number): string | null {
  const t = header.trim();
  for (const re of PAYMENT_HEADER_PATTERNS) {
    const m = t.match(re);
    if (!m) continue;
    if (m.length === 3) {
      let y = parseInt(m[1], 10);
      if (y < 100) y += 2000;
      return `${y}-${String(parseInt(m[2], 10)).padStart(2, '0')}`;
    }
    return `${fallbackYear}-${String(parseInt(m[1], 10)).padStart(2, '0')}`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Assignment
// ---------------------------------------------------------------------------

/**
 * Header and content are combined so that agreement is worth more than either
 * alone, but a single strong signal still carries a column on its own.
 */
function combine(header: Signal, content: Signal): Signal {
  const hi = Math.max(header.score, content.score);
  const lo = Math.min(header.score, content.score);
  const score = Math.min(1, hi + lo * 0.25);
  const reasons = [header.reason, content.reason].filter(Boolean);
  return { score, reason: reasons.join(' · ') };
}

export function classifyColumns(
  table: TableRegion,
  asOf: Date = new Date(),
): ColumnAssignment[] {
  const profiles = profileColumns(table);
  const detectors = makeDetectors(asOf);
  const fallbackYear = asOf.getUTCFullYear();

  const assignments: ColumnAssignment[] = profiles.map((p) => ({
    index: p.index,
    header: p.header,
    field: null,
    confidence: 0,
    basis: '',
    samples: p.texts.slice(0, 3),
  }));

  // --- Payment grid comes first: those columns are out of the running -------
  const open: number[] = [];
  profiles.forEach((p, i) => {
    const month = p.header ? matchPaymentMonth(p.header, fallbackYear) : null;
    if (month) {
      assignments[i] = {
        ...assignments[i],
        field: null,
        paymentMonth: month,
        confidence: 0.9,
        basis: `${month} 납부 현황`,
      };
    } else {
      open.push(i);
    }
  });

  // --- Score every remaining (column, field) pair ---------------------------
  const fields = Object.keys(STUDENT_SYNONYMS) as StudentFieldKey[];
  const scored: { col: number; field: StudentFieldKey; signal: Signal }[] = [];

  for (const i of open) {
    const p = profiles[i];
    const hdr = headerSignal(p.header);
    for (const field of fields) {
      const header = hdr && hdr.field === field ? hdr.signal : NONE;
      const content = detectors[field]?.(p) ?? NONE;
      if (header.score === 0 && content.score === 0) continue;
      scored.push({ col: i, field, signal: combine(header, content) });
    }
  }

  // --- Greedy one-to-one matching, strongest pair first ---------------------
  scored.sort((a, b) => b.signal.score - a.signal.score);
  const takenCols = new Set<number>();
  const takenFields = new Set<StudentFieldKey>();

  for (const { col, field, signal } of scored) {
    if (signal.score < PLAUSIBLE) break;
    if (takenCols.has(col) || takenFields.has(field)) continue;
    takenCols.add(col);
    takenFields.add(field);
    assignments[col] = {
      ...assignments[col],
      field,
      confidence: signal.score,
      basis: signal.reason,
    };
  }

  return assignments;
}

/** Fields still unclaimed — drives the "we need to ask" branch of the UI. */
export function missingFields(
  assignments: ColumnAssignment[],
  required: StudentFieldKey[],
): StudentFieldKey[] {
  const have = new Set(assignments.map((a) => a.field).filter(Boolean));
  return required.filter((f) => !have.has(f));
}

export function paymentColumns(assignments: ColumnAssignment[]): ColumnAssignment[] {
  return assignments.filter((a) => a.paymentMonth);
}

export type { DataRow };
