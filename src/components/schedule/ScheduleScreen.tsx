/**
 * 일정 — the month.
 *
 * A month grid with a dot per session, and the chosen day's list underneath.
 * The grid only says "something is on"; what is on, and in what state, is the
 * list — so each cell stays a number and at most three dots, readable on a
 * phone, and nothing on the grid needs a legend.
 *
 * Trials sit in the same list as classes. A 체험 is an hour where a stranger
 * walks in and decides whether to pay for a year, and putting it on a separate
 * CRM screen is exactly how a coach ends up not knowing they were coming.
 */

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, UserPlus } from 'lucide-react';
import type { Class, ID, ISODate } from '@/types';
import { useApp } from '@/store/AppContext';
import { useWorkspace } from '@/store/WorkspaceContext';
import { THIS_MONTH, TODAY, inMonth, monthGrid, shiftMonth, type YearMonth } from '@/data/dates';
import { buildDay, trialsForDay } from '@/data/today';
import { STAGE_META } from '@/data/crm';
import { cn } from '@/lib/cn';
import { ScreenBody, ScreenHeader, Section } from '@/components/shell/Shell';
import { DayRow } from '@/components/home/ClassHomeScreen';

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];

interface ScheduleScreenProps {
  coachId: ID | null;
  onOpenSession: (cls: Class, date: ISODate) => void;
  onPick: (cls: Class, date: ISODate) => void;
  onRecord: (cls: Class, date: ISODate) => void;
  onOpenLead: (leadId: ID) => void;
}

export function ScheduleScreen({
  coachId,
  onOpenSession,
  onPick,
  onRecord,
  onOpenLead,
}: ScheduleScreenProps) {
  const { slice, state } = useApp();
  const { leads } = useWorkspace();

  const [month, setMonth] = useState<YearMonth>(THIS_MONTH);
  const [picked, setPicked] = useState<ISODate>(TODAY);

  // One pass over the grid, so the dots and the list below can never disagree
  // about whether a day has anything on it.
  const days = useMemo(
    () =>
      monthGrid(month).map((date) => ({
        date,
        entries: buildDay(slice, date, TODAY, coachId),
        trials: trialsForDay(leads, state.classes, date),
      })),
    [month, slice, coachId, leads, state.classes],
  );

  const selected = days.find((d) => d.date === picked) ?? {
    date: picked,
    entries: buildDay(slice, picked, TODAY, coachId),
    trials: trialsForDay(leads, state.classes, picked),
  };

  const shift = (delta: number) => {
    const next = shiftMonth(month, delta);
    setMonth(next);
    // Land on the 1st of the new month — or today, if paging back to it.
    const first = `${next.year}-${String(next.month + 1).padStart(2, '0')}-01`;
    setPicked(inMonth(TODAY, next) ? TODAY : first);
  };

  const count = selected.entries.length + selected.trials.length;

  return (
    <>
      <ScreenHeader
        title={`${month.year !== THIS_MONTH.year ? `${month.year}년 ` : ''}${month.month + 1}월`}
        action={
          <div className="flex items-center gap-1">
            <StepButton dir="prev" onClick={() => shift(-1)} />
            <StepButton dir="next" onClick={() => shift(1)} />
          </div>
        }
      />

      <ScreenBody>
        <div className="lg:max-w-2xl">
          {/* --- Month grid -------------------------------------------------- */}
          <div className="grid grid-cols-7">
            {WEEKDAY.map((w, i) => (
              <span
                key={w}
                className={cn(
                  'pb-2 text-center text-[12px] font-semibold',
                  i === 0 ? 'text-error/70' : i === 6 ? 'text-link' : 'text-stone',
                )}
              >
                {w}
              </span>
            ))}

            {days.map(({ date, entries, trials }) => {
              const active = date === picked;
              const load = entries.length + trials.length;
              const own = inMonth(date, month);
              const needsLog = entries.some((e) => e.state === 'needs_log');

              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => setPicked(date)}
                  aria-current={active ? 'date' : undefined}
                  aria-label={`${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일, 일정 ${load}개`}
                  className="flex h-[52px] flex-col items-center justify-start gap-1 pt-1.5"
                >
                  <span
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full text-[14.5px] font-semibold tabular-nums transition-colors',
                      active
                        ? 'bg-ink text-white'
                        : date === TODAY
                          ? 'text-primary ring-1 ring-primary'
                          : own
                            ? 'text-ink hover:bg-surface'
                            : 'text-muted',
                    )}
                  >
                    {Number(date.slice(8, 10))}
                  </span>
                  <span className="flex h-1.5 items-center gap-[3px]">
                    {Array.from({ length: Math.min(load, 3) }, (_, i) => (
                      <span
                        key={i}
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          needsLog && i === 0
                            ? 'bg-primary-deep'
                            : own
                              ? 'bg-primary-soft'
                              : 'bg-hairline',
                        )}
                      />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>

          {/* --- The chosen day ---------------------------------------------- */}
          <Section
            title={
              selected.date === TODAY
                ? '오늘'
                : `${Number(selected.date.slice(5, 7))}월 ${Number(selected.date.slice(8, 10))}일`
            }
            meta={count === 0 ? undefined : `${count}개`}
          >
            {count === 0 ? (
              <p className="rounded-lg border border-dashed border-hairline-strong bg-canvas px-4 py-8 text-center text-[14px] text-steel">
                일정이 없어요
              </p>
            ) : (
              <ul className="overflow-hidden rounded-lg border border-hairline bg-canvas">
                {selected.entries.map((entry) => (
                  <DayRow
                    key={entry.cls.id}
                    entry={entry}
                    onOpen={() => onOpenSession(entry.cls, selected.date)}
                    onAct={() =>
                      entry.state === 'needs_log'
                        ? onRecord(entry.cls, selected.date)
                        : entry.unplanned && entry.state !== 'done'
                          ? onPick(entry.cls, selected.date)
                          : onOpenSession(entry.cls, selected.date)
                    }
                  />
                ))}

                {selected.trials.map(({ lead, cls, startTime }) => (
                  <li key={lead.id} className="border-b border-hairline-soft last:border-b-0">
                    <button
                      type="button"
                      onClick={() => onOpenLead(lead.id)}
                      className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors duration-150 hover:bg-surface-soft"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-tint-yellow text-charcoal">
                        <UserPlus size={16} strokeWidth={2.2} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="text-[14.5px] font-semibold tabular-nums text-charcoal">
                            {startTime}
                          </span>
                          <span className="truncate text-[15.5px] font-semibold text-ink">
                            {lead.childName} 체험
                          </span>
                        </span>
                        <span className="mt-0.5 block truncate text-[13px] text-steel">
                          {cls ? cls.title : '반 미정'}
                        </span>
                      </span>
                      <span
                        className={cn(
                          'shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-bold',
                          STAGE_META[lead.stage].pill,
                        )}
                      >
                        체험
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </ScreenBody>
    </>
  );
}

function StepButton({ dir, onClick }: { dir: 'prev' | 'next'; onClick: () => void }) {
  const Icon = dir === 'prev' ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={dir === 'prev' ? '이전 달' : '다음 달'}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-hairline text-steel transition-colors duration-200 hover:border-hairline-strong hover:text-ink"
    >
      <Icon size={17} strokeWidth={2.2} />
    </button>
  );
}
