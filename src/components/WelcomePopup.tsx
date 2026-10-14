/**
 * Welcome popup — three cards, swiped left and right, shown once on a user's
 * every time the app loads — 수업 is the main page and the popup greets it.
 *
 * The layout follows the season popup coaches already know from pickup-football
 * apps: a photo band with one huge headline on it, two lines of copy, page dots
 * and one big button. Swiping is the browser's own scroll-snap, so it feels
 * native on a phone and still works with a mouse; the button and dots drive
 * the same scroller.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import season from '@/assets/welcome/season.jpg';
import lesson from '@/assets/welcome/lesson.jpg';
import growth from '@/assets/welcome/growth.jpg';

export interface WelcomePage {
  image: string;
  headline: string;
  /** One line for the 폼 banner, which has no room for the body. */
  tagline: string;
  body: string;
}

export const WELCOME_PAGES: WelcomePage[] = [
  {
    image: season,
    headline: '새로운 시즌',
    tagline: '3개월의 여정을 지금 시작하세요',
    body: '새로운 재미, 새로운 모습으로 시작하는 FC GROWTH의 새로운 시즌. 3개월의 여정을 지금 시작하세요.',
  },
  {
    image: lesson,
    headline: '오늘의 수업',
    tagline: '주제 하나로 오늘 수업이 짜여요',
    body: '키울 역량을 해시태그로 남기고 훈련 주제 하나만 고르세요. 오늘 오는 아이들과 수업 시간에 맞춰 훈련 블록이 짜여요.',
  },
  {
    image: growth,
    headline: '함께 자라요',
    tagline: '출석과 한 줄 기록이 성장이 돼요',
    body: '출석과 한 줄 기록이 쌓이면 아이의 성장이 보여요. 학부모에게는 리포트로, 코치에게는 다음 수업의 단서로.',
  },
];

/** The popup's lime — the one colour it borrows from the season popup it is modelled on. */
const LIME = '#A6F26A';

/** `ready` holds the popup back until the boot and crest screens have gone. */
export function WelcomePopup({ ready }: { ready: boolean }) {
  const [open, setOpen] = useState(true);
  const [page, setPage] = useState(0);
  const track = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open || !ready) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, ready, close]);

  if (!open || !ready) return null;

  const goTo = (i: number) => {
    const el = track.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  };

  const last = page === WELCOME_PAGES.length - 1;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/55 px-4"
      // Slower than the app's 220ms fade-in: it is coming up through the
      // crest screen's fade, and the two should feel like one movement.
      style={{ animation: 'fade-in 480ms ease-out both' }}
      onClick={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="FC GROWTH 안내"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[400px] overflow-hidden rounded-[28px] bg-white shadow-[0_24px_60px_rgba(0,0,0,0.35)] animate-boot-rise"
        style={{ animationDelay: '140ms' }}
      >
        <button
          type="button"
          onClick={close}
          aria-label="닫기"
          className="absolute right-3.5 top-3.5 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-[#4B5563] shadow-sm ring-2 ring-[#3E8E2E]/80 transition-transform active:scale-95"
        >
          <X size={20} strokeWidth={2} />
        </button>

        <div
          ref={track}
          onScroll={(e) => {
            const el = e.currentTarget;
            setPage(Math.round(el.scrollLeft / el.clientWidth));
          }}
          className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
        >
          {WELCOME_PAGES.map((p, i) => (
            <section
              key={p.headline}
              aria-roledescription="slide"
              aria-label={`${i + 1} / ${WELCOME_PAGES.length}`}
              className="w-full shrink-0 snap-center"
            >
              <div className="film-grain relative aspect-[7/6] max-h-[40vh] w-full overflow-hidden bg-[#1a1a1a]">
                <img
                  src={p.image}
                  alt=""
                  draggable={false}
                  className="h-full w-full select-none object-cover"
                />
                <p
                  // Above the grain and vignette: the photo is filmic, the headline crisp.
                  className="absolute inset-x-0 top-1/2 z-[3] select-none whitespace-nowrap text-center leading-none tracking-[-0.03em]"
                  style={{
                    color: LIME,
                    fontFamily: '"Black Han Sans", "Pretendard Variable", sans-serif',
                    fontSize: 'clamp(60px, 22vw, 88px)',
                    // Black Han Sans is wide; squeezed it reads as the tall,
                    // condensed headline face the design calls for.
                    transform: 'translateY(-50%) scaleX(0.72)',
                  }}
                >
                  {p.headline}
                </p>
              </div>
              <p className="px-6 py-6 text-[16px] leading-[1.65] tracking-[-0.01em] text-[#4B5563]">
                {p.body}
              </p>
            </section>
          ))}
        </div>

        <div className="flex items-center justify-center gap-1.5" role="tablist">
          {WELCOME_PAGES.map((p, i) => (
            <button
              key={p.headline}
              type="button"
              role="tab"
              aria-selected={i === page}
              aria-label={`${i + 1}번째 안내`}
              onClick={() => goTo(i)}
              className={`h-[6px] rounded-full transition-all duration-300 ${
                i === page ? 'w-[18px] bg-[#1B2232]' : 'w-[6px] bg-[#D1D5DB]'
              }`}
            />
          ))}
        </div>

        <div className="px-6 pb-6 pt-7">
          <button
            type="button"
            onClick={() => (last ? close() : goTo(page + 1))}
            className="h-[50px] w-full rounded-[14px] text-[16px] font-semibold text-[#111827] transition-[filter] active:brightness-95"
            style={{ background: LIME }}
          >
            {last ? '시작하기' : '다음'}
          </button>
        </div>
      </div>
    </div>
  );
}
