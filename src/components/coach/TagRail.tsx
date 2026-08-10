/**
 * Behaviour tag chips, grouped into horizontally-scrolling rails by dimension.
 *
 * Rendered inline inside the expanded student card — deliberately not a bottom
 * sheet, so the coach never loses sight of the roster while tagging.
 */

import { behaviorTags, TAG_DIMENSION_LABEL } from '@/data/mockData';
import type { BehaviorTag } from '@/types';
import { cn } from '@/lib/cn';

const DIMENSION_ORDER: BehaviorTag['dimension'][] = [
  'skill',
  'attitude',
  'teamwork',
  'physical',
  'caution',
];

interface TagRailProps {
  selected: string[];
  onToggle: (tag: string) => void;
}

export function TagRail({ selected, onToggle }: TagRailProps) {
  return (
    <div className="space-y-2.5">
      {DIMENSION_ORDER.map((dimension) => {
        const tags = behaviorTags.filter((t) => t.dimension === dimension);
        const isCaution = dimension === 'caution';

        return (
          <div key={dimension}>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-label text-stone">
              {TAG_DIMENSION_LABEL[dimension]}
            </p>
            <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
              {tags.map((tag) => {
                const active = selected.includes(tag.label);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => onToggle(tag.label)}
                    className={cn(
                      'shrink-0 whitespace-nowrap rounded-full border px-3 py-2 text-[13px] font-semibold transition-all duration-150 active:scale-95',
                      active
                        ? isCaution
                          ? 'border-brand-orange bg-brand-orange text-white'
                          : 'border-primary bg-primary text-white'
                        : isCaution
                          ? 'border-tint-peach bg-tint-peach text-brand-orange-deep'
                          : 'border-hairline bg-canvas text-charcoal',
                    )}
                  >
                    {tag.label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
