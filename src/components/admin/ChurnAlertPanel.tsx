/**
 * Red Alert queue.
 *
 * Sits at the top of the dashboard because it is the only section that asks
 * the owner to *do* something. Each row carries the evidence behind the score,
 * so acting on it doesn't require opening anything else.
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
  critical: { label: '즉시 조치', row: 'border-error/30 bg-[#fef4f4]', bar: 'bg-error', badge: 'error' },
  high: { label: '이번 주 조치', row: 'border-brand-orange/30 bg-tint-peach/40', bar: 'bg-brand-orange', badge: 'orange' },
  watch: { label: '관찰', row: 'border-hairline bg-canvas', bar: 'bg-primary', badge: 'purple' },
};

interface ChurnAlertPanelProps {
  onInspect: (student: Student) => void;
}

export function ChurnAlertPanel({ onInspect }: ChurnAlertPanelProps) {
  const { slice, churnSignals, dispatch, state } = useApp();
  const queue = buildAlertQueue(slice, churnSignals);

  const resolvedCount = state.resolvedStudentIds.length;
  const revenueAtRisk = queue.reduce((sum, { student }) => sum + student.monthlyFee, 0);

  return (
    <section className="overflow-hidden rounded-lg border border-error/25 bg-canvas shadow-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline bg-[#fef4f4] px-6 py-5">
        <div>
          <h2 className="flex items-center gap-2 text-[22px] font-semibold leading-[1.3] text-ink">
            <AlertTriangle size={20} className="text-error" strokeWidth={2.3} />
            이탈 위험 알림
            {queue.length > 0 && <SolidBadge tone="error">{queue.length}명</SolidBadge>}
          </h2>
          <p className="mt-1 text-sm text-slate">
            결석 빈도·피드백 지연 패턴으로 산출된 위험군입니다. 조치 완료 시 큐에서 제외됩니다.
          </p>
        </div>

        <div className="flex items-center gap-5 text-right">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[1px] text-steel">
              위험 매출
            </p>
            <p className="mt-0.5 text-[20px] font-semibold tracking-[-0.3px] text-error">
              월 {(revenueAtRisk / 10_000).toLocaleString('ko-KR')}만원
            </p>
          </div>
          {resolvedCount > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[1px] text-steel">
                금일 조치
              </p>
              <p className="mt-0.5 text-[20px] font-semibold tracking-[-0.3px] text-brand-green">
                {resolvedCount}건
              </p>
            </div>
          )}
        </div>
      </header>

      {queue.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
          <ShieldCheck size={32} className="text-brand-green" strokeWidth={1.8} />
          <p className="text-[17px] font-semibold text-ink">위험군이 모두 처리되었습니다</p>
          <p className="max-w-sm text-sm leading-[1.5] text-slate">
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
                className={cn('flex flex-wrap items-center gap-4 border-l-4 px-6 py-4', meta.row)}
              >
                {/* Score */}
                <div className="w-[92px] shrink-0">
                  <div className="flex items-baseline gap-1">
                    <span className="text-[26px] font-semibold leading-none tracking-[-0.5px] text-ink">
                      {signal.score}
                    </span>
                    <span className="text-[12px] font-medium text-steel">/100</span>
                  </div>
                  <ProgressBar className="mt-2" value={signal.score / 100} barClassName={meta.bar} />
                </div>

                {/* Identity */}
                <div className="min-w-[180px] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onInspect(student)}
                      className="text-[16px] font-semibold text-ink underline-offset-4 transition-colors hover:text-primary hover:underline"
                    >
                      {student.name}
                    </button>
                    <Badge tone={meta.badge === 'error' ? 'error' : meta.badge === 'orange' ? 'orange' : 'purple'}>
                      {meta.label}
                    </Badge>
                    <span className="text-[13px] text-steel">
                      {className} · {student.ageGroup}
                    </span>
                  </div>

                  <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                    {signal.reasons.map((reason) => (
                      <li
                        key={reason}
                        className="flex items-center gap-1 text-[13px] leading-[1.4] text-charcoal"
                      >
                        <TrendingDown size={12} className="shrink-0 text-error" />
                        {reason}
                      </li>
                    ))}
                  </ul>

                  {student.memo && (
                    <p className="mt-1.5 rounded-sm bg-tint-yellow px-2 py-1 text-[12px] leading-[1.45] text-brand-brown">
                      메모 · {student.memo}
                    </p>
                  )}
                </div>

                {/* Facts */}
                <div className="flex shrink-0 gap-6 text-right">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[1px] text-steel">
                      최종 출석
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-ink">
                      {formatDateShort(student.lastAttendanceDate)}
                    </p>
                    <p className="text-[12px] text-steel">
                      {signal.daysSinceLastAttendance}일 경과
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[1px] text-steel">
                      30일 결석률
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-ink">
                      {formatPercent(signal.absenceRateLast30d)}
                    </p>
                    <p className="text-[12px] text-steel">
                      월 {(student.monthlyFee / 10_000).toFixed(0)}만원
                    </p>
                  </div>
                </div>

                {/* Action */}
                <div className="flex shrink-0 items-center gap-2">
                  <a
                    href={`tel:${student.parentPhone.replace(/-/g, '')}`}
                    className="btn-secondary"
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
                    className="btn-primary"
                  >
                    <CheckCircle2 size={14} strokeWidth={2.4} />
                    CS 조치 완료
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
