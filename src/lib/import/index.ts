/**
 * The pipeline. One entry point per input kind, one result shape for the UI.
 *
 *   file / clipboard → Grid[] → TableRegion → ColumnAssignment[] → ImportedStudent[]
 *
 * Nothing here talks to React or to the store; the demo screen renders whatever
 * comes back and the reducer takes it from there.
 */

import {
  IGNORED_DERIVED_HEADERS,
  REJECTED_HEADERS,
  normalizeHeader,
  type StudentFieldKey,
} from '@/data/importSchema';
import { cellText, readDelimitedText, readWorkbook, type Grid } from './grid';
import { detectTable, type TableRegion } from './structure';
import { classifyColumns, missingFields, type ColumnAssignment } from './classify';
import { UNCLASSIFIED, extractStudents, type ImportIssue, type ImportedStudent } from './extract';
import { parseWeekdays } from './patterns';

export * from './grid';
export * from './structure';
export * from './classify';
export * from './extract';
export * from './patterns';

/** Import is blocked until these are mapped. Deliberately short — see spec §0. */
export const REQUIRED_FIELDS: StudentFieldKey[] = [
  'name',
  'className',
  'parentPhone',
  'monthlyFee',
];

export interface ImportSheetResult {
  table: TableRegion;
  assignments: ColumnAssignment[];
  students: ImportedStudent[];
  missing: StudentFieldKey[];
}

export interface DerivedClass {
  title: string;
  headcount: number;
  monthlyRevenue: number;
  scheduleDays: number[];
}

export interface ImportResult {
  sheets: ImportSheetResult[];
  students: ImportedStudent[];
  classes: DerivedClass[];
  issues: ImportIssue[];
  notes: string[];
  /** Set when the whole file is refused — currently only for 주민등록번호. */
  rejected: string | null;
}

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

/**
 * We have no lawful basis to hold a resident registration number, so a file
 * carrying one is refused outright rather than silently stripped — the owner
 * should delete the column on their side and know that they did.
 */
function findRejectedHeader(grids: Grid[]): string | null {
  for (const grid of grids) {
    for (const row of grid.rows.slice(0, 25)) {
      for (const c of row) {
        const norm = normalizeHeader(cellText(c));
        if (!norm) continue;
        if (REJECTED_HEADERS.some((h) => norm.includes(normalizeHeader(h)))) return cellText(c);
      }
    }
  }
  return null;
}

const isIgnoredHeader = (header: string): boolean => {
  const norm = normalizeHeader(header);
  return norm.length > 0 && IGNORED_DERIVED_HEADERS.some((h) => norm === normalizeHeader(h));
};

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

export function runImport(grids: Grid[], asOf: Date = new Date()): ImportResult {
  const rejected = findRejectedHeader(grids);
  if (rejected) {
    return {
      sheets: [],
      students: [],
      classes: [],
      notes: [],
      issues: [
        {
          level: 'error',
          message:
            `"${rejected}" 열이 있습니다. 주민등록번호는 수집하지 않습니다 — ` +
            '해당 열을 삭제하고 다시 올려주세요. 나이가 필요하면 생년월일만으로 충분합니다.',
        },
      ],
      rejected,
    };
  }

  const sheets: ImportSheetResult[] = [];
  const issues: ImportIssue[] = [];
  const notes: string[] = [];
  let sampleRows = 0;
  let paymentColumnCount = 0;

  for (const grid of grids) {
    const table = detectTable(grid);
    if (!table) continue;

    const assignments = classifyColumns(table, asOf).map((a) =>
      // Columns the owner maintains by hand that we recompute anyway.
      a.field && isIgnoredHeader(a.header)
        ? { ...a, field: null, confidence: 0, basis: '시스템이 계산하므로 무시합니다' }
        : a,
    );

    const extracted = extractStudents(table, assignments, asOf);
    const students = extracted.students;
    issues.push(...extracted.issues);
    sampleRows += extracted.sampleRows;
    paymentColumnCount += assignments.filter((a) => a.paymentMonth).length;
    notes.push(...table.notes.map((n) => (grids.length > 1 ? `[${grid.source}] ${n}` : n)));

    // `className` is the one required field with a fallback chain — a section
    // label above the block, or the sheet name when a workbook keeps one class
    // per tab. It only counts as missing when that chain failed too, otherwise
    // we would stop a perfectly importable file to ask a question we already
    // know the answer to.
    const missing = missingFields(assignments, REQUIRED_FIELDS).filter((f) =>
      f === 'className' ? students.some((s) => s.className === UNCLASSIFIED) : true,
    );

    sheets.push({ table, assignments, students, missing });
  }

  if (sheets.length === 0) {
    return {
      sheets: [],
      students: [],
      classes: [],
      notes,
      issues: [
        {
          level: 'error',
          message: '표를 찾지 못했습니다. 엑셀에서 표 부분만 선택해 복사한 뒤 붙여넣어 보세요.',
        },
      ],
      rejected: null,
    };
  }

  const students = sheets.flatMap((s) => s.students);

  const byClass = new Map<string, DerivedClass>();
  for (const s of students) {
    const existing = byClass.get(s.className);
    if (existing) {
      existing.headcount++;
      existing.monthlyRevenue += s.monthlyFee;
    } else {
      byClass.set(s.className, {
        title: s.className,
        headcount: 1,
        monthlyRevenue: s.monthlyFee,
        // A class name like "U9 화목반" carries its own schedule; that is the
        // cadence the churn engine needs (spec §3).
        scheduleDays: parseWeekdays(s.className),
      });
    }
  }

  // --- Whole-file summary, counted once across every sheet -----------------
  if (sampleRows > 0) {
    issues.push({
      level: 'warning',
      message: `양식의 예시 행 ${sampleRows}건이 남아 있는 것 같습니다. 제외할까요?`,
    });
  }

  const noGroup = students.filter((s) => !s.ageGroup).length;
  if (noGroup > 0) {
    issues.push({
      level: 'warning',
      message: `${noGroup}명은 생년월일·연령대가 없어 연령대를 비워둡니다`,
    });
  }

  // The most important message in the whole import. An empty attendance history
  // is the normal case, not a failure — say so before the owner reads
  // "이탈 위험 0명" and concludes the product is broken.
  if (students.length > 0 && students.every((s) => !s.lastAttendanceDate)) {
    issues.push({
      level: 'info',
      message:
        '출결 이력이 없습니다 — 정상입니다. 매출·미납·정원은 지금 바로 보이고, ' +
        '출결을 3주 기록하시면 이탈 경보가 켜집니다.',
    });
  }

  if (paymentColumnCount === 0 && students.length > 0) {
    issues.push({
      level: 'info',
      message: '납부 이력 열을 찾지 못했습니다. 미납 현황은 첫 수납 기록 후 표시됩니다.',
    });
  }

  const classes = [...byClass.values()].sort((a, b) => b.headcount - a.headcount);
  const noSchedule = classes.filter((c) => c.scheduleDays.length === 0).length;
  if (noSchedule > 0) {
    issues.push({
      level: 'warning',
      message:
        `${noSchedule}개 반은 수업 요일을 알 수 없습니다. ` +
        '요일을 알려주시면 이탈 경보가 훨씬 정확해집니다.',
    });
  }

  return { sheets, students, classes, issues, notes, rejected: null };
}

// ---------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------

export async function importFromFile(file: File, asOf: Date = new Date()): Promise<ImportResult> {
  const name = file.name.toLowerCase();

  if (name.endsWith('.xlsx') || name.endsWith('.xlsm')) {
    const grids = await readWorkbook(await file.arrayBuffer());
    return runImport(grids, asOf);
  }

  if (name.endsWith('.csv') || name.endsWith('.tsv') || name.endsWith('.txt')) {
    return runImport([readDelimitedText(await file.text(), file.name)], asOf);
  }

  return {
    sheets: [],
    students: [],
    classes: [],
    notes: [],
    issues: [
      {
        level: 'error',
        message:
          `"${file.name}"은 아직 직접 읽지 못합니다 (지원: xlsx · csv). ` +
          '파일을 열어 표를 선택하고 복사한 뒤, 이 화면에 붙여넣기(Ctrl+V) 해보세요.',
      },
    ],
    rejected: null,
  };
}

export function importFromText(text: string, asOf: Date = new Date()): ImportResult {
  return runImport([readDelimitedText(text)], asOf);
}
