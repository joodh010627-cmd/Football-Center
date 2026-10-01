/**
 * 오늘 키울 역량 — the growth pentagon as the five-way choice it is.
 *
 * Two figures and nothing else. Grey is where the last few lessons' minutes
 * went. Before a tap there is only grey, and a short spoke is a focus the class
 * hasn't had lately — readable before the coach has decided anything.
 *
 * Green is the same lessons *with today added*. It always contains the grey, so
 * the band between them is exactly what today contributes, and it grows out
 * along the spoke the coach tapped. Drawing today on its own was tried first: a
 * lesson is mostly one ability, so it came out as a spike that dwarfed the
 * history it was meant to be read against.
 *
 * No numbers, no legend: grey is the past and green is today, the same two
 * colours as the lesson line under it, and the names are the only words.
 */

import type { Ability } from '@/types';
import { cn } from '@/lib/cn';
import { ABILITY_META, ABILITY_ORDER } from './meta';

const W = 320;
const H = 272;
const CX = 160;
const CY = 142;
const R = 86;
/** Labels above and below sit centred off the vertex; the side ones hang outward. */
const LABEL_R = R + 32;
const SIDE_LABEL_R = R + 14;
/** A zero spoke still keeps a sliver, so a figure never collapses to a line. */
const FLOOR = 0.12;

type Minutes = Record<Ability, number>;

function at(i: number, r: number): [number, number] {
  const a = (-90 + i * 72) * (Math.PI / 180);
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
}

const pathOf = (radii: number[]) =>
  radii.map((r, i) => `${i ? 'L' : 'M'}${at(i, r).map((v) => v.toFixed(1)).join(' ')}`).join(' ') + ' Z';

export function GoalPentagon({
  past,
  today,
  hasHistory,
  selected,
  onSelect,
}: {
  /** Minutes per ability across the last lessons. */
  past: Minutes;
  /** Minutes per ability in today's blocks; null before there are any. */
  today: Minutes | null;
  hasHistory: boolean;
  selected: Ability | null;
  onSelect: (a: Ability) => void;
}) {
  const before = ABILITY_ORDER.map((a) => past[a]);
  const after = ABILITY_ORDER.map((a) => past[a] + (today?.[a] ?? 0));
  const top = Math.max(...after, 1);
  const radii = (v: number[]) => v.map((x) => R * (FLOOR + (1 - FLOOR) * (x / top)));

  const pastPath = pathOf(radii(before));
  // With no today yet the green figure sits on the grey one, hidden, so the
  // first tap grows it out of the history rather than out of the centre.
  const todayPath = pathOf(radii(after));

  return (
    <div className="rounded-xl border border-hairline bg-canvas px-3 py-2">
      <div className="relative mx-auto w-full max-w-[340px]">
        <svg viewBox={`0 0 ${W} ${H}`} className="block w-full select-none" aria-hidden>
          {[1 / 2, 1].map((k) => (
            <path
              key={k}
              d={pathOf([R * k, R * k, R * k, R * k, R * k])}
              fill={k === 1 ? '#FAFBFB' : 'none'}
              stroke={k === 1 ? '#DCE2E0' : '#E9EDEC'}
              strokeWidth={1}
            />
          ))}
          {ABILITY_ORDER.map((a, i) => {
            const [x, y] = at(i, R);
            return <line key={a} x1={CX} y1={CY} x2={x} y2={y} stroke="#E9EDEC" strokeWidth={1} />;
          })}

          <path
            d={todayPath}
            style={{ d: `path('${todayPath}')` } as React.CSSProperties}
            fill="rgba(0,96,57,0.14)"
            stroke="#006039"
            strokeWidth={2}
            strokeLinejoin="round"
            className={cn('pentagon-shape', today ? 'opacity-100' : 'opacity-0')}
          />

          {hasHistory && (
            <path
              d={pastPath}
              fill="rgba(106,115,110,0.14)"
              stroke="#AEB6B1"
              strokeWidth={1.25}
              strokeLinejoin="round"
            />
          )}

          {ABILITY_ORDER.map((a, i) => {
            const [x, y] = at(i, R);
            const on = a === selected;
            return (
              <g key={a}>
                {on && <circle cx={x} cy={y} r={11} fill="rgba(0,96,57,0.12)" />}
                <circle cx={x} cy={y} r={on ? 5 : 3} fill={on ? '#006039' : '#C0C7C4'} />
              </g>
            );
          })}
        </svg>

        {ABILITY_ORDER.map((a, i) => {
          // 1 and 4 are the side vertices (전술, 태도).
          const side = i === 1 ? 'right' : i === 4 ? 'left' : null;
          const [x, y] = at(i, side ? SIDE_LABEL_R : LABEL_R);
          const on = a === selected;
          return (
            <button
              key={a}
              type="button"
              onClick={() => onSelect(a)}
              aria-pressed={on}
              style={{ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%` }}
              className={cn(
                'absolute flex min-h-[44px] -translate-y-1/2 flex-col justify-center whitespace-nowrap rounded-lg px-1.5 transition-colors hover:bg-surface-soft/60',
                side === 'right' && 'items-start',
                side === 'left' && '-translate-x-full items-end',
                !side && 'min-w-[56px] -translate-x-1/2 items-center',
              )}
            >
              <span
                className={cn(
                  'text-[15px] font-bold leading-tight transition-colors',
                  on ? 'text-primary' : 'text-ink',
                )}
              >
                {ABILITY_META[a].label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
