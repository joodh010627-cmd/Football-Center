import { Clock, Star } from 'lucide-react';
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
  compact?: boolean;
}

export function TrainingBlockCard({
  block,
  onSelect,
  selected = false,
  offAge = false,
  compact = false,
}: TrainingBlockCardProps) {
  const meta = CATEGORY_META[block.category];

  return (
    <button
      type="button"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/block-id', block.id);
        e.dataTransfer.effectAllowed = 'copy';
      }}
      onClick={() => onSelect(block)}
      className={cn(
        'group w-full rounded-lg border bg-canvas p-4 text-left transition-all duration-150 active:scale-[0.985]',
        selected ? 'border-primary shadow-card ring-1 ring-primary' : 'border-hairline hover:shadow-card',
        offAge && 'opacity-55',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={cn('h-2 w-2 shrink-0 rounded-full', meta.bar)} />
            <h4 className="truncate text-[15px] font-semibold leading-[1.35] text-ink">
              {block.title}
            </h4>
          </div>

          {!compact && (
            <p className="mt-1.5 line-clamp-2 text-[13px] leading-[1.45] text-slate">
              {block.description}
            </p>
          )}
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
        <span className="ml-auto text-[12px] font-medium text-stone">{block.usageCount}회 사용</span>
      </div>
    </button>
  );
}
