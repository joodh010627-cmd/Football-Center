/**
 * Layer 1 — turn whatever the owner handed us into a plain cell matrix.
 *
 * Everything downstream works on `Grid` and nothing else, so the messy parts
 * (ExcelJS's value unions, clipboard delimiter guessing) stay quarantined here.
 * That also keeps the classifier testable in Node without a spreadsheet lib.
 */

export type CellValue = string | number | Date | boolean | null;

export interface Grid {
  /** Sheet name, or a label for a pasted block. Shown in the UI and used as a
   *  class-name fallback when a workbook keeps one class per sheet. */
  source: string;
  rows: CellValue[][];
}

// ---------------------------------------------------------------------------
// Excel
// ---------------------------------------------------------------------------

/**
 * ExcelJS hands back a different shape per cell kind. Collapse them all to a
 * primitive; anything we cannot make sense of becomes `null` rather than
 * `[object Object]`, which would otherwise poison the content classifier.
 */
function flattenExcelValue(value: unknown): CellValue {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  const t = typeof value;
  if (t === 'string' || t === 'number' || t === 'boolean') return value as CellValue;

  if (typeof value === 'object') {
    const v = value as Record<string, unknown>;
    // Hyperlink cell
    if (typeof v.text === 'string') return v.text;
    // Rich text runs
    if (Array.isArray(v.richText)) {
      return v.richText.map((r) => String((r as { text?: string }).text ?? '')).join('');
    }
    // Formula cell — we want the computed value, not the expression
    if ('result' in v) return flattenExcelValue(v.result);
    // Error cell (#REF! etc.)
    if ('error' in v) return null;
  }
  return null;
}

/**
 * Reads every sheet in a workbook. Multi-sheet files are common and meaningful:
 * one sheet per class is a layout we have to support, not an edge case.
 *
 * ExcelJS is imported dynamically so the ~900KB parser is only fetched when the
 * user actually drops a file — the demo's first paint stays fast.
 */
export async function readWorkbook(buffer: ArrayBuffer): Promise<Grid[]> {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const grids: Grid[] = [];
  wb.eachSheet((sheet) => {
    const rows: CellValue[][] = [];
    const width = Math.max(sheet.columnCount, 1);

    // `eachRow` skips empty rows entirely, which would silently close the gaps
    // that structure detection uses to find where a table ends. Walk by index.
    for (let r = 1; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);
      const cells: CellValue[] = [];
      for (let c = 1; c <= width; c++) {
        const cell = row.getCell(c);
        // A merged header spans several columns; the slaves hold no value of
        // their own, so read through to the master or the header vanishes.
        const source = cell.isMerged && cell.master ? cell.master : cell;
        cells.push(flattenExcelValue(source.value));
      }
      rows.push(cells);
    }

    if (rows.some((r) => r.some((c) => !isBlank(c)))) {
      grids.push({ source: sheet.name, rows });
    }
  });

  return grids;
}

// ---------------------------------------------------------------------------
// Clipboard / delimited text
// ---------------------------------------------------------------------------

/**
 * Excel, Google Sheets and Naver Cafe tables all copy to the clipboard as TSV,
 * so paste covers the meeting where we cannot get the file itself — the owner
 * only has to get the table onto their screen.
 */
export function detectDelimiter(text: string): string {
  const sample = text.split(/\r?\n/).slice(0, 20).join('\n');
  const counts: Record<string, number> = {
    '\t': (sample.match(/\t/g) ?? []).length,
    ',': (sample.match(/,/g) ?? []).length,
    ';': (sample.match(/;/g) ?? []).length,
    '|': (sample.match(/\|/g) ?? []).length,
  };
  let best = '\t';
  for (const [d, n] of Object.entries(counts)) if (n > counts[best]) best = d;
  return counts[best] === 0 ? '\t' : best;
}

/** Minimal RFC4180-ish splitter — handles quoted fields containing delimiters. */
function splitLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === delimiter) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

export function readDelimitedText(text: string, source = '붙여넣기'): Grid {
  const clean = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const delimiter = detectDelimiter(clean);
  const lines = clean.split('\n');

  // A trailing newline is normal; dropping it avoids a phantom empty row that
  // would look like a table boundary.
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();

  const rows = lines.map((line) =>
    splitLine(line, delimiter).map((cell) => {
      const trimmed = cell.trim();
      return trimmed === '' ? null : trimmed;
    }),
  );

  const width = rows.reduce((m, r) => Math.max(m, r.length), 0);
  for (const r of rows) while (r.length < width) r.push(null);

  return { source, rows };
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

export function isBlank(v: CellValue): boolean {
  return v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
}

/** Display/matching form of a cell. Dates use ISO so date detection is stable. */
export function cellText(v: CellValue): string {
  if (isBlank(v)) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
}

export function rowFilledCount(row: CellValue[]): number {
  let n = 0;
  for (const c of row) if (!isBlank(c)) n++;
  return n;
}

export function columnValues(grid: Grid, col: number, startRow: number, endRow: number): CellValue[] {
  const out: CellValue[] = [];
  for (let r = startRow; r <= endRow && r < grid.rows.length; r++) {
    out.push(grid.rows[r]?.[col] ?? null);
  }
  return out;
}
