/**
 * Coach portfolio — the by-product of logging.
 *
 * Every block a coach runs is counted here, which turns routine record-keeping
 * into a personal training résumé.
 */

import { Award, BarChart3, Dumbbell, Layers, Users } from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { buildCoachPortfolio, classesForCoach, studentsInClass } from '@/data/selectors';
import { formatPercent } from '@/lib/format';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { StatTile } from '@/components/ui/StatTile';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { BackBar } from '@/components/shell/Shell';
import { CATEGORY_META } from './TrainingBlockCard';

export function PortfolioScreen({ onBack }: { onBack?: () => void }) {
  const { state, slice, getCoach } = useApp();
  const coach = getCoach(state.currentCoachId ?? '');
  const portfolio = buildCoachPortfolio(slice, state.currentCoachId ?? '');

  const myClasses = classesForCoach(state.classes, state.currentCoachId ?? '');
  const studentCount = myClasses.reduce(
    (sum, c) => sum + studentsInClass(state.students, c.id).length,
    0,
  );

  const totalLogs = state.attendanceLogs.filter((l) => l.coachId === state.currentCoachId).length;
  const maxUsage = portfolio.blockUsage[0]?.count ?? 1;

  return (
    <div>
      {onBack && <BackBar label="클럽" onBack={onBack} />}

      <header className="border-b border-hairline bg-canvas px-5 pb-7 pt-8 sm:px-8 lg:px-12">
        <p className="eyebrow-ink">Coach portfolio</p>

        <div className="mt-3.5 flex items-center gap-3.5">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-primary/20 text-[18px] font-bold text-primary">
            {coach?.name.slice(-2)}
          </span>
          <div className="min-w-0">
            <h1 className="text-[25px] font-semibold leading-[1.2] tracking-tightest text-ink lg:text-[32px]">
              {coach?.name} 코치
            </h1>
            <p className="mt-1 text-[13px] text-slate lg:text-sm">
              담당 {myClasses.length}개 클래스 · 원생 {studentCount}명
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-1.5">
          {coach?.certifications.map((c) => (
            <Badge key={c} tone="sky" pill>
              {c}
            </Badge>
          ))}
        </div>
      </header>

      <div className="space-y-7 px-5 py-7 sm:px-8 lg:px-12 lg:py-10">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="설계한 세션" value={portfolio.sessionCount} unit="회" icon={Layers} tint="lavender" />
          <StatTile label="누적 기록" value={totalLogs} unit="건" icon={BarChart3} tint="mint" />
          <StatTile label="담당 원생" value={studentCount} unit="명" icon={Users} tint="sky" />
          <StatTile
            label="표준 세션 준수율"
            value={formatPercent(portfolio.templateAdherenceRate)}
            icon={Award}
            tint={portfolio.templateAdherenceRate >= 0.7 ? 'canvas' : 'peach'}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="card p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-1.5 text-[15px] font-semibold text-ink">
                <Award size={15} className="text-primary" />
                표준 세션 준수율
              </h2>
              <span className="text-[17px] font-semibold tracking-[-0.3px] text-ink">
                {formatPercent(portfolio.templateAdherenceRate)}
              </span>
            </div>
            <ProgressBar
              className="mt-3"
              value={portfolio.templateAdherenceRate}
              target={0.7}
              barClassName={
                portfolio.templateAdherenceRate >= 0.7 ? 'bg-brand-green' : 'bg-brand-orange'
              }
            />
            <p className="mt-2 text-[12px] leading-[1.5] text-slate">
              본원 목표는 70%입니다. 담당 반의 커리큘럼에 등재된 표준 세션으로 설계한 비율이며,
              블록을 하나라도 바꾸면 그 수업은 직접 구성으로 집계됩니다.
            </p>
            <p className="mt-3 flex items-baseline justify-between gap-2 border-t border-hairline-soft pt-3 text-[12px]">
              <span className="text-steel">표준 블록 사용률</span>
              <span className="font-semibold tabular-nums text-charcoal">
                {formatPercent(portfolio.coreCurriculumRate)}
              </span>
            </p>

            <h3 className="mt-5 mb-2.5 eyebrow-ink">
              카테고리 구성
            </h3>
            <div className="space-y-3">
              {(['warmup', 'skill', 'game'] as const).map((category) => {
                const meta = CATEGORY_META[category];
                const count = portfolio.categoryMix[category];
                const total = Object.values(portfolio.categoryMix).reduce((a, b) => a + b, 0) || 1;
                return (
                  <div key={category} className="flex items-center gap-3">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${meta.bar}`} />
                    <span className="w-20 shrink-0 text-[14px] font-medium text-charcoal">
                      {meta.label}
                    </span>
                    <ProgressBar value={count / total} barClassName={meta.bar} />
                    <span className="w-10 shrink-0 text-right text-[13px] font-semibold text-ink">
                      {count}회
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <h2 className="mb-2.5 eyebrow-ink">
              자주 사용한 블록
            </h2>
            {portfolio.blockUsage.length > 0 ? (
              <div className="card divide-y divide-hairline-soft">
                {portfolio.blockUsage.slice(0, 8).map(({ block, count }) => (
                  <div key={block.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate text-[14px] font-medium text-ink">
                        {block.title}
                      </span>
                      <span className="shrink-0 text-[13px] font-semibold text-primary">
                        {count}회
                      </span>
                    </div>
                    <ProgressBar
                      className="mt-2"
                      value={count / maxUsage}
                      barClassName={CATEGORY_META[block.category].bar}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Dumbbell}
                title="아직 설계한 세션이 없습니다"
                description="훈련 블록으로 수업을 설계하면 이곳에 자동으로 쌓입니다."
              />
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
