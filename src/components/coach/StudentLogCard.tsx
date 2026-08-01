import { AlertTriangle, ChevronDown } from 'lucide-react';
import type { AttendanceStatus, Student } from '@/types';
import { ATTENDANCE_LABEL, ATTENDANCE_STYLE } from '@/lib/format';
import { cn } from '@/lib/cn';
import { TagRail } from './TagRail';

/** Tapping the status pill walks this cycle — no menu, no modal. */
const NEXT_STATUS: Record<AttendanceStatus, AttendanceStatus> = {
  present: 'absent',
  absent: 'injured',
  injured: 'present',
};

interface StudentLogCardProps {
  student: Student;
  status: AttendanceStatus;
  tags: string[];
  /** Selected = expanded inline on mobile, shown in the side panel on desktop. */
  selected: boolean;
  onSelect: () => void;
  onCycleStatus: () => void;
  onToggleTag: (tag: string) => void;
}

export function StudentLogCard({
  student,
  status,
  tags,
  selected,
  onSelect,
  onCycleStatus,
  onToggleTag,
}: StudentLogCardProps) {
  const style = ATTENDANCE_STYLE[status];
  const atRisk = student.status === 'at_risk';

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border bg-canvas transition-shadow duration-150',
        selected ? 'border-primary shadow-card' : 'border-hairline',
      )}
    >
      <div className="flex items-stretch">
        {/* Status strip doubles as the traffic light. */}
        <span className={cn('w-1.5 shrink-0', style.dot)} />

        <button
          type="button"
          onClick={onSelect}
          className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-3 pr-2 text-left"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface text-[15px] font-semibold text-charcoal">
            {student.name.slice(-2)}
          </span>

          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="truncate text-[15px] font-semibold text-ink">{student.name}</span>
              {atRisk && (
                <AlertTriangle size={13} className="shrink-0 text-error" strokeWidth={2.4} />
              )}
            </span>
            <span className="mt-0.5 block truncate text-[12px] text-stone">
              {tags.length > 0 ? tags.join(' · ') : `${student.ageGroup} · 태그를 추가하려면 탭`}
            </span>
          </span>

          <ChevronDown
            size={16}
            className={cn(
              'shrink-0 text-stone transition-transform duration-150 lg:hidden',
              selected && 'rotate-180',
            )}
          />
        </button>

        {/* One touch = one status change. */}
        <button
          type="button"
          onClick={onCycleStatus}
          aria-label={`${student.name} 출결 상태: ${ATTENDANCE_LABEL[status]}. 탭하여 ${ATTENDANCE_LABEL[NEXT_STATUS[status]]}(으)로 변경`}
          className={cn(
            'my-2 mr-2 flex w-[62px] shrink-0 items-center justify-center rounded-md border-2 text-[13px] font-semibold transition-transform duration-150 active:scale-90',
            style.ring,
            style.text,
          )}
        >
          {ATTENDANCE_LABEL[status]}
        </button>
      </div>

      {/* Inline expansion is the mobile affordance only — on desktop the tag
          rail lives in the persistent side panel instead. */}
      {selected && (
        <div className="animate-fade-in border-t border-hairline bg-surface-soft px-3 py-3 lg:hidden">
          {status === 'present' ? (
            <TagRail selected={tags} onToggle={onToggleTag} />
          ) : (
            <p className="py-2 text-center text-[13px] text-slate">
              {ATTENDANCE_LABEL[status]} 처리된 원생은 행동 태그를 기록하지 않습니다.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export { NEXT_STATUS };
