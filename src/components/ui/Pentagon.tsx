/**
 * The growth pentagon — 기술 / 전술 / 피지컬 / 멘탈 / 태도.
 *
 * A radar rather than five bars because the shape is the point. A parent asked
 * "how is my child doing" does not want five numbers; they want to see that the
 * figure leans toward 기술 and is flat on 전술, which is a sentence you can read
 * in one look and cannot read off a table.
 *
 * Drawn at a fixed 260×230 viewBox and scaled by the container, so the same
 * component is a thumbnail in a list row and a full chart on a detail screen
 * without a second set of sizes to keep in step.
 */

import { AXES, AXIS_META, NEUTRAL_SCORE, type AxisScores, type DevelopmentAxis } from '@/lib/axes';
import { cn } from '@/lib/cn';

const CX = 130;
const CY = 112;
const R = 78;

/** Where the labels sit, as a multiple of `R`. */
const LABEL_R = 1.26;

/** Rings under the figure. 100 is the outer edge and is drawn as the border. */
const RINGS = [25, 50, 75];

/**
 * Point on the pentagon for one axis at one value.
 *
 * `-90°` puts 기술 at twelve o'clock; the remaining four fall clockwise at 72°
 * each, which is the order `AXES` is declared in.
 */
function point(index: number, value: number, radius = R): [number, number] {
  const angle = (-90 + index * 72) * (Math.PI / 180);
  const r = (Math.max(0, Math.min(100, value)) / 100) * radius;
  return [CX + r * Math.cos(angle), CY + r * Math.sin(angle)];
}

const polygon = (values: number[], radius = R): string =>
  values.map((v, i) => point(i, v, radius).join(',')).join(' ');

const FULL = polygon([100, 100, 100, 100, 100]);

interface PentagonProps {
  scores: AxisScores;
  /**
   * A second, fainter figure to read the first against — normally the class
   * average. Without it a score of 62 means nothing; with it, it means ahead or
   * behind the other eleven children in the room.
   */
  compare?: AxisScores;
  compareLabel?: string;
  /**
   * True when no coach has tagged this student yet. The figure still draws, at
   * the neutral value, but greyed and captioned — an unobserved child must not
   * be rendered as a child who scored badly.
   */
  unobserved?: boolean;
  /** Hide the axis labels. For the small version in a list row. */
  bare?: boolean;
  className?: string;
}

export function Pentagon({
  scores,
  compare,
  compareLabel = '반 평균',
  unobserved = false,
  bare = false,
  className,
}: PentagonProps) {
  const values = AXES.map((axis) => (unobserved ? NEUTRAL_SCORE : scores[axis]));
  const stroke = unobserved ? '#B7BEB9' : '#006039';
  const fill = unobserved ? 'rgba(183,190,185,0.18)' : 'rgba(0,96,57,0.16)';

  return (
    <figure className={cn('relative', className)}>
      <svg
        viewBox="0 0 260 230"
        className="w-full"
        role="img"
        aria-label={
          unobserved
            ? '관찰 기록이 없어 평가를 표시할 수 없습니다'
            : AXES.map((a) => `${AXIS_META[a].label} ${scores[a]}점`).join(', ')
        }
      >
        {/* --- Grid ---------------------------------------------------- */}
        {RINGS.map((ring) => (
          <polygon
            key={ring}
            points={polygon([ring, ring, ring, ring, ring])}
            fill="none"
            stroke="#EAE7DE"
            strokeWidth={1}
          />
        ))}
        <polygon points={FULL} fill="none" stroke="#DFDCD3" strokeWidth={1.25} />

        {AXES.map((axis, i) => {
          const [x, y] = point(i, 100);
          return (
            <line key={axis} x1={CX} y1={CY} x2={x} y2={y} stroke="#EAE7DE" strokeWidth={1} />
          );
        })}

        {/* --- Comparison figure, under the main one -------------------- */}
        {compare && !unobserved && (
          <polygon
            points={polygon(AXES.map((a) => compare[a]))}
            fill="none"
            stroke="#C6A664"
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />
        )}

        {/* --- The figure ---------------------------------------------- */}
        <polygon
          points={polygon(values)}
          fill={fill}
          stroke={stroke}
          strokeWidth={2}
          strokeLinejoin="round"
        />

        {!unobserved &&
          values.map((value, i) => {
            const [x, y] = point(i, value);
            return <circle key={AXES[i]} cx={x} cy={y} r={3.25} fill={stroke} />;
          })}

        {/* --- Labels --------------------------------------------------- */}
        {!bare &&
          AXES.map((axis, i) => {
            const [x, y] = point(i, 100, R * LABEL_R);
            // Anchoring by position rather than a per-axis constant keeps the
            // five labels from drifting into the figure at small sizes.
            const anchor = x > CX + 6 ? 'start' : x < CX - 6 ? 'end' : 'middle';
            return (
              <g key={axis}>
                <text
                  x={x}
                  y={y}
                  textAnchor={anchor}
                  dominantBaseline="middle"
                  className="fill-charcoal text-[13px] font-semibold"
                >
                  {AXIS_META[axis].label}
                </text>
                {!unobserved && (
                  <text
                    x={x}
                    y={y + 14}
                    textAnchor={anchor}
                    dominantBaseline="middle"
                    className="fill-steel text-[11.5px] font-medium tabular-nums"
                  >
                    {scores[axis]}
                  </text>
                )}
              </g>
            );
          })}
      </svg>

      {compare && !unobserved && (
        <figcaption className="mt-1 flex items-center justify-center gap-4 text-[11.5px] text-steel">
          <span className="flex items-center gap-1.5">
            <span className="h-[2px] w-4 rounded-full bg-primary" />이 원생
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-[2px] w-4 rounded-full border-t-2 border-dashed border-gold" />
            {compareLabel}
          </span>
        </figcaption>
      )}
    </figure>
  );
}

// ---------------------------------------------------------------------------
// Editing
// ---------------------------------------------------------------------------

/**
 * Five sliders, one per axis.
 *
 * Range inputs rather than a 1–5 star row: the derived score is a continuous
 * 0–100 and a coach adjusting it is *correcting* that number, not replacing it
 * with a coarser one. Snapping to five buckets on save would throw away the
 * difference between "slightly ahead of the tags" and "much better than the
 * tags suggest", which is the whole reason to override.
 */
export function PentagonEditor({
  scores,
  onChange,
}: {
  scores: AxisScores;
  onChange: (axis: DevelopmentAxis, value: number) => void;
}) {
  return (
    <ul className="space-y-3.5">
      {AXES.map((axis) => {
        const meta = AXIS_META[axis];
        return (
          <li key={axis}>
            <div className="flex items-baseline justify-between gap-2">
              <label htmlFor={`axis-${axis}`} className="text-[14.5px] font-semibold text-ink">
                {meta.label}
                <span className="ml-2 text-[12px] font-normal text-stone">{meta.meaning}</span>
              </label>
              <span className="shrink-0 text-[15px] font-bold tabular-nums text-primary">
                {scores[axis]}
              </span>
            </div>
            <input
              id={`axis-${axis}`}
              type="range"
              min={0}
              max={100}
              step={5}
              value={scores[axis]}
              onChange={(e) => onChange(axis, Number(e.target.value))}
              className="mt-2 h-6 w-full cursor-pointer accent-primary"
            />
            <p className="mt-0.5 text-[11.5px] text-stone">{meta.items.join(' · ')}</p>
          </li>
        );
      })}
    </ul>
  );
}
