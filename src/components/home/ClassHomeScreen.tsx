/**
 * 클래스 — the home screen, for everybody.
 *
 * It answers one question: *what do I do next.* One card for the next class —
 * its session and one button — then the rest of the day as a plain list. The
 * button already knows which step is next (고르기, 보기, 마무리), so the coach
 * never chooses between actions only one of which makes sense.
 */

import type { Class, ISODate } from '@/types';
import { useApp } from '@/store/AppContext';
import { TODAY } from '@/data/dates';
import { countdown, upNext, type DayEntry, type DaySummary, type SessionState } from '@/data/today';
import { formatDateKo } from '@/lib/format';
import { cn } from '@/lib/cn';
import { ScreenBody, ScreenHeader, Section } from '@/components/shell/Shell';
import { AbilityTag } from '@/components/session/parts';
import { articleOfTheDay } from '@/data/editorial';
import { FeatureCard } from '@/components/feed/ArticleCard';
import { BrandStory } from '@/components/feed/BrandStory';
import { KitPicks } from '@/components/feed/KitPicks';

const STATE_PILL: Record<SessionState, { label: string; className: string }> = {
  now: { label: '진행 중', className: 'bg-primary text-white' },
  upcoming: { label: '예정', className: 'bg-primary-wash text-primary' },
  done: { label: '완료', className: 'bg-tint-mint text-brand-green' },
  needs_log: {
    label: '마무리',
    className: 'bg-tint-yellow-bold text-charcoal',
  },
};

const HERO_LABEL: Record<SessionState, string> = {
  now: '진행 중',
  upcoming: '다음 수업',
  done: '완료',
  needs_log: '마무리 필요',
};

interface ClassHomeScreenProps {
  entries: DayEntry[];
  summary: DaySummary;
  onOpenSession: (cls: Class, date: ISODate) => void;
  onPick: (cls: Class, date: ISODate) => void;
  onRecord: (cls: Class, date: ISODate) => void;
  onSeeSchedule: () => void;
  onOpenArticle: (articleId: string) => void;
}

export function ClassHomeScreen({
  entries,
  summary,
  onOpenSession,
  onPick,
  onRecord,
  onSeeSchedule,
  onOpenArticle,
}: ClassHomeScreenProps) {
  const hero = upNext(entries);
  const unlogged = entries.filter((e) => e.state === 'needs_log' && e !== hero);
  const column = articleOfTheDay(TODAY);

  const next = (entry: DayEntry) =>
    entry.state === 'needs_log'
      ? onRecord(entry.cls, TODAY)
      : entry.unplanned && entry.state !== 'done'
        ? onPick(entry.cls, TODAY)
        : onOpenSession(entry.cls, TODAY);

  return (
    <>
      <ScreenHeader
        eyebrow={formatDateKo(TODAY)}
        title="오늘의 클래스"
        meta={
          summary.total === 0
            ? undefined
            : `수업 ${summary.total}개${summary.needsLog > 0 ? ` · 마무리 필요 ${summary.needsLog}` : ''}`
        }
      />

      <ScreenBody>
        {entries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-hairline-strong bg-canvas px-5 py-10 text-center">
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
          <div className="stagger">
            {hero && (
              <HeroCard
                entry={hero}
                onAct={() => next(hero)}
                onOpen={() => onOpenSession(hero.cls, TODAY)}
              />
            )}

            {unlogged.length > 0 && (
              <button
                type="button"
                onClick={() => onRecord(unlogged[0].cls, TODAY)}
                className="pressable mt-3 flex w-full items-center gap-2.5 rounded-lg border border-hairline bg-tint-yellow px-4 py-3 text-left hover:bg-tint-yellow-bold"
              >
                <span className="min-w-0 flex-1 text-[14px] font-medium text-charcoal">
                  마무리하지 않은 수업 {unlogged.length}개
                </span>
                <span className="shrink-0 text-[14px] font-bold text-primary">마무리</span>
              </button>
            )}

            <Section title="오늘 일정">
              <ul className="overflow-hidden rounded-lg border border-hairline bg-canvas">
                {entries.map((entry) => (
                  <DayRow
                    key={entry.cls.id}
                    entry={entry}
                    onOpen={() => onOpenSession(entry.cls, TODAY)}
                    onAct={() => next(entry)}
                  />
                ))}
              </ul>
            </Section>
          </div>
        )}
      </ScreenBody>

      {/* --- Below the work -------------------------------------------------
          Reading and the ad slots live under everything a coach came here to
          do, on their own band, so they are there for the quiet minutes before
          a session and invisible during the busy ones. */}
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

          <KitPicks />

          <p className="text-center text-[11.5px] text-stone">
            광고는 모두 가상 브랜드를 사용한 디자인 예시입니다.
          </p>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

/**
 * The next class, with the one thing to do about it.
 *
 * The session name is the headline under the class, because it is the thing
 * that changes day to day; the class name is the same every week.
 */
function HeroCard({
  entry,
  onAct,
  onOpen,
}: {
  entry: DayEntry;
  onAct: () => void;
  onOpen: () => void;
}) {
  const { getTemplate, getCoach } = useApp();
  const session = entry.plan?.templateId ? getTemplate(entry.plan.templateId) : undefined;

  const cta =
    entry.state === 'needs_log' ? '수업 마무리' : entry.unplanned ? '세션 고르기' : '수업 보기';

  return (
    <article
      className={cn(
        'relative overflow-hidden rounded-xl p-5',
        entry.state === 'needs_log'
          ? 'bg-gradient-to-br from-tint-yellow to-tint-cream'
          : 'bg-gradient-to-br from-[#DCEEE4] to-[#F1F7F3]',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-semibold text-primary">{HERO_LABEL[entry.state]}</p>
        <p className="shrink-0 text-[14px] font-semibold tabular-nums text-charcoal">
          {entry.startTime}–{entry.endTime}
        </p>
      </div>

      <button type="button" onClick={onOpen} className="mt-2 block text-left">
        <span className="block text-[26px] font-bold leading-[1.15] tracking-tightest text-ink">
          {entry.cls.title}
        </span>
        <span className="mt-2 flex items-center gap-2">
          {session ? (
            <>
              <AbilityTag ability={session.ability} className="bg-canvas/80" />
              <span className="text-[16px] font-semibold text-charcoal">{session.title}</span>
            </>
          ) : (
            <span className="text-[15px] text-slate">
              {entry.unplanned ? '세션 미정' : '직접 구성한 수업'}
            </span>
          )}
        </span>
      </button>

      <p className="mt-2 text-[13.5px] text-slate">
        {getCoach(entry.cls.coachId)?.name ?? '미배정'} 코치 · {entry.headcount}명
      </p>

      <div className="mt-5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onAct}
          className="pressable rounded-full bg-primary px-6 py-3 text-[15px] font-semibold text-white hover:bg-primary-pressed active:bg-primary-deep"
        >
          {cta}
        </button>
        <span className="shrink-0 text-[13.5px] font-medium text-steel">{countdown(entry)}</span>
      </div>
    </article>
  );
}

/** One class in a day's list. Shared with 일정. */
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
  const session = entry.plan?.templateId ? getTemplate(entry.plan.templateId) : undefined;
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
          {session?.title ?? (entry.unplanned ? '세션 미정' : '직접 구성')}
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
        {unplanned ? '고르기' : pill.label}
      </button>
    </li>
  );
}
