/**
 * Owner BI dashboard.
 *
 * Reading order is deliberate: what needs action (churn alerts) sits above
 * what needs watching (margins), which sits above what needs governing
 * (curriculum standardisation).
 */

import { useMemo, useState } from 'react';
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
import { ChurnAlertPanel } from './ChurnAlertPanel';
import { ClassPerformanceTable } from './ClassPerformanceTable';
import { CurriculumPanel } from './CurriculumPanel';
import { StudentDetailModal } from './StudentDetailModal';
import { RecentActivityPanel } from './RecentActivityPanel';

export function AdminDashboard() {
  const { slice, state } = useApp();
  const [inspected, setInspected] = useState<Student | null>(null);

  const kpis = useMemo(() => buildKpis(slice), [slice]);
  const totalStudents = state.students.length;

  return (
    <div className="min-h-screen bg-surface-soft">
      {/* --- Navy hero band ------------------------------------------- */}
      <header className="relative overflow-hidden bg-navy px-6 pb-24 pt-10 text-white lg:px-10">
        <span className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-brand-purple/20 blur-3xl" />
        <span className="pointer-events-none absolute right-[12%] top-10 h-3 w-3 rounded-full bg-brand-yellow" />
        <span className="pointer-events-none absolute right-[20%] top-24 h-2.5 w-2.5 rounded-full bg-brand-pink" />
        <span className="pointer-events-none absolute right-[28%] top-14 h-2 w-2 rounded-full bg-brand-teal" />
        <span className="pointer-events-none absolute left-[8%] top-20 h-2 w-2 rounded-full bg-brand-green" />

        <div className="relative mx-auto max-w-[1280px]">
          <p className="text-[13px] font-medium text-on-dark-muted">
            {formatDateKo(TODAY)} · 대표 대시보드
          </p>
          <h1 className="mt-2 text-[36px] font-semibold leading-[1.15] tracking-[-1px] lg:text-[48px]">
            오늘 챙겨야 할 원생 {kpis.atRiskStudents}명,
            <br />
            지켜야 할 매출 {formatWonCompact(kpis.monthlyRevenue)}원.
          </h1>
          <p className="mt-3 max-w-xl text-[16px] leading-[1.55] text-on-dark-muted">
            출결·결제·특이사항·학부모 소통 이력이 한 곳에 모입니다. 현장 노동이 아니라 숫자로
            운영하세요.
          </p>
        </div>
      </header>

      {/* --- KPI row overlapping the band ----------------------------- */}
      {/* `relative` is load-bearing: the hero band is positioned, so a static
          grid here would paint underneath it instead of overlapping. */}
      <div className="relative z-10 mx-auto -mt-16 max-w-[1280px] px-6 lg:px-10">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          <StatTile
            label="재원생"
            value={kpis.activeStudents}
            unit={`/ ${totalStudents}명`}
            icon={Users}
            tint="canvas"
            className="shadow-card"
            caption="정상 출석 중"
          />
          <StatTile
            label="이탈 위험군"
            value={kpis.atRiskStudents}
            unit="명"
            icon={UserCheck}
            tint="rose"
            className="shadow-card"
            caption="즉시 개입 필요"
          />
          <StatTile
            label="월 매출"
            value={formatWonCompact(kpis.monthlyRevenue)}
            unit="원"
            icon={Coins}
            tint="canvas"
            className="shadow-card"
            caption={`공헌이익 ${formatWonCompact(kpis.monthlyMargin)}원`}
          />
          <StatTile
            label="평균 출석률"
            value={formatPercent(kpis.averageAttendanceRate)}
            icon={TrendingUp}
            tint="canvas"
            className="shadow-card"
            caption="최근 30일"
          />
          <StatTile
            label="평균 재등록률"
            value={formatPercent(kpis.averageRetentionRate)}
            icon={Repeat2}
            tint="canvas"
            className="shadow-card"
            caption="직전 사이클"
          />
          <StatTile
            label="기록 충실도"
            value={formatPercent(kpis.logCoverageRate)}
            icon={ClipboardCheck}
            tint="mint"
            className="shadow-card"
            caption="태그·코멘트 입력률"
          />
        </div>
      </div>

      {/* --- Body ------------------------------------------------------ */}
      <main className="mx-auto max-w-[1280px] space-y-8 px-6 py-10 lg:px-10">
        <ChurnAlertPanel onInspect={setInspected} />

        <ClassPerformanceTable />

        <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
          <CurriculumPanel />
          <RecentActivityPanel onInspect={setInspected} />
        </div>
      </main>

      <StudentDetailModal student={inspected} onClose={() => setInspected(null)} />
    </div>
  );
}
