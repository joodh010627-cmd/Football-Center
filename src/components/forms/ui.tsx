/**
 * The 폼 tab's visual language, taken from the FC Growth mockup.
 *
 * White page, large quiet headings, rows divided by a hairline rather than
 * boxed in cards, one soft green surface per screen for the thing that
 * matters, and one wide button at the end. Every screen in this folder is
 * built out of these few pieces so the tab reads as one place — and so a
 * screen can't quietly grow a fourth kind of card.
 */

import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { SyncError } from './parts';

/**
 * White page for the whole tab — the mockup has no grey behind its rows.
 * Every page carries the failed-save line, so no screen can forget it.
 */
export function Page({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-canvas lg:min-h-screen">
      <div className="mx-auto w-full max-w-[640px] px-5 pb-14 pt-6 sm:px-7 lg:pt-10">
        <SyncError />
        {children}
      </div>
    </div>
  );
}

export function Title({
  eyebrow,
  title,
  sub,
  back,
  action,
}: {
  eyebrow: string;
  title: ReactNode;
  sub?: ReactNode;
  back?: { label: string; onBack: () => void };
  action?: ReactNode;
}) {
  return (
    <header>
      {back && (
        <button
          type="button"
          onClick={back.onBack}
          className="-ml-1 mb-5 flex items-center gap-0.5 text-[15px] text-steel transition-colors hover:text-ink"
        >
          <ChevronLeft size={18} strokeWidth={2} />
          {back.label}
        </button>
      )}
      <div className="flex items-start justify-between gap-3">
        <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-primary">{eyebrow}</p>
        {action}
      </div>
      <h1 className="mt-2 text-[28px] font-bold leading-[1.25] tracking-[-0.04em] text-ink">
        {title}
      </h1>
      {sub && <p className="mt-2 text-[15px] leading-[1.6] text-steel">{sub}</p>}
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
    <section className={cn('mt-9', className)}>
      {title && (
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h2 className="text-[20px] font-bold tracking-[-0.03em] text-ink">{title}</h2>
          {aside && <span className="shrink-0 text-[13.5px] text-steel">{aside}</span>}
        </div>
      )}
      {children}
    </section>
  );
}

/**
 * The one soft surface on a screen. `tone="alert"` only when something is
 * genuinely late — the colour is the message, so it can't be the default.
 */
export function Surface({
  children,
  tone = 'calm',
  className,
}: {
  children: ReactNode;
  tone?: 'calm' | 'alert';
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-[22px] px-6 py-5',
        tone === 'alert'
          ? 'bg-gradient-to-br from-[#FBEFE9] to-[#FDF7F2]'
          : 'bg-gradient-to-br from-[#EEF6F0] to-[#F6F9EE]',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Eyebrow({ children, tone = 'calm' }: { children: ReactNode; tone?: 'calm' | 'alert' }) {
  return (
    <p
      className={cn(
        'text-[12px] font-bold uppercase tracking-[0.12em]',
        tone === 'alert' ? 'text-[#B4532F]' : 'text-primary',
      )}
    >
      {children}
    </p>
  );
}

/** A divided list. Rows sit on the page, not in a box. */
export function Rows({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-hairline-soft">{children}</div>;
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
  /** A number or short figure on the left, e.g. a phase count. */
  lead?: ReactNode;
  tag?: ReactNode;
  onClick?: () => void;
  /** Replaces the chevron, e.g. a copy button. */
  trailing?: ReactNode;
}) {
  const body = (
    <>
      {lead !== undefined && (
        <span className="w-10 shrink-0 text-[26px] font-bold leading-none tabular-nums text-primary">
          {lead}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-[17px] font-bold leading-[1.4] text-ink">{title}</span>
        {sub && <span className="mt-1 block text-[14px] leading-[1.5] text-steel">{sub}</span>}
        {tag && <span className="mt-2 flex flex-wrap gap-1.5">{tag}</span>}
      </span>
      {trailing ?? (onClick && <ChevronRight size={18} className="shrink-0 text-stone" />)}
    </>
  );

  if (!onClick) return <div className="flex items-center gap-3 py-4">{body}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 py-4 text-left transition-opacity active:opacity-60"
    >
      {body}
    </button>
  );
}

export function Tag({ children, tone = 'green' }: { children: ReactNode; tone?: 'green' | 'amber' | 'gray' }) {
  return (
    <span
      className={cn(
        'inline-block rounded-md px-2 py-1 text-[12.5px] font-semibold leading-none',
        tone === 'green' && 'bg-[#EDF4EF] text-primary',
        tone === 'amber' && 'bg-[#FAF3E5] text-[#946216]',
        tone === 'gray' && 'bg-surface-soft text-steel',
      )}
    >
      {children}
    </span>
  );
}

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
    'flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[14px] bg-primary px-5 text-[16px] font-semibold text-white transition-colors hover:bg-primary-pressed active:bg-primary-deep disabled:bg-hairline disabled:text-muted',
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
        'flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[12px] bg-[#EEF4EF] px-4 text-[15px] font-semibold text-primary transition-colors hover:bg-[#E3EEE6] disabled:opacity-50',
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
        'py-1.5 text-[14.5px] font-semibold transition-opacity active:opacity-60',
        tone === 'green' ? 'text-primary' : 'text-steel',
      )}
    >
      {children}
    </button>
  );
}

/** Choice pills. `pressed` is what's selected. */
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
    <div className="flex flex-wrap gap-2">
      {options.map(([value, label]) => (
        <button
          key={value}
          type="button"
          aria-pressed={on(value)}
          onClick={() => onPick(value)}
          className={cn(
            'rounded-full px-3.5 py-2 text-[14px] transition-colors',
            on(value) ? 'bg-primary font-semibold text-white' : 'bg-[#F3F6F3] text-[#5B6A60] hover:bg-[#EAEFEA]',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** Label-left, value-right lines under a hairline. */
export function Facts({ items }: { items: Array<[string, ReactNode]> }) {
  return (
    <dl>
      {items.map(([label, value]) => (
        <div
          key={label}
          className="flex items-baseline justify-between gap-4 border-b border-hairline-soft py-3 text-[15px]"
        >
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
      <p className="text-[15px] font-semibold text-ink">
        {label}
        {hint && <span className="ml-2 text-[13px] font-normal text-stone">{hint}</span>}
      </p>
      <div className="mt-2.5">{children}</div>
    </div>
  );
}

export const inputClass =
  'w-full rounded-[12px] border border-[#E2E8E2] bg-[#F6F8F6] px-3.5 py-3 text-[16px] text-ink outline-none transition-colors placeholder:text-stone focus:border-primary';

/** The quiet line at the foot of a screen that says the data is a demo. */
export function DemoNote({ show, children }: { show: boolean; children: ReactNode }) {
  if (!show) return null;
  return <p className="mt-10 text-center text-[12.5px] leading-[1.6] text-stone">{children}</p>;
}
