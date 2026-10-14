/**
 * 훈련 주제 — the textbook football abilities a 훈련 블록 trains.
 *
 * This list has nothing to do with the five abilities. Those are hashtags a
 * coach puts on a day (`SessionPlan.abilities`); these are what football
 * coaching manuals list as the things a player learns, in the order they are
 * usually taught: the ball skills first, then playing with and against
 * others, then the body, then the keeper.
 *
 * - 볼 마스터리 · 퍼스트 터치 · 패스 · 드리블 · 슈팅 · 헤딩 — technique
 * - 볼 소유 · 오프 더 볼 · 빌드업 · 수비 · 공수 전환 · 세트피스 — the game's
 *   moments and principles as UEFA courses teach them
 * - 스피드 · 민첩성 · 협응·균형 · 근력·파워 · 지구력 — football fitness
 * - 골키핑
 *
 * A block can serve several topics (a 4대4 게임 is 볼 소유 and 공수 전환
 * alike). Choosing a topic builds the lesson from the blocks mapped to it.
 * Blocks written before topics existed have theirs read off their words
 * (`topicsForBlock`); a block whose words name none has none.
 */

import type { TopicId, TrainingBlock } from '@/types';

export type { TopicId };

export interface Topic {
  id: TopicId;
  label: string;
  /** Words a block on this topic tends to use. */
  words: string[];
}

// prettier-ignore
export const TOPICS: readonly Topic[] = [
  { id: 'ball-mastery', label: '볼 마스터리', words: ['볼 마스터리', '볼마스터리', '토탭', '볼 감각', '리프팅'] },
  { id: 'first-touch',  label: '퍼스트 터치', words: ['퍼스트터치', '퍼스트 터치', '첫 터치', '볼 컨트롤', '트래핑', '받고 돌', '돌아서'] },
  { id: 'passing',      label: '패스',       words: ['패스'] },
  { id: 'dribbling',    label: '드리블',     words: ['드리블', '돌파', '제치'] },
  { id: 'shooting',     label: '슈팅',       words: ['슈팅', '슛', '마무리'] },
  { id: 'heading',      label: '헤딩',       words: ['헤딩'] },
  { id: 'possession',   label: '볼 소유',    words: ['론도', '소유', '점유', '터치 제한', '두 터치'] },
  { id: 'off-ball',     label: '오프 더 볼', words: ['빈 곳', '빈 공간', '빈 모서리', '지원 움직임', '보고 받기', '스캔'] },
  { id: 'build-up',     label: '빌드업',     words: ['빌드업'] },
  { id: 'defending',    label: '수비',       words: ['수비', '압박', '커버'] },
  { id: 'transition',   label: '공수 전환',  words: ['공수 전환', '전환 게임', '트랜지션', '역습', '되찾'] },
  { id: 'set-pieces',   label: '세트피스',   words: ['세트피스', '코너킥', '프리킥', '스로인'] },
  { id: 'speed',        label: '스피드',     words: ['스피드', '스프린트', '출발', '반응 속도', '가속', '레이스'] },
  { id: 'agility',      label: '민첩성',     words: ['민첩', '지그재그', '방향 전환', '슬라럼', '스텝'] },
  { id: 'coordination', label: '협응·균형',  words: ['밸런스', '균형', '협응', '스트레칭'] },
  { id: 'strength',     label: '근력·파워',  words: ['몸싸움', '공 지키기', '근력', '파워', '경합'] },
  { id: 'endurance',    label: '지구력',     words: ['지구력', '인터벌', '체력', '심박'] },
  { id: 'goalkeeping',  label: '골키핑',     words: ['GK', '골키퍼', '캐칭', '다이브', '핸들링'] },
];

const BY_ID = new Map(TOPICS.map((t) => [t.id, t]));

export const topicMeta = (id: TopicId): Topic => BY_ID.get(id) as Topic;

export const isTopicId = (v: unknown): v is TopicId => typeof v === 'string' && BY_ID.has(v as TopicId);

/** "패스 · 볼 소유" — a block's topics as one line, empty when it has none. */
export const topicsLine = (ids: readonly TopicId[]): string =>
  ids.map((id) => topicMeta(id).label).join(' · ');

/** Topics whose words appear in `text`, in `TOPICS` order. */
function matches(text: string): TopicId[] {
  return TOPICS.filter((t) => t.words.some((w) => text.includes(w))).map((t) => t.id);
}

/**
 * Which topics a block serves: the ones it was saved with, else the ones its
 * title names, else the ones its description names. Empty when neither says —
 * better blank than wrong.
 */
export function topicsForBlock(
  block: Pick<TrainingBlock, 'title' | 'description'> & { topics?: unknown },
): TopicId[] {
  if (Array.isArray(block.topics)) {
    const saved = block.topics.filter(isTopicId);
    if (saved.length > 0) return saved;
  }
  const byTitle = matches(block.title);
  return byTitle.length > 0 ? byTitle : matches(block.description);
}
