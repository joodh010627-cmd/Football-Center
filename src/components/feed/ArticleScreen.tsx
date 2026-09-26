/**
 * One column, full screen.
 *
 * Reading on a phone at the side of a pitch, so: short sections with real
 * headings, a thin progress line under the top bar so the reader knows how much
 * is left before the session starts, and the next two things to read at the
 * bottom instead of a dead end.
 */

import { useEffect, useState } from 'react';
import { AlertTriangle, Lightbulb } from 'lucide-react';
import { AUDIENCE_LABEL, findArticle, relatedTo } from '@/data/editorial';
import { cn } from '@/lib/cn';
import { BackBar, ScreenBody } from '@/components/shell/Shell';
import { ArticleArt } from '@/components/feed/ArticleArt';
import { ArticleRow } from '@/components/feed/ArticleCard';

export function ArticleScreen({
  articleId,
  onBack,
  onOpenArticle,
}: {
  articleId: string;
  onBack: () => void;
  onOpenArticle: (id: string) => void;
}) {
  const article = findArticle(articleId);
  const progress = useReadingProgress();

  if (!article) {
    return (
      <>
        <BackBar label="피드" onBack={onBack} />
        <ScreenBody>
          <p className="py-10 text-center text-[14px] text-steel">글을 찾을 수 없습니다.</p>
        </ScreenBody>
      </>
    );
  }

  const related = relatedTo(article);

  return (
    <>
      {/* Pinned under the mobile top bar (h-14), at the very top on desktop. */}
      <div className="sticky top-14 z-30 h-[3px] bg-transparent lg:top-0">
        <div
          className="h-full origin-left bg-primary transition-transform duration-150 ease-out"
          style={{ transform: `scaleX(${progress})` }}
        />
      </div>

      <BackBar label="피드" onBack={onBack} />

      <ScreenBody>
        <article className="mx-auto max-w-[680px]">
          <ArticleArt variant={article.art} zoom className="aspect-[16/10] w-full rounded-xl" />

          <p className="mt-6 eyebrow-ink">{article.kicker}</p>
          <h1 className="mt-3 whitespace-pre-line text-[28px] font-bold leading-[1.2] tracking-tightest text-ink sm:text-[34px]">
            {article.title}
          </h1>
          <p className="mt-3 text-[15.5px] leading-[1.7] text-charcoal">{article.dek}</p>

          <div className="mt-4 flex flex-wrap items-center gap-1.5 border-b border-hairline pb-5">
            {article.audience.map((a) => (
              <span
                key={a}
                className="rounded-full bg-primary-wash px-2.5 py-1 text-[12px] font-semibold text-primary"
              >
                {AUDIENCE_LABEL[a]}
              </span>
            ))}
            <span className="ml-1 text-[12.5px] text-steel">
              {article.minutes}분 읽기 · FC Growth 편집
            </span>
          </div>

          <div className="stagger">
            {article.sections.map((section) => (
              <section key={section.heading} className="mt-8">
                <h2 className="text-[19px] font-bold leading-[1.35] tracking-[-0.02em] text-ink">
                  {section.heading}
                </h2>
                {section.paragraphs.map((p, i) => (
                  <p key={i} className="mt-3 text-[15.5px] leading-[1.8] text-slate">
                    {p}
                  </p>
                ))}
                {section.points && (
                  <ul className="mt-3 space-y-2">
                    {section.points.map((point) => (
                      <li
                        key={point}
                        className="flex gap-2.5 text-[15px] leading-[1.65] text-slate"
                      >
                        <span className="mt-[10px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {section.note && (
                  <div
                    className={cn(
                      'mt-4 flex gap-3 rounded-lg px-4 py-3.5',
                      section.note.tone === 'tip' ? 'bg-primary-wash' : 'bg-tint-alert-soft',
                    )}
                  >
                    {section.note.tone === 'tip' ? (
                      <Lightbulb
                        size={17}
                        className="mt-0.5 shrink-0 text-primary"
                        strokeWidth={2.2}
                      />
                    ) : (
                      <AlertTriangle
                        size={17}
                        className="mt-0.5 shrink-0 text-error"
                        strokeWidth={2.2}
                      />
                    )}
                    <p className="text-[14px] leading-[1.7] text-charcoal">{section.note.text}</p>
                  </div>
                )}
              </section>
            ))}
          </div>

          <p className="mt-10 rounded-lg border border-hairline bg-canvas px-4 py-3 text-[12.5px] leading-[1.65] text-steel">
            이 글은 일반적인 정보를 전하기 위한 FC Growth 편집 예시입니다.
            {article.medical &&
              ' 개인의 건강 상태에 대한 판단은 반드시 의료 전문가와 상의해 주세요.'}
          </p>

          {related.length > 0 && (
            <section className="mt-9">
              <h2 className="text-[17px] font-bold tracking-[-0.02em] text-ink">
                함께 읽으면 좋은 글
              </h2>
              <div className="mt-3 space-y-2">
                {related.map((a) => (
                  <ArticleRow key={a.id} article={a} onOpen={() => onOpenArticle(a.id)} />
                ))}
              </div>
            </section>
          )}
        </article>
      </ScreenBody>
    </>
  );
}

/** 0 → 1 as the window scrolls from the top to the bottom of the page. */
function useReadingProgress(): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setValue(max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return value;
}
