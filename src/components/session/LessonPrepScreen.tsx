/**
 * 수업 준비 — one class on one day, planned the way coaches already plan it.
 *
 * Top to bottom is the order of the thinking: who is coming, what we did last
 * time, so what is today for. The first two are read-only facts. The third is
 * a tap — a focus from the growth pentagon, then one of a few goals — and the
 * moment a goal is chosen its 훈련 블록 appear already fitted to today's
 * headcount and minutes. Editing is there for the day the coach wants it, not a
 * step every day has to pass through.
 *
 * The same screen edits a lesson that is already prepared: it opens on the
 * saved goal and blocks, and choosing a different goal recomposes.
 */

import { useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Minus, Plus, Repeat2, Sparkles, X } from 'lucide-react';
import type { Ability, Class, ID, ISODate, SessionItem, TrainingBlock } from '@/types';
import { useApp } from '@/store/AppContext';
import { useWorkspace } from '@/store/WorkspaceContext';
import { trialsOn } from '@/data/crm';
import { fromMinutes } from '@/data/today';
import { blocksFor, planFor, sessionDuration, studentsInClass } from '@/data/selectors';
import {
  composeLesson,
  goalOptions,
  recentLessons,
  suggestedAbility,
  type PastLesson,
} from '@/data/lessonPrep';
import { formatDateKo } from '@/lib/format';
import { cn } from '@/lib/cn';
import { ABILITY_META, ABILITY_ORDER, CATEGORY_META } from './meta';
import { AbilityChips, AbilityTag, DetailHeader, More } from './parts';
import { BlockAdder } from './BlockAdder';

interface LessonPrepScreenProps {
  cls: Class;
  date: ISODate;
  backLabel: string;
  onBack: () => void;
  /** Called after the plan is saved. */
  onDone: () => void;
}

/** Goals shown before 더 보기. Past four the list stops being a choice. */
const SHOWN_GOALS = 4;

export function LessonPrepScreen({ cls, date, backLabel, onBack, onDone }: LessonPrepScreenProps) {
  const { state, dispatch, blockMap, getTemplate } = useApp();
  const { leads } = useWorkspace();

  // --- Today's facts ------------------------------------------------------

  const roster = useMemo(
    () => studentsInClass(state.students, cls.id).filter((s) => s.status !== 'inactive'),
    [state.students, cls.id],
  );
  const trials = useMemo(
    () => trialsOn(leads, date).filter((l) => l.trialClassId === cls.id),
    [leads, date, cls.id],
  );
  const headcount = roster.length + trials.length;
  const recent = useMemo(() => recentLessons(state, cls, date), [state, cls, date]);

  // --- The plan being prepared -------------------------------------------

  const saved = planFor(state.sessionPlans, cls.id, date);
  const savedGoal = saved?.templateId ? getTemplate(saved.templateId) : undefined;

  const [ability, setAbility] = useState<Ability>(
    savedGoal?.ability ?? suggestedAbility(recent),
  );
  const [goalId, setGoalId] = useState<ID | null>(saved?.templateId ?? null);
  const [items, setItems] = useState<SessionItem[]>(() =>
    (saved?.items ?? []).filter((i) => i.blockId),
  );
  const [notes, setNotes] = useState<string[]>([]);
  const [allGoals, setAllGoals] = useState(false);
  const blocksRef = useRef<HTMLElement>(null);

  const recentIds = useMemo(() => recent.map((l) => l.plan?.templateId), [recent]);
  const goals = useMemo(
    () => goalOptions(state.sessionTemplates, cls, ability, recentIds),
    [state.sessionTemplates, cls, ability, recentIds],
  );
  const shownGoals = allGoals ? goals : goals.slice(0, SHOWN_GOALS);
  const goal = goalId ? getTemplate(goalId) : undefined;

  const total = sessionDuration(items, blockMap);

  const choose = (id: ID) => {
    const template = getTemplate(id);
    if (!template) return;
    const composed = composeLesson(template, state.trainingBlocks, {
      ageGroup: cls.ageGroup,
      headcount,
      minutes: cls.schedule.durationMin,
    });
    setGoalId(id);
    setItems(composed.items);
    setNotes(composed.notes);
    // The blocks land below the fold on a phone; bring them up.
    window.setTimeout(
      () => blocksRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      60,
    );
  };

  const save = () => {
    dispatch({ type: 'plan/save', classId: cls.id, date, items, templateId: goalId });
    onDone();
  };

  const [h, m] = cls.schedule.startTime.split(':').map(Number);
  const end = fromMinutes((h || 0) * 60 + (m || 0) + cls.schedule.durationMin);

  return (
    <div>
      <DetailHeader
        backLabel={backLabel}
        onBack={onBack}
        title="수업 준비"
        meta={`${cls.title} · ${formatDateKo(date)} ${cls.schedule.startTime}–${end}`}
      />

      <div className="space-y-8 px-5 pb-8 pt-5 sm:px-7 lg:max-w-2xl lg:px-10">
        {/* 1 — who is coming */}
        <Step n={1} title="오늘 오는 선수">
          <div className="rounded-xl border border-hairline bg-canvas p-4">
            <div className="flex items-baseline gap-2">
              <span className="text-[30px] font-bold leading-none tracking-tightest text-ink tabular-nums">
                {headcount}
              </span>
              <span className="text-[15px] font-semibold text-ink">명</span>
              {trials.length > 0 && (
                <span className="ml-1 rounded-full bg-tint-peach px-2 py-0.5 text-[12px] font-bold text-brand-orange-deep">
                  체험 {trials.length}
                </span>
              )}
              <span className="ml-auto text-[13.5px] text-steel">
                {cls.schedule.durationMin}분 · {cls.ageGroup}
              </span>
            </div>
            {headcount > 0 && (
              <More className="mt-3" label="명단">
                <ul className="flex flex-wrap gap-1.5">
                  {roster.map((s) => (
                    <li
                      key={s.id}
                      className={cn(
                        'rounded-full px-2.5 py-1 text-[13px] font-medium',
                        s.status === 'at_risk'
                          ? 'bg-tint-alert text-error'
                          : 'bg-surface-soft text-charcoal',
                      )}
                    >
                      {s.name}
                    </li>
                  ))}
                  {trials.map((l) => (
                    <li
                      key={l.id}
                      className="rounded-full bg-tint-peach px-2.5 py-1 text-[13px] font-medium text-brand-orange-deep"
                    >
                      {l.childName} · 체험
                    </li>
                  ))}
                </ul>
              </More>
            )}
          </div>
        </Step>

        {/* 2 — what we did last time */}
        <Step n={2} title="지난 수업">
          {recent.length === 0 ? (
            <p className="rounded-xl border border-dashed border-hairline-strong px-4 py-5 text-center text-[14px] text-steel">
              이 클래스의 첫 수업이에요
            </p>
          ) : (
            <LastLessons recent={recent} />
          )}
        </Step>

        {/* 3 — so what is today for */}
        <Step n={3} title="오늘의 목표">
          <FocusPicker
            value={ability}
            last={recent.find((l) => l.template)?.template?.ability}
            onChange={(a) => {
              setAbility(a);
              setAllGoals(false);
            }}
          />

          <ul className="mt-3 space-y-2">
            {shownGoals.map((t) => {
              const on = t.id === goalId;
              const last = t.id === recent[0]?.plan?.templateId;
              const lately = !last && recentIds.includes(t.id);
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => choose(t.id)}
                    aria-pressed={on}
                    className={cn(
                      'pressable flex w-full items-start gap-3 rounded-xl border px-4 py-3.5 text-left',
                      on
                        ? 'border-primary bg-primary-wash ring-1 ring-inset ring-primary'
                        : 'border-hairline bg-canvas hover:border-hairline-strong',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-[3px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2',
                        on ? 'border-primary' : 'border-hairline-strong',
                      )}
                    >
                      {on && <span className="h-2 w-2 rounded-full bg-primary" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="text-[16px] font-bold leading-snug text-ink">{t.title}</span>
                        {(last || lately) && (
                          <span className="shrink-0 text-[12px] font-semibold text-steel">
                            {last ? '지난 수업' : '최근 진행'}
                          </span>
                        )}
                      </span>
                      <span className="mt-1 block text-[14px] leading-[1.5] text-slate">{t.goal}</span>
                    </span>
                  </button>
                </li>
              );
            })}
            {goals.length === 0 && (
              <li className="rounded-xl border border-dashed border-hairline-strong px-4 py-6 text-center text-[14px] text-steel">
                {cls.ageGroup}에 맞는 {ABILITY_META[ability].label} 목표가 아직 없어요
              </li>
            )}
          </ul>
          {!allGoals && goals.length > SHOWN_GOALS && (
            <button
              type="button"
              onClick={() => setAllGoals(true)}
              className="mt-2 w-full py-2 text-center text-[13.5px] font-semibold text-steel hover:text-ink"
            >
              목표 {goals.length - SHOWN_GOALS}개 더 보기
            </button>
          )}
        </Step>

        {/* 4 — the blocks, once there is a goal (or a plan to edit) */}
        {(goalId || items.length > 0) && (
          <section ref={blocksRef} className="scroll-mt-4">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-[19px] font-bold tracking-[-0.02em] text-ink">훈련 블록</h2>
              <span
                className={cn(
                  'text-[13px] tabular-nums',
                  total > cls.schedule.durationMin ? 'text-brand-orange-deep' : 'text-steel',
                )}
              >
                {items.length}개 · {total}분 / {cls.schedule.durationMin}분
              </span>
            </div>

            {goal && notes.length > 0 && (
              <div className="mt-3 flex gap-2 rounded-lg bg-primary-wash px-3.5 py-3 text-[13.5px] leading-[1.55] text-charcoal">
                <Sparkles size={15} className="mt-[3px] shrink-0 text-primary" />
                <div>
                  <p className="font-semibold text-ink">
                    {headcount}명 · {cls.schedule.durationMin}분 · {cls.ageGroup}에 맞춰 짰어요
                  </p>
                  <ul className="mt-0.5 text-slate">
                    {notes.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <BlockPlan
              items={items}
              onChange={setItems}
              ageGroup={cls.ageGroup}
              focus={goal?.ability ?? ability}
            />
          </section>
        )}
      </div>

      <div className="glass sticky bottom-[calc(60px+env(safe-area-inset-bottom))] z-30 border-t border-hairline px-5 py-3 sm:px-7 lg:bottom-0 lg:px-10">
        <button
          type="button"
          onClick={save}
          disabled={items.length === 0}
          className="btn-primary w-full py-3.5 text-[15px] lg:max-w-2xl"
        >
          {items.length === 0 ? '목표를 골라 주세요' : saved ? '저장' : '준비 완료'}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="flex items-center gap-2 text-[19px] font-bold tracking-[-0.02em] text-ink">
        <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-ink text-[12px] font-bold text-white">
          {n}
        </span>
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** The last lesson in full, the two before it as one line each. */
function LastLessons({ recent }: { recent: PastLesson[] }) {
  const [last, ...earlier] = recent;
  return (
    <div className="overflow-hidden rounded-xl border border-hairline bg-canvas">
      <div className="p-4">
        <div className="flex items-center justify-between gap-3 text-[13px] text-steel">
          <span>{formatDateKo(last.date)}</span>
          {last.total > 0 && (
            <span className="tabular-nums">
              출석 {last.present}/{last.total}
            </span>
          )}
        </div>
        <p className="mt-1.5 flex items-center gap-2">
          {last.template && <AbilityTag ability={last.template.ability} />}
          <span className="truncate text-[16px] font-bold text-ink">
            {last.template?.title ?? (last.plan ? '직접 구성한 수업' : '계획 없이 진행')}
          </span>
        </p>
        {last.tags.length > 0 && (
          <ul className="mt-2.5 flex flex-wrap gap-1.5">
            {last.tags.slice(0, 3).map(([tag, count]) => (
              <li
                key={tag}
                className="rounded-full bg-surface-soft px-2.5 py-1 text-[12.5px] font-medium text-charcoal"
              >
                {tag} <span className="tabular-nums text-steel">{count}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {earlier.length > 0 && (
        <ul className="border-t border-hairline-soft bg-surface-soft/50 px-4 py-2">
          {earlier.map((l) => (
            <li key={l.date} className="flex items-center gap-2 py-1 text-[13px] text-steel">
              <span className="w-[74px] shrink-0 tabular-nums">{formatDateKo(l.date).split(' (')[0]}</span>
              {l.template && <AbilityTag ability={l.template.ability} />}
              <span className="truncate text-charcoal">{l.template?.title ?? '직접 구성'}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The five abilities as one row. The last lesson's focus carries a dot. */
function FocusPicker({
  value,
  last,
  onChange,
}: {
  value: Ability;
  last?: Ability;
  onChange: (a: Ability) => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-1 rounded-full bg-surface-soft p-1">
      {ABILITY_ORDER.map((a) => (
        <button
          key={a}
          type="button"
          onClick={() => onChange(a)}
          aria-pressed={value === a}
          className={cn(
            'relative rounded-full py-2 text-[14px] font-semibold transition-colors duration-150',
            value === a ? 'bg-canvas text-ink shadow-card' : 'text-steel hover:text-ink',
          )}
        >
          {ABILITY_META[a].label}
          {last === a && (
            <span
              aria-label="지난 수업"
              className="absolute right-2 top-1.5 h-1.5 w-1.5 rounded-full bg-primary"
            />
          )}
        </button>
      ))}
    </div>
  );
}

/**
 * The lesson's blocks, editable in place.
 *
 * A row is name and minutes. Tapping it opens what the block is — how to run
 * it, what to look for — and under that the four edits a coach actually makes:
 * minutes, order, swap for another, drop. Swapping opens the library on the
 * block's own ability, so "something else that trains passing" is one tap.
 */
function BlockPlan({
  items,
  onChange,
  ageGroup,
  focus,
}: {
  items: SessionItem[];
  onChange: (next: SessionItem[]) => void;
  ageGroup: Class['ageGroup'];
  focus: Ability;
}) {
  const { blockMap } = useApp();
  const [open, setOpen] = useState<number | null>(null);
  const [swapping, setSwapping] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);

  const set = (next: SessionItem[], nextOpen: number | null = open) => {
    onChange(next);
    setOpen(nextOpen);
  };

  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    set(next, j);
  };

  const minutes = (i: number, value: number) =>
    set(items.map((it, k) => (k === i ? { ...it, durationMin: Math.max(5, value) } : it)));

  const toItem = (b: TrainingBlock): SessionItem => ({
    category: b.category,
    blockId: b.id,
    durationMin: null,
  });

  return (
    <>
      <ol className="mt-3 overflow-hidden rounded-xl border border-hairline bg-canvas">
        {items.map((item, i) => {
          const block = item.blockId ? blockMap.get(item.blockId) : undefined;
          const min = item.durationMin ?? block?.durationMin ?? 0;
          const isOpen = open === i;
          return (
            <li key={`${item.blockId}-${i}`} className="border-b border-hairline-soft last:border-b-0">
              <button
                type="button"
                onClick={() => {
                  setOpen(isOpen ? null : i);
                  setSwapping(null);
                }}
                aria-expanded={isOpen}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
              >
                <span className="w-5 shrink-0 text-[13px] font-semibold tabular-nums text-stone">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15.5px] font-semibold text-ink">
                    {block?.title ?? '삭제된 블록'}
                  </span>
                  {block && (
                    <span className="mt-0.5 block text-[12.5px] text-steel">
                      {CATEGORY_META[block.category].label} · {ABILITY_META[block.ability].label}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-[14px] font-semibold tabular-nums text-charcoal">
                  {min}분
                </span>
              </button>

              {isOpen && block && (
                <div className="animate-fade-in px-4 pb-4 pl-12">
                  <p className="text-[14px] leading-[1.6] text-charcoal">{block.description}</p>
                  {block.coachingPoints.length > 0 && (
                    <ul className="mt-2 space-y-0.5 text-[13.5px] leading-[1.55] text-slate">
                      {block.coachingPoints.map((p) => (
                        <li key={p}>· {p}</li>
                      ))}
                    </ul>
                  )}
                  {block.equipment.length > 0 && (
                    <p className="mt-2 text-[12.5px] text-steel">준비물 {block.equipment.join(', ')}</p>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="flex items-center gap-1 rounded-full border border-hairline px-1 py-0.5">
                      <button
                        type="button"
                        onClick={() => minutes(i, min - 5)}
                        aria-label="시간 줄이기"
                        className="p-1.5 text-steel hover:text-ink"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="min-w-[40px] text-center text-[13px] font-semibold tabular-nums text-ink">
                        {min}분
                      </span>
                      <button
                        type="button"
                        onClick={() => minutes(i, min + 5)}
                        aria-label="시간 늘리기"
                        className="p-1.5 text-steel hover:text-ink"
                      >
                        <Plus size={14} />
                      </button>
                    </span>
                    <Round label="위로" onClick={() => move(i, -1)} disabled={i === 0}>
                      <ArrowUp size={15} />
                    </Round>
                    <Round label="아래로" onClick={() => move(i, 1)} disabled={i === items.length - 1}>
                      <ArrowDown size={15} />
                    </Round>
                    <Round label="바꾸기" onClick={() => setSwapping(swapping === i ? null : i)}>
                      <Repeat2 size={15} />
                    </Round>
                    <Round
                      label="빼기"
                      onClick={() => set(items.filter((_, k) => k !== i), null)}
                    >
                      <X size={15} />
                    </Round>
                  </div>

                  {swapping === i && (
                    <SwapList
                      current={block}
                      ageGroup={ageGroup}
                      exclude={items.map((it) => it.blockId)}
                      onPick={(b) => {
                        // The new block takes over the slot, minutes included,
                        // so a swap never throws the hour out.
                        const slot = { ...toItem(b), durationMin: min === b.durationMin ? null : min };
                        set(items.map((it, k) => (k === i ? slot : it)));
                        setSwapping(null);
                      }}
                    />
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {adding ? (
        <BlockAdder
          ageGroup={ageGroup}
          initialAbility={focus}
          onAdd={(ids) => {
            set([
              ...items,
              ...ids.flatMap((id) => {
                const b = blockMap.get(id);
                return b ? [toItem(b)] : [];
              }),
            ]);
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-2 flex w-full items-center justify-center gap-1.5 py-2.5 text-[14px] font-semibold text-primary"
        >
          <Plus size={16} strokeWidth={2.4} />
          훈련 블록 추가
        </button>
      )}
    </>
  );
}

/** Blocks that could take this one's place — same ability to start with. */
function SwapList({
  current,
  ageGroup,
  exclude,
  onPick,
}: {
  current: TrainingBlock;
  ageGroup: Class['ageGroup'];
  exclude: Array<ID | null>;
  onPick: (b: TrainingBlock) => void;
}) {
  const { state } = useApp();
  const [ability, setAbility] = useState<Ability | 'all'>(current.ability);
  const options = useMemo(
    () =>
      blocksFor(state.trainingBlocks, ability, ageGroup)
        .filter((b) => !exclude.includes(b.id))
        // Same slot of the hour first: a warm-up is swapped for a warm-up.
        .sort((a, b) => Number(b.category === current.category) - Number(a.category === current.category)),
    [state.trainingBlocks, ability, ageGroup, exclude, current.category],
  );

  return (
    <div className="animate-fade-in mt-3 rounded-lg border border-hairline bg-surface-soft/60 p-3">
      <AbilityChips value={ability} onChange={setAbility} />
      <ul className="mt-2 max-h-[280px] overflow-y-auto">
        {options.map((b) => (
          <li key={b.id}>
            <button
              type="button"
              onClick={() => onPick(b)}
              className="flex w-full items-center gap-3 rounded-md px-1.5 py-2.5 text-left hover:bg-canvas"
            >
              <span className="min-w-0 flex-1 truncate text-[14.5px] font-medium text-ink">{b.title}</span>
              <span className="shrink-0 text-[12.5px] text-steel">
                {CATEGORY_META[b.category].label} · {b.durationMin}분
              </span>
            </button>
          </li>
        ))}
        {options.length === 0 && (
          <li className="px-1.5 py-4 text-center text-[13.5px] text-steel">바꿀 블록이 없어요</li>
        )}
      </ul>
    </div>
  );
}

function Round({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex h-8 w-8 items-center justify-center rounded-full border border-hairline text-steel transition-colors hover:text-ink disabled:opacity-30"
    >
      {children}
    </button>
  );
}
