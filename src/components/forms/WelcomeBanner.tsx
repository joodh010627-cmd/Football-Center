/**
 * The 폼 tab's top banner — the welcome popup's three cards as a swipeable
 * strip, the way pickup-football apps run their season banners: full-bleed,
 * the next card peeking at the edge, page dots on the photo, turning on its
 * own every few seconds until the coach touches it.
 */

import { useEffect, useRef, useState } from 'react';
import { WELCOME_PAGES } from '@/components/WelcomePopup';
import { cn } from '@/lib/cn';

const TURN_MS = 4500;

export function WelcomeBanner() {
  const [index, setIndex] = useState(0);
  const [held, setHeld] = useState(false);
  const track = useRef<HTMLDivElement>(null);

  const step = () => ((track.current?.firstElementChild as HTMLElement | null)?.offsetWidth ?? 0) + 8;

  const onScroll = () => {
    const el = track.current;
    if (!el || step() <= 8) return;
    setIndex(Math.min(WELCOME_PAGES.length - 1, Math.max(0, Math.round(el.scrollLeft / step()))));
  };

  useEffect(() => {
    if (held) return;
    const t = window.setTimeout(() => {
      const next = (index + 1) % WELCOME_PAGES.length;
      track.current?.scrollTo({ left: next * step(), behavior: 'smooth' });
    }, TURN_MS);
    return () => window.clearTimeout(t);
  }, [index, held]);

  return (
    <div
      ref={track}
      onScroll={onScroll}
      onPointerDown={() => setHeld(true)}
      onTouchStart={() => setHeld(true)}
      className="no-scrollbar -mx-5 flex snap-x snap-mandatory scroll-px-5 gap-2 overflow-x-auto px-5 sm:-mx-7 sm:scroll-px-7 sm:px-7 lg:mx-0 lg:px-0"
    >
      {WELCOME_PAGES.map((p, i) => (
        <article
          key={p.headline}
          className="relative h-[132px] w-[calc(100%-24px)] shrink-0 snap-start overflow-hidden rounded-[10px] bg-ink sm:h-[168px]"
        >
          <img src={p.bannerImage ?? p.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <span className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/35 to-transparent" />
          <div className="relative flex h-full flex-col justify-end p-4">
            <p className="text-[22px] font-extrabold leading-tight tracking-[-0.02em] text-white">{p.headline}</p>
            <p className="mt-1 text-[13px] font-medium text-white/85">{p.tagline}</p>
          </div>
          <div className="absolute bottom-3 right-4 flex gap-1">
            {WELCOME_PAGES.map((_, d) => (
              <span
                key={d}
                className={cn('h-[5px] rounded-full transition-all', d === i ? 'w-3.5 bg-white' : 'w-[5px] bg-white/50')}
              />
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}
