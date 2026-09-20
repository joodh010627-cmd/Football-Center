/**
 * One class, one month.
 *
 * Four cell states, and the whole screen exists to keep them apart:
 *
 *   off        — the class doesn't meet. Not a gap to fill; nothing to do.
 *   unplanned  — it meets and nobody has designed it. Dashed, inviting.
 *   scheduled  — a plan is registered. Filled, mid-weight.
 *   completed  — it ran, attendance is logged, parents were told. Darkest.
 *
 * Colour carries the state and a label repeats it. Relying on the fill alone
 * would make the month unreadable for anyone who can't separate two greens, and
 * the difference between "planned" and "already happened" is exactly the thing a
 * coach must not misread while standing on a pitch.
 */

import { useState } from 'react';
import {
  CalendarPlus,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  PencilLine,
  Target,
} from 'lucide-react';
import type { Class, ISODate, SessionPlan } from '@/types';
import { useApp } from '@/store/AppContext';
import { THIS_MONTH, TODAY, monthLabel, shiftMonth, type YearMonth } from '@/data/dates';
import {
  buildCalendar,
  curriculumForClass,
  monthSummary,
  sessionDuration,
  studentsInClass,
  type CalendarCell,
  type ScheduleState,
} from '@/data/selectors';
import { formatDateKo, formatSchedule, weekdayLabel } from '@/lib/format';
import { cn } from '@/lib/cn';
import { TRACK_META } from '@/components/curriculum/curriculumMeta';
import { CATEGORY_META } from './TrainingBlockCard';

const STATE_STYLE: Record<ScheduleState, { cell: string; label: string; tone: string }> = {
  off: { cell: 'border-transparent bg-transparent', label: '', tone: '' },
  unplanned: {
    cell: 'border-dashed border-hairline-strong bg-canvas hover:border-primary hover:bg-primary-wash',
    label: '미등록',
    tone: 'text-steel',
  },
  scheduled: {
    cell: 'border-primary-soft bg-primary-wash hover:border-primary',
    label: '등록',
    tone: 'text-primary',
  },
  completed: {
    cell: 'border-primary bg-primary text-white hover:bg-primary-pressed',
    label: '완료',
    tone: 'text-white/80',
  },
};

interface ClassCalendarScreenProps {
  cls: Class;
  onDesign: (date: ISODate) => void;
  onRecord: (date: ISODate) => void;
  onBack: () => void;
  /** Names wherever 뒤로 actually goes — this screen is reached from three places. */
  backLabel?: string;
}

export function ClassCalendarScreen({
  cls,
  onDesign,
  onRecord,
  onBack,
  backLabel = '← 수업 목록',
}: ClassCalendarScreenProps) {
  const { state } = useApp();
  const [month, setMonth] = useState<YearMonth>(THIS_MONTH);
  const [picked, setPicked] = useState<ISODate | null>(null);

  const cells = buildCalendar(cls, state, month);
  const counts = monthSummary(cells);
  const curriculum = curriculumForClass(state.curricula, cls);
  const roster = studentsInClass(state.students, cls.id);

  const pickedCell = cells.find((c) => c.date === picked) ?? null;

  return (
    <div>
      {/* --- Header ----------------------------------------------------- */}
      <header className="border-b border-hairline bg-canvas px-5 pb-5 pt-6 sm:px-8 lg:px-12">
        <button
          type="button"
          onClick={onBack}
          className="mb-2 text-[13px] font-medium text-steel transition-colors hover:text-ink"
        >
          {backLabel}
        </button>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[25px] font-semibold leading-[1.2] tracking-tightest text-ink lg:text-[32px]">
              {cls.title}
            </h1>
            <p className="mt-1 text-[13px] text-slate lg:text-sm">
              {formatSchedule(cls.schedule.days, cls.schedule.startTime)} ·{' '}
              {cls.schedule.durationMin}분 · {cls.venue} · 원생 {roster.length}명
            </p>
            {curriculum && (
              <p className="mt-2 flex items-center gap-1.5 text-[13px]">
                <span
                  className={cn(
                    'h-1.5 w-1.5 shrink-0 rounded-full',
                    TRACK_META[curriculum.track].bar,
                  )}
                />
                <span className="font-medium text-charcoal">{curriculum.title}</span>
                <span className="text-steel">{curriculum.cycleWeeks}주 주기</span>
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <NavButton label="이전 달" onClick={() => setMonth(shiftMonth(month, -1))}>
              <ChevronLeft size={17} />
            </NavButton>
            <span className="min-w-[112px] text-center text-[15px] font-semibold tabular-nums text-ink">
              {monthLabel(month)}
            </span>
            <NavButton label="다음 달" onClick={() => setMonth(shiftMonth(month, 1))}>
              <ChevronRight size={17} />
            </NavButton>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Tally label="완료" count={counts.completed} dot="bg-primary" />
          <Tally label="등록" count={counts.scheduled} dot="bg-primary-soft" />
          <Tally label="미등록" count={counts.unplanned} dot="bg-hairline-strong" />
        </div>
      </header>

      {/* --- Grid + detail --------------------------------------------- */}
      <div className="px-5 py-6 sm:px-8 lg:px-12">
        <div className="grid gap-6 lg:grid-cols-[1fr_340px] lg:items-start">
          <div>
            <div className="mb-1.5 grid grid-cols-7 gap-1.5">
              {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                <span
                  key={day}
                  className={cn(
                    'py-1 text-center text-[11.5px] font-semibold',
                    day === 0 ? 'text-error/70' : day === 6 ? 'text-link' : 'text-steel',
                  )}
                >
                  {weekdayLabel(day)}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {cells.map((cell) => (
                <DayCell
                  key={cell.date}
                  cell={cell}
                  active={cell.date === picked}
                  onSelect={() => setPicked(cell.date === picked ? null : cell.date)}
                />
              ))}
            </div>
          </div>

          <div className="lg:sticky lg:top-6">
            {pickedCell && pickedCell.state !== 'off' ? (
              <DayDetail
                cell={pickedCell}
                cls={cls}
                onDesign={() => onDesign(pickedCell.date)}
                onRecord={() => onRecord(pickedCell.date)}
              />
            ) : (
              <div className="card px-5 py-8 text-center">
                <ClipboardList size={22} className="mx-auto text-stone" />
                <p className="mt-2.5 text-[14px] font-semibold text-ink">날짜를 선택하세요</p>
                <p className="mx-auto mt-1 max-w-[240px] text-[13px] leading-[1.6] text-slate">
                  수업이 있는 날을 누르면 설계를 시작하거나, 이미 등록된 구성을 확인할 수 있습니다.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cells
// ---------------------------------------------------------------------------

function DayCell({
  cell,
  active,
  onSelect,
}: {
  cell: CalendarCell;
  active: boolean;
  onSelect: () => void;
}) {
  const day = new Date(`${cell.date}T00:00:00`).getDate();
  const isToday = cell.date === TODAY;
  const style = STATE_STYLE[cell.state];

  if (cell.state === 'off') {
    return (
      <div
        className={cn(
          'flex min-h-[68px] flex-col rounded-md border border-transparent px-2 py-1.5 sm:min-h-[84px]',
          !cell.inMonth && 'opacity-35',
        )}
      >
        <span
          className={cn(
            'text-[12.5px] font-medium tabular-nums',
            isToday ? 'font-bold text-primary' : 'text-muted',
          )}
        >
          {day}
        </span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex min-h-[68px] flex-col rounded-md border-2 px-2 py-1.5 text-left transition-all duration-150 sm:min-h-[84px]',
        style.cell,
        active && 'ring-2 ring-gold ring-offset-1',
        !cell.inMonth && 'opacity-45',
      )}
    >
      <span className="flex items-center gap-1">
        <span
          className={cn(
            'text-[12.5px] font-semibold tabular-nums',
            cell.state === 'completed' ? 'text-white' : isToday ? 'text-primary' : 'text-ink',
          )}
        >
          {day}
        </span>
        {isToday && (
          <span
            className={cn(
              'rounded-full px-1 text-[9.5px] font-bold uppercase tracking-wide',
              cell.state === 'completed' ? 'bg-white/25 text-white' : 'bg-gold/25 text-gold-deep',
            )}
          >
            오늘
          </span>
        )}
      </span>

      <span className={cn('mt-auto text-[11px] font-semibold leading-tight', style.tone)}>
        {style.label}
      </span>

      {cell.plan && cell.plan.items.length > 0 && (
        <span className="mt-1 flex gap-[3px]">
          {cell.plan.items.slice(0, 5).map((item, i) => (
            <span
              key={i}
              className={cn(
                'h-1 w-1 rounded-full',
                cell.state === 'completed' ? 'bg-white/70' : CATEGORY_META[item.category].bar,
              )}
            />
          ))}
        </span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Detail panel
// ---------------------------------------------------------------------------

function DayDetail({
  cell,
  cls,
  onDesign,
  onRecord,
}: {
  cell: CalendarCell;
  cls: Class;
  onDesign: () => void;
  onRecord: () => void;
}) {
  const { blockMap, getTemplate } = useApp();
  const plan = cell.plan;
  const future = cell.date > TODAY;

  return (
    <section className="card overflow-hidden">
      <header className="border-b border-hairline px-5 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-label text-steel">
          {STATE_STYLE[cell.state].label} 스케줄
        </p>
        <h3 className="mt-1 text-[17px] font-semibold text-ink">{formatDateKo(cell.date)}</h3>
        <p className="mt-0.5 text-[12.5px] text-steel">
          {cls.schedule.startTime} · {cls.schedule.durationMin}분 · {cls.venue}
        </p>
      </header>

      <div className="px-5 py-4">
        {plan && plan.items.length > 0 ? (
          <PlanBody plan={plan} />
        ) : (
          <p className="py-3 text-[13px] leading-[1.65] text-slate">
            아직 설계되지 않은 수업입니다. 표준 커리큘럼에서 불러오거나 블록을 직접 조립할 수
            있습니다.
          </p>
        )}
      </div>

      <footer className="space-y-2 border-t border-hairline bg-surface-soft px-5 py-4">
        {cell.state === 'completed' ? (
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-primary">
            <CheckCircle2 size={14} />
            출결 기록과 학부모 발송이 완료되었습니다
          </p>
        ) : (
          <>
            <button type="button" onClick={onDesign} className="btn-primary w-full py-3">
              {plan ? (
                <>
                  <PencilLine size={15} strokeWidth={2.4} />
                  설계 수정
                </>
              ) : (
                <>
                  <CalendarPlus size={15} strokeWidth={2.4} />
                  수업 설계하기
                </>
              )}
            </button>

            {/* Recording attendance for a day that hasn't happened is how a
                register fills up with sessions nobody attended. */}
            {plan && !future && (
              <button type="button" onClick={onRecord} className="btn-secondary w-full py-3">
                <ClipboardList size={15} />
                수업 완료 — 출결 기록
              </button>
            )}
            {plan && future && (
              <p className="text-center text-[12px] text-stone">
                수업일이 되면 출결 기록을 시작할 수 있습니다
              </p>
            )}
          </>
        )}
      </footer>
    </section>
  );

  function PlanBody({ plan }: { plan: SessionPlan }) {
    const total = sessionDuration(plan.items, blockMap);
    const template = plan.templateId ? getTemplate(plan.templateId) : undefined;

    return (
      <>
        {template && (
          <p className="mb-3 flex items-start gap-1.5 rounded-sm bg-tint-lavender px-2.5 py-2 text-[12.5px] leading-[1.5] text-brand-purple-800">
            <Target size={12} className="mt-[3px] shrink-0" />
            표준 세션 — {template.title}
          </p>
        )}

        <ol className="space-y-2">
          {plan.items.map((item, i) => {
            const block = item.blockId ? blockMap.get(item.blockId) : undefined;
            const meta = CATEGORY_META[item.category];
            return (
              <li key={i} className="flex items-start gap-2.5">
                <span
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-[11px] font-bold tabular-nums',
                    meta.tint,
                    meta.accent,
                  )}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn('text-[10.5px] font-semibold uppercase tracking-label', meta.accent)}>
                    {meta.label}
                  </span>
                  <span className="block truncate text-[13.5px] font-semibold text-ink">
                    {block?.title ?? '삭제된 블록'}
                  </span>
                </span>
                <span className="shrink-0 text-[12px] font-medium tabular-nums text-steel">
                  {item.durationMin ?? block?.durationMin ?? 0}분
                </span>
              </li>
            );
          })}
        </ol>

        <p className="mt-3 flex items-center gap-1.5 border-t border-hairline-soft pt-3 text-[12.5px] font-semibold text-charcoal">
          <Clock size={12} />총 {total}분
          <span
            className={cn(
              'ml-auto font-medium',
              total > cls.schedule.durationMin ? 'text-brand-orange-deep' : 'text-steel',
            )}
          >
            수업 {cls.schedule.durationMin}분
          </span>
        </p>
      </>
    );
  }
}

// ---------------------------------------------------------------------------
// Chrome
// ---------------------------------------------------------------------------

function NavButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="rounded-full border border-hairline p-2 text-steel transition-colors hover:border-primary hover:text-primary"
    >
      {children}
    </button>
  );
}

function Tally({ label, count, dot }: { label: string; count: number; dot: string }) {
  return (
    <span
      className={cn(
        'flex items-center gap-1.5 rounded-full border border-hairline bg-surface-soft px-3 py-1.5 text-[12.5px] font-semibold text-charcoal',
        count === 0 && 'opacity-50',
      )}
    >
      <span className={cn('h-2 w-2 rounded-full', dot)} />
      {label} {count}
    </span>
  );
}
