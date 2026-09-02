/**
 * Red Alert queue.
 *
 * The only section that asks the owner to *do* something, so each row carries
 * the evidence behind the score — acting on it never requires opening anything
 * else. Rows stack on phones and go wide from `xl`, where the facts column and
 * the actions finally fit beside the reasons.
 */

import { AlertTriangle, CheckCircle2, PhoneCall, ShieldCheck, TrendingDown } from 'lucide-react';
import type { ChurnSignal, Student } from '@/types';
import { useApp } from '@/store/AppContext';
import { buildAlertQueue } from '@/data/selectors';
import { formatDateShort, formatPercent } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Badge, SolidBadge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';

const SEVERITY_META: Record<
  ChurnSignal['severity'],
  { label: string; row: string; bar: string; badge: 'error' | 'orange' | 'purple' }
> = {
  critical: { label: '즉시 조치', row: 'border-error/50 bg-tint-alert-soft', bar: 'bg-error', badge: 'error' },
  high: { label: '이번 주 조치', row: 'border-brand-orange/50 bg-tint-peach/40', bar: 'bg-brand-orange', badge: 'orange' },
  watch: { label: '관찰', row: 'border-hairline bg-canvas', bar: 'bg-primary', badge: 'purple' },
};

interface ChurnAlertPanelProps {
  onInspect: (student: Student) => void;
}

export function ChurnAlertPanel({ onInspect }: ChurnAlertPanelProps) {
  const { slice, churnSignals, dispatch, state, getFee } = useApp();
  const queue = buildAlertQueue(slice, churnSignals);

  const resolvedCount = state.resolvedStudentIds.length;
  const revenueAtRisk = queue.reduce((sum, { student }) => sum + getFee(student.id), 0);

  return (
    <section className="overflow-hidden rounded-lg border border-hairline bg-canvas shadow-card">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-hairline bg-tint-alert-soft px-5 py-5 sm:px-6">
        <div className="min-w-0">
          <h2 className="flex flex-wrap items-center gap-2 text-[19px] font-semibold leading-[1.3] tracking-[-0.02em] text-ink sm:text-[21px]">
            <AlertTriangle size={19} className="text-error" strokeWidth={2.3} />
            조치 대기 큐
            {queue.length > 0 && <SolidBadge tone="error">{queue.length}명</SolidBadge>}
          </h2>
          <p className="mt-1.5 text-[13.5px] leading-[1.6] text-slate">
            위 순서대로 연락하면 됩니다. 조치 완료 시 큐에서 즉시 제외됩니다.
          </p>
        </div>

        <div className="flex items-center gap-6">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-label text-steel">위험 매출</p>
            <p className="mt-1 text-[20px] font-semibold tracking-[-0.03em] text-error">
              월 {(revenueAtRisk / 10_000).toLocaleString('ko-KR')}만원
            </p>
          </div>
          {resolvedCount > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-label text-steel">
                금일 조치
              </p>
              <p className="mt-1 text-[20px] font-semibold tracking-[-0.03em] text-brand-green">
                {resolvedCount}건
              </p>
            </div>
          )}
        </div>
      </header>

      {queue.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
          <ShieldCheck size={32} className="text-brand-green" strokeWidth={1.8} />
          <p className="text-[17px] font-semibold text-ink">위험군이 모두 처리되었습니다</p>
          <p className="max-w-sm text-sm leading-[1.6] text-slate">
            새로운 결석 패턴이 감지되면 이곳에 자동으로 표시됩니다.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-hairline-soft">
          {queue.map(({ student, signal, className }) => {
            const meta = SEVERITY_META[signal.severity];
            return (
              <li
                key={student.id}
                className={cn(
                  'grid gap-4 border-l-[3px] px-5 py-4 sm:px-6 xl:grid-cols-[92px_minmax(0,1fr)_auto_auto] xl:items-center',
                  meta.row,
                )}
              >
                {/* Score */}
                <div className="flex items-center gap-3 xl:block">
                  <div className="flex items-baseline gap-1">
                    <span className="text-[26px] font-semibold leading-none tracking-[-0.03em] text-ink">
                      {signal.score}
                    </span>
                    <span className="text-[12px] font-medium text-steel">/100</span>
                  </div>
                  <ProgressBar
                    className="mt-0 w-24 xl:mt-2 xl:w-full"
                    value={signal.score / 100}
                    barClassName={meta.bar}
                  />
                </div>

                {/* Identity + evidence */}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onInspect(student)}
                      className="text-[16px] font-semibold text-ink underline-offset-4 transition-colors hover:text-primary hover:underline"
                    >
                      {student.name}
                    </button>
                    <Badge tone={meta.badge}>{meta.label}</Badge>
                    <span className="text-[13px] text-steel">
                      {className} · {student.ageGroup}
                    </span>
                  </div>

                  <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                    {signal.reasons.map((reason) => (
                      <li
                        key={reason}
                        className="flex items-center gap-1 text-[13px] leading-[1.45] text-charcoal"
                      >
                        <TrendingDown size={12} className="shrink-0 text-error" />
                        {reason}
                      </li>
                    ))}
                  </ul>

                  {student.memo && (
                    <p className="mt-2 rounded-sm bg-tint-yellow px-2.5 py-1.5 text-[12.5px] leading-[1.5] text-brand-brown">
                      메모 · {student.memo}
                    </p>
                  )}
                </div>

                {/* Facts */}
                <div className="flex gap-6 xl:pl-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-label text-steel">
                      최종 출석
                    </p>
                    <p className="mt-1 text-sm font-semibold text-ink">
                      {formatDateShort(student.lastAttendanceDate)}
                    </p>
                    <p className="text-[12px] text-steel">{signal.daysSinceLastAttendance}일 경과</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-label text-steel">
                      30일 결석률
                    </p>
                    <p className="mt-1 text-sm font-semibold text-ink">
                      {formatPercent(signal.absenceRateLast30d)}
                    </p>
                    <p className="text-[12px] text-steel">
                      월 {(getFee(student.id) / 10_000).toFixed(0)}만원
                    </p>
                  </div>
                </div>

                {/* Action — stacked on wide screens so the evidence column,
                    which is the part worth reading, keeps the extra pixels. */}
                <div className="flex flex-wrap items-center gap-2 xl:w-[132px] xl:flex-col xl:items-stretch">
                  <a
                    href={`tel:${student.parentPhone.replace(/-/g, '')}`}
                    className="btn-secondary flex-1 xl:flex-none"
                    title={`${student.parentName} 학부모 · ${student.parentPhone}`}
                  >
                    <PhoneCall size={14} />
                    학부모 연락
                  </a>
                  <button
                    type="button"
                    onClick={() =>
                      dispatch({
                        type: 'churn/resolve',
                        studentId: student.id,
                        note: `${signal.reasons[0]} 관련 CS 조치`,
                      })
                    }
                    className="btn-primary flex-1 xl:flex-none"
                  >
                    <CheckCircle2 size={14} strokeWidth={2.4} />
                    조치 완료
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
