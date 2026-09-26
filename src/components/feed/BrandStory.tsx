/**
 * 브랜드 스토리 — the ad slot, as a magazine spread rather than a banner.
 *
 * It sits below everything a coach came to do and never above it, and it moves
 * slowly: five seconds a card, a thin progress line saying when the next one
 * comes, and a pause control right there. An ad that jumps while you read the
 * thing next to it is the fastest way to teach people to scroll past the
 * whole section.
 *
 * Every card is labelled as an example with a fictional brand — there are no
 * advertisers yet, and a real brand name here would read as a partnership.
 *
 * Autoplay stops when the carousel is off-screen, when the user asked the OS
 * for reduced motion, and while a finger is on it.
 */

import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { Pause, Play } from 'lucide-react';
import { BRAND_STORIES } from '@/data/editorial';
import { cn } from '@/lib/cn';

const SWIPE = 44;

export function BrandStory({ compact = false }: { compact?: boolean }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(prefersReducedMotion);
  const [visible, setVisible] = useState(false);
  const [drag, setDrag] = useState<number | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const startX = useRef(0);

  const count = BRAND_STORIES.length;
  const go = (next: number) => setIndex((next + count) % count);
  const running = !paused && visible && drag === null;

  useEffect(() => {
    const el = root.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      threshold: 0.4,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const onDown = (e: PointerEvent) => {
    startX.current = e.clientX;
    setDrag(0);
  };
  const onMove = (e: PointerEvent) => {
    if (drag === null) return;
    setDrag(e.clientX - startX.current);
  };
  const onUp = () => {
    if (drag === null) return;
    if (drag <= -SWIPE) go(index + 1);
    else if (drag >= SWIPE) go(index - 1);
    setDrag(null);
  };

  return (
    <section ref={root} aria-roledescription="carousel" aria-label="브랜드 스토리">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[19px] font-bold tracking-[-0.02em] text-ink">브랜드 스토리</h2>
        <span className="shrink-0 text-[12.5px] text-steel">광고 디자인 예시</span>
      </div>

      {/* Segments double as a table of contents: the four slots, by name. */}
      <div className="mt-3 grid grid-cols-4 gap-1.5" role="tablist">
        {BRAND_STORIES.map((story, i) => (
          <button
            key={story.id}
            type="button"
            role="tab"
            aria-selected={i === index}
            onClick={() => go(i)}
            className={cn(
              'pressable truncate rounded-md px-1 py-2.5 text-[13px]',
              i === index
                ? 'bg-primary-wash font-semibold text-primary'
                : 'bg-canvas font-medium text-slate hover:text-ink',
            )}
          >
            {story.tab}
          </button>
        ))}
      </div>

      <div
        className="mt-3 overflow-hidden rounded-xl"
        style={{ touchAction: 'pan-y' }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onPointerLeave={onUp}
      >
        <div
          className={cn('flex', drag === null && 'transition-transform duration-500 ease-smooth')}
          style={{ transform: `translateX(calc(${-index * 100}% + ${drag ?? 0}px))` }}
        >
          {BRAND_STORIES.map((story, i) => {
            const light = story.ink === 'light';
            return (
              <article
                key={story.id}
                aria-hidden={i !== index}
                className={cn(
                  'relative flex w-full shrink-0 select-none flex-col px-6 py-6',
                  compact ? 'min-h-[272px]' : 'min-h-[320px]',
                  story.surface,
                  light ? 'text-white' : 'text-ink',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[11.5px] font-bold uppercase tracking-label">{story.kicker}</p>
                  <span
                    className={cn(
                      'shrink-0 rounded-sm border px-1.5 py-0.5 text-[10.5px] font-medium',
                      light ? 'border-white/60 text-white/90' : 'border-ink/70 text-ink',
                    )}
                  >
                    광고 예시 · 가상 브랜드
                  </span>
                </div>

                <div className="my-auto py-7">
                  <h3
                    className={cn(
                      'whitespace-pre-line font-bold leading-[1.18] tracking-tightest',
                      compact ? 'text-[26px]' : 'text-[30px]',
                    )}
                  >
                    {story.headline}
                  </h3>
                  <p
                    className={cn(
                      'mt-3 whitespace-pre-line text-[14px] leading-[1.6]',
                      light ? 'text-white/80' : 'text-charcoal',
                    )}
                  >
                    {story.body}
                  </p>
                </div>
                <p className="text-[15px] font-bold">
                  {story.brand}
                  <span className={cn('font-medium', light ? 'text-white/60' : 'text-steel')}>
                    {' '}
                    · 가상 브랜드
                  </span>
                </p>
              </article>
            );
          })}
        </div>
      </div>

      <div className="mt-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {BRAND_STORIES.map((story, i) => (
            <button
              key={story.id}
              type="button"
              aria-label={`${i + 1}번째 광고`}
              onClick={() => go(i)}
              className={cn(
                'relative h-1.5 overflow-hidden rounded-full bg-hairline-strong/70 transition-all duration-300 ease-smooth',
                i === index ? 'w-7' : 'w-1.5',
              )}
            >
              {i === index && (
                <span
                  // Keyed so the line restarts whenever the card changes by
                  // any route — tap, swipe or the timer itself.
                  key={index}
                  onAnimationEnd={() => go(index + 1)}
                  className={cn(
                    'absolute inset-0 origin-left rounded-full bg-primary',
                    !paused && 'animate-dot-fill',
                  )}
                  style={{ animationPlayState: running ? 'running' : 'paused' }}
                />
              )}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          className="flex items-center gap-1 rounded-full px-2 py-1 text-[12.5px] font-medium text-steel transition-colors hover:text-ink"
        >
          {paused ? <Play size={12} strokeWidth={2.4} /> : <Pause size={12} strokeWidth={2.4} />}
          {paused ? '자동 넘김' : '움직임 일시정지'}
        </button>
      </div>
    </section>
  );
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
}
