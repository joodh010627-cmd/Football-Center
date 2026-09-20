/**
 * 피드 — not built yet, and said so.
 *
 * The tab exists because the structure is settled: 피드 is where the centre's
 * content will live, the thing that gives a parent a reason to open the app on a
 * day their child isn't training. That dwell time is the precondition for the
 * ad slots the homepage and Archive+ already assume.
 *
 * It is deliberately *not* built now. Parents have no login yet, and a content
 * surface with no audience is a surface that gets written twice. A stub that
 * names the plan is more honest than an empty list styled to look finished.
 */

import { Newspaper } from 'lucide-react';
import { ScreenBody, ScreenHeader } from '@/components/shell/Shell';

export function FeedScreen() {
  return (
    <>
      <ScreenHeader eyebrow="FC Growth Journal" title="축구 밖의 성장까지." />

      <ScreenBody>
        <div className="rounded-xl border border-dashed border-hairline-strong bg-canvas px-5 py-12 text-center">
          <Newspaper size={28} className="mx-auto text-primary-soft" strokeWidth={1.7} />
          <p className="mt-3.5 text-[17px] font-bold text-ink">준비 중입니다</p>
          <p className="mx-auto mt-2 max-w-[320px] text-[13.5px] leading-[1.7] text-steel">
            코칭 노트와 클럽 소식을 학부모에게 전하는 공간입니다. 학부모 계정이 열리는 시점에 함께
            공개됩니다.
          </p>
        </div>

        <ul className="mt-4 space-y-2">
          {[
            ['코칭 노트', '이번 주 수업에서 다룬 것을 학부모의 언어로'],
            ['클럽 소식', '경기 결과, 일정 변경, 새 학기 안내'],
            ['성장 리포트', '원생별 5개 영역 변화를 월 단위로'],
          ].map(([title, detail]) => (
            <li
              key={title}
              className="flex items-start gap-3 rounded-lg border border-hairline bg-canvas px-4 py-3.5 opacity-70"
            >
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-hairline-strong" />
              <span className="min-w-0">
                <span className="block text-[14.5px] font-semibold text-charcoal">{title}</span>
                <span className="mt-0.5 block text-[12.5px] leading-[1.5] text-stone">
                  {detail}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </ScreenBody>
    </>
  );
}
