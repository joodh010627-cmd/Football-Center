import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'purple' | 'orange' | 'green' | 'sky' | 'rose' | 'neutral' | 'error';

const TONES: Record<Tone, string> = {
  purple: 'bg-tint-lavender text-brand-purple-800',
  orange: 'bg-tint-peach text-brand-orange-deep',
  green: 'bg-tint-mint text-brand-green',
  sky: 'bg-tint-sky text-link-pressed',
  rose: 'bg-tint-rose text-brand-pink-deep',
  neutral: 'bg-tint-gray text-slate',
  error: 'bg-[#fde2e2] text-error',
};

interface BadgeProps {
  children: ReactNode;
  tone?: Tone;
  /** Pill geometry is reserved for status; tags stay rectangular (6px). */
  pill?: boolean;
  className?: string;
}

export function Badge({ children, tone = 'neutral', pill = false, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap text-[13px] font-semibold leading-[1.4]',
        pill ? 'rounded-full px-[10px] py-1' : 'rounded-sm px-2 py-[2px]',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Solid, high-contrast variant for counts and severity flags. */
export function SolidBadge({
  children,
  className,
  tone = 'purple',
}: {
  children: ReactNode;
  className?: string;
  tone?: 'purple' | 'error' | 'orange' | 'pink';
}) {
  const tones = {
    purple: 'bg-primary text-white',
    error: 'bg-error text-white',
    orange: 'bg-brand-orange text-white',
    pink: 'bg-brand-pink text-white',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-[10px] py-1 text-[13px] font-semibold leading-[1.4]',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
