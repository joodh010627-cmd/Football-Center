/**
 * Owner BI dashboard.
 *
 * Split into five rail sections rather than one long scroll: 개요 answers "how
 * are we doing", and each other section is a place to *do* something. The KPI
 * tiles on 개요 are jump links into whichever section explains the number, so
 * the reading order (act → watch → govern) still holds.
 */

import { useMemo, useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  ClipboardCheck,
  Coins,
  LayoutGrid,
  Repeat2,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react';
import type { Role, Student } from '@/types';
import { useApp } from '@/store/AppContext';
import { TODAY } from '@/data/mockData';
import { buildAlertQueue, buildClassPerformance, buildKpis } from '@/data/selectors';
import { formatDateKo, formatPercent, formatWon, formatWonCompact } from '@/lib/format';
import { cn } from '@/lib/cn';
import { AppShell, type ShellNavItem } from '@/components/AppShell';
import { StatTile } from '@/components/ui/StatTile';
import { PitchBackdrop } from '@/components/ui/PitchBackdrop';
import { ChurnAlertPanel } from './ChurnAlertPanel';
import { ClassPerformanceTable } from './ClassPerformanceTable';
import { CurriculumPanel } from './CurriculumPanel';
import { RosterPanel } from './RosterPanel';
import { StudentDetailModal } from './StudentDetailModal';
import { RecentActivityPanel } from './RecentActivityPanel';

type View = 'overview' | 'alerts' | 'classes' | 'roster' | 'ops';

/** A class below either of these is worth a second look on the overview. */
const MARGIN_WARNING = 0.25;
const RETENTION_TARGET = 0.8;

export function AdminDashboard({
  role,
  onRoleChange,
}: {
  role: Role;
  onRoleChange: (role: Role) => void;
}) {
  const { slice, state, churnSignals } = useApp();
  const [view, setView] = useState<View>('overview');
  const [inspected, setInspected] = useState<Student | null>(null);

  const kpis = useMemo(() => buildKpis(slice), [slice]);
  const queue = useMemo(() => buildAlertQueue(slice, churnSignals), [slice, churnSignals]);
  const performance = useMemo(() => buildClassPerformance(slice), [slice]);

  const totalStudents = state.students.length;
  const revenueAtRisk = queue.reduce((sum, { student }) => sum + student.monthlyFee, 0);

  const go = (next: View) => {
    setView(next);
    window.scrollTo({ top: 0 });
  };

  const nav: ShellNavItem[] = [
    { key: 'overview', label: '개요', icon: LayoutGrid },
    { key: 'alerts', label: '이탈 위험', shortLabel: '위험', icon: AlertTriangle, badge: queue.length },
    { key: 'classes', label: '클래스 성과', shortLabel: '클래스', icon: Coins },
    { key: 'roster', label: '원생 명단', shortLabel: '원생', icon: Users },
    { key: 'ops', label: '운영 품질', shortLabel: '운영', icon: BookOpenCheck },
  ];

  return (
    <AppShell
      role={role}
      onRoleChange={onRoleChange}
      roleLabel="대표 대시보드"
      identity={{ name: 'FC GROWTH 본원', meta: `${formatDateKo(TODAY)} 기준` }}
      nav={nav}
      active={view}
      onSelect={(key) => go(key as View)}
      railFooter={
        <div className="rounded-lg border border-white/10 bg-white/[0.06] p-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-label text-gold">위험 매출</p>
          <p className="mt-1.5 text-[20px] font-semibold tracking-[-0.5px] text-white">
            월 {(revenueAtRisk / 10_000).toLocaleString('ko-KR')}만원
          </p>
          <p className="mt-0.5 text-[12px] text-white/50">{queue.length}명 조치 대기</p>
        </div>
      }
    >
      {view === 'overview' && (
        <Overview
          kpis={kpis}
          totalStudents={totalStudents}
          queue={queue}
          performance={performance}
          onGo={go}
          onInspect={setInspected}
        />
      )}

      {view === 'alerts' && (
        <ViewFrame
          eyebrow="Retention"
          title="이탈 위험 알림"
          description="결석 빈도·피드백 지연 패턴으로 산출된 위험군입니다. 조치 완료 시 큐에서 제외됩니다."
        >
          <ChurnAlertPanel onInspect={setInspected} />
        </ViewFrame>
      )}

      {view === 'classes' && (
        <ViewFrame
          eyebrow="Unit economics"
          title="클래스 성과"
          description="반별 재등록률과 공헌이익. 어떤 반을 늘리고 어떤 반을 접을지 결정하는 표입니다."
        >
          <ClassPerformanceTable />
        </ViewFrame>
      )}

      {view === 'roster' && (
        <ViewFrame
          eyebrow="Roster"
          title="원생 명단"
          description={`재원 ${totalStudents}명 전체. 이탈 위험도 높은 순으로 정렬됩니다.`}
        >
          <RosterPanel onInspect={setInspected} />
        </ViewFrame>
      )}

      {view === 'ops' && (
        <ViewFrame
          eyebrow="Quality control"
          title="운영 품질"
          description="코치가 바뀌어도 수업이 같으려면, 커리큘럼 준수율과 기록 습관이 함께 보여야 합니다."
        >
          <div className="grid gap-5 xl:grid-cols-[1.15fr_1fr]">
            <CurriculumPanel />
            <RecentActivityPanel onInspect={setInspected} />
          </div>
        </ViewFrame>
      )}

      <StudentDetailModal student={inspected} onClose={() => setInspected(null)} />
    </AppShell>
  );
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

function Overview({
  kpis,
  totalStudents,
  queue,
  performance,
  onGo,
  onInspect,
}: {
  kpis: ReturnType<typeof buildKpis>;
  totalStudents: number;
  queue: ReturnType<typeof buildAlertQueue>;
  performance: ReturnType<typeof buildClassPerformance>;
  onGo: (v: View) => void;
  onInspect: (s: Student) => void;
}) {
  const watchlist = performance
    .filter((p) => p.marginRate < MARGIN_WARNING || p.retentionRate < RETENTION_TARGET)
    .sort((a, b) => a.marginRate - b.marginRate)
    .slice(0, 4);

  return (
    <>
      {/* --- Pitch hero band ------------------------------------------- */}
      <header className="grain relative overflow-hidden px-5 pb-24 pt-12 text-white sm:px-8 lg:px-12 lg:pt-16">
        <PitchBackdrop />

        <div className="relative">
          <p className="text-[11px] font-semibold uppercase tracking-label text-gold">
            {formatDateKo(TODAY)} · Owner dashboard
          </p>

          <h1 className="mt-4 text-[30px] font-semibold leading-[1.14] tracking-tightest sm:text-[42px] lg:text-[54px]">
            오늘 챙겨야 할 원생{' '}
            <em className="not-italic text-accent-alert text-[46px] leading-none sm:text-[64px] lg:text-[84px]">
              {kpis.atRiskStudents}
            </em>
            명,
            <br />
            지켜야 할 매출{' '}
            <em className="not-italic text-gold text-[46px] leading-none sm:text-[64px] lg:text-[84px]">
              {formatWonCompact(kpis.monthlyRevenue)}
            </em>
            원.
          </h1>

          <p className="mt-5 max-w-xl text-[15px] leading-[1.75] text-white/60 lg:text-[16px]">
            출결·결제·특이사항·학부모 소통 이력이 한 곳에 모입니다. 감이 아니라 기록으로 운영하세요.
          </p>
        </div>
      </header>

      {/* --- KPI row overlapping the band -----------------------------
          `relative` is load-bearing: the hero band is positioned, so a static
          grid here would paint underneath it instead of overlapping. */}
      <div className="relative z-10 -mt-16 px-5 sm:px-8 lg:px-12">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <StatTile
            label="재원생" value={kpis.activeStudents} unit={`/ ${totalStudents}명`}
            icon={Users} tint="canvas" className="shadow-card" caption="정상 출석 중"
            onClick={() => onGo('roster')}
          />
          <StatTile
            label="이탈 위험군" value={kpis.atRiskStudents} unit="명"
            icon={UserCheck} tint="rose" className="shadow-card" caption="즉시 개입 필요"
            onClick={() => onGo('alerts')}
          />
          <StatTile
            label="월 매출" value={formatWonCompact(kpis.monthlyRevenue)} unit="원"
            icon={Coins} tint="canvas" className="shadow-card"
            caption={`공헌이익 ${formatWonCompact(kpis.monthlyMargin)}원`}
            onClick={() => onGo('classes')}
          />
          <StatTile
            label="평균 출석률" value={formatPercent(kpis.averageAttendanceRate)}
            icon={TrendingUp} tint="canvas" className="shadow-card" caption="최근 30일"
            onClick={() => onGo('ops')}
          />
          <StatTile
            label="평균 재등록률" value={formatPercent(kpis.averageRetentionRate)}
            icon={Repeat2} tint="canvas" className="shadow-card" caption="직전 사이클"
            onClick={() => onGo('classes')}
          />
          <StatTile
            label="기록 충실도" value={formatPercent(kpis.logCoverageRate)}
            icon={ClipboardCheck} tint="mint" className="shadow-card" caption="태그·코멘트 입력률"
            onClick={() => onGo('ops')}
          />
        </div>
      </div>

      {/* --- Briefs ---------------------------------------------------- */}
      <div className="grid gap-5 px-5 py-8 sm:px-8 lg:grid-cols-[1.25fr_1fr] lg:px-12 lg:py-10">
        <BriefCard
          icon={AlertTriangle}
          tone="alert"
          title="지금 연락해야 할 원생"
          meta={`${queue.length}명`}
          action="위험군 전체 보기"
          onAction={() => onGo('alerts')}
        >
          {queue.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <ShieldCheck size={28} className="text-brand-green" strokeWidth={1.8} />
              <p className="text-[15px] font-semibold text-ink">위험군이 모두 처리되었습니다</p>
            </div>
          ) : (
            <ul className="divide-y divide-hairline-soft">
              {queue.slice(0, 5).map(({ student, signal, className }) => (
                <li key={student.id} className="flex items-center gap-3 py-3">
                  <span
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold tabular-nums',
                      signal.severity === 'critical'
                        ? 'bg-error text-white'
                        : 'bg-tint-alert text-error',
                    )}
                  >
                    {signal.score}
                  </span>
                  <span className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => onInspect(student)}
                      className="text-[15px] font-semibold text-ink underline-offset-4 transition-colors hover:text-primary hover:underline"
                    >
                      {student.name}
                    </button>
                    <span className="ml-2 text-[12.5px] text-steel">{className}</span>
                    <span className="mt-0.5 block truncate text-[13px] text-slate">
                      {signal.reasons[0]}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-[13px] font-semibold tabular-nums text-charcoal">
                    월 {(student.monthlyFee / 10_000).toFixed(0)}만
                  </span>
                </li>
              ))}
            </ul>
          )}
        </BriefCard>

        <BriefCard
          icon={Activity}
          tone="neutral"
          title="점검이 필요한 클래스"
          meta={`${watchlist.length}개 반`}
          action="클래스 성과 보기"
          onAction={() => onGo('classes')}
        >
          {watchlist.length === 0 ? (
            <p className="py-8 text-center text-[14px] text-slate">
              모든 반이 목표 마진·재등록률을 넘겼습니다.
            </p>
          ) : (
            <ul className="divide-y divide-hairline-soft">
              {watchlist.map((row) => (
                <li key={row.classId} className="flex items-center gap-3 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-ink">
                      {row.title}
                    </span>
                    <span className="mt-0.5 block text-[12.5px] text-steel">
                      {row.coachName} 코치 · {row.headcount}/{row.capacity}명
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span
                      className={cn(
                        'block text-[14px] font-semibold tabular-nums',
                        row.marginRate < MARGIN_WARNING ? 'text-brand-orange-deep' : 'text-ink',
                      )}
                    >
                      {formatWon(row.contributionMargin)}
                    </span>
                    <span
                      className={cn(
                        'block text-[12.5px] tabular-nums',
                        row.retentionRate < RETENTION_TARGET ? 'text-error' : 'text-steel',
                      )}
                    >
                      재등록 {formatPercent(row.retentionRate)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </BriefCard>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Chrome
// ---------------------------------------------------------------------------

/** Section wrapper: eyebrow + tight title, matching the public site's heads. */
function ViewFrame({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
      <header className="mb-6 max-w-2xl">
        <p className="eyebrow-ink">{eyebrow}</p>
        <h1 className="mt-2.5 h-section">{title}</h1>
        <p className="mt-3 text-[14px] leading-[1.7] text-slate lg:text-[15px]">{description}</p>
      </header>
      {children}
    </div>
  );
}

function BriefCard({
  icon: Icon,
  tone,
  title,
  meta,
  action,
  onAction,
  children,
}: {
  icon: LucideIcon;
  tone: 'alert' | 'neutral';
  title: string;
  meta: string;
  action: string;
  onAction: () => void;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col overflow-hidden rounded-lg border border-hairline bg-canvas">
      <header className="flex items-center gap-2.5 border-b border-hairline px-5 py-4">
        <Icon
          size={17}
          strokeWidth={2.2}
          className={tone === 'alert' ? 'text-error' : 'text-primary'}
        />
        <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-ink">{title}</h2>
        <span className="ml-auto text-[13px] font-semibold text-steel">{meta}</span>
      </header>

      <div className="flex-1 px-5">{children}</div>

      <footer className="border-t border-hairline-soft px-5 py-3">
        <button
          type="button"
          onClick={onAction}
          className="group flex items-center gap-1.5 text-[13.5px] font-semibold text-primary"
        >
          {action}
          <ArrowRight
            size={14}
            className="transition-transform duration-200 group-hover:translate-x-1"
          />
        </button>
      </footer>
    </section>
  );
}
