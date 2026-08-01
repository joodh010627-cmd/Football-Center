import { cn } from '@/lib/cn';

interface ProgressBarProps {
  /** 0–1. */
  value: number;
  className?: string;
  barClassName?: string;
  /** Renders a hairline marker at this ratio, e.g. an owner-set target. */
  target?: number;
}

export function ProgressBar({ value, className, barClassName, target }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className={cn('relative h-1.5 w-full overflow-hidden rounded-full bg-hairline', className)}>
      <div
        className={cn('h-full rounded-full transition-[width] duration-300', barClassName ?? 'bg-primary')}
        style={{ width: `${pct}%` }}
      />
      {target !== undefined && (
        <span
          className="absolute top-0 h-full w-px bg-charcoal/40"
          style={{ left: `${Math.max(0, Math.min(1, target)) * 100}%` }}
        />
      )}
    </div>
  );
}
