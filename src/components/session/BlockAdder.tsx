/**
 * The block library, filtered by 훈련 주제.
 * Tick any number and add them in one go — used when preparing a lesson and
 * when writing a library goal.
 */

import { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import type { Class, ID, TopicId } from '@/types';
import { useApp } from '@/store/AppContext';
import { blocksFor } from '@/data/selectors';
import { topicsLine } from '@/data/topics';
import { cn } from '@/lib/cn';
import { TopicChips } from './TopicPicker';

export function BlockAdder({
  ageGroup,
  initialTopic = 'all',
  onAdd,
  onCancel,
  addLabel = '추가',
}: {
  ageGroup?: Class['ageGroup'];
  initialTopic?: TopicId | 'all';
  onAdd: (ids: ID[]) => void;
  onCancel: () => void;
  addLabel?: string;
}) {
  const { state } = useApp();
  const [topic, setTopic] = useState<TopicId | 'all'>(initialTopic);
  const [picked, setPicked] = useState<ID[]>([]);

  const blocks = useMemo(
    () =>
      blocksFor(state.trainingBlocks, 'all', ageGroup).filter(
        (b) => topic === 'all' || b.topics.includes(topic),
      ),
    [state.trainingBlocks, topic, ageGroup],
  );

  const toggle = (id: ID) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <div className="mt-3 rounded-lg border border-hairline bg-canvas p-4">
      <TopicChips value={topic} onChange={setTopic} />
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
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-medium text-ink">{b.title}</span>
                  {b.topics.length > 0 && (
                    <span className="block text-[12px] text-steel">{topicsLine(b.topics)}</span>
                  )}
                </span>
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
