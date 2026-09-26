/**
 * Cover art for the journal, drawn rather than photographed.
 *
 * Stock photos would have to be hotlinked (and break, or change under us) or
 * bundled (and weigh more than the rest of the app). A small set of line
 * drawings on the brand's pitch green reads as one publication, costs nothing,
 * and stays sharp on any screen. Every motif is white on green so a caption
 * can sit on top of any of them.
 */

import { useId } from 'react';
import type { ArtVariant } from '@/data/editorial';
import { cn } from '@/lib/cn';

/** Background tone per motif — night scenes go darker, daytime ones greener. */
const TONE: Record<ArtVariant, [string, string]> = {
  pitch: ['#0B7A4B', '#00301C'],
  ball: ['#1C8A54', '#003A22'],
  floodlight: ['#0F3A2A', '#020D08'],
  bottle: ['#138C66', '#00352A'],
  moon: ['#12303A', '#030B10'],
  boot: ['#16704A', '#00271A'],
  bench: ['#146B45', '#002A1A'],
  plate: ['#2B7D51', '#073420'],
  heel: ['#18704F', '#002C1D'],
};

export function ArticleArt({
  variant,
  className,
  zoom = false,
  cover = false,
}: {
  variant: ArtVariant;
  className?: string;
  /** A slow settle-in on mount — for the one large cover on a screen. */
  zoom?: boolean;
  /**
   * Headline will sit over the lower-left, so pull the motif up and to the
   * right, out of the text's way.
   */
  cover?: boolean;
}) {
  const id = useId().replace(/:/g, '');
  const [from, to] = TONE[variant];

  return (
    <div className={cn('grain relative overflow-hidden', className)} aria-hidden="true">
      <svg
        viewBox="0 0 400 300"
        preserveAspectRatio="xMidYMid slice"
        className={cn('absolute inset-0 h-full w-full', zoom && 'animate-slow-zoom')}
      >
        <defs>
          <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0" stopColor={from} />
            <stop offset="1" stopColor={to} />
          </linearGradient>
          <radialGradient id={`${id}-glow`} cx="0.75" cy="0.2" r="0.7">
            <stop offset="0" stopColor="#fff" stopOpacity="0.22" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${id}-beam`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.35" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        </defs>

        <rect width="400" height="300" fill={`url(#${id}-bg)`} />
        {variant !== 'moon' && variant !== 'floodlight' && <Stripes />}
        <rect width="400" height="300" fill={`url(#${id}-glow)`} />

        <g
          fill="none"
          stroke="#fff"
          strokeLinecap="round"
          strokeLinejoin="round"
          transform={cover ? 'translate(96 -52) scale(0.78)' : undefined}
        >
          {MOTIF[variant](id)}
        </g>
      </svg>
    </div>
  );
}

/** Mowing stripes — the one texture every pitch has. */
function Stripes() {
  return (
    <g fill="#fff" opacity="0.045">
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x={i * 90 - 20} y="0" width="45" height="300" transform="skewX(-12)" />
      ))}
    </g>
  );
}

function Ball({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  // A centre pentagon, five seams out from its corners, and five more patches
  // cut off by the silhouette — enough for the eye to read "football" without
  // drawing a real truncated icosahedron.
  const clip = `ball-${Math.round(cx)}-${Math.round(cy)}`;
  const pentagon = (px: number, py: number, size: number, turn: number) =>
    Array.from({ length: 5 }, (_, i) => {
      const a = (turn + i * 72) * (Math.PI / 180);
      return `${px + Math.cos(a) * size},${py + Math.sin(a) * size}`;
    }).join(' ');
  const dirs = Array.from({ length: 5 }, (_, i) => (-90 + i * 72) * (Math.PI / 180));

  return (
    <g>
      <defs>
        <clipPath id={clip}>
          <circle cx={cx} cy={cy} r={r} />
        </clipPath>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill="#fff" fillOpacity="0.96" stroke="none" />
      <g clipPath={`url(#${clip})`} stroke="none" fill="#0E1310">
        <polygon points={pentagon(cx, cy, r * 0.3, -90)} />
        {dirs.map((a, i) => (
          <polygon
            key={i}
            points={pentagon(
              cx + Math.cos(a) * r * 0.98,
              cy + Math.sin(a) * r * 0.98,
              r * 0.3,
              90 + (a * 180) / Math.PI,
            )}
          />
        ))}
        {dirs.map((a, i) => (
          <line
            key={`s${i}`}
            x1={cx + Math.cos(a) * r * 0.3}
            y1={cy + Math.sin(a) * r * 0.3}
            x2={cx + Math.cos(a) * r * 0.7}
            y2={cy + Math.sin(a) * r * 0.7}
            stroke="#0E1310"
            strokeOpacity="0.45"
            strokeWidth={r * 0.035}
          />
        ))}
      </g>
      {/* Shade on the lower-left so it sits in light rather than floating. */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="#00301C"
        fillOpacity="0.12"
        stroke="none"
        clipPath={`url(#${clip})`}
        transform={`translate(${-r * 0.25} ${r * 0.25})`}
      />
    </g>
  );
}

const MOTIF: Record<ArtVariant, (id: string) => JSX.Element> = {
  pitch: () => (
    <g strokeWidth="2.5" opacity="0.55">
      <rect x="40" y="40" width="320" height="220" rx="2" />
      <line x1="200" y1="40" x2="200" y2="260" />
      <circle cx="200" cy="150" r="38" />
      <circle cx="200" cy="150" r="2.5" fill="#fff" />
      <rect x="40" y="95" width="52" height="110" />
      <rect x="308" y="95" width="52" height="110" />
      <rect x="40" y="122" width="20" height="56" />
      <rect x="340" y="122" width="20" height="56" />
      <path d="M92 128a26 26 0 0 1 0 44M308 128a26 26 0 0 0 0 44" />
    </g>
  ),

  ball: () => (
    <>
      <g strokeWidth="2" opacity="0.28">
        <path d="M-10 250 Q200 205 410 250" />
        <path d="M-10 280 Q200 240 410 280" />
      </g>
      <ellipse cx="262" cy="248" rx="70" ry="10" fill="#000" fillOpacity="0.25" stroke="none" />
      <Ball cx={262} cy={185} r={62} />
      <g strokeWidth="3" opacity="0.5">
        <path d="M120 150h60M100 175h66M128 200h40" />
      </g>
    </>
  ),

  floodlight: (id) => (
    <>
      <path d="M40 60 L-30 300 L150 300 Z" fill={`url(#${id}-beam)`} stroke="none" />
      <path d="M360 60 L250 300 L430 300 Z" fill={`url(#${id}-beam)`} stroke="none" />
      {[40, 360].map((x) => (
        <g key={x}>
          <line x1={x} y1="70" x2={x} y2="300" strokeWidth="3" opacity="0.5" />
          <rect
            x={x - 22}
            y="42"
            width="44"
            height="22"
            rx="3"
            fill="#fff"
            fillOpacity="0.9"
            stroke="none"
          />
          <g fill="#FFF9E0" stroke="none">
            {[0, 1, 2].map((i) => (
              <circle key={i} cx={x - 13 + i * 13} cy="53" r="4" />
            ))}
          </g>
        </g>
      ))}
      {/* Stands: two tiers of seat rows, then the pitch edge. */}
      <path d="M0 210 L400 210 L400 300 L0 300 Z" fill="#000" fillOpacity="0.35" stroke="none" />
      <g strokeWidth="1.5" opacity="0.18">
        {[222, 236, 250, 264].map((y) => (
          <line key={y} x1="0" y1={y} x2="400" y2={y} />
        ))}
      </g>
      <path d="M0 278 Q200 262 400 278" strokeWidth="2.5" opacity="0.5" />
    </>
  ),

  bottle: () => (
    <>
      <g transform="translate(170 50)" strokeWidth="3.5" opacity="0.9">
        <rect
          x="18"
          y="0"
          width="24"
          height="18"
          rx="4"
          fill="#fff"
          fillOpacity="0.9"
          stroke="none"
        />
        <path d="M14 22h32l6 24v150a14 14 0 0 1-14 14H22a14 14 0 0 1-14-14V46Z" />
        <path d="M10 110h40" opacity="0.5" />
        <path
          d="M10 110v86a12 12 0 0 0 12 12h16a12 12 0 0 0 12-12v-86Z"
          fill="#fff"
          fillOpacity="0.22"
          stroke="none"
        />
      </g>
      <g fill="#fff" stroke="none" opacity="0.7">
        <path d="M110 110c0 0-12 16-12 24a12 12 0 0 0 24 0c0-8-12-24-12-24Z" />
        <path d="M300 150c0 0-9 12-9 18a9 9 0 0 0 18 0c0-6-9-18-9-18Z" opacity="0.7" />
        <path d="M290 80c0 0-6 8-6 12a6 6 0 0 0 12 0c0-4-6-12-6-12Z" opacity="0.5" />
      </g>
    </>
  ),

  moon: () => (
    <>
      <path
        d="M262 56a72 72 0 1 0 72 96 58 58 0 1 1-72-96Z"
        fill="#fff"
        fillOpacity="0.92"
        stroke="none"
      />
      <g fill="#fff" stroke="none">
        {[
          [70, 60, 2.2],
          [120, 110, 1.6],
          [40, 150, 1.4],
          [160, 50, 1.8],
          [360, 60, 1.5],
          [330, 250, 1.3],
          [90, 230, 1.8],
          [180, 190, 1.2],
        ].map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} opacity={0.5 + (i % 3) * 0.15} />
        ))}
      </g>
      <g strokeWidth="2.5" opacity="0.4">
        <text
          x="200"
          y="200"
          fill="#fff"
          stroke="none"
          fontSize="26"
          fontWeight="700"
          opacity="0.8"
        >
          z
        </text>
        <text
          x="220"
          y="176"
          fill="#fff"
          stroke="none"
          fontSize="20"
          fontWeight="700"
          opacity="0.6"
        >
          z
        </text>
      </g>
    </>
  ),

  boot: () => (
    <>
      <g transform="translate(60 90)" strokeWidth="3.5">
        <path
          d="M20 40 C20 20 40 10 70 12 L120 16 C130 30 150 44 190 52 C240 62 270 72 270 98 L270 110 L14 110 C8 110 6 104 8 96 Z"
          fill="#fff"
          fillOpacity="0.92"
          stroke="none"
        />
        <path
          d="M70 12 L80 60 M95 14 L102 58 M118 16 L122 56"
          stroke="#0E1310"
          strokeOpacity="0.35"
          strokeWidth="3"
        />
        <path d="M150 70 C190 78 230 80 262 92" stroke="#006039" strokeWidth="6" />
        <g fill="#fff" stroke="none">
          {[40, 80, 150, 190, 230].map((x) => (
            <rect key={x} x={x} y="112" width="14" height="14" rx="3" />
          ))}
        </g>
      </g>
      <path d="M40 250 Q200 236 360 250" strokeWidth="2" opacity="0.35" />
    </>
  ),

  bench: () => (
    <>
      <g strokeWidth="4" opacity="0.8">
        <path d="M70 190h260M70 206h260" />
        <path d="M92 206v48M308 206v48" />
        <path d="M70 150h260" opacity="0.6" />
        <path d="M92 150v40M308 150v40" opacity="0.6" />
      </g>
      {/* A shirt folded over the bench — numbered, waiting. */}
      <g transform="translate(168 108)">
        <path
          d="M12 0 L30 0 C32 8 40 12 48 12 C56 12 64 8 66 0 L84 0 L100 22 L84 34 L78 28 L78 86 L18 86 L18 28 L12 34 L-4 22 Z"
          fill="#fff"
          fillOpacity="0.92"
          stroke="none"
        />
        <text
          x="48"
          y="66"
          textAnchor="middle"
          fontSize="30"
          fontWeight="800"
          fill="#006039"
          stroke="none"
        >
          7
        </text>
      </g>
    </>
  ),

  plate: () => (
    <>
      <circle cx="200" cy="160" r="96" fill="#fff" fillOpacity="0.92" stroke="none" />
      <circle cx="200" cy="160" r="72" stroke="#0E1310" strokeOpacity="0.1" strokeWidth="2" />
      {/* Rice, egg, greens — a pre-match plate, no fried food in sight. */}
      <path
        d="M150 150a38 30 0 0 1 64-10 30 26 0 0 1-8 44h-44a30 30 0 0 1-12-34Z"
        fill="#F4F1EA"
        stroke="#0E1310"
        strokeOpacity="0.15"
        strokeWidth="2"
      />
      <ellipse
        cx="236"
        cy="138"
        rx="22"
        ry="18"
        fill="#FFF"
        stroke="#0E1310"
        strokeOpacity="0.15"
        strokeWidth="2"
      />
      <circle cx="236" cy="138" r="9" fill="#F2B84B" stroke="none" />
      <g fill="#2E8B57" stroke="none">
        <ellipse cx="228" cy="192" rx="16" ry="8" transform="rotate(-20 228 192)" />
        <ellipse cx="248" cy="182" rx="14" ry="7" transform="rotate(30 248 182)" />
      </g>
      <g strokeWidth="4" opacity="0.7">
        <path d="M70 90v140M60 90v30a10 10 0 0 0 20 0V90" />
        <path d="M330 90c14 0 16 30 0 46v94" />
      </g>
    </>
  ),

  heel: () => (
    <>
      <g transform="translate(70 70)">
        <path
          d="M40 20 C40 8 56 4 64 12 L72 110 C74 124 90 130 130 132 L230 136 C252 138 262 150 256 162 C250 172 236 174 220 172 L60 168 C30 166 18 150 20 128 Z"
          fill="#fff"
          fillOpacity="0.9"
          stroke="none"
        />
        <circle cx="46" cy="150" r="30" fill="#F0A38C" fillOpacity="0.35" stroke="none" />
        <circle cx="46" cy="150" r="14" fill="#F0A38C" fillOpacity="0.75" stroke="none" />
      </g>
      <path d="M40 262 Q200 248 360 262" strokeWidth="2" opacity="0.35" />
      <g strokeWidth="2.5" opacity="0.55">
        <path d="M280 70l18 -18M296 90l24 -6M270 52l4 -24" />
      </g>
    </>
  ),
};
