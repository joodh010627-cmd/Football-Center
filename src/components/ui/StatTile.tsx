import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { ArrowDownRight } from 'lucide-react';
import { cn } from '@/lib/cn';

type Tint = 'canvas' | 'lavender' | 'mint' | 'peach' | 'sky' | 'rose' | 'yellow';

const TINTS: Record<Tint, string> = {
  canvas: 'bg-canvas border border-hairline',
  lavender: 'bg-tint-lavender',
  mint: 'bg-tint-mint',
  peach: 'bg-tint-peach',
  sky: 'bg-tint-sky',
  rose: 'bg-tint-rose',
  yellow: 'bg-tint-yellow',
};

interface StatTileProps {
  label: string;
  value: ReactNode;
  unit?: string;
  icon?: LucideIcon;
  caption?: ReactNode;
  tint?: Tint;
  className?: string;
  /** When set the tile becomes a jump link into the section behind the number. */
  onClick?: () => void;
}

export function StatTile({
  label,
  value,
  unit,
  icon: Icon,
  caption,
  tint = 'canvas',
  className,
  onClick,
}: StatTileProps) {
  const body = (
    <>
      <div className="flex items-center gap-2 text-charcoal">
        {Icon && <Icon size={15} strokeWidth={2.2} />}
        <span className="text-[13px] font-semibold leading-[1.4]">{label}</span>
        {onClick && (
          <ArrowDownRight
            size={14}
            className="ml-auto text-stone transition-transform duration-150 group-hover:translate-x-0.5 group-hover:translate-y-0.5 group-hover:text-primary"
          />
        )}
      </div>

      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-[26px] font-semibold leading-none tracking-[-0.5px] text-ink sm:text-[30px]">
          {value}
        </span>
        {unit && <span className="text-sm font-medium text-slate">{unit}</span>}
      </div>

      {caption && <div className="mt-2 text-[13px] leading-[1.4] text-slate">{caption}</div>}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'group rounded-lg p-4 text-left transition-all duration-150 sm:p-5',
          'hover:-translate-y-0.5 hover:shadow-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
          TINTS[tint],
          className,
        )}
      >
        {body}
      </button>
    );
  }

  return <div className={cn('rounded-lg p-4 sm:p-5', TINTS[tint], className)}>{body}</div>;
}
