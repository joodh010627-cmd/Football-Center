import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
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
}

export function StatTile({
  label,
  value,
  unit,
  icon: Icon,
  caption,
  tint = 'canvas',
  className,
}: StatTileProps) {
  return (
    <div className={cn('rounded-lg p-5', TINTS[tint], className)}>
      <div className="flex items-center gap-2 text-charcoal">
        {Icon && <Icon size={15} strokeWidth={2.2} />}
        <span className="text-[13px] font-semibold leading-[1.4]">{label}</span>
      </div>

      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-[30px] font-semibold leading-none tracking-[-0.5px] text-ink">
          {value}
        </span>
        {unit && <span className="text-sm font-medium text-slate">{unit}</span>}
      </div>

      {caption && <div className="mt-2 text-[13px] leading-[1.4] text-slate">{caption}</div>}
    </div>
  );
}
