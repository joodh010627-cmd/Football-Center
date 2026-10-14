/**
 * 훈련 주제 — pick one, and the lesson is built from its blocks.
 *
 * Every topic is on screen so the list reads as the whole of football, not as
 * what this centre happens to have. Topics with no drill for the class's age
 * are greyed out rather than hidden, so a coach can see what is missing.
 */

import { Check } from 'lucide-react';
import type { TopicId } from '@/types';
import { TOPICS } from '@/data/topics';
import { cn } from '@/lib/cn';

export function TopicPicker({
  selected,
  runnable,
  onSelect,
}: {
  selected: TopicId | null;
  runnable: ReadonlySet<TopicId>;
  onSelect: (t: TopicId) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {TOPICS.map((t) => {
        const on = t.id === selected;
        const can = runnable.has(t.id);
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t.id)}
            disabled={!can}
            aria-pressed={on}
            className={cn(
              'pressable flex items-center gap-1 rounded-lg border px-3 py-2 text-[14.5px] font-semibold transition-colors',
              on
                ? 'border-primary bg-primary-wash text-primary'
                : 'border-hairline bg-canvas text-ink hover:bg-surface-soft/60',
              'disabled:border-hairline-soft disabled:bg-transparent disabled:text-stone disabled:hover:bg-transparent',
            )}
          >
            {on && <Check size={14} strokeWidth={3} />}
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/** 전체 + every topic, as a scrolling row — the filter on block lists. */
export function TopicChips({
  value,
  onChange,
}: {
  value: TopicId | 'all';
  onChange: (v: TopicId | 'all') => void;
}) {
  const chip = (id: TopicId | 'all', label: string) => (
    <button
      key={id}
      type="button"
      onClick={() => onChange(id)}
      aria-pressed={value === id}
      className={cn('pill-tab shrink-0 !px-3 !py-1.5 !text-[13px]', value === id && 'pill-tab-active')}
    >
      {label}
    </button>
  );
  return (
    <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
      {chip('all', '전체')}
      {TOPICS.map((t) => chip(t.id, t.label))}
    </div>
  );
}
