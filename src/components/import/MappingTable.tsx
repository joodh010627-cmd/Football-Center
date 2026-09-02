/**
 * 열 매핑 확인.
 *
 * The engine already decided; this screen exists so the owner can *see* that it
 * decided sensibly. Showing the reason ("휴대폰 번호 100%") next to each column
 * is the whole point — a silent auto-mapping that gets one column wrong is
 * worse than one that shows its work, because nobody checks a black box.
 *
 * Only low-confidence columns really need attention, so those are the ones
 * tinted; everything else stays quiet.
 */

import { ArrowRight } from 'lucide-react';
import { STUDENT_FIELDS, type StudentFieldKey } from '@/data/importSchema';
import { CONFIDENT, type ColumnAssignment, type SheetInput } from '@/lib/import';
import { cn } from '@/lib/cn';

const FIELD_LABEL = new Map(STUDENT_FIELDS.map((f) => [f.key, f.label]));

function confidenceChip(a: ColumnAssignment) {
  if (a.paymentMonth) return { text: '납부', cls: 'bg-tint-sky text-primary' };
  if (!a.field) return { text: '미사용', cls: 'bg-tint-gray text-steel' };
  if (a.confidence >= CONFIDENT) return { text: '확실', cls: 'bg-tint-mint text-brand-green' };
  return { text: '확인 필요', cls: 'bg-tint-yellow-bold text-brand-orange-deep' };
}

interface Props {
  sheets: SheetInput[];
  /** Multi-sheet workbooks show the tab name; a single table doesn't need it. */
  showSheetNames: boolean;
  onChange: (sheetIndex: number, columnIndex: number, field: StudentFieldKey | null) => void;
}

export function MappingTable({ sheets, showSheetNames, onChange }: Props) {
  return (
    <div className="space-y-5">
      {sheets.map((sheet, si) => (
        <div key={`${sheet.table.source}-${si}`} className="overflow-hidden rounded-md border border-hairline">
          {showSheetNames && (
            <div className="flex items-center justify-between border-b border-hairline bg-surface-soft px-4 py-2.5">
              <span className="text-sm font-semibold text-ink">{sheet.table.source}</span>
              <span className="text-[12px] text-steel">
                {sheet.table.headerRow === null
                  ? '제목 행 없음 — 내용으로 판별'
                  : `제목 ${sheet.table.headerRow + 1}행`}
              </span>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-hairline bg-surface-soft text-[12px] uppercase tracking-wide text-steel">
                  <th className="px-4 py-2.5 text-left font-semibold">엑셀 열</th>
                  <th className="px-4 py-2.5 text-left font-semibold">예시 값</th>
                  <th className="px-4 py-2.5 text-left font-semibold">항목</th>
                  <th className="px-4 py-2.5 text-left font-semibold">판별 근거</th>
                </tr>
              </thead>
              <tbody>
                {sheet.assignments.map((a) => {
                  const chip = confidenceChip(a);
                  const needsLook = Boolean(a.field) && a.confidence < CONFIDENT;

                  return (
                    <tr
                      key={a.index}
                      className={cn(
                        'border-b border-hairline-soft align-middle',
                        needsLook && 'bg-tint-yellow/50',
                      )}
                    >
                      <td className="px-4 py-2.5">
                        <span className={cn('font-medium', a.header ? 'text-ink' : 'italic text-stone')}>
                          {a.header || '(제목 없음)'}
                        </span>
                      </td>

                      <td className="max-w-[190px] truncate px-4 py-2.5 text-[13px] text-steel">
                        {a.samples.join(' · ') || '—'}
                      </td>

                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <ArrowRight size={13} className="shrink-0 text-stone" />
                          {a.paymentMonth ? (
                            // Month columns are structural, not a field choice —
                            // there is nothing sensible to re-map them to.
                            <span className="text-[13px] font-medium text-primary">
                              {a.paymentMonth} 납부
                            </span>
                          ) : (
                            <select
                              value={a.field ?? ''}
                              onChange={(e) =>
                                onChange(si, a.index, (e.target.value || null) as StudentFieldKey | null)
                              }
                              className="h-8 max-w-[150px] rounded-sm border border-hairline-strong bg-canvas px-2 text-[13px] text-ink"
                            >
                              <option value="">사용 안 함</option>
                              {STUDENT_FIELDS.map((f) => (
                                <option key={f.key} value={f.key}>
                                  {f.label}
                                </option>
                              ))}
                            </select>
                          )}
                          <span
                            className={cn(
                              'shrink-0 rounded-sm px-1.5 py-0.5 text-[11px] font-semibold',
                              chip.cls,
                            )}
                          >
                            {chip.text}
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-2.5 text-[12px] text-steel">{a.basis || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {sheet.assignments.every((a) => !a.field && !a.paymentMonth) && (
            <p className="border-t border-hairline-soft px-4 py-3 text-[13px] text-error">
              이 표에서는 쓸 수 있는 열을 찾지 못했습니다.
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

export function fieldLabel(key: StudentFieldKey): string {
  return FIELD_LABEL.get(key) ?? key;
}
