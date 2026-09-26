/**
 * Session Builder — two steps, in the order a coach actually thinks.
 *
 * Step 1 is the *shape*: how many blocks, in what order, of what kind. The old
 * builder skipped this by hard-coding 웜업 → 스킬 → 미니게임, which is a common
 * session and not the only one. Two skill blocks, a game to open with, warmup
 * then nothing but games — all real, none expressible. A coach whose session
 * doesn't fit the form either lies to the form or stops using it.
 *
 * Step 2 fills the shape. The library is no longer "all blocks, age-appropriate
 * first" but the class's own curriculum first — the blocks its standard sessions
 * actually call for, most-used first — then the next most related curriculum,
 * and so on. The [빠른 구성] button is gone: it was one guess at a session, and
 * the curriculum now offers the real ones by name.
 */

import { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronRight,
  Clock,
  Layers,
  Plus,
  Sparkles,
  Target,
  Trash2,
  X,
} from 'lucide-react';
import type { Class, ISODate, TrainingBlock, TrainingCategory } from '@/types';
import { useApp, DEFAULT_SHAPE } from '@/store/AppContext';
import {
  blockGroupsForCurriculum,
  curriculumForClass,
  relatedCurricula,
  sessionDuration,
  templatesForCurriculum,
} from '@/data/selectors';
import { formatDateKo } from '@/lib/format';
import { cn } from '@/lib/cn';
import { TRACK_META } from '@/components/curriculum/curriculumMeta';
import { CATEGORY_META, TrainingBlockCard } from './TrainingBlockCard';

const CATEGORIES: TrainingCategory[] = ['warmup', 'skill', 'game'];

/** Shapes worth one tap. Not a menu of everything — a menu of the common four. */
const SHAPE_PRESETS: Array<{ label: string; shape: TrainingCategory[] }> = [
  { label: '기본', shape: ['warmup', 'skill', 'game'] },
  { label: '기술 집중', shape: ['warmup', 'skill', 'skill', 'game'] },
  { label: '경기 중심', shape: ['warmup', 'game', 'game'] },
  { label: '게임 먼저', shape: ['warmup', 'game', 'skill', 'game'] },
];

interface SessionBuilderScreenProps {
  cls: Class;
  date: ISODate;
  onDone: () => void;
  onBack: () => void;
  /** Name of the screen 뒤로 returns to. */
  backLabel?: string;
}

export function SessionBuilderScreen({
  cls,
  date,
  onDone,
  onBack,
  backLabel = '달력',
}: SessionBuilderScreenProps) {
  const { state, dispatch, blockMap } = useApp();
  const draft = state.draft;

  const ownCurriculum = curriculumForClass(state.curricula, cls);
  // The library's base curriculum. Defaults to the class's own; changing it is
  // the "which class is this block for" filter the builder needed.
  const [baseId, setBaseId] = useState<string | null>(ownCurriculum?.id ?? null);
  const [focused, setFocused] = useState(0);

  const base = state.curricula.find((c) => c.id === baseId) ?? ownCurriculum;

  const filterOptions = useMemo(() => {
    if (!ownCurriculum) return state.curricula;
    return [ownCurriculum, ...relatedCurricula(state.curricula, ownCurriculum)];
  }, [state.curricula, ownCurriculum]);

  if (!draft) {
    return (
      <div className="px-5 py-20 text-center text-sm text-slate">
        설계 중인 수업이 없습니다. 달력에서 날짜를 다시 선택해 주세요.
      </div>
    );
  }

  const items = draft.items;
  const filled = items.filter((i) => i.blockId).length;
  const totalMin = sessionDuration(items, blockMap);

  // Clamp rather than trust `focused`: changing the shape can drop slots from
  // under it (focus the 4th block, then switch to a three-block preset). A stale
  // index is not a crash — it is worse, a library whose cards silently do
  // nothing, because `setBlock` would address an item that no longer exists.
  const focusIndex = items.length === 0 ? 0 : Math.min(focused, items.length - 1);
  const focusedItem = items[focusIndex];

  const header = (
    <header className="border-b border-hairline bg-canvas px-5 pb-5 pt-6 sm:px-8 lg:px-12">
      <button
        type="button"
        onClick={onBack}
        className="mb-2 text-[13px] font-medium text-steel transition-colors hover:text-ink"
      >
        ← {backLabel}
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[25px] font-semibold leading-[1.2] tracking-tightest text-ink lg:text-[32px]">
            {formatDateKo(date)} 수업 설계
          </h1>
          <p className="mt-1 text-[13px] text-slate lg:text-sm">
            {cls.title} · {cls.venue} · {cls.ageGroup}
          </p>
        </div>

        <span
          className={cn(
            'shrink-0 rounded-md px-3 py-2 text-[13px] font-semibold',
            totalMin > cls.schedule.durationMin
              ? 'bg-tint-peach text-brand-orange-deep'
              : 'bg-surface text-charcoal',
          )}
        >
          구성 {totalMin}분 / 수업 {cls.schedule.durationMin}분
        </span>
      </div>
    </header>
  );

  // --- Step 1: choose the shape ------------------------------------------
  if (!draft.shaped) {
    return (
      <div>
        {header}
        <ShapeStep cls={cls} base={ownCurriculum} />
      </div>
    );
  }

  // --- Step 2: fill it ---------------------------------------------------
  const groups = blockGroupsForCurriculum(
    state,
    base,
    focusedItem?.category ?? 'warmup',
  );

  const fill = (block: TrainingBlock) => {
    dispatch({ type: 'builder/setBlock', index: focusIndex, blockId: block.id });
    // Auto-advance to the next empty slot, so a four-block session is four taps.
    const nextEmpty = items.findIndex((item, i) => i !== focusIndex && !item.blockId);
    if (nextEmpty !== -1) setFocused(nextEmpty);
  };

  const cta = (
    <button
      type="button"
      disabled={filled === 0}
      onClick={onDone}
      className="btn-primary w-full py-3.5 text-[15px]"
    >
      <Check size={16} strokeWidth={2.6} />
      설계 완료 — 한 장으로 보기 ({filled}/{items.length})
    </button>
  );

  return (
    <div>
      {header}

      <div className="px-5 py-6 sm:px-8 lg:px-12">
        <div className="grid gap-6 lg:grid-cols-[380px_1fr] lg:items-start">
          {/* --- Composition ----------------------------------------- */}
          <div className="space-y-2 lg:sticky lg:top-6">
            <div className="flex items-center justify-between gap-2">
              <h2 className="eyebrow-ink">세션 구성 — 순서대로</h2>
              <button
                type="button"
                onClick={() => dispatch({ type: 'builder/reshape' })}
                className="text-[12px] font-semibold text-primary transition-colors hover:text-primary-pressed"
              >
                구성 바꾸기
              </button>
            </div>

            {draft.templateId && (
              <p className="flex items-start gap-1.5 rounded-md bg-tint-lavender px-3 py-2.5 text-[12.5px] leading-[1.5] text-brand-purple-800">
                <Target size={12} className="mt-[3px] shrink-0" />
                표준 세션 그대로 진행합니다 — 블록을 바꾸면 이 표시가 사라집니다.
              </p>
            )}

            {items.map((item, index) => {
              const meta = CATEGORY_META[item.category];
              const block = item.blockId ? blockMap.get(item.blockId) : undefined;
              const isFocused = focusIndex === index;

              return (
                <div
                  key={index}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'copy';
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const id = e.dataTransfer.getData('text/block-id');
                    const dropped = blockMap.get(id);
                    // A dropped block sets the slot's category too. Refusing the
                    // drop because the kinds differ was right when the shape was
                    // fixed; now the shape is the coach's, so adapt to it.
                    if (dropped) {
                      dispatch({ type: 'builder/setBlock', index, blockId: dropped.id });
                      setFocused(index);
                    }
                  }}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg border-2 p-3 transition-all duration-150',
                    block
                      ? 'border-solid border-hairline bg-canvas'
                      : 'border-dashed border-hairline-strong bg-canvas/50',
                    isFocused && !block && 'border-primary bg-tint-lavender/40',
                    isFocused && block && 'ring-1 ring-primary',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setFocused(index)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <span
                      className={cn(
                        'flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-[13px] font-semibold',
                        meta.tint,
                        meta.accent,
                      )}
                    >
                      {block ? <Check size={18} strokeWidth={2.6} /> : index + 1}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            'text-[11px] font-semibold uppercase tracking-label',
                            meta.accent,
                          )}
                        >
                          {meta.label}
                        </span>
                        {block && (
                          <span className="text-[11px] font-medium tabular-nums text-stone">
                            {block.durationMin}분
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block truncate text-[15px] font-semibold text-ink">
                        {block ? block.title : '탭하여 블록 선택'}
                      </span>
                    </span>
                  </button>

                  <span className="flex shrink-0 flex-col">
                    <SlotIcon
                      label="위로"
                      disabled={index === 0}
                      onClick={() => {
                        dispatch({ type: 'builder/moveItem', index, delta: -1 });
                        setFocused(index - 1);
                      }}
                    >
                      <ArrowUp size={13} />
                    </SlotIcon>
                    <SlotIcon
                      label="아래로"
                      disabled={index === items.length - 1}
                      onClick={() => {
                        dispatch({ type: 'builder/moveItem', index, delta: 1 });
                        setFocused(index + 1);
                      }}
                    >
                      <ArrowDown size={13} />
                    </SlotIcon>
                  </span>

                  <SlotIcon
                    label={block ? '블록 비우기' : '슬롯 삭제'}
                    danger
                    onClick={() => {
                      if (block) {
                        dispatch({ type: 'builder/setBlock', index, blockId: null });
                        setFocused(index);
                      } else {
                        dispatch({ type: 'builder/removeItem', index });
                        setFocused(Math.max(0, index - 1));
                      }
                    }}
                  >
                    <X size={15} />
                  </SlotIcon>
                </div>
              );
            })}

            {/* Append without leaving step 2 — the shape is never locked. */}
            <div className="flex gap-1.5 pt-1">
              {CATEGORIES.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => {
                    dispatch({ type: 'builder/addItem', category });
                    setFocused(items.length);
                  }}
                  className="flex flex-1 items-center justify-center gap-1 rounded-md border border-dashed border-hairline-strong py-2 text-[12.5px] font-semibold text-steel transition-colors hover:border-primary hover:text-primary"
                >
                  <Plus size={12} strokeWidth={3} />
                  {CATEGORY_META[category].label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => dispatch({ type: 'builder/shape', categories: DEFAULT_SHAPE })}
              className="flex items-center gap-1.5 pt-1 text-[13px] font-medium text-steel transition-colors hover:text-error"
            >
              <Trash2 size={13} />
              처음부터 다시
            </button>

            <div className="hidden pt-3 lg:block">{cta}</div>
          </div>

          {/* --- Library ---------------------------------------------- */}
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="text-[12px] font-semibold text-charcoal">
                {focusedItem
                  ? `${focusIndex + 1}번 ${CATEGORY_META[focusedItem.category].label}`
                  : '블록'}
                {' 라이브러리'}
              </span>

              {filterOptions.length > 0 && (
                <label className="ml-auto flex items-center gap-1.5 text-[12px] text-steel">
                  클래스 기준
                  <select
                    value={baseId ?? ''}
                    onChange={(e) => setBaseId(e.target.value || null)}
                    className="rounded-md border border-hairline-strong bg-canvas px-2.5 py-1.5 text-[12.5px] font-medium text-ink outline-none focus:border-primary"
                  >
                    {filterOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                        {c.id === ownCurriculum?.id ? ' (이 반)' : ''}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            <div className="space-y-5">
              {groups.map((group) => (
                <section key={group.curriculum?.id ?? 'unclaimed'}>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    {group.curriculum ? (
                      <>
                        <span
                          className={cn(
                            'h-2 w-2 shrink-0 rounded-full',
                            TRACK_META[group.curriculum.track].bar,
                          )}
                        />
                        <h3 className="text-[13.5px] font-semibold text-ink">
                          {group.curriculum.title}
                        </h3>
                        <span
                          className={cn(
                            'rounded-sm px-1.5 py-[2px] text-[11px] font-semibold',
                            group.rank === 0
                              ? 'bg-primary text-white'
                              : 'bg-tint-gray text-steel',
                          )}
                        >
                          {group.rank === 0 ? '이 반의 커리큘럼' : `연관 ${group.rank}순위`}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="h-2 w-2 shrink-0 rounded-full bg-hairline-strong" />
                        <h3 className="text-[13.5px] font-semibold text-steel">
                          커리큘럼 미지정 블록
                        </h3>
                      </>
                    )}
                    <span className="text-[11.5px] text-stone">사용 빈도순</span>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {group.blocks.map((block) => (
                      <TrainingBlockCard
                        key={block.id}
                        block={block}
                        selected={focusedItem?.blockId === block.id}
                        offAge={!block.ageGroups.includes(cls.ageGroup)}
                        onSelect={fill}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="sticky bottom-14 z-30 border-t border-hairline bg-canvas px-5 py-3 shadow-[0_-4px_12px_rgba(14,19,16,0.06)] sm:px-8 lg:hidden">
        {cta}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — the shape
// ---------------------------------------------------------------------------

function ShapeStep({
  cls,
  base,
}: {
  cls: Class;
  base: ReturnType<typeof curriculumForClass>;
}) {
  const { state, dispatch, blockMap } = useApp();
  const [custom, setCustom] = useState<TrainingCategory[]>([]);

  const templates = base
    ? templatesForCurriculum(state.sessionTemplates, base.id).filter(
        (t) => t.status === 'published',
      )
    : [];

  return (
    <div className="space-y-8 px-5 py-7 sm:px-8 lg:px-12 lg:py-9">
      {/* --- From the curriculum -------------------------------------- */}
      <section>
        <h2 className="eyebrow-ink">표준 커리큘럼에서 불러오기</h2>
        <p className="mt-1.5 text-[13px] leading-[1.6] text-slate">
          {base
            ? `${base.title}의 표준 세션입니다. 불러오면 구성과 블록이 한 번에 채워집니다.`
            : '이 클래스에 배정된 커리큘럼이 없습니다. 아래에서 직접 구성하세요.'}
        </p>

        {templates.length > 0 && (
          <ul className="mt-3.5 grid gap-2 md:grid-cols-2">
            {templates.map((template) => {
              const blocks = template.blockIds.map((id) => blockMap.get(id));
              const total = blocks.reduce((sum, b) => sum + (b?.durationMin ?? 0), 0);
              return (
                <li key={template.id}>
                  <button
                    type="button"
                    onClick={() =>
                      dispatch({ type: 'builder/applyTemplate', templateId: template.id })
                    }
                    className="group w-full rounded-lg border border-hairline bg-canvas p-4 text-left transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-card"
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5">
                          <span className="rounded-sm bg-tint-lavender px-1.5 py-[2px] text-[11px] font-bold text-brand-purple-800">
                            {template.week}주
                          </span>
                          <span className="truncate text-[15px] font-semibold text-ink">
                            {template.title}
                          </span>
                        </span>
                        {template.goal && (
                          <span className="mt-1 block text-[12.5px] leading-[1.5] text-slate">
                            {template.goal}
                          </span>
                        )}
                      </span>
                      <ChevronRight
                        size={16}
                        className="mt-0.5 shrink-0 text-stone transition-transform group-hover:translate-x-0.5"
                      />
                    </span>

                    <span className="mt-2.5 flex flex-wrap items-center gap-1">
                      {blocks.map((block, i) => {
                        const meta = block ? CATEGORY_META[block.category] : null;
                        return (
                          <span
                            key={i}
                            className={cn(
                              'rounded-sm px-1.5 py-[2px] text-[11.5px] font-medium',
                              meta?.tint ?? 'bg-tint-gray',
                              meta?.accent ?? 'text-slate',
                            )}
                          >
                            {block?.title ?? '삭제됨'}
                          </span>
                        );
                      })}
                      <span className="ml-auto flex items-center gap-1 text-[12px] font-semibold tabular-nums text-steel">
                        <Clock size={11} />
                        {total}분
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* --- Presets -------------------------------------------------- */}
      <section>
        <h2 className="eyebrow-ink">직접 구성하기</h2>
        <p className="mt-1.5 text-[13px] leading-[1.6] text-slate">
          블록 개수와 순서를 먼저 정합니다. 스킬을 두 번 하거나 미니게임을 먼저 해도 됩니다.
        </p>

        <div className="mt-3.5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {SHAPE_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => dispatch({ type: 'builder/shape', categories: preset.shape })}
              className="rounded-lg border border-hairline bg-canvas p-4 text-left transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-card"
            >
              <span className="flex items-center gap-1.5 text-[14px] font-semibold text-ink">
                <Sparkles size={13} className="text-primary" />
                {preset.label}
              </span>
              <span className="mt-2.5 flex flex-wrap gap-1">
                {preset.shape.map((category, i) => (
                  <span
                    key={i}
                    className={cn(
                      'rounded-sm px-1.5 py-[2px] text-[11.5px] font-semibold',
                      CATEGORY_META[category].tint,
                      CATEGORY_META[category].accent,
                    )}
                  >
                    {CATEGORY_META[category].label}
                  </span>
                ))}
              </span>
              <span className="mt-2 block text-[11.5px] text-stone">
                {preset.shape.reduce((sum, c) => sum + CATEGORY_META[c].defaultMin, 0)}분 예상 ·
                수업 {cls.schedule.durationMin}분
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* --- Fully custom -------------------------------------------- */}
      <section>
        <h2 className="eyebrow-ink">또는 하나씩 쌓기</h2>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {CATEGORIES.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setCustom([...custom, category])}
              className="flex items-center gap-1.5 rounded-full border border-dashed border-hairline-strong px-3.5 py-2 text-[13px] font-semibold text-steel transition-colors hover:border-primary hover:text-primary"
            >
              <Plus size={13} strokeWidth={3} />
              {CATEGORY_META[category].label}
            </button>
          ))}
        </div>

        {custom.length > 0 && (
          <div className="mt-3.5 flex flex-wrap items-center gap-2 rounded-lg border border-hairline bg-canvas p-3.5">
            <Layers size={14} className="shrink-0 text-primary" />
            {custom.map((category, i) => (
              <span
                key={i}
                className={cn(
                  'flex items-center gap-1 rounded-sm px-2 py-1 text-[12.5px] font-semibold',
                  CATEGORY_META[category].tint,
                  CATEGORY_META[category].accent,
                )}
              >
                {i + 1}. {CATEGORY_META[category].label}
              </span>
            ))}
            <button
              type="button"
              onClick={() => setCustom([])}
              className="rounded-sm p-1.5 text-stone transition-colors hover:text-error"
              aria-label="비우기"
            >
              <X size={14} />
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: 'builder/shape', categories: custom })}
              className="btn-primary ml-auto !px-4 !py-2 !text-[13px]"
            >
              이 구성으로 시작
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function SlotIcon({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'rounded-sm p-1 text-stone transition-colors hover:bg-surface hover:text-charcoal disabled:opacity-25 disabled:hover:bg-transparent',
        danger && 'p-2 hover:text-error',
      )}
    >
      {children}
    </button>
  );
}
