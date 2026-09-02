/**
 * Import diagnostic — shows *why* the engine mapped each column the way it did.
 *
 *   npm run import:report                 # 픽스처 6종 전부
 *   npm run import:report -- some.xlsx    # 실제 파일 하나
 *
 * The second form is the one that matters: when an owner's file comes back
 * wrong in a meeting, this prints the reasoning in seconds, and whatever header
 * it failed on goes straight into the synonym table in `importSchema.ts`.
 * That loop is the whole point of the "hand us any file" claim.
 */

import { readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

import { readWorkbook, readDelimitedText } from '@/lib/import/grid';
import { runImport, type ImportResult } from '@/lib/import';

const FIXTURES = join(process.cwd(), 'src', 'lib', 'import', '__fixtures__');
const DEFAULTS = [
  '01-clean.xlsx',
  '02-titled.xlsx',
  '03-sections.xlsx',
  '04-headerless.xlsx',
  '05-payments.xlsx',
  '06-multisheet.xlsx',
];

const LEVEL_MARK = { error: '🔴', warning: '🟡', info: '🔵' } as const;

async function analyse(path: string): Promise<ImportResult> {
  const buf = readFileSync(path);
  if (/\.xlsx?$|\.xlsm$/i.test(path)) {
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    return runImport(await readWorkbook(ab as ArrayBuffer));
  }
  return runImport([readDelimitedText(buf.toString('utf8'), basename(path))]);
}

function pad(s: string, n: number): string {
  // 한글은 터미널에서 두 칸을 먹으므로 표가 어긋난다. 실제 폭으로 센다.
  const width = [...s].reduce((w, ch) => w + (ch.charCodeAt(0) > 0x1100 ? 2 : 1), 0);
  return s + ' '.repeat(Math.max(0, n - width));
}

async function report(path: string): Promise<void> {
  const r = await analyse(path);

  console.log(`\n${'─'.repeat(72)}`);
  console.log(`■ ${basename(path)}`);

  if (r.rejected) {
    console.log(`  거부됨: ${r.rejected}`);
    for (const i of r.issues) console.log(`  ${LEVEL_MARK[i.level]} ${i.message}`);
    return;
  }

  console.log(`  원생 ${r.students.length}명 · 반 ${r.classes.length}개`);
  for (const n of r.notes) console.log(`  · ${n}`);

  for (const sheet of r.sheets) {
    const head = sheet.table.headerRow === null ? '헤더 없음' : `헤더 ${sheet.table.headerRow + 1}행`;
    console.log(`\n  [${sheet.table.source}] ${head} · ${sheet.students.length}명`);
    if (sheet.missing.length) console.log(`  ⚠ 미해결 필수 필드: ${sheet.missing.join(', ')}`);

    for (const a of sheet.assignments) {
      const target = a.paymentMonth ? `납부 ${a.paymentMonth}` : (a.field ?? '—');
      const conf = a.confidence ? `${Math.round(a.confidence * 100)}%` : '';
      console.log(
        `    ${pad(a.header || '(제목없음)', 16)} → ${pad(target, 20)} ${pad(conf, 5)} ${a.basis}`,
      );
    }
  }

  const classes = r.classes.map((c) => `${c.title}(${c.headcount})`).join(', ');
  if (classes) console.log(`\n  반: ${classes}`);

  if (r.issues.length) {
    console.log('');
    for (const i of r.issues) console.log(`  ${LEVEL_MARK[i.level]} ${i.message}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const targets = args.length > 0 ? args : DEFAULTS.map((f) => join(FIXTURES, f));
  for (const t of targets) await report(t);
  console.log('');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
