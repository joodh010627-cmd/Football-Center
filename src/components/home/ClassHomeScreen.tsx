/**
 * 클래스 — the home screen, for everybody.
 *
 * It answers one question and refuses the others: *what do I do in the next
 * hour.* So there is a single hero card for the next session, a nag strip for
 * anything unlogged, and then the rest of the day as a plain list. No KPIs, no
 * revenue, no charts — the owner sees those by choosing to, on 클럽.
 *
 * The hero is the only element allowed to be large. Everything a coach does in
 * the ten minutes before a session starts is inside it: what is being taught,
 * how many are coming, and one button that goes to the right place depending on
 * whether the session still needs designing.
 */

import { ArrowRight, CalendarDays, Plus, Sparkles } from 'lucide-react';
import type { Class, ISODate } from '@/types';
import { useApp } from '@/store/AppContext';
import { TODAY } from '@/data/dates';
import { countdown, upNext, type DayEntry, type DaySummary, type SessionState } from '@/data/today';
import { curriculumForClass, sessionDuration } from '@/data/selectors';
import { formatDateKo } from '@/lib/format';
import { cn } from '@/lib/cn';
import { ScreenBody, ScreenHeader, Section } from '@/components/shell/Shell';

const STATE_PILL: Record<SessionState, { label: string; className: string }> = {
  now: { label: '진행 중', className: 'bg-primary text-white' },
  upcoming: { label: '예정', className: 'bg-primary-wash text-primary' },
  done: { label: '완료', className: 'bg-tint-mint text-brand-green' },
  needs_log: { label: '기록 필요', className: 'bg-tint-yellow-bold text-gold-deep' },
};

interface ClassHomeScreenProps {
  entries: DayEntry[];
  summary: DaySummary;
  owner: boolean;
  onOpenClass: (cls: Class) => void;
  onDesign: (cls: Class, date: ISODate) => void;
  onRecord: (cls: Class, date: ISODate) => void;
  onOpenSheet: (cls: Class, date: ISODate) => void;
  onSeeSchedule: () => void;
}

export function ClassHomeScreen({
  entries,
  summary,
  owner,
  onOpenClass,
  onDesign,
  onRecord,
  onOpenSheet,
  onSeeSchedule,
}: ClassHomeScreenProps) {
  const hero = upNext(entries);
  const unlogged = entries.filter((e) => e.state === 'needs_log');

  return (
    <>
      <ScreenHeader
        eyebrow={formatDateKo(TODAY)}
        title="오늘의 클래스"
        action={
          <button
            type="button"
            onClick={onSeeSchedule}
            className="flex items-center gap-1 rounded-full px-2 py-1 text-[13.5px] font-semibold text-primary transition-colors hover:bg-primary-wash"
          >
            <Plus size={15} strokeWidth={2.6} />
            만들기
          </button>
        }
        meta={<DayCounts summary={summary} />}
      />

      <ScreenBody>
        {entries.length === 0 ? (
          <EmptyDay owner={owner} onSeeSchedule={onSeeSchedule} />
        ) : (
          <>
            {hero && (
              <HeroCard
                entry={hero}
                onOpen={() =>
                  hero.state === 'needs_log'
                    ? onRecord(hero.cls, TODAY)
                    : hero.unplanned
                      ? onDesign(hero.cls, TODAY)
                      : onOpenSheet(hero.cls, TODAY)
                }
                onOpenClass={() => onOpenClass(hero.cls)}
              />
            )}

            {unlogged.length > 0 && (
              <button
                type="button"
                onClick={() => onRecord(unlogged[0].cls, TODAY)}
                className="mt-3 flex w-full items-center gap-2.5 rounded-lg border border-gold-soft bg-tint-yellow px-4 py-3 text-left transition-colors duration-200 hover:bg-tint-yellow-bold"
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-gold-deep" />
                <span className="min-w-0 flex-1 text-[13.5px] font-medium text-gold-deep">
                  기록이 필요한 수업 {unlogged.length}개
                </span>
                <span className="shrink-0 text-[13.5px] font-bold text-primary">기록하기</span>
              </button>
            )}

            <Section title="오늘 일정" meta={`${entries.length}개`}>
              <ul className="overflow-hidden rounded-lg border border-hairline bg-canvas">
                {entries.map((entry) => (
                  <DayRow
                    key={entry.cls.id}
                    entry={entry}
                    onOpen={() => onOpenClass(entry.cls)}
                    onAct={() =>
                      entry.state === 'done'
                        ? onOpenSheet(entry.cls, TODAY)
                        : entry.state === 'needs_log'
                          ? onRecord(entry.cls, TODAY)
                          : entry.unplanned
                            ? onDesign(entry.cls, TODAY)
                            : onOpenSheet(entry.cls, TODAY)
                    }
                  />
                ))}
              </ul>
            </Section>
          </>
        )}

        <button
          type="button"
          onClick={onSeeSchedule}
          className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-full border border-hairline py-3 text-[14px] font-semibold text-slate transition-colors duration-200 hover:border-hairline-strong hover:text-ink"
        >
          <CalendarDays size={16} strokeWidth={2.2} />
          이번 주 전체 일정 보기
        </button>
      </ScreenBody>
    </>
  );
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function DayCounts({ summary }: { summary: DaySummary }) {
  if (summary.total === 0) return <>오늘은 예정된 수업이 없습니다</>;

  return (
    <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 tabular-nums">
      <span>전체 {summary.total}</span>
      <span className="text-hairline-strong">·</span>
      <span>완료 {summary.done}</span>
      <span className="text-hairline-strong">·</span>
      <span>예정 {summary.upcoming}</span>
      {summary.needsLog > 0 && (
        <>
          <span className="text-hairline-strong">·</span>
          <span className="font-semibold text-gold-deep">기록 필요 {summary.needsLog}</span>
        </>
      )}
    </span>
  );
}

/**
 * The next session, in full.
 *
 * The button's label changes with the state because there is only ever one
 * right next action, and making the coach choose between [설계] and [기록] when
 * only one of them is possible is a decision the screen already knows how to
 * make. The class name stays tappable underneath for the cases where they
 * wanted the month view instead.
 */
function HeroCard({
  entry,
  onOpen,
  onOpenClass,
}: {
  entry: DayEntry;
  onOpen: () => void;
  onOpenClass: () => void;
}) {
  const { state, getCoach, blockMap } = useApp();
  const curriculum = curriculumForClass(state.curricula, entry.cls);
  const coach = getCoach(entry.cls.coachId);

  // What today is actually about: the plan's goal if it has one, else the
  // curriculum's objective, else nothing — never a placeholder sentence.
  const focus =
    entry.plan?.items.length && entry.plan.templateId
      ? (state.sessionTemplates.find((t) => t.id === entry.plan?.templateId)?.goal ?? '')
      : (curriculum?.objective ?? '');

  const minutes = entry.plan ? sessionDuration(entry.plan.items, blockMap) : 0;

  const cta =
    entry.state === 'needs_log' ? '출결 기록하기' : entry.unplanned ? '수업 설계하기' : '수업 보기';

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
        <p className="micro-label text-primary">
          {entry.state === 'needs_log' ? 'TO RECORD' : entry.state === 'now' ? 'NOW' : 'UP NEXT'}
        </p>
        <p className="shrink-0 text-[14px] font-semibold tabular-nums text-charcoal">
          {entry.startTime}–{entry.endTime}
        </p>
      </div>

      <button
        type="button"
        onClick={onOpenClass}
        className="mt-3 block text-left text-[26px] font-bold leading-[1.15] tracking-tightest text-ink"
      >
        {entry.cls.title}
      </button>

      {focus && <p className="mt-1.5 text-[15px] leading-[1.5] text-charcoal">{focus}</p>}

      <p className="mt-2 text-[13.5px] text-slate">
        {coach?.name ?? '미배정'} 코치 · {entry.headcount}명
        {minutes > 0 && ` · ${minutes}분 구성`}
        {entry.unplanned && entry.state !== 'needs_log' && (
          <span className="ml-1.5 font-semibold text-gold-deep">· 미설계</span>
        )}
      </p>

      <div className="mt-5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onOpen}
          className="rounded-full bg-primary px-6 py-3 text-[15px] font-semibold text-white transition-colors duration-200 hover:bg-primary-pressed active:bg-primary-deep"
        >
          {cta}
        </button>
        <span className="shrink-0 text-[13.5px] font-medium text-steel">{countdown(entry)}</span>
      </div>
    </article>
  );
}

function DayRow({ entry, onOpen, onAct }: { entry: DayEntry; onOpen: () => void; onAct: () => void }) {
  const { getCoach } = useApp();
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
          {getCoach(entry.cls.coachId)?.name ?? '미배정'} 코치 · {entry.cls.venue} ·{' '}
          {entry.headcount}명
        </span>
      </button>

      <button
        type="button"
        onClick={onAct}
        className={cn(
          'shrink-0 rounded-full px-3 py-1.5 text-[12px] font-bold transition-opacity duration-200 hover:opacity-85',
          pill.className,
        )}
      >
        {entry.state === 'needs_log' ? '기록' : pill.label}
      </button>
    </li>
  );
}

function EmptyDay({ owner, onSeeSchedule }: { owner: boolean; onSeeSchedule: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-hairline-strong bg-canvas px-5 py-10 text-center">
      <Sparkles size={26} className="mx-auto text-primary-soft" strokeWidth={1.8} />
      <p className="mt-3 text-[16px] font-semibold text-ink">오늘은 수업이 없습니다</p>
      <p className="mt-1.5 text-[13.5px] leading-[1.6] text-steel">
        {owner
          ? '이번 주 일정을 확인하거나, 새 클래스를 만들어 두세요.'
          : '다음 수업을 미리 설계해 두면 당일이 편해집니다.'}
      </p>
      <button
        type="button"
        onClick={onSeeSchedule}
        className="mt-4 inline-flex items-center gap-1.5 text-[14px] font-semibold text-primary"
      >
        일정 보기
        <ArrowRight size={15} />
      </button>
    </div>
  );
}

/** Exported for the schedule screen, which renders the same row shape. */
export { DayRow, STATE_PILL };
