/**
 * 훈련 주제 — the textbook football abilities a 훈련 블록 trains.
 *
 * This list has nothing to do with the five abilities. Those are hashtags a
 * coach puts on a day (`SessionPlan.abilities`); these are the four lessons a
 * coach builds from: 광진 FC 기본 수업, 패스, 드리블, 슈팅. Everything that is
 * not one of the three techniques falls under 기본 수업.
 *
 * A block can serve several topics (a 3패스 게임 is 패스 and 기본 수업
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
  { id: 'basic',     label: '광진 FC 기본 수업', words: ['기본 수업', '볼 마스터리', '퍼스트 터치', '론도', '소유', '수비', '전환', '스피드', '민첩', '밸런스', '공 지키기', '체력', 'GK', '골키퍼'] },
  { id: 'passing',   label: '패스',   words: ['패스'] },
  { id: 'dribbling', label: '드리블', words: ['드리블', '돌파', '제치'] },
  { id: 'shooting',  label: '슈팅',   words: ['슈팅', '슛', '마무리'] },
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
