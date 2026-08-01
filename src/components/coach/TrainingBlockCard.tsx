import { Clock, GripVertical, Plus, Star } from 'lucide-react';
import type { TrainingBlock } from '@/types';
import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui/Badge';

export const CATEGORY_META = {
  warmup: { label: '웜업', tint: 'bg-tint-peach', accent: 'text-brand-orange-deep', bar: 'bg-brand-orange', defaultMin: 10 },
  skill: { label: '스킬 훈련', tint: 'bg-tint-lavender', accent: 'text-brand-purple-800', bar: 'bg-primary', defaultMin: 20 },
  game: { label: '미니 게임', tint: 'bg-tint-mint', accent: 'text-brand-green', bar: 'bg-brand-green', defaultMin: 25 },
} as const;

interface TrainingBlockCardProps {
  block: TrainingBlock;
  onSelect: (block: TrainingBlock) => void;
  selected?: boolean;
  /** Dimmed when the block isn't rated for the class's age group. */
  offAge?: boolean;
}

export function TrainingBlockCard({
  block,
  onSelect,
  selected = false,
  offAge = false,
}: TrainingBlockCardProps) {
  const meta = CATEGORY_META[block.category];

  return (
    /* Drag lives on a dedicated handle, never on the card itself. A draggable
       button eats its own click: any pixel of pointer movement starts a drag
       and the click never fires, which reads as a dead control on desktop. */
    <div
      className={cn(
        'group relative flex rounded-lg border bg-canvas transition-all duration-150',
        selected ? 'border-primary shadow-card ring-1 ring-primary' : 'border-hairline hover:shadow-card',
        offAge && 'opacity-55',
      )}
    >
      <span
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('text/block-id', block.id);
          e.dataTransfer.effectAllowed = 'copy';
        }}
        title="드래그해서 슬롯에 놓기"
        className="hidden w-7 shrink-0 cursor-grab items-center justify-center rounded-l-lg border-r border-hairline-soft text-stone transition-colors hover:bg-surface hover:text-charcoal active:cursor-grabbing lg:flex"
      >
        <GripVertical size={14} />
      </span>

      <button
        type="button"
        onClick={() => onSelect(block)}
        className="min-w-0 flex-1 p-4 text-left active:scale-[0.99]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className={cn('h-2 w-2 shrink-0 rounded-full', meta.bar)} />
              <h4 className="truncate text-[15px] font-semibold leading-[1.35] text-ink">
                {block.title}
              </h4>
            </div>

            <p className="mt-1.5 line-clamp-2 text-[13px] leading-[1.45] text-slate">
              {block.description}
            </p>
          </div>

          <span className="flex shrink-0 items-center gap-1 rounded-sm bg-surface px-2 py-1 text-[12px] font-semibold text-charcoal">
            <Clock size={11} strokeWidth={2.4} />
            {block.durationMin}분
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {block.isCoreCurriculum && (
            <Badge tone="purple">
              <Star size={10} strokeWidth={2.6} fill="currentColor" />
              표준 커리큘럼
            </Badge>
          )}
          {block.equipment.slice(0, 2).map((item) => (
            <Badge key={item} tone="neutral">
              {item}
            </Badge>
          ))}
          <span className="ml-auto flex items-center gap-1 text-[12px] font-medium text-stone">
            {block.usageCount}회 사용
            <span className="flex items-center gap-0.5 rounded-sm bg-tint-lavender px-1.5 py-0.5 text-[11px] font-semibold text-brand-purple-800 opacity-0 transition-opacity group-hover:opacity-100">
              <Plus size={10} strokeWidth={3} />
              담기
            </span>
          </span>
        </div>
      </button>
    </div>
  );
}
