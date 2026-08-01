/**
 * Top-view football pitch used as the hero band backdrop.
 *
 * Three stacked layers: a deep-green base, mown stripes, and the line
 * markings as SVG. A vignette sits on top so headline text keeps its
 * contrast regardless of where the markings land behind it.
 */

import { cn } from '@/lib/cn';

/** viewBox is 1200×400; the pitch is inset 24px inside it. */
const L = 24;
const R = 1176;
const T = 24;
const B = 376;
const MID_X = 600;
const MID_Y = 200;

export function PitchBackdrop({ className }: { className?: string }) {
  return (
    <div className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)} aria-hidden>
      {/* Base */}
      <div className="absolute inset-0 bg-pitch" />

      {/* Mown stripes — alternating bands, as a groundskeeper would cut them.
          Stops are in px, not %: fractional-percentage repeating gradients hit
          a pathological slow path in Chromium and stall rasterisation. */}
      <div
        className="absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            'repeating-linear-gradient(90deg, #0c4636 0px, #0c4636 64px, #0a3d2f 64px, #0a3d2f 128px)',
        }}
      />

      {/* Line markings */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1200 400"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
        stroke="rgba(255,255,255,0.22)"
        strokeWidth="2.5"
      >
        {/* Touchlines */}
        <rect x={L} y={T} width={R - L} height={B - T} />

        {/* Halfway line + centre circle */}
        <line x1={MID_X} y1={T} x2={MID_X} y2={B} />
        <circle cx={MID_X} cy={MID_Y} r={56} />
        <circle cx={MID_X} cy={MID_Y} r={4} fill="rgba(255,255,255,0.22)" stroke="none" />

        {/* Left penalty area, goal area, spot and D */}
        <rect x={L} y={104} width={132} height={192} />
        <rect x={L} y={156} width={52} height={88} />
        <circle cx={112} cy={MID_Y} r={3.5} fill="rgba(255,255,255,0.22)" stroke="none" />
        <path d="M 156 165.4 A 56 56 0 0 1 156 234.6" />
        <rect x={L - 10} y={172} width={10} height={56} />

        {/* Right penalty area, goal area, spot and D */}
        <rect x={R - 132} y={104} width={132} height={192} />
        <rect x={R - 52} y={156} width={52} height={88} />
        <circle cx={1088} cy={MID_Y} r={3.5} fill="rgba(255,255,255,0.22)" stroke="none" />
        <path d="M 1044 165.4 A 56 56 0 0 0 1044 234.6" />
        <rect x={R} y={172} width={10} height={56} />

        {/* Corner arcs */}
        <path d={`M ${L + 12} ${T} A 12 12 0 0 1 ${L} ${T + 12}`} />
        <path d={`M ${R - 12} ${T} A 12 12 0 0 0 ${R} ${T + 12}`} />
        <path d={`M ${L} ${B - 12} A 12 12 0 0 0 ${L + 12} ${B}`} />
        <path d={`M ${R} ${B - 12} A 12 12 0 0 1 ${R - 12} ${B}`} />
      </svg>

      {/* Vignette — keeps headline contrast steady over the markings. */}
      <div className="absolute inset-0 bg-gradient-to-r from-pitch-deep via-pitch-deep/80 to-pitch-deep/30" />
      <div className="absolute inset-0 bg-gradient-to-t from-pitch-deep/70 via-transparent to-pitch-deep/40" />
    </div>
  );
}
