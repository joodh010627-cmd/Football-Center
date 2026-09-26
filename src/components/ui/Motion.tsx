/**
 * Motion helpers — the two things CSS keyframes can't do on their own.
 *
 * `Swap` replays an entrance whenever a value changes, for content that is
 * replaced in place (a filter, a segment) and would otherwise snap. `usePresence`
 * keeps a closing sheet mounted long enough to animate out: React unmounts on
 * the same frame the state flips, so without it every sheet and dialog could
 * only ever appear, never leave.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Remounts its children with a short rise whenever `k` changes. */
export function Swap({
  k,
  className,
  children,
}: {
  k: string | number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div key={k} className={cn('animate-swap-in', className)}>
      {children}
    </div>
  );
}

/** How long exit animations run. Matches `slide-down` / `pop-out` / `fade-out`. */
export const EXIT_MS = 200;

/**
 * `mounted` stays true for `EXIT_MS` after `open` goes false, with `closing`
 * set for that window so the caller can swap its enter animation for an exit.
 */
export function usePresence(open: boolean, ms: number = EXIT_MS) {
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    const t = window.setTimeout(() => setMounted(false), ms);
    return () => window.clearTimeout(t);
  }, [open, ms]);

  return { mounted: open || mounted, closing: !open && mounted };
}
