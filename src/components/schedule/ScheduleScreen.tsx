/**
 * 일정 — the week.
 *
 * A week strip rather than a month grid, because the month grid already exists
 * one level down (per class) and answers a different question. Up here the
 * question is "what is the centre doing this week", and a phone can show seven
 * days honestly where it can only show 42 cells as dots.
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
import { TODAY, addDays, toISODate } from '@/data/dates';
import { buildDay, summarise, trialsForDay, type DayEntry } from '@/data/today';
import { STAGE_META } from '@/data/crm';
import { cn } from '@/lib/cn';
import { ScreenBody, ScreenHeader, Section } from '@/components/shell/Shell';
import { STATE_PILL } from '@/components/home/ClassHomeScreen';

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];

/** Monday of the week containing `iso`. */
function weekStart(iso: ISODate): ISODate {
  const d = new Date(`${iso}T00:00:00`);
  // getDay() is Sunday-first; the strip runs Monday-first like the screenshot,
  // so Sunday has to reach six days back rather than none.
  const offset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - offset);
  return toISODate(d);
}

interface ScheduleScreenProps {
  coachId: ID | null;
  onOpenClass: (cls: Class) => void;
  onDesign: (cls: Class, date: ISODate) => void;
  onRecord: (cls: Class, date: ISODate) => void;
  onOpenLead: (leadId: ID) => void;
}

export function ScheduleScreen({
  coachId,
  onOpenClass,
  onDesign,
  onRecord,
  onOpenLead,
}: ScheduleScreenProps) {
  const { slice, state, getCoach } = useApp();
  const { leads } = useWorkspace();

  const [monday, setMonday] = useState<ISODate>(() => weekStart(TODAY));
  const [picked, setPicked] = useState<ISODate>(TODAY);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(monday, i)),
    [monday],
  );

  // One pass over the week, so the dots under the strip and the list below can
  // never disagree about whether a day has anything on it.
  const week = useMemo(
    () =>
      days.map((date) => ({
        date,
        entries: buildDay(slice, date, TODAY, coachId),
        trials: trialsForDay(leads, state.classes, date),
      })),
    [days, slice, coachId, leads, state.classes],
  );

  const selected = week.find((d) => d.date === picked) ?? week[0];
  const summary = summarise(selected.entries);
  const month = Number(monday.slice(5, 7));

  const shift = (delta: number) => {
    // Land on the same weekday you were looking at, not back on today.
    const weekday = Math.max(days.indexOf(picked), 0);
    const next = addDays(monday, delta * 7);
    setMonday(next);
    setPicked(addDays(next, weekday));
  };

  return (
    <>
      <ScreenHeader
        eyebrow="This week"
        title={`${month}월 클래스 일정`}
        action={
          <div className="flex items-center gap-1">
            <StepButton dir="prev" onClick={() => shift(-1)} />
            <StepButton dir="next" onClick={() => shift(1)} />
          </div>
        }
      />

      <ScreenBody>
        {/* --- Week strip ------------------------------------------------ */}
        <div className="grid grid-cols-7 gap-1">
          {week.map(({ date, entries, trials }) => {
            const active = date === picked;
            const load = entries.length + trials.length;
            const day = new Date(`${date}T00:00:00`);

            return (
              <button
                key={date}
                type="button"
                onClick={() => setPicked(date)}
                aria-current={active ? 'date' : undefined}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-lg py-2.5 transition-colors duration-200',
                  active ? 'bg-primary-wash' : 'hover:bg-surface',
                )}
              >
                <span
                  className={cn(
                    'text-[11.5px] font-medium',
                    active ? 'text-primary' : 'text-stone',
                  )}
                >
                  {WEEKDAY[day.getDay()]}
                </span>
                <span
                  className={cn(
                    'text-[16px] font-bold tabular-nums',
                    active ? 'text-primary' : date === TODAY ? 'text-ink' : 'text-charcoal',
                  )}
                >
                  {day.getDate()}
                </span>
                <span className="flex h-1.5 items-center gap-[3px]">
                  {load === 0 ? (
                    <span className="h-1 w-1 rounded-full bg-hairline" />
                  ) : (
                    Array.from({ length: Math.min(load, 3) }, (_, i) => (
                      <span
                        key={i}
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          active ? 'bg-primary' : 'bg-primary-soft',
                        )}
                      />
                    ))
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {/* --- The chosen day -------------------------------------------- */}
        <Section
          title={selected.date === TODAY ? '오늘' : `${Number(selected.date.slice(8, 10))}일`}
          meta={
            selected.entries.length + selected.trials.length === 0
              ? '일정 없음'
              : `수업 ${summary.total}${selected.trials.length > 0 ? ` · 체험 ${selected.trials.length}` : ''}`
          }
        >
          {selected.entries.length + selected.trials.length === 0 ? (
            <p className="rounded-lg border border-dashed border-hairline-strong bg-canvas px-4 py-8 text-center text-[13.5px] text-steel">
              이 날은 예정된 수업이 없습니다.
            </p>
          ) : (
            <ul className="overflow-hidden rounded-lg border border-hairline bg-canvas">
              {selected.entries.map((entry) => (
                <ScheduleRow
                  key={entry.cls.id}
                  entry={entry}
                  coachName={getCoach(entry.cls.coachId)?.name ?? '미배정'}
                  onOpen={() => onOpenClass(entry.cls)}
                  onAct={() =>
                    entry.state === 'needs_log'
                      ? onRecord(entry.cls, selected.date)
                      : onDesign(entry.cls, selected.date)
                  }
                />
              ))}

              {selected.trials.map(({ lead, cls, startTime }) => (
                <li
                  key={lead.id}
                  className="border-b border-hairline-soft last:border-b-0"
                >
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
                        {lead.ageLabel} · {cls ? cls.title : '반 미정'} · {lead.parentName} 학부모
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
      </ScreenBody>
    </>
  );
}

function ScheduleRow({
  entry,
  coachName,
  onOpen,
  onAct,
}: {
  entry: DayEntry;
  coachName: string;
  onOpen: () => void;
  onAct: () => void;
}) {
  const pill = STATE_PILL[entry.state];

  return (
    <li className="flex items-center gap-3 border-b border-hairline-soft px-4 py-3.5 last:border-b-0">
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <span className="flex items-center gap-2">
          <span className="text-[14.5px] font-semibold tabular-nums text-charcoal">
            {entry.startTime}
          </span>
          <span className="truncate text-[15.5px] font-semibold text-ink">{entry.cls.title}</span>
        </span>
        <span className="mt-0.5 block truncate text-[13px] text-steel">
          {coachName} 코치 · {entry.cls.venue}
        </span>
      </button>

      <button
        type="button"
        onClick={onAct}
        className={cn(
          'shrink-0 rounded-full px-3 py-1.5 text-[12px] font-bold transition-opacity duration-200 hover:opacity-85',
          entry.unplanned && entry.state === 'upcoming'
            ? 'bg-tint-yellow-bold text-charcoal'
            : pill.className,
        )}
      >
        {entry.state === 'needs_log'
          ? '기록'
          : entry.unplanned && entry.state === 'upcoming'
            ? '설계'
            : pill.label}
      </button>
    </li>
  );
}

function StepButton({ dir, onClick }: { dir: 'prev' | 'next'; onClick: () => void }) {
  const Icon = dir === 'prev' ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={dir === 'prev' ? '이전 주' : '다음 주'}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-hairline text-steel transition-colors duration-200 hover:border-hairline-strong hover:text-ink"
    >
      <Icon size={17} strokeWidth={2.2} />
    </button>
  );
}
