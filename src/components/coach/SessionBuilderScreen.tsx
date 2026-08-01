/**
 * 30-Second Session Builder.
 *
 * Three fixed slots (warmup / skill / game). A coach taps a slot to focus it,
 * then taps a library card to fill it — two touches per block, or one touch
 * total via [빠른 구성]. On desktop the slots pin to a sticky left column and
 * the library grids out beside them; drag-and-drop is available from the card
 * handle. Every action stays reachable by tap alone.
 */

import { useMemo, useState } from 'react';
import { Check, Play, Sparkles, Trash2, X } from 'lucide-react';
import type { Class, TrainingBlock, TrainingCategory } from '@/types';
import { useApp } from '@/store/AppContext';
import { TODAY } from '@/data/mockData';
import { blocksByCategory } from '@/data/selectors';
import { formatDateKo } from '@/lib/format';
import { cn } from '@/lib/cn';
import { CATEGORY_META, TrainingBlockCard } from './TrainingBlockCard';

const SLOT_ORDER: TrainingCategory[] = ['warmup', 'skill', 'game'];

interface SessionBuilderScreenProps {
  cls: Class;
  onStartSession: () => void;
  onBack: () => void;
}

export function SessionBuilderScreen({ cls, onStartSession, onBack }: SessionBuilderScreenProps) {
  const { state, dispatch, getBlock } = useApp();
  const [focused, setFocused] = useState<TrainingCategory>('warmup');

  const { draftSlots, trainingBlocks } = state;

  const filledCount = SLOT_ORDER.filter((c) => draftSlots[c]).length;
  const totalMin = SLOT_ORDER.reduce((sum, c) => {
    const id = draftSlots[c];
    return sum + (id ? (getBlock(id)?.durationMin ?? 0) : 0);
  }, 0);

  const library = useMemo(() => {
    const pool = blocksByCategory(trainingBlocks, focused);
    // Age-appropriate blocks float to the top; the rest stay reachable but dim.
    return [...pool].sort((a, b) => {
      const aFit = a.ageGroups.includes(cls.ageGroup) ? 1 : 0;
      const bFit = b.ageGroups.includes(cls.ageGroup) ? 1 : 0;
      if (aFit !== bFit) return bFit - aFit;
      return b.usageCount - a.usageCount;
    });
  }, [trainingBlocks, focused, cls.ageGroup]);

  const fillSlot = (category: TrainingCategory, block: TrainingBlock) => {
    dispatch({ type: 'builder/setSlot', category, blockId: block.id });
    // Auto-advance to the next empty slot so three blocks take three taps.
    const nextEmpty = SLOT_ORDER.find((c) => c !== category && !draftSlots[c]);
    if (nextEmpty) setFocused(nextEmpty);
  };

  /** One-tap curriculum: the owner's core blocks, matched to this age group. */
  const quickBuild = () => {
    for (const category of SLOT_ORDER) {
      const candidates = blocksByCategory(trainingBlocks, category)
        .filter((b) => b.ageGroups.includes(cls.ageGroup))
        .sort((a, b) => {
          if (a.isCoreCurriculum !== b.isCoreCurriculum) return a.isCoreCurriculum ? -1 : 1;
          return b.usageCount - a.usageCount;
        });
      if (candidates[0]) {
        dispatch({ type: 'builder/setSlot', category, blockId: candidates[0].id });
      }
    }
  };

  const handleStart = () => {
    dispatch({ type: 'builder/commit', classId: cls.id, date: TODAY });
    dispatch({ type: 'attendance/start', classId: cls.id, date: TODAY });
    onStartSession();
  };

  return (
    <div>
      {/* --- Header ---------------------------------------------------- */}
      <header className="border-b border-hairline bg-canvas px-5 pb-5 pt-6 sm:px-8 lg:px-10">
        <button
          type="button"
          onClick={onBack}
          className="mb-2 text-[13px] font-medium text-steel transition-colors hover:text-ink"
        >
          ← 클래스 선택
        </button>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[24px] font-semibold leading-[1.25] tracking-[-0.4px] text-ink lg:text-[30px]">
              {cls.title}
            </h1>
            <p className="mt-1 text-[13px] text-slate lg:text-sm">
              {formatDateKo(TODAY)} · {cls.venue} · {cls.ageGroup}
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

        <button
          type="button"
          onClick={quickBuild}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-tint-yellow-bold px-4 py-2.5 text-sm font-semibold text-charcoal transition-transform active:scale-[0.99] lg:w-auto lg:px-5"
        >
          <Sparkles size={15} strokeWidth={2.3} />
          빠른 구성 — {cls.ageGroup} 표준 커리큘럼 자동 채우기
        </button>
      </header>

      {/* --- Slots + library ------------------------------------------- */}
      <div className="px-5 py-6 sm:px-8 lg:px-10">
        <div className="grid gap-6 lg:grid-cols-[380px_1fr] lg:items-start">
          {/* Slots */}
          <div className="space-y-2 lg:sticky lg:top-6">
            <h2 className="text-[11px] font-semibold uppercase tracking-[1px] text-stone">
              오늘의 세션 구성
            </h2>

            {SLOT_ORDER.map((category, index) => {
              const meta = CATEGORY_META[category];
              const blockId = draftSlots[category];
              const block = blockId ? getBlock(blockId) : undefined;
              const isFocused = focused === category;

              return (
                /* A div, not a button — it holds its own buttons, and nesting
                   interactive elements makes clicks ambiguous. */
                <div
                  key={category}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'copy';
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const id = e.dataTransfer.getData('text/block-id');
                    const dropped = getBlock(id);
                    if (dropped && dropped.category === category) fillSlot(category, dropped);
                  }}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border-2 border-dashed p-3 transition-all duration-150',
                    block ? 'border-solid border-hairline bg-canvas' : 'border-hairline-strong bg-canvas/50',
                    isFocused && !block && 'border-primary bg-tint-lavender/40',
                    isFocused && block && 'ring-1 ring-primary',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setFocused(category)}
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
                        <span className={cn('text-[11px] font-semibold uppercase tracking-[1px]', meta.accent)}>
                          {meta.label}
                        </span>
                        <span className="text-[11px] font-medium text-stone">
                          권장 {meta.defaultMin}분
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-[15px] font-semibold text-ink">
                        {block ? block.title : '탭하여 블록 선택'}
                      </span>
                    </span>
                  </button>

                  {block && (
                    <button
                      type="button"
                      aria-label={`${meta.label} 블록 비우기`}
                      onClick={() => {
                        dispatch({ type: 'builder/setSlot', category, blockId: null });
                        setFocused(category);
                      }}
                      className="shrink-0 rounded-sm p-2 text-stone transition-colors hover:bg-surface hover:text-error"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              );
            })}

            {filledCount > 0 && (
              <button
                type="button"
                onClick={() => dispatch({ type: 'builder/clear' })}
                className="flex items-center gap-1.5 pt-1 text-[13px] font-medium text-steel transition-colors hover:text-error"
              >
                <Trash2 size={13} />
                전체 비우기
              </button>
            )}

            {/* Desktop CTA sits with the slots it commits. */}
            <button
              type="button"
              disabled={filledCount === 0}
              onClick={handleStart}
              className="btn-primary mt-4 hidden w-full py-3.5 text-[15px] lg:flex"
            >
              <Play size={16} strokeWidth={2.5} fill="currentColor" />
              수업 시작 &amp; 출결 기록 ({filledCount}/3)
            </button>
          </div>

          {/* Library */}
          <div>
            <div className="mb-3 flex gap-2">
              {SLOT_ORDER.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setFocused(category)}
                  className={cn(
                    'pill-tab flex-1 lg:flex-none',
                    focused === category && 'pill-tab-active',
                  )}
                >
                  {CATEGORY_META[category].label}
                </button>
              ))}
            </div>

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {library.map((block) => (
                <TrainingBlockCard
                  key={block.id}
                  block={block}
                  selected={draftSlots[focused] === block.id}
                  offAge={!block.ageGroups.includes(cls.ageGroup)}
                  onSelect={(b) => fillSlot(focused, b)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* --- Mobile CTA ------------------------------------------------ */}
      <div className="sticky bottom-16 z-30 border-t border-hairline bg-canvas px-5 py-3 shadow-[0_-4px_12px_rgba(15,15,15,0.06)] sm:px-8 lg:hidden">
        <button
          type="button"
          disabled={filledCount === 0}
          onClick={handleStart}
          className="btn-primary w-full py-3.5 text-[15px]"
        >
          <Play size={16} strokeWidth={2.5} fill="currentColor" />
          수업 시작 &amp; 출결 기록 ({filledCount}/3 블록)
        </button>
      </div>
    </div>
  );
}
