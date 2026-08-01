/**
 * 30-Second Session Builder.
 *
 * Three fixed slots (warmup / skill / game). A coach taps a slot to focus it,
 * then taps a library card to fill it — two touches per block, or one touch
 * total via [빠른 구성]. Drag-and-drop is wired for tablet/desktop, but every
 * action is reachable by tap alone because this runs pitch-side.
 */

import { useMemo, useState } from 'react';
import { Check, ChevronRight, Play, Sparkles, Trash2, X } from 'lucide-react';
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
    <div className="flex h-full flex-col">
      {/* --- Header --------------------------------------------------- */}
      <header className="shrink-0 border-b border-hairline bg-canvas px-5 pb-4 pt-5">
        <button
          type="button"
          onClick={onBack}
          className="mb-2 text-[13px] font-medium text-steel transition-colors hover:text-ink"
        >
          ← 클래스 선택
        </button>

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-[22px] font-semibold leading-[1.3] tracking-[-0.3px] text-ink">
              {cls.title}
            </h1>
            <p className="mt-0.5 text-[13px] text-slate">
              {formatDateKo(TODAY)} · {cls.venue}
            </p>
          </div>
          <span
            className={cn(
              'shrink-0 rounded-sm px-2 py-1 text-[12px] font-semibold',
              totalMin > cls.schedule.durationMin
                ? 'bg-tint-peach text-brand-orange-deep'
                : 'bg-surface text-charcoal',
            )}
          >
            {totalMin}분 / {cls.schedule.durationMin}분
          </span>
        </div>

        <button
          type="button"
          onClick={quickBuild}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-tint-yellow-bold px-4 py-2.5 text-sm font-semibold text-charcoal transition-transform active:scale-[0.98]"
        >
          <Sparkles size={15} strokeWidth={2.3} />
          빠른 구성 — {cls.ageGroup} 표준 커리큘럼 자동 채우기
        </button>
      </header>

      {/* --- Slots ----------------------------------------------------- */}
      <div className="shrink-0 space-y-2 bg-surface-soft px-5 py-4">
        {SLOT_ORDER.map((category, index) => {
          const meta = CATEGORY_META[category];
          const blockId = draftSlots[category];
          const block = blockId ? getBlock(blockId) : undefined;
          const isFocused = focused === category;

          return (
            <button
              key={category}
              type="button"
              onClick={() => setFocused(category)}
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
                'flex w-full items-center gap-3 rounded-lg border-2 border-dashed p-3 text-left transition-all duration-150',
                block
                  ? 'border-solid border-hairline bg-canvas'
                  : 'border-hairline-strong bg-canvas/40',
                isFocused && !block && 'border-primary bg-tint-lavender/40',
                isFocused && block && 'ring-1 ring-primary',
              )}
            >
              <span
                className={cn(
                  'flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-md text-[11px] font-semibold',
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

              {block ? (
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={`${meta.label} 블록 비우기`}
                  onClick={(e) => {
                    e.stopPropagation();
                    dispatch({ type: 'builder/setSlot', category, blockId: null });
                    setFocused(category);
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter' && e.key !== ' ') return;
                    e.stopPropagation();
                    dispatch({ type: 'builder/setSlot', category, blockId: null });
                  }}
                  className="shrink-0 rounded-sm p-2 text-stone transition-colors hover:bg-surface hover:text-error"
                >
                  <X size={16} />
                </span>
              ) : (
                <ChevronRight size={18} className="shrink-0 text-stone" />
              )}
            </button>
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
      </div>

      {/* --- Library --------------------------------------------------- */}
      <div className="min-h-0 flex-1 overflow-y-auto bg-surface-soft px-5 pb-40">
        <div className="sticky top-0 z-10 -mx-5 flex gap-2 bg-surface-soft px-5 pb-3 pt-1">
          {SLOT_ORDER.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setFocused(category)}
              className={cn('pill-tab flex-1', focused === category && 'pill-tab-active')}
            >
              {CATEGORY_META[category].label}
            </button>
          ))}
        </div>

        <div className="space-y-2">
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

      {/* --- Commit ---------------------------------------------------- */}
      <div className="absolute inset-x-0 bottom-[68px] z-20 border-t border-hairline bg-canvas px-5 py-3 shadow-[0_-4px_12px_rgba(15,15,15,0.06)]">
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
