/**
 * FC GROWTH PICKS — the weekend kit bag, as a checklist you can tick.
 *
 * Useful before it is commercial: a parent packing on Saturday morning gets a
 * list they can actually use, and the one sponsored line sits at the bottom,
 * after the list is done, labelled for what it is. Ticks are local and
 * forgotten on reload — it is a packing list, not a record.
 */

import { useState } from 'react';
import { Check } from 'lucide-react';
import { KIT_PICKS } from '@/data/editorial';
import { cn } from '@/lib/cn';

export function KitPicks() {
  const [packed, setPacked] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setPacked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const done = packed.size === KIT_PICKS.length;

  return (
    <section>
      <p className="eyebrow-ink">FC Growth Picks</p>
      <div className="mt-2 flex items-baseline justify-between gap-3">
        <h2 className="text-[19px] font-bold tracking-[-0.02em] text-ink">
          이번 주말, 축구 가방에 담을 것들
        </h2>
        <span className="shrink-0 text-[12.5px] tabular-nums text-steel">
          {packed.size}/{KIT_PICKS.length}
        </span>
      </div>
      <p className="mt-1 text-[13.5px] text-steel">
        물병부터 여벌 양말까지. 보호자와 함께 보는 준비 목록.
      </p>

      {/* Progress: fills as the bag does. */}
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-hairline">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500 ease-smooth"
          style={{ width: `${(packed.size / KIT_PICKS.length) * 100}%` }}
        />
      </div>

      <ul className="mt-3 overflow-hidden rounded-lg border border-hairline bg-canvas">
        {KIT_PICKS.map((item) => {
          const on = packed.has(item.id);
          return (
            <li key={item.id} className="border-b border-hairline-soft last:border-b-0">
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => toggle(item.id)}
                className="pressable flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-soft"
              >
                <span
                  className={cn(
                    'flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-200',
                    on ? 'border-primary bg-primary text-white' : 'border-hairline-strong',
                  )}
                >
                  {on && <Check size={13} strokeWidth={3.2} className="animate-check-pop" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      'block text-[14.5px] font-semibold transition-colors duration-200',
                      on ? 'text-stone line-through decoration-hairline-strong' : 'text-ink',
                    )}
                  >
                    {item.label}
                  </span>
                  <span className="block text-[12.5px] text-steel">{item.detail}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <p
        className={cn(
          'mt-2 text-center text-[13px] font-semibold text-primary transition-opacity duration-300',
          done ? 'opacity-100' : 'opacity-0',
        )}
        aria-live="polite"
      >
        {done ? '가방 준비 끝. 즐거운 경기 되세요!' : ' '}
      </p>

      <div className="mt-2 flex items-center gap-3 rounded-lg bg-canvas px-4 py-3">
        <span className="shrink-0 rounded-sm border border-hairline-strong px-1.5 py-0.5 text-[10.5px] font-medium text-steel">
          광고 예시
        </span>
        <p className="min-w-0 flex-1 truncate text-[13px] text-charcoal">
          <span className="font-semibold">스트라이드 풋웨어</span> · 미끄럼 방지 축구 양말 3켤레
          세트
        </p>
      </div>
    </section>
  );
}
