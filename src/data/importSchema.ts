/**
 * Canonical import schema — the machine-readable half of `docs/IMPORT-SPEC.md`.
 *
 * This file is data, not logic. The importer (step 2) reads it to auto-infer a
 * customer's spreadsheet headers; the only reason it lives in code rather than
 * JSON is so the field keys are typed against `Student` / `Class`.
 *
 * The synonym table is the point of the whole exercise: it is a multiple-choice
 * sheet we hand to the market. Every header it *fails* to match in a sales
 * meeting is a field-research result — write it down and add it here.
 */

import type { AgeGroup } from '@/types';

// ---------------------------------------------------------------------------
// Fields
// ---------------------------------------------------------------------------

/**
 * `required` blocks the import. Everything else is progressive enhancement —
 * four columns is deliberately the whole entry fee, because a demo dies the
 * moment an owner says "we don't have that one".
 */
export type FieldGrade = 'required' | 'recommended' | 'optional';

export type StudentFieldKey =
  | 'name'
  | 'className'
  | 'parentPhone'
  | 'monthlyFee'
  | 'enrolledAt'
  | 'birthDate'
  | 'ageGroup'
  | 'parentName'
  | 'lastAttendanceDate'
  | 'memo';

export type ClassFieldKey =
  | 'classTitle'
  | 'scheduleDays'
  | 'coachName'
  | 'capacity'
  | 'startTime'
  | 'durationMin'
  | 'venue'
  | 'monthlyCost';

export interface ImportField<K extends string> {
  key: K;
  /** Header text written in the template we ship. */
  label: string;
  grade: FieldGrade;
  type: 'text' | 'phone' | 'money' | 'date' | 'int' | 'enum' | 'csv';
}

export const STUDENT_FIELDS: ImportField<StudentFieldKey>[] = [
  { key: 'name', label: '이름', grade: 'required', type: 'text' },
  { key: 'className', label: '클래스', grade: 'required', type: 'text' },
  { key: 'parentPhone', label: '보호자연락처', grade: 'required', type: 'phone' },
  { key: 'monthlyFee', label: '월수강료', grade: 'required', type: 'money' },
  { key: 'enrolledAt', label: '등록일', grade: 'recommended', type: 'date' },
  { key: 'birthDate', label: '생년월일', grade: 'recommended', type: 'date' },
  { key: 'ageGroup', label: '연령대', grade: 'optional', type: 'enum' },
  { key: 'parentName', label: '보호자성명', grade: 'optional', type: 'text' },
  { key: 'lastAttendanceDate', label: '최근출석일', grade: 'optional', type: 'date' },
  { key: 'memo', label: '메모', grade: 'optional', type: 'text' },
];

export const CLASS_FIELDS: ImportField<ClassFieldKey>[] = [
  { key: 'classTitle', label: '클래스명', grade: 'required', type: 'text' },
  // Not cosmetic: the churn engine's "14 days" bar is meaningless without a
  // cadence to measure it against. See IMPORT-SPEC §3.
  { key: 'scheduleDays', label: '수업요일', grade: 'recommended', type: 'csv' },
  { key: 'coachName', label: '담당코치', grade: 'recommended', type: 'text' },
  { key: 'capacity', label: '정원', grade: 'recommended', type: 'int' },
  { key: 'startTime', label: '시작시간', grade: 'optional', type: 'text' },
  { key: 'durationMin', label: '수업시간(분)', grade: 'optional', type: 'int' },
  { key: 'venue', label: '장소', grade: 'optional', type: 'text' },
  { key: 'monthlyCost', label: '월운영비', grade: 'optional', type: 'money' },
];

// ---------------------------------------------------------------------------
// Synonyms — grows after every sales meeting
// ---------------------------------------------------------------------------

export const STUDENT_SYNONYMS: Record<StudentFieldKey, string[]> = {
  name: ['이름', '성명', '원생명', '학생명', '선수명', '아동명', '회원명'],
  className: ['클래스', '반', '반명', '클래스명', '소속', '소속반', '팀', '그룹', '요일반'],
  parentPhone: [
    '보호자연락처', '학부모연락처', '연락처', '전화번호', '휴대폰', '핸드폰',
    'hp', '보호자전화', '모연락처', '부연락처', '비상연락처',
  ],
  monthlyFee: ['월수강료', '수강료', '회비', '월회비', '교육비', '금액', '납부액', '월납입액'],
  enrolledAt: ['등록일', '가입일', '시작일', '입회일', '등록날짜', '최초등록일'],
  birthDate: ['생년월일', '생일', '출생일', '생년월'],
  // `학년` needs value conversion (초3 → age 9 → U9), not just a header match.
  ageGroup: ['연령대', '연령', '나이대', '카테고리', '학년'],
  parentName: ['보호자성명', '보호자명', '학부모명', '보호자', '부모님성함'],
  lastAttendanceDate: ['최근출석일', '최종출석일', '마지막출석'],
  memo: ['메모', '비고', '특이사항', '참고', '기타'],
};

export const CLASS_SYNONYMS: Record<ClassFieldKey, string[]> = {
  classTitle: ['클래스명', '클래스', '반', '반명', '팀명'],
  scheduleDays: ['수업요일', '요일', '수업일', '운영요일'],
  coachName: ['담당코치', '코치', '지도자', '강사', '담당자'],
  capacity: ['정원', '최대인원', '모집정원'],
  startTime: ['시작시간', '수업시간', '시간'],
  durationMin: ['수업시간(분)', '진행시간', '소요시간'],
  venue: ['장소', '구장', '운동장', '수업장소'],
  monthlyCost: ['월운영비', '운영비', '월비용', '지출'],
};

/**
 * Headers are compared after stripping everything a human might sprinkle in —
 * spaces, parens, dots, slashes — so "학부모 연락처" and "학부모(연락처)" collapse
 * onto the same key. `durationMin` keeps its parens in the label but matches
 * bare too, which is why normalisation runs on both sides.
 */
export function normalizeHeader(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[\s()[\]{}.,/\\_·:;'"-]/g, '')
    .trim();
}

/** Returns the canonical key for a spreadsheet header, or `null` to ask the user. */
export function matchHeader<K extends string>(
  raw: string,
  synonyms: Record<K, string[]>,
): K | null {
  const needle = normalizeHeader(raw);
  if (!needle) return null;
  for (const key of Object.keys(synonyms) as K[]) {
    if (synonyms[key].some((s) => normalizeHeader(s) === needle)) return key;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Payment grid
// ---------------------------------------------------------------------------

/**
 * Small shops keep payments as one column per month rather than one row per
 * payment. Read that shape rather than asking them to change it.
 *
 * NOTE: still a hypothesis — no real customer file has been seen yet.
 */
export const PAYMENT_HEADER_PATTERNS: RegExp[] = [
  /^(\d{4})[-./](\d{1,2})$/, //  2026-06 · 2026.06 · 2026/06
  /^(\d{2,4})년\s*(\d{1,2})월$/, //  26년 6월 · 2026년 6월
  /^'?(\d{2})\s*(\d{1,2})월$/, //  '26 6월
  /^(\d{1,2})월$/, //  6월  (year inferred from the file's context)
];

export const PAYMENT_PAID_TOKENS = ['o', '○', '●', 'v', '✓', '완납', '납부'];
export const PAYMENT_UNPAID_TOKENS = ['x', '✗', '미납'];

// ---------------------------------------------------------------------------
// Age group
// ---------------------------------------------------------------------------

/**
 * Default only. International U-numbering goes by birth *year*, and Korean
 * academies commonly stream by school grade instead — so an explicit `연령대`
 * column always wins over this, and per-tenant overrides land in
 * `academy_settings.age_groups` later.
 */
export const AGE_GROUP_BANDS: { maxAge: number; group: AgeGroup }[] = [
  { maxAge: 7, group: 'U7' },
  { maxAge: 9, group: 'U9' },
  { maxAge: 11, group: 'U11' },
  { maxAge: 13, group: 'U13' },
  { maxAge: Infinity, group: 'U15' },
];

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

/**
 * Resident registration numbers. We have no lawful basis to collect these, so a
 * file carrying one is rejected outright rather than silently stripped — the
 * owner should delete the column on their side and know that they did.
 */
export const REJECTED_HEADERS = ['주민번호', '주민등록번호', '주민', '주민등록'];

/** Sample rows shipped in the template, so we can offer to drop them on import. */
export const TEMPLATE_SAMPLE_NAMES = ['홍길동', '김민준', '이서연'];
export const TEMPLATE_SAMPLE_PHONE_PREFIX = '010-0000-000';

/**
 * Derived columns. Present in many customer sheets as hand-maintained cells;
 * we recompute all of them, so they are ignored on import — and saying so is
 * the demo's best line ("you don't have to fill these in any more").
 */
export const IGNORED_DERIVED_HEADERS = [
  '상태', '이탈위험도', '위험도', '출석률', '재등록률', '공헌이익', '마진율',
];
