/**
 * The club's own crest, between the boot screen and the app.
 *
 * The boot screen is the product (FC GROWTH); this is the club that runs it
 * (FC 광진), so a coach opening the app sees whose app it is before the first
 * lesson card. It reads as a second loading page: crest, name, a line of small
 * type, on plain white — the crest's own white disc sits on the same white, so
 * no circle shows.
 *
 * Timing is handed over rather than chained. It is mounted from the start,
 * under the boot screen, and only begins (`started`) when the boot screen
 * starts fading — so the fade reveals the crest already rising, never a frame
 * of the app. Its own fade starts `onLeave`, which is when the welcome popup
 * appears underneath it; `onDone` fires once it is fully gone.
 *
 * The crest PNG is the original artwork at its own size with only the black
 * around the disc taken out (`src/assets/brand/gjfc-logo.png`).
 */

import { useEffect, useState } from 'react';
import logo from '@/assets/brand/gjfc-logo.png';

const HOLD_MS = 1700;
const FADE_MS = 520;

export function ClubLogoScreen({
  started,
  onLeave,
  onDone,
}: {
  started: boolean;
  onLeave?: () => void;
  onDone?: () => void;
}) {
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (!started) return;
    const t = window.setTimeout(() => setLeaving(true), HOLD_MS);
    return () => window.clearTimeout(t);
  }, [started]);

  useEffect(() => {
    if (!leaving) return;
    onLeave?.();
    const t = window.setTimeout(() => {
      setGone(true);
      onDone?.();
    }, FADE_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaving]);

  if (gone) return null;

  // Nothing animates until the boot screen hands over; until then it is a
  // white sheet waiting underneath.
  const rise = (delay: number) =>
    started ? { className: 'animate-boot-rise', style: { animationDelay: `${delay}ms` } } : { className: 'opacity-0', style: {} };

  return (
    <div
      aria-hidden
      onClick={() => started && setLeaving(true)}
      className={`fixed inset-0 z-[99] flex flex-col items-center justify-center bg-white ${
        leaving ? 'animate-boot-out' : ''
      }`}
    >
      <div className="flex flex-col items-center px-8 text-center">
        <img
          src={logo}
          alt=""
          draggable={false}
          // 522px artwork: 196 CSS px stays sharp past a 2.5× screen.
          className={`h-auto w-[min(52vw,196px)] select-none ${started ? 'animate-crest-in' : 'opacity-0'}`}
          style={started ? { animationDelay: '120ms' } : undefined}
        />

        <p
          className={`mt-5 text-[34px] font-extrabold leading-none tracking-[-0.01em] text-black ${rise(420).className}`}
          style={rise(420).style}
        >
          FC 광진
        </p>

        <p
          className={`mt-3 text-[11px] font-semibold uppercase tracking-label text-black/45 ${rise(600).className}`}
          style={rise(600).style}
        >
          Gwangjin Football Club
        </p>
      </div>

      {/* The same small sign-off the boot screen ends on. */}
      <p
        className={`absolute bottom-[12vh] text-[10.5px] font-semibold uppercase tracking-label text-black/35 ${rise(760).className}`}
        style={rise(760).style}
      >
        Seoul · Since 2002
      </p>
    </div>
  );
}
