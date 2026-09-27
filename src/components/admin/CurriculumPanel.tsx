/**
 * Standardisation control.
 *
 * Answers the owner's question "are classes running named sessions, or drills
 * strung together on the day?" — coach by coach, from plan history rather than
 * trust. A named session carries a goal a parent can be told; a hand-built list
 * of blocks does not. The number in brackets is the share of blocks drawn from
 * the standard or core library.
 */

import { BookOpenCheck, Star } from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { buildCoachPortfolio, classesForCoach } from '@/data/selectors';
import { formatPercent } from '@/lib/format';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { cn } from '@/lib/cn';

const CORE_TARGET = 0.6;
/** Below this, a coach is improvising most of their month. */
const ADHERENCE_TARGET = 0.7;

export function CurriculumPanel() {
  const { state, slice } = useApp();
  const evaluations = state.evaluations;

  const rows = state.coaches
    .map((coach) => ({
      coach,
      portfolio: buildCoachPortfolio(slice, coach.id),
      classCount: classesForCoach(state.classes, coach.id).length,
    }))
    .sort((a, b) => b.portfolio.templateAdherenceRate - a.portfolio.templateAdherenceRate);

  return (
    <section className="rounded-lg border border-hairline bg-canvas p-6">
      <header className="mb-4">
        <h2 className="flex items-center gap-2 text-[18px] font-semibold leading-[1.4] text-ink">
          <BookOpenCheck size={17} className="text-primary" />
          세션 사용 현황
        </h2>
        <p className="mt-1 text-[13px] leading-[1.5] text-slate">
          세션을 골라 진행한 수업의 비율 · 목표 {formatPercent(ADHERENCE_TARGET)}
        </p>
      </header>

      <ul className="space-y-4">
        {rows.map(({ coach, portfolio, classCount }) => {
          const rate = portfolio.templateAdherenceRate;
          const belowTarget = rate < ADHERENCE_TARGET;

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
                <span className="flex shrink-0 items-baseline gap-1.5">
                  <span
                    className={cn(
                      'text-sm font-semibold tabular-nums',
                      belowTarget ? 'text-brand-orange-deep' : 'text-ink',
                    )}
                  >
                    {portfolio.sessionCount > 0 ? formatPercent(rate) : '기록 없음'}
                  </span>
                  {portfolio.sessionCount > 0 && (
                    <span
                      className={cn(
                        'text-[12px] tabular-nums',
                        portfolio.coreCurriculumRate < CORE_TARGET
                          ? 'text-brand-orange-deep'
                          : 'text-steel',
                      )}
                    >
                      ({formatPercent(portfolio.coreCurriculumRate)})
                    </span>
                  )}
                </span>
              </div>
              <ProgressBar
                className="mt-2"
                value={rate}
                target={ADHERENCE_TARGET}
                barClassName={belowTarget ? 'bg-brand-orange' : 'bg-brand-green'}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
