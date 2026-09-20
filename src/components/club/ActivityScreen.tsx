/**
 * 활동 기록 — the ledger, read end to end.
 *
 * Grouped by day rather than paged, because the question people bring here is
 * always dated: "what happened last Tuesday", "did anyone call them back after
 * the trial". A flat infinite list answers neither without scrolling and
 * counting.
 *
 * What is in here is what `deriveActivity` can reconstruct from persisted rows
 * plus what this session recorded. In a coach's session the owner-only sources
 * come back empty and simply produce no rows — the ledger narrows itself by
 * what the query returned, not by a filter in the UI.
 */

import { useMemo, useState, type ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useWorkspace } from '@/store/WorkspaceContext';
import { TODAY, addDays, timeOf } from '@/data/dates';
import {
  ACTIVITY_GROUP_LABEL,
  ACTIVITY_META,
  groupByDay,
  type ActivityGroup,
} from '@/data/activity';
import { formatDateKo } from '@/lib/format';
import { cn } from '@/lib/cn';
import { ScreenBody, ScreenHeader } from '@/components/shell/Shell';

type Filter = 'all' | ActivityGroup;

const GROUPS: ActivityGroup[] = ['session', 'lead', 'student', 'curriculum'];

/** Cap the timeline rather than paginating — a ledger is read from the top. */
const LIMIT = 120;

export function ActivityScreen({ onBack }: { onBack: () => void }) {
  const { activity } = useWorkspace();
  const [filter, setFilter] = useState<Filter>('all');

  const days = useMemo(() => {
    const rows =
      filter === 'all'
        ? activity
        : activity.filter((e) => ACTIVITY_META[e.kind].group === filter);
    return groupByDay(rows.slice(0, LIMIT));
  }, [activity, filter]);

  const counts = useMemo(() => {
    const out = { session: 0, lead: 0, student: 0, curriculum: 0 } as Record<
      ActivityGroup,
      number
    >;
    for (const event of activity) out[ACTIVITY_META[event.kind].group] += 1;
    return out;
  }, [activity]);

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
        title="활동 기록"
        meta="이 앱에서 일어난 일이 시간 순서대로 남습니다. 지워지지 않습니다."
      />

      <ScreenBody>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          <Chip active={filter === 'all'} onClick={() => setFilter('all')}>
            전체 {activity.length}
          </Chip>
          {GROUPS.map((group) => (
            <Chip
              key={group}
              active={filter === group}
              onClick={() => setFilter(filter === group ? 'all' : group)}
            >
              {ACTIVITY_GROUP_LABEL[group]} {counts[group]}
            </Chip>
          ))}
        </div>

        {days.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-hairline-strong bg-canvas px-4 py-10 text-center text-[13.5px] text-steel">
            아직 기록된 활동이 없습니다.
          </p>
        ) : (
          <div className="mt-5 space-y-6">
            {days.map(([day, events]) => (
              <section key={day}>
                <h2 className="sticky top-14 z-10 -mx-1 bg-surface-soft/90 px-1 py-1 text-[12.5px] font-bold text-steel backdrop-blur lg:top-0">
                  {day === TODAY
                    ? '오늘'
                    : day === addDays(TODAY, -1)
                      ? '어제'
                      : formatDateKo(day)}
                </h2>

                <ol className="relative mt-2 space-y-4 border-l border-hairline-soft pl-4">
                  {events.map((event) => (
                    <li key={event.id} className="relative">
                      <span
                        className={cn(
                          'absolute -left-[21px] top-[7px] h-2 w-2 rounded-full ring-2 ring-surface-soft',
                          ACTIVITY_META[event.kind].dot,
                        )}
                      />
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="min-w-0 text-[14.5px] font-semibold text-ink">
                          <span className="text-primary">{event.subjectLabel}</span>
                          <span className="ml-1.5 font-normal text-charcoal">{event.summary}</span>
                        </p>
                        <span className="shrink-0 text-[12px] tabular-nums text-stone">
                          {timeOf(event.at)}
                        </span>
                      </div>
                      {event.detail && (
                        <p className="mt-0.5 text-[13px] leading-[1.55] text-slate">
                          {event.detail}
                        </p>
                      )}
                      <p className="mt-0.5 text-[12px] text-stone">
                        {ACTIVITY_META[event.kind].label}
                        {event.actorName && ` · ${event.actorName}`}
                      </p>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        )}

        {activity.length > LIMIT && (
          <p className="mt-6 text-center text-[12.5px] text-stone">
            최근 {LIMIT}건만 표시하고 있습니다.
          </p>
        )}
      </ScreenBody>
    </>
  );
}

function Chip({
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
