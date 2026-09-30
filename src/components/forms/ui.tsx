/**
 * The 폼 tab's building blocks — the 수업 tab's visual language, reused.
 *
 *   · Header: a small green label over a large title. No wide-tracked English
 *     eyebrow — it spaces Hangul apart letter by letter.
 *   · One `.mesh` card per screen for the thing that matters now.
 *   · Lists sit in white rounded cards, rows divided by a hairline.
 *   · Green only. State is told by the green's brightness (done / now / not
 *     yet), never by switching to a warm colour.
 *   · One pill button per card; the rest folds behind 더 보기.
 */

import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { SyncError } from './parts';

/** Page gutters, same as every other tab. Carries the failed-save line. */
export function Page({ children }: { children: ReactNode }) {
  return (
    <div className="px-5 pb-10 pt-5 sm:px-7 lg:max-w-2xl lg:px-10 lg:pt-8">
      <SyncError />
      {children}
    </div>
  );
}

/**
 * Tab root: small label + large title (like 오늘의 수업 / 날짜).
 * Drill-down: 뒤로 + title + one line of context (like DetailHeader).
 */
export function Title({
  eyebrow,
  title,
  sub,
  back,
  action,
}: {
  eyebrow?: string;
  title: ReactNode;
  sub?: ReactNode;
  back?: { label: string; onBack: () => void };
  action?: ReactNode;
}) {
  return (
    <header className="pb-1">
      {back && (
        <button
          type="button"
          onClick={back.onBack}
          className="-ml-1 mb-3 flex items-center gap-0.5 text-[13.5px] font-medium text-steel transition-colors hover:text-ink"
        >
          <ChevronLeft size={16} strokeWidth={2.4} />
          {back.label}
        </button>
      )}
      {eyebrow && <p className="text-[14px] font-semibold text-primary">{eyebrow}</p>}
      <div className="mt-1 flex items-start justify-between gap-3">
        <h1
          className={cn(
            'min-w-0 font-bold leading-[1.15] tracking-tightest text-ink',
            back ? 'text-[27px] sm:text-[30px]' : 'text-[30px] sm:text-[32px]',
          )}
        >
          {title}
        </h1>
        {action && <div className="shrink-0 pt-1">{action}</div>}
      </div>
      {sub && <p className="mt-2 text-[14px] text-steel">{sub}</p>}
    </header>
  );
}

export function Section({
  title,
  aside,
  children,
  className,
}: {
  title?: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('mt-8', className)}>
      {title && (
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-[19px] font-bold tracking-[-0.02em] text-ink">{title}</h2>
          {aside && <span className="shrink-0 text-[13.5px] text-steel">{aside}</span>}
        </div>
      )}
      {children}
    </section>
  );
}

/** The one lit card on a screen — the 수업 card's mesh. Always green. */
export function Surface({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mesh rounded-2xl p-5', className)}>{children}</div>;
}

/** The small bold label at the top of a lit card ("할 일", "예정"). */
export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-[13px] font-bold text-primary">{children}</p>;
}

/** A white rounded card of divided rows. */
export function Rows({ children }: { children: ReactNode }) {
  return (
    <div className="divide-y divide-hairline-soft overflow-hidden rounded-xl border border-hairline bg-canvas">
      {children}
    </div>
  );
}

export function Row({
  title,
  sub,
  lead,
  tag,
  onClick,
  trailing,
}: {
  title: ReactNode;
  sub?: ReactNode;
  /** A number or short figure on the left, e.g. a stage count or a time. */
  lead?: ReactNode;
  tag?: ReactNode;
  onClick?: () => void;
  /** Replaces the chevron, e.g. a copy button. */
  trailing?: ReactNode;
}) {
  const body = (
    <>
      {lead !== undefined && (
        <span className="w-9 shrink-0 text-[22px] font-bold leading-none tabular-nums text-primary">
          {lead}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-[15.5px] font-semibold text-ink">{title}</span>
          {tag}
        </span>
        {sub && <span className="mt-0.5 block truncate text-[13px] text-steel">{sub}</span>}
      </span>
      {trailing ?? (onClick && <ChevronRight size={17} className="shrink-0 text-stone" />)}
    </>
  );

  if (!onClick) return <div className="flex items-center gap-3 px-4 py-3.5">{body}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-soft/60"
    >
      {body}
    </button>
  );
}

/** Small pill. `strong` is for what's overdue — a deeper green, not a warning colour. */
export function Tag({ children, tone = 'green' }: { children: ReactNode; tone?: 'green' | 'strong' | 'gray' }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11.5px] font-bold',
        tone === 'green' && 'bg-primary-wash text-primary',
        tone === 'strong' && 'bg-primary text-white',
        tone === 'gray' && 'bg-surface-soft text-steel',
      )}
    >
      {children}
    </span>
  );
}

/** The card's pill button (수업 보기 / 수업 기록). */
export function PrimaryButton({
  children,
  onClick,
  disabled,
  href,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  href?: string;
  className?: string;
}) {
  const cls = cn(
    'pressable inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-primary px-6 text-[15px] font-semibold text-white hover:bg-primary-pressed active:bg-primary-deep disabled:bg-hairline disabled:text-muted',
    className,
  );
  if (href) {
    return (
      <a href={href} className={cls}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cls}>
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  onClick,
  disabled,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'pressable inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-hairline-strong bg-canvas px-5 text-[15px] font-semibold text-ink hover:border-primary hover:text-primary disabled:opacity-50',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function TextLink({
  children,
  onClick,
  tone = 'green',
}: {
  children: ReactNode;
  onClick: () => void;
  tone?: 'green' | 'gray';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'py-1 text-[13.5px] font-semibold transition-colors',
        tone === 'green' ? 'text-primary hover:text-primary-pressed' : 'text-steel hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}

/** Choice chips — the ability chips' shape, selected in green. */
export function Pills<T extends string>({
  options,
  pressed,
  onPick,
}: {
  options: ReadonlyArray<readonly [T, string]>;
  pressed: T | readonly T[] | null;
  onPick: (value: T) => void;
}) {
  const on = (v: T) => (Array.isArray(pressed) ? pressed.includes(v) : pressed === v);
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(([value, label]) => (
        <button
          key={value}
          type="button"
          aria-pressed={on(value)}
          onClick={() => onPick(value)}
          className={cn(
            'rounded-full border px-3.5 py-1.5 text-[13.5px] font-semibold transition-colors duration-150',
            on(value)
              ? 'border-primary bg-primary text-white'
              : 'border-hairline bg-canvas text-charcoal hover:border-hairline-strong',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** Label-left, value-right lines in a white card. */
export function Facts({ items }: { items: Array<[string, ReactNode]> }) {
  return (
    <dl className="divide-y divide-hairline-soft overflow-hidden rounded-xl border border-hairline bg-canvas">
      {items.map(([label, value]) => (
        <div key={label} className="flex items-baseline justify-between gap-4 px-4 py-3 text-[14.5px]">
          <dt className="shrink-0 text-steel">{label}</dt>
          <dd className="min-w-0 text-right text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A labelled block inside a sheet. */
export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="mt-5 first:mt-0">
      <p className="text-[13.5px] font-semibold text-charcoal">
        {label}
        {hint && <span className="ml-2 text-[12px] font-normal text-stone">{hint}</span>}
      </p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

export const inputClass = 'input-field !py-3 !text-[16px]';

/**
 * Steps as bars of green brightness — the 준비·수업·기록 bar of a lesson card,
 * with as many steps as the caller has.
 */
export function StepBar({
  steps,
  className,
}: {
  steps: Array<{ label: string; state: 'done' | 'current' | 'todo' }>;
  className?: string;
}) {
  return (
    <ol
      className={cn('grid gap-1.5', className)}
      style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
    >
      {steps.map((s) => (
        <li key={s.label} aria-current={s.state === 'current' ? 'step' : undefined}>
          <span
            className={cn(
              'block h-[5px] rounded-full',
              s.state === 'done' && 'bg-primary',
              s.state === 'current' && 'bg-primary-soft',
              s.state === 'todo' && 'bg-primary/15',
            )}
          />
          <span
            className={cn(
              'mt-1.5 block truncate text-[12.5px]',
              s.state === 'done' && 'text-primary',
              s.state === 'todo' && 'text-stone',
              s.state === 'current' && 'font-bold text-ink',
            )}
          >
            {s.label}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** The quiet line at the foot of a screen that says the data is a demo. */
export function DemoNote({ show, children }: { show: boolean; children: ReactNode }) {
  if (!show) return null;
  return <p className="mt-10 text-center text-[11.5px] leading-[1.6] text-stone">{children}</p>;
}
