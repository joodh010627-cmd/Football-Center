/**
 * The two shapes a column takes in a list: a full-bleed cover for the one the
 * screen leads with, and a compact row for the rest.
 */

import { ArrowRight } from 'lucide-react';
import { AUDIENCE_LABEL, type Article } from '@/data/editorial';
import { ArticleArt } from '@/components/feed/ArticleArt';

export function FeatureCard({
  article,
  onOpen,
  caption,
}: {
  article: Article;
  onOpen: () => void;
  /** Line under the headline; defaults to the audience. */
  caption?: string;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="pressable group relative block w-full overflow-hidden rounded-xl text-left shadow-card"
    >
      <ArticleArt
        variant={article.art}
        zoom
        cover
        className="aspect-[4/3.6] w-full sm:aspect-[16/9]"
      />
      {/* Scrim: the art's bottom half darkens so white type always reads. */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-6 text-white">
        <p className="text-[11.5px] font-bold uppercase tracking-label text-white/85">
          {article.kicker}
        </p>
        <h3 className="mt-3 whitespace-pre-line text-[26px] font-bold leading-[1.2] tracking-tightest sm:text-[30px]">
          {article.title}
        </h3>
        <p className="mt-2.5 text-[13.5px] text-white/80">
          {caption ?? article.audience.map((a) => AUDIENCE_LABEL[a]).join(' · ') + ' 함께 읽기'}
        </p>
        <p className="mt-4 flex items-center gap-1.5 text-[14px] font-semibold">
          {article.minutes}분 읽기
          <ArrowRight
            size={15}
            strokeWidth={2.4}
            className="transition-transform duration-300 ease-smooth group-hover:translate-x-1"
          />
        </p>
      </div>
    </button>
  );
}

export function ArticleRow({ article, onOpen }: { article: Article; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="pressable flex w-full items-center gap-4 rounded-lg border border-hairline bg-canvas p-3 text-left hover:border-hairline-strong"
    >
      <ArticleArt variant={article.art} className="h-[84px] w-[84px] shrink-0 rounded-md" />
      <span className="min-w-0 flex-1">
        <span className="text-[11.5px] font-semibold text-primary">{article.category}</span>
        <span className="mt-1 line-clamp-2 block text-[15.5px] font-bold leading-[1.35] text-ink">
          {article.title.replace('\n', ' ')}
        </span>
        <span className="mt-1.5 block text-[12px] text-steel">
          {article.audience.map((a) => AUDIENCE_LABEL[a]).join(' · ')} · {article.minutes}분
        </span>
      </span>
    </button>
  );
}
