/**
 * Layer 4 — turn classified columns into canonical records, and say plainly
 * what we could not make sense of.
 *
 * The validation split matters for the demo: an `error` stops the row, a
 * `warning` still imports it, and an `info` is us explaining something that
 * looks wrong but isn't. Getting that wrong means either a dead demo or a
 * dashboard quietly built on garbage.
 */

import type { AgeGroup } from '@/types';
import {
  PAYMENT_PAID_TOKENS,
  PAYMENT_UNPAID_TOKENS,
  TEMPLATE_SAMPLE_NAMES,
  TEMPLATE_SAMPLE_PHONE_PREFIX,
} from '@/data/importSchema';
import { cellText, isBlank, type CellValue } from './grid';
import type { ColumnAssignment } from './classify';
import type { DataRow, TableRegion } from './structure';
import {
  ageAt,
  ageToGroup,
  parseAgeGroup,
  parseDate,
  parseMoney,
  parsePhone,
  toISODate,
} from './patterns';

export interface PaymentEntry {
  /** `YYYY-MM`. */
  month: string;
  paid: boolean;
  paidAt?: string;
  amount?: number;
}

export interface ImportedStudent {
  sourceRow: number;
  sourceSheet: string;
  name: string;
  className: string;
  parentPhone: string;
  monthlyFee: number;
  enrolledAt: string | null;
  birthDate: string | null;
  ageGroup: AgeGroup | null;
  parentName: string | null;
  /**
   * Almost always null, and that is the correct outcome — see IMPORT-SPEC §5.
   * Filling it with the enrolment date marks everyone dormant; filling it with
   * today invents attendance that never happened.
   */
  lastAttendanceDate: string | null;
  memo: string | null;
  payments: PaymentEntry[];
}

export interface ImportIssue {
  level: 'error' | 'warning' | 'info';
  row?: number;
  sheet?: string;
  message: string;
}

export interface ExtractResult {
  students: ImportedStudent[];
  issues: ImportIssue[];
  /** Rows that still look like the template's example rows. Summed per file. */
  sampleRows: number;
}

/** Last resort when no column, section label, or sheet name yields a class. */
export const UNCLASSIFIED = '미분류';

// ---------------------------------------------------------------------------
// Payment cells
// ---------------------------------------------------------------------------

function parsePaymentCell(
  value: CellValue,
  month: string,
  enrolledAt: string | null,
): PaymentEntry | null {
  // A blank month before the student even joined is not an unpaid month.
  if (isBlank(value)) {
    if (enrolledAt && month < enrolledAt.slice(0, 7)) return null;
    return { month, paid: false };
  }

  const t = cellText(value).toLowerCase();
  if (PAYMENT_PAID_TOKENS.includes(t)) return { month, paid: true };
  if (PAYMENT_UNPAID_TOKENS.includes(t)) return { month, paid: false };

  const date = parseDate(value);
  if (date) return { month, paid: true, paidAt: toISODate(date) };

  const amount = parseMoney(t);
  if (amount !== null && amount > 0) return { month, paid: true, amount };

  return { month, paid: false };
}

// ---------------------------------------------------------------------------
// Extraction
// ---------------------------------------------------------------------------

export function extractStudents(
  table: TableRegion,
  assignments: ColumnAssignment[],
  asOf: Date = new Date(),
): ExtractResult {
  const students: ImportedStudent[] = [];
  const issues: ImportIssue[] = [];
  const sheet = table.source;

  const byField = new Map<string, number>();
  for (const a of assignments) if (a.field) byField.set(a.field, a.index);
  const payments = assignments.filter((a) => a.paymentMonth);

  const cell = (row: DataRow, field: string): CellValue => {
    const idx = byField.get(field);
    return idx === undefined ? null : (row.cells[idx] ?? null);
  };

  let sampleRows = 0;

  for (const row of table.rows) {
    const line = row.index + 1; // 1-based, matches what Excel shows

    const name = cellText(cell(row, 'name'));
    if (!name) {
      issues.push({ level: 'error', row: line, sheet, message: `${line}행: 이름이 없습니다` });
      continue;
    }

    const rawPhone = cellText(cell(row, 'parentPhone'));
    const parentPhone = rawPhone ? parsePhone(rawPhone) : null;
    if (rawPhone && !parentPhone) {
      issues.push({
        level: 'error',
        row: line,
        sheet,
        message: `${line}행 ${name}: 연락처를 읽을 수 없습니다 ("${rawPhone}")`,
      });
      continue;
    }
    if (!rawPhone) {
      issues.push({
        level: 'warning',
        row: line,
        sheet,
        message: `${line}행 ${name}: 보호자 연락처가 비어 있습니다`,
      });
    }

    const feeRaw = cell(row, 'monthlyFee');
    const monthlyFee = feeRaw === null ? null : parseMoney(cellText(feeRaw));
    if (feeRaw !== null && monthlyFee === null) {
      issues.push({
        level: 'warning',
        row: line,
        sheet,
        message: `${line}행 ${name}: 수강료를 숫자로 읽지 못해 0원으로 둡니다 ("${cellText(feeRaw)}")`,
      });
    }

    // Class name: mapped column → section header above the block → sheet name.
    const className =
      cellText(cell(row, 'className')) || row.sectionLabel || sheet || UNCLASSIFIED;

    const enrolledDate = parseDate(cell(row, 'enrolledAt'));
    const enrolledAt = enrolledDate ? toISODate(enrolledDate) : null;
    if (enrolledDate && enrolledDate.getTime() > asOf.getTime()) {
      issues.push({
        level: 'warning',
        row: line,
        sheet,
        message: `${line}행 ${name}: 등록일이 오늘보다 뒤입니다`,
      });
    }

    const birth = parseDate(cell(row, 'birthDate'));
    const birthDate = birth ? toISODate(birth) : null;

    const explicitGroup = parseAgeGroup(cellText(cell(row, 'ageGroup')));
    const ageGroup: AgeGroup | null =
      explicitGroup ?? (birth ? ageToGroup(ageAt(birth, asOf)) : null);

    const lastAttendance = parseDate(cell(row, 'lastAttendanceDate'));

    const entries: PaymentEntry[] = [];
    for (const p of payments) {
      const entry = parsePaymentCell(row.cells[p.index] ?? null, p.paymentMonth!, enrolledAt);
      if (entry) entries.push(entry);
    }

    const isSample =
      TEMPLATE_SAMPLE_NAMES.includes(name) ||
      (parentPhone?.startsWith(TEMPLATE_SAMPLE_PHONE_PREFIX) ?? false);
    if (isSample) sampleRows++;

    students.push({
      sourceRow: line,
      sourceSheet: sheet,
      name,
      className,
      parentPhone: parentPhone ?? '',
      monthlyFee: monthlyFee ?? 0,
      enrolledAt,
      birthDate,
      ageGroup,
      parentName: cellText(cell(row, 'parentName')) || null,
      lastAttendanceDate: lastAttendance ? toISODate(lastAttendance) : null,
      memo: cellText(cell(row, 'memo')) || null,
      payments: entries,
    });
  }

  // --- Cross-row checks ----------------------------------------------------
  const seen = new Map<string, number>();
  for (const s of students) {
    const key = `${s.name}|${s.parentPhone}`;
    const first = seen.get(key);
    if (first !== undefined && s.parentPhone) {
      issues.push({
        level: 'warning',
        row: s.sourceRow,
        sheet,
        message: `${first}행과 ${s.sourceRow}행 ${s.name}: 동일인으로 보입니다`,
      });
    } else {
      seen.set(key, s.sourceRow);
    }
  }

  // Whole-file observations (missing age groups, no attendance history, sample
  // rows) are summarised once in `runImport`, not here. Emitting them per sheet
  // made a three-tab workbook show the same blue notice three times, which
  // reads as a malfunction in front of an owner.
  return { students, issues, sampleRows };
}
