/**
 * 오늘 키울 역량 — the five abilities as five words, one tap.
 *
 * A pentagon was tried here first. It asked the coach to read a shape before
 * choosing, and the choice is just one of five words, so the words are all
 * that's left.
 */

import type { Ability } from '@/types';
import { cn } from '@/lib/cn';
import { ABILITY_META, ABILITY_ORDER } from './meta';

export function AbilityPicker({
  selected,
  onSelect,
}: {
  selected: Ability | null;
  onSelect: (a: Ability) => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {ABILITY_ORDER.map((a) => {
        const on = a === selected;
        return (
          <button
            key={a}
            type="button"
            onClick={() => onSelect(a)}
            aria-pressed={on}
            className={cn(
              'min-h-[48px] rounded-xl border text-[15px] font-bold transition-colors',
              on
                ? 'border-primary bg-primary-wash text-primary'
                : 'border-hairline bg-canvas text-ink hover:bg-surface-soft/60',
            )}
          >
            {ABILITY_META[a].label}
          </button>
        );
      })}
    </div>
  );
}
