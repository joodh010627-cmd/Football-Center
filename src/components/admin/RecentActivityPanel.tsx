/**
 * Live feed of what the coaches logged.
 *
 * Doubles as the owner's proof that the recording process is actually being
 * followed — an empty feed is itself the signal.
 */

import { useMemo } from 'react';
import { Activity, CheckCircle2 } from 'lucide-react';
import type { Student } from '@/types';
import { useApp } from '@/store/AppContext';
import { ATTENDANCE_LABEL, ATTENDANCE_STYLE, formatDateShort } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/cn';

interface RecentActivityPanelProps {
  onInspect: (student: Student) => void;
}

export function RecentActivityPanel({ onInspect }: RecentActivityPanelProps) {
  const { state, getStudent, getClass } = useApp();

  // Newest first, and only logs that actually carry an observation.
  const feed = useMemo(
    () =>
      [...state.attendanceLogs]
        .filter((l) => l.tags.length > 0 || l.coachComment)
        .sort((a, b) => (a.date < b.date ? 1 : -1))
        .slice(0, 12),
    [state.attendanceLogs],
  );

  const resolved = state.csActions.slice(0, 3);

  return (
    <section className="flex flex-col gap-4">
      {resolved.length > 0 && (
        <div className="rounded-lg border border-hairline bg-tint-mint/50 p-5">
          <h3 className="flex items-center gap-1.5 text-[15px] font-semibold text-ink">
            <CheckCircle2 size={15} className="text-brand-green" />
            최근 CS 조치
          </h3>
          <ul className="mt-2.5 space-y-1.5">
            {resolved.map((action) => (
              <li key={action.id} className="text-[13px] leading-[1.5] text-charcoal">
                <span className="font-semibold">{getStudent(action.studentId)?.name}</span> ·{' '}
                {action.note}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-hairline bg-canvas">
        <header className="border-b border-hairline px-5 py-4">
          <h2 className="flex items-center gap-2 text-[18px] font-semibold leading-[1.4] text-ink">
            <Activity size={17} className="text-primary" />
            현장 기록 피드
          </h2>
          <p className="mt-1 text-[13px] text-slate">코치가 태그한 원생별 행동 데이터</p>
        </header>

        <ul className="divide-y divide-hairline-soft overflow-y-auto">
          {feed.map((log) => {
            const student = getStudent(log.studentId);
            if (!student) return null;
            const style = ATTENDANCE_STYLE[log.status];

            return (
              <li key={log.id} className="px-5 py-3">
                <div className="flex items-center gap-2">
                  <span className={cn('h-2 w-2 shrink-0 rounded-full', style.dot)} />
                  <button
                    type="button"
                    onClick={() => onInspect(student)}
                    className="text-sm font-semibold text-ink underline-offset-4 transition-colors hover:text-primary hover:underline"
                  >
                    {student.name}
                  </button>
                  <span className="truncate text-[12px] text-steel">
                    {getClass(log.classId)?.title}
                  </span>
                  <span className="ml-auto shrink-0 text-[12px] text-stone">
                    {formatDateShort(log.date)} · {ATTENDANCE_LABEL[log.status]}
                  </span>
                </div>

                {log.tags.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {log.tags.map((tag) => (
                      <Badge key={tag} tone={tag === '#통증호소' ? 'orange' : 'purple'}>
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                {log.coachComment && (
                  <p className="mt-1.5 text-[13px] leading-[1.5] text-slate">{log.coachComment}</p>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
