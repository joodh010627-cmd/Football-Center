/**
 * 원생 명단.
 *
 * At ~100 students the owner needs a way to find one person without scrolling
 * the whole academy. Filters are chips and a select — no free-text search,
 * because the alert queue is what surfaces "who to look at" in practice.
 */

import { useMemo, useState } from 'react';
import { Users } from 'lucide-react';
import type { Student, StudentStatus } from '@/types';
import { useApp } from '@/store/AppContext';
import { STUDENT_STATUS_LABEL } from '@/data/dates';
import { attendanceRateForStudent } from '@/data/selectors';
import { formatDateShort, formatPercent, formatWonCompact } from '@/lib/format';
import { cn } from '@/lib/cn';

const STATUS_FILTERS: Array<{ key: StudentStatus | 'all'; label: string }> = [
  { key: 'all', label: '전체' },
  { key: 'active', label: '정상' },
  { key: 'at_risk', label: '이탈 위험' },
  { key: 'inactive', label: '휴원' },
];

const STATUS_STYLE: Record<StudentStatus, string> = {
  active: 'bg-tint-mint text-brand-green',
  at_risk: 'bg-tint-alert text-error',
  inactive: 'bg-tint-gray text-steel',
};

const PAGE_SIZE = 15;

export function RosterPanel({ onInspect }: { onInspect: (s: Student) => void }) {
  const { state, getClass, getFee } = useApp();
  const [status, setStatus] = useState<StudentStatus | 'all'>('all');
  const [classId, setClassId] = useState<string>('all');
  const [limit, setLimit] = useState(PAGE_SIZE);

  const rows = useMemo(() => {
    return state.students
      .filter((s) => (status === 'all' ? true : s.status === status))
      .filter((s) => (classId === 'all' ? true : s.classId === classId))
      // Highest churn first — the roster should never bury a problem.
      .sort((a, b) => b.churnScore - a.churnScore);
  }, [state.students, status, classId]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: state.students.length, active: 0, at_risk: 0, inactive: 0 };
    for (const s of state.students) c[s.status] += 1;
    return c;
  }, [state.students]);

  const visible = rows.slice(0, limit);

  return (
    <div className="overflow-hidden rounded-lg border border-hairline bg-canvas">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-hairline px-5 py-5 sm:px-6">
        <div>
          <h2 className="flex items-center gap-2 text-[17px] font-semibold tracking-[-0.02em] text-ink">
            <Users size={17} className="text-primary" />
            전체 명부
          </h2>
          <p className="mt-1 text-sm text-slate">
            총 {state.students.length}명 · 이탈 위험도 높은 순
          </p>
        </div>

        <select
          value={classId}
          onChange={(e) => {
            setClassId(e.target.value);
            setLimit(PAGE_SIZE);
          }}
          className="h-10 rounded-full border border-hairline-strong bg-canvas px-4 text-sm text-ink"
        >
          <option value="all">전체 클래스</option>
          {state.classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </header>

      <div className="flex flex-wrap gap-2 border-b border-hairline-soft px-5 py-3 sm:px-6">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => {
              setStatus(f.key);
              setLimit(PAGE_SIZE);
            }}
            className={cn('pill-tab', status === f.key && 'pill-tab-active')}
          >
            {f.label} {counts[f.key] ?? 0}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-hairline bg-surface-soft text-[12px] uppercase tracking-wide text-steel">
              <th className="px-5 py-3 text-left font-semibold">원생</th>
              <th className="px-5 py-3 text-left font-semibold">클래스</th>
              <th className="px-5 py-3 text-center font-semibold">상태</th>
              <th className="px-5 py-3 text-right font-semibold">위험도</th>
              <th className="px-5 py-3 text-right font-semibold">30일 출석률</th>
              <th className="px-5 py-3 text-right font-semibold">최종 출석</th>
              <th className="px-5 py-3 text-right font-semibold">월 수강료</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((s) => (
              <tr key={s.id} className="border-b border-hairline-soft transition-colors hover:bg-surface-soft">
                <td className="px-5 py-3">
                  <button
                    type="button"
                    onClick={() => onInspect(s)}
                    className="font-semibold text-ink underline-offset-4 transition-colors hover:text-primary hover:underline"
                  >
                    {s.name}
                  </button>
                  <span className="ml-2 text-[12px] text-steel">{s.ageGroup}</span>
                </td>
                <td className="px-5 py-3 text-charcoal">{getClass(s.classId)?.title}</td>
                <td className="px-5 py-3 text-center">
                  <span className={cn('rounded-sm px-2 py-0.5 text-[12px] font-semibold', STATUS_STYLE[s.status])}>
                    {STUDENT_STATUS_LABEL[s.status]}
                  </span>
                </td>
                <td
                  className={cn(
                    'px-5 py-3 text-right font-semibold tabular-nums',
                    s.churnScore >= 78 ? 'text-error' : s.churnScore >= 55 ? 'text-brand-orange-deep' : 'text-charcoal',
                  )}
                >
                  {s.churnScore}
                </td>
                <td className="px-5 py-3 text-right tabular-nums text-charcoal">
                  {formatPercent(attendanceRateForStudent(state.attendanceLogs, s.id))}
                </td>
                <td className="px-5 py-3 text-right tabular-nums text-steel">
                  {formatDateShort(s.lastAttendanceDate)}
                </td>
                <td className="px-5 py-3 text-right tabular-nums text-charcoal">
                  {formatWonCompact(getFee(s.id))}원
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {limit < rows.length && (
        <div className="border-t border-hairline px-5 py-4 text-center sm:px-6">
          <button type="button" onClick={() => setLimit((n) => n + PAGE_SIZE)} className="btn-secondary">
            {rows.length - limit}명 더 보기
          </button>
        </div>
      )}
    </div>
  );
}
