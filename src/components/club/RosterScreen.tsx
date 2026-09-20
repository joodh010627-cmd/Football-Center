/**
 * 원생 명단.
 *
 * A list, not the old table. The table was right for a 1440px dashboard and
 * unusable on the device the coach actually holds — eight columns collapsed to
 * a horizontal scroll, and the column that mattered (이탈 위험) was the one off
 * the right edge.
 *
 * Sorted by risk rather than by name. An alphabetical roster is a filing
 * cabinet; this one is a worklist, and the child at the top is the one to think
 * about first.
 */

import { useMemo, useState, type ReactNode } from 'react';
import { ArrowLeft, ChevronRight, Search } from 'lucide-react';
import type { Student } from '@/types';
import { useApp } from '@/store/AppContext';
import { STUDENT_STATUS_LABEL } from '@/data/dates';
import { AT_RISK_THRESHOLD } from '@/data/churn';
import { cn } from '@/lib/cn';
import { ScreenBody, ScreenHeader } from '@/components/shell/Shell';

type Filter = 'all' | 'at_risk' | 'inactive';

const STATUS_STYLE: Record<Student['status'], string> = {
  active: 'bg-tint-mint text-brand-green',
  at_risk: 'bg-tint-alert text-error',
  inactive: 'bg-surface text-steel',
};

interface RosterScreenProps {
  owner: boolean;
  onBack: () => void;
  onOpenStudent: (student: Student) => void;
}

export function RosterScreen({ owner, onBack, onOpenStudent }: RosterScreenProps) {
  const { state, churnSignals, getClass, getFee } = useApp();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return state.students
      .filter((s) => {
        if (filter === 'at_risk') return s.churnScore >= AT_RISK_THRESHOLD;
        if (filter === 'inactive') return s.status === 'inactive';
        return true;
      })
      .filter((s) => {
        if (!needle) return true;
        return (
          s.name.toLowerCase().includes(needle) ||
          s.parentName.toLowerCase().includes(needle) ||
          s.parentPhone.includes(needle)
        );
      })
      .sort((a, b) => b.churnScore - a.churnScore || a.name.localeCompare(b.name, 'ko'));
  }, [state.students, query, filter]);

  const atRisk = state.students.filter((s) => s.churnScore >= AT_RISK_THRESHOLD).length;
  const inactive = state.students.filter((s) => s.status === 'inactive').length;

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
        title="원생 명단"
        meta={`전체 ${state.students.length}명 · 이탈 위험 높은 순`}
      />

      <ScreenBody>
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone"
          />
          <input
            className="input-field pl-10"
            placeholder="이름 · 학부모 · 연락처"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="mt-3 flex gap-1.5 overflow-x-auto no-scrollbar">
          <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>
            전체 {state.students.length}
          </FilterChip>
          <FilterChip active={filter === 'at_risk'} onClick={() => setFilter('at_risk')}>
            이탈 위험 {atRisk}
          </FilterChip>
          <FilterChip active={filter === 'inactive'} onClick={() => setFilter('inactive')}>
            휴원 {inactive}
          </FilterChip>
        </div>

        {rows.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-hairline-strong bg-canvas px-4 py-10 text-center text-[13.5px] text-steel">
            조건에 맞는 원생이 없습니다.
          </p>
        ) : (
          <ul className="mt-4 overflow-hidden rounded-lg border border-hairline bg-canvas">
            {rows.map((student) => {
              const signal = churnSignals.get(student.id);
              const cls = getClass(student.classId);

              return (
                <li key={student.id} className="border-b border-hairline-soft last:border-b-0">
                  <button
                    type="button"
                    onClick={() => onOpenStudent(student)}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors duration-150 hover:bg-surface-soft"
                  >
                    <span
                      className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-bold tabular-nums',
                        !signal?.computable
                          ? 'bg-surface text-stone'
                          : student.churnScore >= 75
                            ? 'bg-error text-white'
                            : student.churnScore >= AT_RISK_THRESHOLD
                              ? 'bg-tint-alert text-error'
                              : 'bg-primary-wash text-primary',
                      )}
                    >
                      {/* A student with no attendance history has no score. "0"
                          would read as "safe" when it means "unknown". */}
                      {signal?.computable ? student.churnScore : '—'}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-1.5">
                        <span className="truncate text-[15.5px] font-semibold text-ink">
                          {student.name}
                        </span>
                        <span className="shrink-0 text-[12.5px] text-steel">
                          {student.ageGroup}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-[13px] text-steel">
                        {cls?.title ?? '미배정'}
                        {owner && getFee(student.id) > 0 &&
                          ` · 월 ${(getFee(student.id) / 10_000).toFixed(0)}만원`}
                      </span>
                    </span>

                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold',
                        STATUS_STYLE[student.status],
                      )}
                    >
                      {STUDENT_STATUS_LABEL[student.status]}
                    </span>
                    <ChevronRight size={16} className="shrink-0 text-stone" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </ScreenBody>
    </>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('shrink-0 pill-tab whitespace-nowrap', active && 'pill-tab-active')}
    >
      {children}
    </button>
  );
}
