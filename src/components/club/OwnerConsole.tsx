/**
 * 세부 관리 — the owner's extra, behind one door.
 *
 * This is the old `AdminDashboard`, demoted. It used to *be* the owner's
 * application: they logged in and landed on a P&L, which quietly said that
 * running a football centre is a spreadsheet exercise. It isn't. The owner
 * teaches, watches sessions and talks to parents like everyone else, so they now
 * land on 클래스 with the coaches and reach this by choosing to.
 *
 * Nothing about the permission model changed. Every figure here still comes from
 * an owner-only table with an owner-only policy; a coach who reached this screen
 * would find it full of zeroes because the queries returned nothing, not because
 * the component hid anything.
 */

import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ClipboardCheck,
  Coins,
  FileSpreadsheet,
  Repeat2,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react';
import type { Student } from '@/types';
import { useApp } from '@/store/AppContext';
import { buildAlertQueue, buildClassPerformance, buildKpis } from '@/data/selectors';
import { formatPercent, formatWon, formatWonCompact } from '@/lib/format';
import { cn } from '@/lib/cn';
import { ScreenBody, ScreenHeader, Section } from '@/components/shell/Shell';
import { Swap } from '@/components/ui/Motion';
import { ChurnAlertPanel } from '@/components/admin/ChurnAlertPanel';
import { ClassPerformanceTable } from '@/components/admin/ClassPerformanceTable';
import { CurriculumPanel } from '@/components/admin/CurriculumPanel';
import { RecentActivityPanel } from '@/components/admin/RecentActivityPanel';
import { StudentDetailModal } from '@/components/admin/StudentDetailModal';
import { ImportPanel } from '@/components/import/ImportPanel';
import { commitImport } from '@/data/importCommit';

type View = 'overview' | 'alerts' | 'classes' | 'ops' | 'import';

/** A class below either of these is worth a second look on the overview. */
const MARGIN_WARNING = 0.25;
const RETENTION_TARGET = 0.8;

const VIEWS: Array<{ key: View; label: string }> = [
  { key: 'overview', label: '개요' },
  { key: 'alerts', label: '이탈 위험' },
  { key: 'classes', label: '클래스 성과' },
  { key: 'ops', label: '운영 품질' },
  { key: 'import', label: '가져오기' },
];

interface OwnerConsoleProps {
  onBack: () => void;
  onOpenStudent: (student: Student) => void;
}

export function OwnerConsole({ onBack, onOpenStudent }: OwnerConsoleProps) {
  const { slice, state, churnSignals, getFee, refresh } = useApp();
  const [view, setView] = useState<View>('overview');
  const [inspected, setInspected] = useState<Student | null>(null);

  const kpis = useMemo(() => buildKpis(slice), [slice]);
  const queue = useMemo(() => buildAlertQueue(slice, churnSignals), [slice, churnSignals]);
  const performance = useMemo(() => buildClassPerformance(slice), [slice]);

  const revenueAtRisk = queue.reduce((sum, { student }) => sum + getFee(student.id), 0);

  const watchlist = performance
    .filter((p) => p.marginRate < MARGIN_WARNING || p.retentionRate < RETENTION_TARGET)
    .sort((a, b) => a.marginRate - b.marginRate)
    .slice(0, 4);

  return (
    <>
      <header className="px-5 pb-1 pt-5 sm:px-7 lg:px-10 lg:pt-8">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-[13.5px] font-medium text-steel transition-colors hover:text-ink"
        >
          <ArrowLeft size={15} strokeWidth={2.2} />
          클럽
        </button>
      </header>

      <ScreenHeader
        eyebrow="Owner only"
        title="세부 관리"
        meta={
          queue.length > 0
            ? `이탈 위험 ${queue.length}명 · 위험 매출 월 ${formatWonCompact(revenueAtRisk)}원`
            : '위험군이 모두 처리되었습니다'
        }
      />

      <ScreenBody>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => {
                setView(v.key);
                window.scrollTo({ top: 0 });
              }}
              className={cn(
                'shrink-0 pill-tab whitespace-nowrap',
                view === v.key && 'pill-tab-active',
              )}
            >
              {v.label}
              {v.key === 'alerts' && queue.length > 0 && ` ${queue.length}`}
            </button>
          ))}
        </div>

        <Swap k={view}>
          {view === 'overview' && (
            <>
              {/* --- KPIs ------------------------------------------------- */}
              <div className="mt-5 grid grid-cols-2 gap-2.5 lg:grid-cols-3">
                <Kpi
                  icon={Users}
                  label="재원생"
                  value={`${kpis.activeStudents}`}
                  unit={`/ ${state.students.length}명`}
                  caption="정상 출석 중"
                />
                <Kpi
                  icon={UserCheck}
                  label="이탈 위험군"
                  value={`${kpis.atRiskStudents}`}
                  unit="명"
                  caption="즉시 개입 필요"
                  tone="alert"
                  onClick={() => setView('alerts')}
                />
                <Kpi
                  icon={Coins}
                  label="월 매출"
                  value={formatWonCompact(kpis.monthlyRevenue)}
                  unit="원"
                  caption={`공헌이익 ${formatWonCompact(kpis.monthlyMargin)}원`}
                  onClick={() => setView('classes')}
                />
                <Kpi
                  icon={TrendingUp}
                  label="평균 출석률"
                  value={formatPercent(kpis.averageAttendanceRate)}
                  caption="최근 30일"
                  onClick={() => setView('ops')}
                />
                <Kpi
                  icon={Repeat2}
                  label="평균 재등록률"
                  value={formatPercent(kpis.averageRetentionRate)}
                  caption="직전 사이클"
                  onClick={() => setView('classes')}
                />
                <Kpi
                  icon={ClipboardCheck}
                  label="기록 충실도"
                  value={formatPercent(kpis.logCoverageRate)}
                  caption="태그·코멘트 입력률"
                  onClick={() => setView('ops')}
                />
              </div>

              {/* --- Watchlist --------------------------------------------- */}
              <Section title="점검이 필요한 클래스" meta={`${watchlist.length}개 반`}>
                {watchlist.length === 0 ? (
                  <div className="rounded-lg border border-hairline bg-canvas px-4 py-8 text-center">
                    <ShieldCheck size={24} className="mx-auto text-brand-green" strokeWidth={1.9} />
                    <p className="mt-2 text-[14.5px] font-semibold text-ink">
                      모든 반이 목표 마진·재등록률을 넘겼습니다
                    </p>
                  </div>
                ) : (
                  <ul className="overflow-hidden rounded-lg border border-hairline bg-canvas">
                    {watchlist.map((row) => (
                      <li
                        key={row.classId}
                        className="flex items-center gap-3 border-b border-hairline-soft px-4 py-3.5 last:border-b-0"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-semibold text-ink">
                            {row.title}
                          </span>
                          <span className="mt-0.5 block truncate text-[12.5px] text-steel">
                            {row.coachName} 코치 · {row.headcount}/{row.capacity}명
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span
                            className={cn(
                              'block text-[14px] font-semibold tabular-nums',
                              row.marginRate < MARGIN_WARNING
                                ? 'text-brand-orange-deep'
                                : 'text-ink',
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
              </Section>

              <Section title="지금 연락해야 할 원생" meta={`${queue.length}명`}>
                {queue.length === 0 ? (
                  <p className="rounded-lg border border-hairline bg-canvas px-4 py-8 text-center text-[13.5px] text-steel">
                    위험군이 모두 처리되었습니다.
                  </p>
                ) : (
                  <ul className="overflow-hidden rounded-lg border border-hairline bg-canvas">
                    {queue.slice(0, 5).map(({ student, signal, className }) => (
                      <li
                        key={student.id}
                        className="border-b border-hairline-soft last:border-b-0"
                      >
                        <button
                          type="button"
                          onClick={() => onOpenStudent(student)}
                          className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-soft"
                        >
                          <span
                            className={cn(
                              'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold tabular-nums',
                              signal.severity === 'critical'
                                ? 'bg-error text-white'
                                : 'bg-tint-alert text-error',
                            )}
                          >
                            {signal.computable ? signal.score : '—'}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[15px] font-semibold text-ink">
                              {student.name}
                              <span className="ml-2 text-[12.5px] font-normal text-steel">
                                {className}
                              </span>
                            </span>
                            <span className="mt-0.5 block truncate text-[13px] text-slate">
                              {signal.reasons[0] ?? '출결 기록 없음'}
                            </span>
                          </span>
                          <span className="shrink-0 text-[13px] font-semibold tabular-nums text-charcoal">
                            월 {(getFee(student.id) / 10_000).toFixed(0)}만
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            </>
          )}

          {view === 'alerts' && (
            <div className="mt-5">
              <ChurnAlertPanel onInspect={setInspected} />
            </div>
          )}

          {view === 'classes' && (
            <div className="mt-5 overflow-x-auto">
              <ClassPerformanceTable />
            </div>
          )}

          {view === 'ops' && (
            <div className="mt-5 grid gap-4 xl:grid-cols-[1.15fr_1fr]">
              <CurriculumPanel />
              <RecentActivityPanel onInspect={setInspected} />
            </div>
          )}

          {view === 'import' && (
            <div className="mt-5">
              <p className="mb-4 flex items-start gap-2 rounded-lg bg-surface px-4 py-3 text-[13px] leading-[1.6] text-slate">
                <FileSpreadsheet size={16} className="mt-0.5 shrink-0 text-primary" />
                쓰시던 엑셀을 그대로 올리면 열의 뜻을 알아서 판별합니다. 양식을 맞추실 필요
                없습니다.
              </p>
              <ImportPanel
                onCommit={async (r) => {
                  const summary = await commitImport(state.academyId, r, state.classes);
                  // 적재 후 다시 읽어야 대시보드 숫자가 새 원생을 포함한다.
                  refresh();
                  return summary;
                }}
              />
            </div>
          )}
        </Swap>
      </ScreenBody>

      <StudentDetailModal student={inspected} onClose={() => setInspected(null)} />
    </>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  unit,
  caption,
  tone = 'neutral',
  onClick,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  unit?: string;
  caption: string;
  tone?: 'neutral' | 'alert';
  onClick?: () => void;
}) {
  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      className={cn(
        'rounded-lg border border-hairline bg-canvas px-3.5 py-3 text-left',
        onClick && 'transition-colors duration-200 hover:border-hairline-strong',
      )}
    >
      <span className="flex items-center gap-1.5">
        <Icon
          size={14}
          strokeWidth={2.2}
          className={tone === 'alert' ? 'text-error' : 'text-primary'}
        />
        <span className="truncate text-[11.5px] font-semibold text-steel">{label}</span>
      </span>
      <span className="mt-1.5 block">
        <span
          className={cn(
            'text-[22px] font-bold tabular-nums tracking-tightest',
            tone === 'alert' ? 'text-error' : 'text-ink',
          )}
        >
          {value}
        </span>
        {unit && <span className="ml-1 text-[12.5px] font-medium text-steel">{unit}</span>}
      </span>
      <span className="mt-0.5 block truncate text-[11.5px] text-stone">{caption}</span>
    </Wrapper>
  );
}
