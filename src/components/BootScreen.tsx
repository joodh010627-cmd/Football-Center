/**
 * Cold-boot screen.
 *
 * Deliberately device-like: crest first, wordmark second, a hairline progress
 * rule last — the same beat as a phone powering on. It runs once per page load
 * and is purely decorative, so it's `aria-hidden` and skippable with a tap.
 *
 * The overlay unmounts only after its fade-out finishes, which keeps the app
 * underneath mounted (and already painted) the whole time.
 */

import { useEffect, useState } from 'react';
import { Crest } from '@/components/ui/Crest';

/** Crest + wordmark + rule ≈ 2.1s; short enough that nobody waits on purpose. */
const HOLD_MS = 2100;
const FADE_MS = 520;

export function BootScreen({ onDone }: { onDone?: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setLeaving(true), HOLD_MS);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!leaving) return;
    const t = window.setTimeout(() => {
      setGone(true);
      onDone?.();
    }, FADE_MS);
    return () => window.clearTimeout(t);
  }, [leaving, onDone]);

  if (gone) return null;

  return (
    <div
      aria-hidden
      onClick={() => setLeaving(true)}
      className={`grain fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-pitch-deep ${
        leaving ? 'animate-boot-out' : ''
      }`}
    >
      {/* Soft halo behind the crest — depth without any imagery. */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(45%_38%_at_50%_44%,rgba(198,166,100,0.14)_0%,transparent_70%)]" />

      <div className="relative flex flex-col items-center px-8 text-center text-white">
        <Crest className="h-[62px] w-[62px] animate-crest-in text-white" />

        <p
          className="mt-7 text-[26px] font-bold leading-none tracking-[0.24em] animate-boot-rise sm:text-[32px]"
          style={{ animationDelay: '360ms' }}
        >
          FC GROWTH
        </p>

        <p
          className="mt-4 text-[11px] font-semibold uppercase tracking-label text-white/45 animate-boot-rise"
          style={{ animationDelay: '620ms' }}
        >
          Football Center
        </p>

        <p
          className="mt-3 text-[13px] leading-relaxed text-white/55 animate-boot-rise"
          style={{ animationDelay: '760ms' }}
        >
          축구로 배우는 성장 · 데이터로 지키는 원생
        </p>
      </div>

      {/* Progress rule — the only motion that reads as "loading". */}
      <div className="absolute bottom-[16vh] h-px w-[132px] overflow-hidden bg-white/15">
        <div
          className="h-full origin-left animate-boot-progress bg-white"
          style={{ animationDelay: '240ms' }}
        />
      </div>
    </div>
  );
}
