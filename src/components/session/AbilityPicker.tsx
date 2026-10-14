/**
 * 오늘 키울 역량 — the five abilities as hashtags.
 *
 * Tap as many as fit, or none. They are the coach's note on the day, like the
 * "what I felt" line of a diary: they build nothing and filter nothing, so
 * they look like tags, not like a choice that leads somewhere.
 */

import type { Ability } from '@/types';
import { cn } from '@/lib/cn';
import { ABILITY_META, ABILITY_ORDER } from './meta';

export function AbilityPicker({
  selected,
  onToggle,
}: {
  selected: readonly Ability[];
  onToggle: (a: Ability) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {ABILITY_ORDER.map((a) => {
        const on = selected.includes(a);
        return (
          <button
            key={a}
            type="button"
            onClick={() => onToggle(a)}
            aria-pressed={on}
            className={cn(
              'pressable rounded-full border px-3.5 py-2 text-[14.5px] font-semibold transition-colors',
              on
                ? 'border-primary bg-primary text-white'
                : 'border-hairline bg-canvas text-charcoal hover:bg-surface-soft/60',
            )}
          >
            #{ABILITY_META[a].label}
          </button>
        );
      })}
    </div>
  );
}
