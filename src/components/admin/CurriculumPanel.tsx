/**
 * Standardisation control.
 *
 * Answers the owner's question "is every class actually running the curriculum
 * I designed?" — coach by coach, from session-plan history rather than trust.
 */

import { BookOpenCheck, Star } from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { buildCoachPortfolio, classesForCoach } from '@/data/selectors';
import { formatPercent } from '@/lib/format';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { cn } from '@/lib/cn';

const CORE_TARGET = 0.6;

export function CurriculumPanel() {
  const { state, slice } = useApp();
  const evaluations = state.evaluations;

  const rows = state.coaches
    .map((coach) => ({
      coach,
      portfolio: buildCoachPortfolio(slice, coach.id),
      classCount: classesForCoach(state.classes, coach.id).length,
    }))
    .sort((a, b) => b.portfolio.coreCurriculumRate - a.portfolio.coreCurriculumRate);

  return (
    <section className="rounded-lg border border-hairline bg-canvas p-6">
      <header className="mb-4">
        <h2 className="flex items-center gap-2 text-[18px] font-semibold leading-[1.4] text-ink">
          <BookOpenCheck size={17} className="text-primary" />
          커리큘럼 표준화 현황
        </h2>
        <p className="mt-1 text-[13px] leading-[1.5] text-slate">
          표준 블록 사용률. 목표 {formatPercent(CORE_TARGET)} 미만이면 수업 품질 편차가 발생합니다.
        </p>
      </header>

      <ul className="space-y-4">
        {rows.map(({ coach, portfolio, classCount }) => {
          const rate = portfolio.coreCurriculumRate;
          const belowTarget = rate < CORE_TARGET;

          return (
            <li key={coach.id}>
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-semibold text-ink">{coach.name}</span>
                  <span className="shrink-0 text-[12px] text-steel">{classCount}개 반</span>
                  <span className="flex shrink-0 items-center gap-0.5 text-[12px] text-steel">
                    <Star size={10} className="text-brand-yellow" fill="currentColor" strokeWidth={0} />
                    {(evaluations[coach.id] ?? 0).toFixed(1)}
                  </span>
                </span>
                <span
                  className={cn(
                    'shrink-0 text-sm font-semibold tabular-nums',
                    belowTarget ? 'text-brand-orange-deep' : 'text-ink',
                  )}
                >
                  {portfolio.sessionCount > 0 ? formatPercent(rate) : '기록 없음'}
                </span>
              </div>
              <ProgressBar
                className="mt-2"
                value={rate}
                target={CORE_TARGET}
                barClassName={belowTarget ? 'bg-brand-orange' : 'bg-brand-green'}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
