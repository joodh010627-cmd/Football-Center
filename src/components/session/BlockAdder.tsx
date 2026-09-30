/**
 * The block library, filtered by the five abilities of the growth pentagon.
 * Tick any number and add them in one go — used when preparing a lesson and
 * when writing a library goal.
 */

import { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import type { Ability, Class, ID } from '@/types';
import { useApp } from '@/store/AppContext';
import { blocksFor } from '@/data/selectors';
import { cn } from '@/lib/cn';
import { AbilityChips, AbilityTag } from './parts';

export function BlockAdder({
  ageGroup,
  initialAbility = 'all',
  onAdd,
  onCancel,
  addLabel = '추가',
}: {
  ageGroup?: Class['ageGroup'];
  initialAbility?: Ability | 'all';
  onAdd: (ids: ID[]) => void;
  onCancel: () => void;
  addLabel?: string;
}) {
  const { state } = useApp();
  const [ability, setAbility] = useState<Ability | 'all'>(initialAbility);
  const [picked, setPicked] = useState<ID[]>([]);

  const blocks = useMemo(
    () => blocksFor(state.trainingBlocks, ability, ageGroup),
    [state.trainingBlocks, ability, ageGroup],
  );

  const toggle = (id: ID) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <div className="mt-3 rounded-lg border border-hairline bg-canvas p-4">
      <AbilityChips value={ability} onChange={setAbility} />
      <ul className="mt-3 max-h-[360px] overflow-y-auto">
        {blocks.map((b) => {
          const on = picked.includes(b.id);
          return (
            <li key={b.id}>
              <button
                type="button"
                onClick={() => toggle(b.id)}
                aria-pressed={on}
                className="flex w-full items-center gap-3 rounded-md px-1 py-2.5 text-left hover:bg-surface-soft"
              >
                <span
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                    on ? 'border-primary bg-primary text-white' : 'border-hairline-strong',
                  )}
                >
                  {on && <Check size={12} strokeWidth={3} />}
                </span>
                <span className="min-w-0 flex-1 truncate text-[14.5px] font-medium text-ink">
                  {b.title}
                </span>
                <AbilityTag ability={b.ability} />
                <span className="w-9 shrink-0 text-right text-[12.5px] tabular-nums text-steel">
                  {b.durationMin}분
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1 py-2.5">
          취소
        </button>
        <button
          type="button"
          onClick={() => onAdd(picked)}
          disabled={picked.length === 0}
          className="btn-primary flex-1 py-2.5"
        >
          {picked.length > 0 ? `${picked.length}개 ${addLabel}` : addLabel}
        </button>
      </div>
    </div>
  );
}
