/**
 * Owner BI dashboard.
 *
 * Reading order is deliberate: what needs action (churn alerts) sits above
 * what needs watching (margins), which sits above what needs governing
 * (curriculum standardisation). The KPI tiles double as jump links into
 * whichever section explains the number.
 */

import { useCallback, useMemo, useState } from 'react';
import {
  ClipboardCheck,
  Coins,
  Repeat2,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react';
import type { Student } from '@/types';
import { useApp } from '@/store/AppContext';
import { TODAY } from '@/data/mockData';
import { buildKpis } from '@/data/selectors';
import { formatDateKo, formatPercent, formatWonCompact } from '@/lib/format';
import { StatTile } from '@/components/ui/StatTile';
import { PitchBackdrop } from '@/components/ui/PitchBackdrop';
import { ChurnAlertPanel } from './ChurnAlertPanel';
import { ClassPerformanceTable } from './ClassPerformanceTable';
import { CurriculumPanel } from './CurriculumPanel';
import { RosterPanel } from './RosterPanel';
import { StudentDetailModal } from './StudentDetailModal';
import { RecentActivityPanel } from './RecentActivityPanel';

/** Sticky headers would otherwise clip the section title on jump. */
const SCROLL_OFFSET = 16;

export function AdminDashboard() {
  const { slice, state } = useApp();
  const [inspected, setInspected] = useState<Student | null>(null);

  const kpis = useMemo(() => buildKpis(slice), [slice]);
  const totalStudents = state.students.length;

  const jumpTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - SCROLL_OFFSET;
    window.scrollTo({ top: y, behavior: 'smooth' });
  }, []);

  return (
    <div className="min-h-screen bg-surface-soft">
      {/* --- Pitch hero band ------------------------------------------- */}
      <header className="relative overflow-hidden px-5 pb-24 pt-10 text-white sm:px-8 lg:px-10 lg:pt-14">
        <PitchBackdrop />

        <div className="relative mx-auto max-w-[1280px]">
          <p className="text-[13px] font-medium text-white/60">
            {formatDateKo(TODAY)} · 대표 대시보드
          </p>

          <h1 className="mt-3 text-[30px] font-semibold leading-[1.16] tracking-[-0.8px] sm:text-[40px] lg:text-[52px]">
            오늘 챙겨야 할 원생{' '}
            <em className="not-italic text-accent-alert text-[46px] leading-none sm:text-[62px] lg:text-[82px]">
              {kpis.atRiskStudents}
            </em>
            명,
            <br />
            지켜야 할 매출{' '}
            <em className="not-italic text-accent-amber text-[46px] leading-none sm:text-[62px] lg:text-[82px]">
              {formatWonCompact(kpis.monthlyRevenue)}
            </em>
            원.
          </h1>

          <p className="mt-4 max-w-xl text-[15px] leading-[1.55] text-white/70 lg:text-[16px]">
            출결·결제·특이사항·학부모 소통 이력이 한 곳에 모입니다.
          </p>
        </div>
      </header>

      {/* --- KPI row overlapping the band -----------------------------
          `relative` is load-bearing: the hero band is positioned, so a static
          grid here would paint underneath it instead of overlapping. */}
      <div className="relative z-10 mx-auto -mt-16 max-w-[1280px] px-5 sm:px-8 lg:px-10">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <StatTile
            label="재원생" value={kpis.activeStudents} unit={`/ ${totalStudents}명`}
            icon={Users} tint="canvas" className="shadow-card" caption="정상 출석 중"
            onClick={() => jumpTo('roster')}
          />
          <StatTile
            label="이탈 위험군" value={kpis.atRiskStudents} unit="명"
            icon={UserCheck} tint="rose" className="shadow-card" caption="즉시 개입 필요"
            onClick={() => jumpTo('alerts')}
          />
          <StatTile
            label="월 매출" value={formatWonCompact(kpis.monthlyRevenue)} unit="원"
            icon={Coins} tint="canvas" className="shadow-card"
            caption={`공헌이익 ${formatWonCompact(kpis.monthlyMargin)}원`}
            onClick={() => jumpTo('classes')}
          />
          <StatTile
            label="평균 출석률" value={formatPercent(kpis.averageAttendanceRate)}
            icon={TrendingUp} tint="canvas" className="shadow-card" caption="최근 30일"
            onClick={() => jumpTo('activity')}
          />
          <StatTile
            label="평균 재등록률" value={formatPercent(kpis.averageRetentionRate)}
            icon={Repeat2} tint="canvas" className="shadow-card" caption="직전 사이클"
            onClick={() => jumpTo('classes')}
          />
          <StatTile
            label="기록 충실도" value={formatPercent(kpis.logCoverageRate)}
            icon={ClipboardCheck} tint="mint" className="shadow-card" caption="태그·코멘트 입력률"
            onClick={() => jumpTo('curriculum')}
          />
        </div>
      </div>

      {/* --- Body ------------------------------------------------------ */}
      <main className="mx-auto max-w-[1280px] space-y-8 px-5 py-10 sm:px-8 lg:px-10">
        <section id="alerts" className="scroll-mt-4">
          <ChurnAlertPanel onInspect={setInspected} />
        </section>

        <section id="classes" className="scroll-mt-4">
          <ClassPerformanceTable />
        </section>

        <section id="roster" className="scroll-mt-4">
          <RosterPanel onInspect={setInspected} />
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
          <section id="curriculum" className="scroll-mt-4">
            <CurriculumPanel />
          </section>
          <section id="activity" className="scroll-mt-4">
            <RecentActivityPanel onInspect={setInspected} />
          </section>
        </div>
      </main>

      <StudentDetailModal student={inspected} onClose={() => setInspected(null)} />
    </div>
  );
}
