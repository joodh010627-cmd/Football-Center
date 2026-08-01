/**
 * Class Retention & Margin table.
 *
 * One row per class, sortable on the columns the owner actually decides with:
 * contribution margin, retention, attendance and coach satisfaction.
 */

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Star } from 'lucide-react';
import type { ClassPerformance } from '@/types';
import { useApp } from '@/store/AppContext';
import { buildClassPerformance } from '@/data/selectors';
import { formatPercent, formatWon, formatWonCompact } from '@/lib/format';
import { cn } from '@/lib/cn';
import { ProgressBar } from '@/components/ui/ProgressBar';

type SortKey = 'contributionMargin' | 'retentionRate' | 'attendanceRate' | 'headcount' | 'marginRate';

const COLUMNS: Array<{ key: SortKey | null; label: string; align?: 'right' | 'center' }> = [
  { key: null, label: '클래스' },
  { key: 'headcount', label: '정원 대비', align: 'center' },
  { key: 'retentionRate', label: '재등록률', align: 'right' },
  { key: 'attendanceRate', label: '출석률', align: 'right' },
  { key: null, label: '매출 / 비용', align: 'right' },
  { key: 'contributionMargin', label: '공헌이익', align: 'right' },
  { key: null, label: '코치 만족도', align: 'center' },
];

/** Below this the class is barely paying for its pitch time. */
const MARGIN_WARNING = 0.25;
const RETENTION_TARGET = 0.8;

export function ClassPerformanceTable() {
  const { slice } = useApp();
  const [sortKey, setSortKey] = useState<SortKey>('contributionMargin');
  const [asc, setAsc] = useState(false);

  const rows = useMemo(() => {
    const perf = buildClassPerformance(slice);
    return [...perf].sort((a, b) => {
      const diff = (a[sortKey] as number) - (b[sortKey] as number);
      return asc ? diff : -diff;
    });
  }, [slice, sortKey, asc]);

  const totals = rows.reduce(
    (acc, r) => ({
      revenue: acc.revenue + r.monthlyRevenue,
      cost: acc.cost + r.monthlyCost,
      margin: acc.margin + r.contributionMargin,
      headcount: acc.headcount + r.headcount,
    }),
    { revenue: 0, cost: 0, margin: 0, headcount: 0 },
  );

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setAsc((v) => !v);
    else {
      setSortKey(key);
      setAsc(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-lg border border-hairline bg-canvas">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-hairline px-6 py-5">
        <div>
          <h2 className="text-[22px] font-semibold leading-[1.3] tracking-[-0.3px] text-ink">
            클래스별 리텐션 &amp; 마진
          </h2>
          <p className="mt-1 text-sm text-slate">
            공헌이익 = 월 매출 − 월 운영비(코치 인건비·구장 대관·용품).
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-semibold uppercase tracking-[1px] text-steel">
            전체 공헌이익
          </p>
          <p className="text-[24px] font-semibold tracking-[-0.5px] text-ink">
            {formatWon(totals.margin)}
          </p>
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-hairline bg-surface-soft">
              {COLUMNS.map((col) => (
                <th
                  key={col.label}
                  className={cn(
                    'px-5 py-3 text-[12px] font-semibold uppercase tracking-[0.5px] text-steel',
                    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left',
                  )}
                >
                  {col.key ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key as SortKey)}
                      className={cn(
                        'inline-flex items-center gap-1 transition-colors hover:text-ink',
                        sortKey === col.key && 'text-ink',
                      )}
                    >
                      {col.label}
                      {sortKey === col.key &&
                        (asc ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <PerformanceRow key={row.classId} row={row} />
            ))}
          </tbody>

          <tfoot>
            <tr className="border-t-2 border-hairline bg-surface-soft font-semibold text-ink">
              <td className="px-5 py-4">합계 · {rows.length}개 클래스</td>
              <td className="px-5 py-4 text-center">{totals.headcount}명</td>
              <td className="px-5 py-4" />
              <td className="px-5 py-4" />
              <td className="px-5 py-4 text-right">
                {formatWonCompact(totals.revenue)} / {formatWonCompact(totals.cost)}
              </td>
              <td className="px-5 py-4 text-right">{formatWon(totals.margin)}</td>
              <td className="px-5 py-4" />
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

function PerformanceRow({ row }: { row: ClassPerformance }) {
  const thin = row.marginRate < MARGIN_WARNING;
  const fillRate = row.capacity > 0 ? row.headcount / row.capacity : 0;

  return (
    <tr className="border-b border-hairline-soft transition-colors hover:bg-surface-soft">
      <td className="px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-ink">{row.title}</span>
          {row.atRiskCount > 0 && (
            <span className="rounded-sm bg-[#fde2e2] px-1.5 py-0.5 text-[11px] font-semibold text-error">
              위험 {row.atRiskCount}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[13px] text-steel">{row.coachName} 코치</p>
      </td>

      <td className="px-5 py-4">
        <div className="mx-auto w-[92px]">
          <p className="text-center text-[13px] font-medium text-charcoal">
            {row.headcount}/{row.capacity}
          </p>
          <ProgressBar
            className="mt-1.5"
            value={fillRate}
            barClassName={fillRate >= 0.8 ? 'bg-brand-green' : fillRate >= 0.6 ? 'bg-primary' : 'bg-brand-orange'}
          />
        </div>
      </td>

      <td
        className={cn(
          'px-5 py-4 text-right font-semibold tabular-nums',
          row.retentionRate < RETENTION_TARGET ? 'text-error' : 'text-ink',
        )}
      >
        {formatPercent(row.retentionRate)}
      </td>

      <td className="px-5 py-4 text-right tabular-nums text-charcoal">
        {formatPercent(row.attendanceRate)}
      </td>

      <td className="px-5 py-4 text-right tabular-nums text-charcoal">
        <span className="text-ink">{formatWonCompact(row.monthlyRevenue)}</span>
        <span className="text-stone"> / {formatWonCompact(row.monthlyCost)}</span>
      </td>

      <td className="px-5 py-4 text-right">
        <span
          className={cn(
            'font-semibold tabular-nums',
            thin ? 'text-brand-orange-deep' : 'text-ink',
          )}
        >
          {formatWon(row.contributionMargin)}
        </span>
        <span
          className={cn(
            'ml-2 rounded-sm px-1.5 py-0.5 text-[11px] font-semibold',
            thin ? 'bg-tint-peach text-brand-orange-deep' : 'bg-tint-mint text-brand-green',
          )}
        >
          {formatPercent(row.marginRate)}
        </span>
      </td>

      <td className="px-5 py-4">
        <div className="flex items-center justify-center gap-1">
          <Star size={13} className="text-brand-yellow" fill="currentColor" strokeWidth={0} />
          <span className="text-[13px] font-semibold tabular-nums text-charcoal">
            {row.coachSatisfaction.toFixed(1)}
          </span>
        </div>
      </td>
    </tr>
  );
}
