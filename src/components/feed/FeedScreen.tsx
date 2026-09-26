/**
 * 피드 — the journal.
 *
 * This is where a parent gets a reason to open the app on a day their child
 * isn't training, which is the precondition for the ad slots the homepage and
 * Archive+ already assume. Until a pilot team's coaches write for it, it runs
 * on the sample columns in `data/editorial.ts` — plain, useful pieces for
 * players and parents rather than lorem ipsum, so the shape can be judged with
 * real reading in it.
 *
 * Order is deliberate: the lead column first, then a few more, and the one
 * brand slot only after the reader has already got something from the page.
 */

import { useMemo, useState } from 'react';
import { ARTICLES, AUDIENCE_LABEL, type Audience } from '@/data/editorial';
import { cn } from '@/lib/cn';
import { ScreenBody, ScreenHeader } from '@/components/shell/Shell';
import { Swap } from '@/components/ui/Motion';
import { ArticleRow, FeatureCard } from '@/components/feed/ArticleCard';
import { BrandStory } from '@/components/feed/BrandStory';

type Filter = 'all' | Audience;

const FILTERS: Filter[] = ['all', 'parent', 'player', 'coach'];

export function FeedScreen({ onOpenArticle }: { onOpenArticle: (id: string) => void }) {
  const [filter, setFilter] = useState<Filter>('all');

  const list = useMemo(
    () => (filter === 'all' ? ARTICLES : ARTICLES.filter((a) => a.audience.includes(filter))),
    [filter],
  );
  const [lead, ...rest] = list;
  const before = rest.slice(0, 3);
  const after = rest.slice(3);

  return (
    <>
      <ScreenHeader eyebrow="FC Growth Journal" title="축구 밖의 성장까지." />

      <ScreenBody>
        <div className="-mx-5 flex gap-1.5 overflow-x-auto px-5 no-scrollbar sm:mx-0 sm:px-0">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                'pill-tab shrink-0 whitespace-nowrap',
                filter === f && 'pill-tab-active',
              )}
            >
              {f === 'all' ? '전체' : `${AUDIENCE_LABEL[f]}를 위한`}
            </button>
          ))}
        </div>

        <Swap k={filter}>
          <div className="mt-6 flex items-end justify-between gap-3">
            <div>
              <p className="eyebrow-ink">This week</p>
              <h2 className="mt-2 text-[21px] font-bold tracking-[-0.02em] text-ink">
                이번 주, 함께 읽어요
              </h2>
            </div>
            <span className="shrink-0 text-[12.5px] tabular-nums text-steel">{list.length}편</span>
          </div>

          {lead && (
            <div className="mt-4">
              <FeatureCard article={lead} onOpen={() => onOpenArticle(lead.id)} />
            </div>
          )}

          {before.length > 0 && (
            <div className="stagger mt-3 grid gap-2 lg:grid-cols-2">
              {before.map((a) => (
                <ArticleRow key={a.id} article={a} onOpen={() => onOpenArticle(a.id)} />
              ))}
            </div>
          )}
        </Swap>

        <div className="mt-9 border-t border-hairline pt-7">
          <BrandStory />
        </div>

        {after.length > 0 && (
          <Swap k={filter}>
            <h2 className="mt-9 text-[19px] font-bold tracking-[-0.02em] text-ink">더 읽을거리</h2>
            <div className="stagger mt-3 grid gap-2 lg:grid-cols-2">
              {after.map((a) => (
                <ArticleRow key={a.id} article={a} onOpen={() => onOpenArticle(a.id)} />
              ))}
            </div>
          </Swap>
        )}

        <p className="mt-8 text-center text-[12px] leading-[1.6] text-stone">
          칼럼은 FC Growth 편집 예시이며 일반적인 정보입니다.
          <br />
          광고는 모두 가상 브랜드를 사용한 디자인 예시입니다.
        </p>
      </ScreenBody>
    </>
  );
}
