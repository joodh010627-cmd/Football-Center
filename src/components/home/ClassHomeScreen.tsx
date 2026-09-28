/**
 * 수업 — the home screen, for everybody. A coach's day at a glance.
 *
 * The date is the headline because the date is what the screen is about. Under
 * it, today's lessons as cards you swipe through, each showing where it is in
 * its day — 준비, 수업, 기록 — as three bars and offering the one button that
 * moves it on. With more than one lesson a row of start times sits above the
 * cards: it is the day's timetable and the way to jump between them, so the
 * old list under the hero (which repeated the hero) is gone.
 */

import { useEffect, useRef, useState } from 'react';
import type { Class, ISODate } from '@/types';
import { useApp } from '@/store/AppContext';
import { TODAY } from '@/data/dates';
import { countdown, upNext, type DayEntry, type SessionState } from '@/data/today';
import { formatDateLong } from '@/lib/format';
import { cn } from '@/lib/cn';
import { ScreenBody } from '@/components/shell/Shell';
import { AbilityTag, LessonProgress } from '@/components/session/parts';
import { articleOfTheDay } from '@/data/editorial';
import { FeatureCard } from '@/components/feed/ArticleCard';
import { BrandStory } from '@/components/feed/BrandStory';

const STATE_PILL: Record<SessionState, { label: string; className: string }> = {
  now: { label: '진행 중', className: 'bg-primary text-white' },
  upcoming: { label: '예정', className: 'bg-primary-wash text-primary' },
  done: { label: '완료', className: 'bg-tint-mint text-brand-green' },
  needs_log: { label: '기록', className: 'bg-tint-peach text-brand-orange-deep' },
};

const CARD_LABEL: Record<SessionState, string> = {
  now: '진행 중',
  upcoming: '예정',
  done: '완료',
  needs_log: '기록 필요',
};

/** The dot beside a start time in the timetable row. */
const STATE_DOT: Record<SessionState, string> = {
  now: 'bg-primary animate-pulse',
  upcoming: 'bg-muted',
  done: 'bg-primary',
  needs_log: 'bg-brand-orange',
};

interface ClassHomeScreenProps {
  entries: DayEntry[];
  /** Show whose lesson each card is — true for an owner looking at the centre. */
  showCoach: boolean;
  onOpenSession: (cls: Class, date: ISODate) => void;
  onPick: (cls: Class, date: ISODate) => void;
  onRecord: (cls: Class, date: ISODate) => void;
  onSeeSchedule: () => void;
  onOpenArticle: (articleId: string) => void;
}

export function ClassHomeScreen({
  entries,
  showCoach,
  onOpenSession,
  onPick,
  onRecord,
  onSeeSchedule,
  onOpenArticle,
}: ClassHomeScreenProps) {
  const column = articleOfTheDay(TODAY);

  const next = (entry: DayEntry) =>
    entry.state === 'needs_log'
      ? onRecord(entry.cls, TODAY)
      : entry.unplanned && entry.state !== 'done'
        ? onPick(entry.cls, TODAY)
        : onOpenSession(entry.cls, TODAY);

  return (
    <>
      {/* Not `ScreenHeader`: its eyebrow is wide-tracked uppercase, which
          spaces Hangul out into separate letters. */}
      <header className="px-5 pb-1 pt-6 sm:px-7 lg:px-10 lg:pt-10">
        <p className="text-[14px] font-semibold text-primary">오늘의 수업</p>
        <h1 className="mt-1 text-[30px] font-bold leading-[1.15] tracking-tightest text-ink sm:text-[32px]">
          {formatDateLong(TODAY)}
        </h1>
      </header>

      <ScreenBody>
        {entries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-hairline-strong bg-canvas px-5 py-10 text-center">
            <p className="text-[16px] font-semibold text-ink">오늘은 수업이 없어요</p>
            <button
              type="button"
              onClick={onSeeSchedule}
              className="mt-3 text-[14px] font-semibold text-primary"
            >
              일정 보기
            </button>
          </div>
        ) : (
          <TodayLessons
            entries={entries}
            showCoach={showCoach}
            onAct={next}
            onOpen={(e) => onOpenSession(e.cls, TODAY)}
          />
        )}
      </ScreenBody>

      {/* --- Below the work -------------------------------------------------
          Reading and the ad slots live under everything a coach came here to
          do, on their own band, so they are there for the quiet minutes before
          a lesson and invisible during the busy ones. */}
      <div className="mt-6 border-t border-hairline bg-canvas/60">
        <div className="space-y-10 px-5 pb-8 pt-7 sm:px-7 lg:px-10">
          <section>
            <h2 className="text-[19px] font-bold tracking-[-0.02em] text-ink">오늘의 칼럼</h2>
            <div className="mt-3">
              <FeatureCard
                article={column}
                caption={column.dek}
                onOpen={() => onOpenArticle(column.id)}
              />
            </div>
          </section>

          <BrandStory compact />

          <p className="text-center text-[11.5px] text-stone">
            광고는 모두 가상 브랜드를 사용한 디자인 예시입니다.
          </p>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Today's lessons
// ---------------------------------------------------------------------------

/**
 * The day's lessons as a swipeable row, opening on the one that needs the coach
 * next. Snap scrolling does the paging, so a swipe feels native and a mouse or
 * keyboard still works; the timetable row follows along and jumps on tap.
 */
function TodayLessons({
  entries,
  showCoach,
  onAct,
  onOpen,
}: {
  entries: DayEntry[];
  showCoach: boolean;
  onAct: (e: DayEntry) => void;
  onOpen: (e: DayEntry) => void;
}) {
  const first = Math.max(0, entries.indexOf(upNext(entries) ?? entries[0]));
  const [index, setIndex] = useState(first);
  const rail = useRef<HTMLDivElement>(null);
  const many = entries.length > 1;

  /** One card plus the gap — the distance a swipe moves. */
  const step = () => ((rail.current?.firstElementChild as HTMLElement | null)?.offsetWidth ?? 0) + 12;

  const go = (i: number, smooth = true) => {
    rail.current?.scrollTo({ left: i * step(), behavior: smooth ? 'smooth' : 'auto' });
    setIndex(i);
  };

  // Open on the lesson that matters now, not on the first one of the day.
  useEffect(() => {
    if (first > 0) go(first, false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onScroll = () => {
    const el = rail.current;
    if (!el || step() <= 12) return;
    setIndex(Math.min(entries.length - 1, Math.max(0, Math.round(el.scrollLeft / step()))));
  };

  return (
    <div className="stagger">
      {many && (
        <div className="no-scrollbar -mx-5 mb-3 flex gap-1.5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
          {entries.map((e, i) => (
            <button
              key={e.cls.id}
              type="button"
              onClick={() => go(i)}
              aria-pressed={i === index}
              aria-label={`${e.startTime} ${e.cls.title} · ${CARD_LABEL[e.state]}`}
              className={cn(
                'pressable flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[14px] font-semibold tabular-nums',
                i === index ? 'bg-ink text-white' : 'bg-canvas text-charcoal',
              )}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', STATE_DOT[e.state])} />
              {e.startTime}
            </button>
          ))}
        </div>
      )}

      <div
        ref={rail}
        onScroll={many ? onScroll : undefined}
        className={cn(
          'flex gap-3',
          many && 'no-scrollbar -mx-5 snap-x snap-mandatory scroll-px-5 overflow-x-auto px-5 sm:mx-0 sm:px-0',
        )}
      >
        {entries.map((e) => (
          <LessonCard
            key={e.cls.id}
            entry={e}
            showCoach={showCoach}
            className={many ? 'w-[calc(100%-28px)] shrink-0 snap-start' : 'w-full'}
            onAct={() => onAct(e)}
            onOpen={() => onOpen(e)}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * One lesson, lit. The goal is the line under the class because it is what
 * changes from day to day; the class name is the same every week.
 */
function LessonCard({
  entry,
  showCoach,
  className,
  onAct,
  onOpen,
}: {
  entry: DayEntry;
  showCoach: boolean;
  className?: string;
  onAct: () => void;
  onOpen: () => void;
}) {
  const { getTemplate, getCoach } = useApp();
  const goal = entry.plan?.templateId ? getTemplate(entry.plan.templateId) : undefined;
  const planned = !entry.unplanned;

  const cta =
    entry.state === 'needs_log'
      ? '수업 기록'
      : entry.state === 'done'
        ? '기록 보기'
        : planned
          ? '수업 보기'
          : '수업 준비';

  return (
    <article
      className={cn(
        'mesh rounded-2xl p-5',
        entry.state === 'needs_log' && 'mesh-warm',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p
          className={cn(
            'text-[13px] font-bold',
            entry.state === 'needs_log' ? 'text-brand-orange-deep' : 'text-primary',
          )}
        >
          {CARD_LABEL[entry.state]}
        </p>
        <p className="shrink-0 text-[15px] font-semibold tabular-nums text-charcoal">
          {entry.startTime}–{entry.endTime}
        </p>
      </div>

      <button type="button" onClick={onOpen} className="mt-6 block w-full text-left">
        <span className="block text-[26px] font-bold leading-[1.15] tracking-tightest text-ink">
          {entry.cls.title}
        </span>
        <span className="mt-2 flex min-h-[26px] items-center gap-2">
          {goal ? (
            <>
              <AbilityTag ability={goal.ability} className="bg-canvas/80" />
              <span className="truncate text-[17px] text-charcoal">{goal.title}</span>
            </>
          ) : (
            <span className="text-[16px] text-steel">
              {planned ? '직접 구성한 수업' : '아직 목표를 정하지 않았어요'}
            </span>
          )}
        </span>
      </button>

      <p className="mt-1.5 text-[13.5px] text-slate">
        {showCoach && `${getCoach(entry.cls.coachId)?.name ?? '미배정'} 코치 · `}
        {entry.headcount}명
      </p>

      <LessonProgress state={entry.state} planned={planned} className="mt-5" />

      <div className="mt-5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onAct}
          className="pressable min-h-[44px] rounded-full bg-primary px-6 text-[15px] font-semibold text-white hover:bg-primary-pressed active:bg-primary-deep"
        >
          {cta}
        </button>
        {entry.state === 'upcoming' && (
          <span className="shrink-0 text-[13.5px] font-medium text-steel">{countdown(entry)}</span>
        )}
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Shared with 일정
// ---------------------------------------------------------------------------

/** One lesson in a day's list. */
export function DayRow({
  entry,
  onOpen,
  onAct,
}: {
  entry: DayEntry;
  onOpen: () => void;
  onAct: () => void;
}) {
  const { getTemplate } = useApp();
  const pill = STATE_PILL[entry.state];
  const goal = entry.plan?.templateId ? getTemplate(entry.plan.templateId) : undefined;
  const unplanned = entry.unplanned && (entry.state === 'upcoming' || entry.state === 'now');

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
          {goal?.title ?? (entry.unplanned ? '목표 미정' : '직접 구성')}
        </span>
      </button>

      <button
        type="button"
        onClick={onAct}
        className={cn(
          'pressable shrink-0 rounded-full px-3 py-1.5 text-[12px] font-bold hover:opacity-85',
          unplanned ? 'bg-tint-yellow-bold text-charcoal' : pill.className,
        )}
      >
        {unplanned ? '준비' : pill.label}
      </button>
    </li>
  );
}
