/**
 * 수업 준비 — one class on one day, planned the way coaches already plan it.
 *
 * Top to bottom is the order of the thinking: who is coming, then what the last
 * lessons did and so what today is for. The second is one picture — the growth
 * pentagon with the last lessons' blocks on it — and one tap: the coach picks
 * the ability to work on, and the app picks the goal, from what the last
 * lessons left off, today's headcount and the class's age group. The goal's
 * 훈련 블록 arrive already fitted to the day. A coach who'd rather do something
 * else opens 바꾸기; the recommendation is a starting point, not a gate.
 *
 * The same screen edits a lesson that is already prepared: it opens on the
 * saved goal and blocks, and choosing a different goal recomposes.
 */

import { useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, Minus, Pencil, Plus, Repeat2, Sparkles, X } from 'lucide-react';
import type { Ability, BlockEdit, Class, ID, ISODate, SessionItem, TrainingBlock } from '@/types';
import { useApp } from '@/store/AppContext';
import { useWorkspace } from '@/store/WorkspaceContext';
import { trialsOn } from '@/data/crm';
import { fromMinutes } from '@/data/today';
import { blocksFor, planFor, sessionDuration, studentsInClass } from '@/data/selectors';
import {
  TODAY,
  beadsOf,
  blockAsRun,
  composeLesson,
  carryOver,
  goalOptions,
  minutesByAbility,
  pastBeads,
  recentLessons,
  recommendGoal,
  type GoalContext,
} from '@/data/lessonPrep';
import { formatDateKo } from '@/lib/format';
import { cn } from '@/lib/cn';
import { ABILITY_META, CATEGORY_META } from './meta';
import { AbilityChips, DetailHeader, More } from './parts';
import { BlockAdder } from './BlockAdder';
import { GoalPentagon } from './GoalPentagon';
import { LessonFlow } from './LessonFlow';

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
  const past = useMemo(() => pastBeads(recent, blockMap), [recent, blockMap]);

  const ctx: GoalContext = useMemo(
    () => ({
      cls,
      recent,
      past,
      library: state.trainingBlocks,
      when: { ageGroup: cls.ageGroup, headcount, minutes: cls.schedule.durationMin },
    }),
    [cls, recent, past, state.trainingBlocks, headcount],
  );

  // --- The plan being prepared -------------------------------------------

  const saved = planFor(state.sessionPlans, cls.id, date);
  const savedGoal = saved?.templateId ? getTemplate(saved.templateId) : undefined;

  // No focus until the coach taps one: which ability today is for is the one
  // decision the app leaves to them.
  const [ability, setAbility] = useState<Ability | null>(savedGoal?.ability ?? null);
  const [goalId, setGoalId] = useState<ID | null>(saved?.templateId ?? null);
  const [items, setItems] = useState<SessionItem[]>(() =>
    (saved?.items ?? []).filter((i) => i.blockId),
  );
  const [notes, setNotes] = useState<string[]>([]);
  const [picking, setPicking] = useState(false);
  const [allGoals, setAllGoals] = useState(false);
  const blocksRef = useRef<HTMLElement>(null);

  const recentIds = useMemo(() => recent.map((l) => l.plan?.templateId), [recent]);
  const goals = useMemo(
    () => (ability ? goalOptions(state.sessionTemplates, cls, ability, recentIds) : []),
    [state.sessionTemplates, cls, ability, recentIds],
  );
  const recommended = useMemo(() => recommendGoal(goals, ctx), [goals, ctx]);
  const shownGoals = allGoals ? goals : goals.slice(0, SHOWN_GOALS);
  const goal = goalId ? getTemplate(goalId) : undefined;

  const pastMin = useMemo(() => minutesByAbility(past), [past]);
  const todayMin = useMemo(
    () => (items.length > 0 ? minutesByAbility(beadsOf(items, blockMap, TODAY)) : null),
    [items, blockMap],
  );
  const carry = useMemo(() => (goal ? carryOver(goal, ctx) : null), [goal, ctx]);

  const total = sessionDuration(items, blockMap);

  const choose = (id: ID, scroll = false) => {
    const template = getTemplate(id);
    if (!template) return;
    const composed = composeLesson(template, state.trainingBlocks, ctx.when);
    setGoalId(id);
    setItems(composed.items);
    setNotes(composed.notes);
    if (scroll) {
      // Picked from the list, which can push the blocks off a phone screen.
      window.setTimeout(
        () => blocksRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
        60,
      );
    }
  };

  /** A focus tapped on the pentagon: the app answers with a goal. */
  const pickAbility = (a: Ability) => {
    setAbility(a);
    setPicking(false);
    setAllGoals(false);
    const options = goalOptions(state.sessionTemplates, cls, a, recentIds);
    const best = recommendGoal(options, ctx);
    if (best) choose(best.id);
    else {
      // Nothing for this age on this ability: say so rather than keep a goal
      // from another ability on screen as if it answered the tap.
      setGoalId(null);
      setItems([]);
      setNotes([]);
    }
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
                <span className="ml-1 rounded-full bg-primary-wash px-2 py-0.5 text-[12px] font-bold text-primary">
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
                      className="rounded-full bg-surface-soft px-2.5 py-1 text-[13px] font-medium text-charcoal"
                    >
                      {s.name}
                    </li>
                  ))}
                  {trials.map((l) => (
                    <li
                      key={l.id}
                      className="rounded-full bg-primary-wash px-2.5 py-1 text-[13px] font-medium text-primary"
                    >
                      {l.childName} · 체험
                    </li>
                  ))}
                </ul>
              </More>
            )}
          </div>
        </Step>

        {/* 2 — what today is for, read off what the last lessons did */}
        <Step n={2} title="오늘의 목표">
          <GoalPentagon
            past={pastMin}
            today={todayMin}
            hasHistory={past.length > 0}
            selected={ability}
            onSelect={pickAbility}
          />

          <div className="mt-3">
            <LessonFlow
              recent={recent}
              past={past}
              carry={carry}
              today={{
                ready: Boolean(goal),
                body: (
                  <div>
                    <p className={cn('text-[13px] font-bold', goal ? 'text-primary' : 'text-stone')}>
                      오늘
                    </p>
                    {goal ? (
                      <div key={goal.id} className="animate-fade-in">
                        <div className="mt-0.5 flex items-baseline gap-3">
                          <p className="min-w-0 flex-1 text-[20px] font-bold leading-tight tracking-[-0.02em] text-ink">
                            {goal.title}
                          </p>
                          <button
                            type="button"
                            onClick={() => setPicking((v) => !v)}
                            aria-expanded={picking}
                            className="flex shrink-0 items-center gap-0.5 text-[13px] font-semibold text-steel transition-colors hover:text-ink"
                          >
                            바꾸기
                            <ChevronDown
                              size={14}
                              strokeWidth={2.4}
                              className={cn('transition-transform duration-200', picking && 'rotate-180')}
                            />
                          </button>
                        </div>

                        {picking && (
                          <ul className="animate-fade-in mt-2.5 space-y-1">
                            {shownGoals.map((t) => {
                              const on = t.id === goalId;
                              return (
                                <li key={t.id}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      choose(t.id, true);
                                      setPicking(false);
                                    }}
                                    aria-pressed={on}
                                    className={cn(
                                      'flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-[14.5px] transition-colors',
                                      on ? 'bg-primary-wash font-bold text-primary' : 'text-ink hover:bg-surface-soft',
                                    )}
                                  >
                                    <span className="min-w-0 flex-1 truncate">{t.title}</span>
                                    {t.id === recommended?.id && (
                                      <span className="shrink-0 text-[12px] font-semibold text-primary">추천</span>
                                    )}
                                  </button>
                                </li>
                              );
                            })}
                            {!allGoals && goals.length > SHOWN_GOALS && (
                              <li>
                                <button
                                  type="button"
                                  onClick={() => setAllGoals(true)}
                                  className="w-full py-1.5 text-center text-[13px] font-semibold text-steel hover:text-ink"
                                >
                                  {goals.length - SHOWN_GOALS}개 더 보기
                                </button>
                              </li>
                            )}
                          </ul>
                        )}
                      </div>
                    ) : (
                      <p className="mt-0.5 text-[15px] text-steel">
                        {ability && goals.length === 0
                          ? `${cls.ageGroup} ${ABILITY_META[ability].label} 목표가 아직 없어요`
                          : items.length > 0
                            ? '직접 구성한 수업'
                            : '역량을 누르면 목표가 정해져요'}
                      </p>
                    )}
                  </div>
                ),
              }}
            />
          </div>
        </Step>

        {/* 3 — the blocks, once there is a goal (or a plan to edit) */}
        {(goalId || items.length > 0) && (
          <section ref={blocksRef} className="scroll-mt-4">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="flex items-center gap-2 text-[19px] font-bold tracking-[-0.02em] text-ink">
                <StepNo n={3} />
                훈련 블록
              </h2>
              <span
                className={cn(
                  'text-[13px] tabular-nums',
                  total > cls.schedule.durationMin ? 'font-semibold text-ink' : 'text-steel',
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
              focus={goal?.ability ?? ability ?? 'technical'}
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
          {items.length === 0 ? '오늘 키울 역량을 눌러 주세요' : saved ? '저장' : '준비 완료'}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function StepNo({ n }: { n: number }) {
  return (
    <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-ink text-[12px] font-bold text-white">
      {n}
    </span>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="flex items-center gap-2 text-[19px] font-bold tracking-[-0.02em] text-ink">
        <StepNo n={n} />
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/**
 * The lesson's blocks, editable in place.
 *
 * A row is name and minutes. Tapping it opens what the block is — how to run
 * it, what to look for — and under that every edit a coach makes: minutes and
 * order on top, then 내용 수정 (rewrite it for today), 다른 블록 (swap it for
 * another that trains the same ability) and 빼기. The actions carry words, not
 * just icons — a coach should never have to guess which circle means "edit".
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
  const [mode, setMode] = useState<'view' | 'edit' | 'swap'>('view');
  const [adding, setAdding] = useState(false);

  const set = (next: SessionItem[], nextOpen: number | null = open) => {
    onChange(next);
    setOpen(nextOpen);
    setMode('view');
  };

  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    set(next, j);
  };

  const patch = (i: number, change: Partial<SessionItem>) =>
    set(items.map((it, k) => (k === i ? { ...it, ...change } : it)));

  const toItem = (b: TrainingBlock): SessionItem => ({
    category: b.category,
    blockId: b.id,
    durationMin: null,
  });

  return (
    <>
      {items.length > 0 && (
        <p className="mt-1 text-[13px] text-steel">블록을 누르면 내용을 고치거나 바꿀 수 있어요</p>
      )}
      <ol className="mt-3 overflow-hidden rounded-xl border border-hairline bg-canvas">
        {items.map((item, i) => {
          const base = item.blockId ? blockMap.get(item.blockId) : undefined;
          const block = base && blockAsRun(base, item);
          const min = item.durationMin ?? block?.durationMin ?? 0;
          const isOpen = open === i;
          return (
            <li key={`${item.blockId}-${i}`} className="border-b border-hairline-soft last:border-b-0">
              <button
                type="button"
                onClick={() => {
                  setOpen(isOpen ? null : i);
                  setMode('view');
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
                      {item.edit && <span className="font-semibold text-primary"> · 수정함</span>}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-[14px] font-semibold tabular-nums text-charcoal">
                  {min}분
                </span>
                <ChevronDown
                  size={15}
                  className={cn('shrink-0 text-stone transition-transform', isOpen && 'rotate-180')}
                />
              </button>

              {isOpen && block && base && (
                <div className="animate-fade-in px-4 pb-4 pl-12">
                  {mode === 'edit' ? (
                    <BlockEditForm
                      original={base}
                      current={block}
                      edited={Boolean(item.edit)}
                      onCancel={() => setMode('view')}
                      onApply={(edit) => patch(i, { edit })}
                    />
                  ) : (
                    <>
                      <p className="text-[14px] leading-[1.6] text-charcoal">{block.description}</p>
                      {block.coachingPoints.length > 0 && (
                        <ul className="mt-2 space-y-0.5 text-[13.5px] leading-[1.55] text-slate">
                          {block.coachingPoints.map((p) => (
                            <li key={p}>· {p}</li>
                          ))}
                        </ul>
                      )}
                      {block.equipment.length > 0 && (
                        <p className="mt-2 text-[12.5px] text-steel">
                          준비물 {block.equipment.join(', ')}
                        </p>
                      )}

                      <div className="mt-3 flex items-center gap-2">
                        <span className="flex items-center gap-1 rounded-full border border-hairline px-1 py-0.5">
                          <button
                            type="button"
                            onClick={() => patch(i, { durationMin: Math.max(5, min - 5) })}
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
                            onClick={() => patch(i, { durationMin: min + 5 })}
                            aria-label="시간 늘리기"
                            className="p-1.5 text-steel hover:text-ink"
                          >
                            <Plus size={14} />
                          </button>
                        </span>
                        <Round label="위로" onClick={() => move(i, -1)} disabled={i === 0}>
                          <ArrowUp size={15} />
                        </Round>
                        <Round
                          label="아래로"
                          onClick={() => move(i, 1)}
                          disabled={i === items.length - 1}
                        >
                          <ArrowDown size={15} />
                        </Round>
                      </div>

                      <div className="mt-2 grid grid-cols-3 gap-1.5">
                        <Action onClick={() => setMode('edit')}>
                          <Pencil size={14} />
                          내용 수정
                        </Action>
                        <Action
                          active={mode === 'swap'}
                          onClick={() => setMode(mode === 'swap' ? 'view' : 'swap')}
                        >
                          <Repeat2 size={14} />
                          다른 블록
                        </Action>
                        <Action onClick={() => set(items.filter((_, k) => k !== i), null)}>
                          <X size={14} />
                          빼기
                        </Action>
                      </div>

                      {mode === 'swap' && (
                        <SwapList
                          current={base}
                          ageGroup={ageGroup}
                          exclude={items.map((it) => it.blockId)}
                          onPick={(b) =>
                            // The new block takes over the slot, minutes
                            // included, so a swap never throws the hour out.
                            // Today's rewrite belonged to the old block.
                            patch(i, {
                              ...toItem(b),
                              durationMin: min === b.durationMin ? null : min,
                              edit: undefined,
                            })
                          }
                        />
                      )}
                    </>
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

/**
 * Rewrite a block for this lesson only.
 *
 * Only what differs from the library is kept, so "원래대로" is simply dropping
 * the edit, and a block that was opened and saved unchanged stays unedited.
 */
function BlockEditForm({
  original,
  current,
  edited,
  onCancel,
  onApply,
}: {
  original: TrainingBlock;
  current: TrainingBlock;
  edited: boolean;
  onCancel: () => void;
  onApply: (edit: BlockEdit | undefined) => void;
}) {
  const [title, setTitle] = useState(current.title);
  const [description, setDescription] = useState(current.description);
  const [points, setPoints] = useState(current.coachingPoints.join('\n'));

  const apply = () => {
    const nextPoints = points
      .split('\n')
      .map((p) => p.trim())
      .filter(Boolean);
    const edit: BlockEdit = {};
    if (title.trim() && title.trim() !== original.title) edit.title = title.trim();
    if (description.trim() !== original.description) edit.description = description.trim();
    if (nextPoints.join('\n') !== original.coachingPoints.join('\n')) edit.coachingPoints = nextPoints;
    onApply(Object.keys(edit).length > 0 ? edit : undefined);
  };

  return (
    <div className="animate-fade-in space-y-3">
      <Field label="블록 이름">
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="input-field" />
      </Field>
      <Field label="진행 방법">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="input-field resize-none leading-[1.55]"
        />
      </Field>
      <Field label="코칭 포인트" hint="한 줄에 하나씩">
        <textarea
          value={points}
          onChange={(e) => setPoints(e.target.value)}
          rows={3}
          className="input-field resize-none leading-[1.55]"
        />
      </Field>
      <p className="text-[12.5px] text-steel">이 수업에만 적용돼요. 라이브러리의 블록은 그대로예요.</p>
      <div className="flex items-center gap-2">
        {edited && (
          <button
            type="button"
            onClick={() => onApply(undefined)}
            className="mr-auto text-[13.5px] font-semibold text-steel hover:text-ink"
          >
            원래대로
          </button>
        )}
        <button type="button" onClick={onCancel} className="btn-secondary ml-auto py-2.5">
          취소
        </button>
        <button type="button" onClick={apply} className="btn-primary py-2.5">
          적용
        </button>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline gap-2 text-[12.5px] font-semibold text-charcoal">
        {label}
        {hint && <span className="font-normal text-stone">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function Action({
  active = false,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'pressable flex items-center justify-center gap-1.5 rounded-full border py-2 text-[13px] font-semibold',
        active
          ? 'border-primary bg-primary-wash text-primary'
          : 'border-hairline text-charcoal hover:border-hairline-strong',
      )}
    >
      {children}
    </button>
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
