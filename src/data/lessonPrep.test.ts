/**
 * 수업 준비's composer decides what a coach walks onto the pitch with, so the
 * rules are the ones a coach would notice first: the hour adds up, nobody is
 * handed a 5대5 with seven children, a U7 class never gets a U11 drill, and the
 * drills are the 훈련 주제 the coach chose.
 */

import { describe, expect, it } from 'vitest';
import type { AgeGroup, TopicId, TrainingBlock } from '@/types';
import { STANDARD_BLOCKS } from './sessionLibrary';
import {
  beadsOf,
  blockAsRun,
  composeForTopic,
  lessonName,
  mainBlock,
  minPlayers,
  pastBeads,
  runnableTopics,
  type LessonContext,
  type PastLesson,
} from './lessonPrep';
import { fromSessionPlan, toSessionPlan } from './mappers';
import { sessionDuration } from './selectors';

const lib = new Map(STANDARD_BLOCKS.map((b) => [b.id, b]));

/** A past lesson that ran these blocks as written. */
const lesson = (ids: string[], date: string): PastLesson => ({
  date,
  template: undefined,
  present: 10,
  total: 12,
  tags: [],
  plan: {
    id: date, academyId: 'a', classId: 'c', coachId: 'k', date, createdAt: '', status: 'completed', templateId: null,
    items: ids.map((id) => ({ category: lib.get(id)!.category, blockId: id, durationMin: null })),
  },
});

const ctxOf = (
  recent: PastLesson[] = [],
  { headcount = 12, ageGroup = 'U9', minutes = 60, library = STANDARD_BLOCKS }:
    { headcount?: number; ageGroup?: AgeGroup; minutes?: number; library?: TrainingBlock[] } = {},
): LessonContext => ({
  cls: { ageGroup },
  past: pastBeads(recent, new Map(library.map((b) => [b.id, b]))),
  library,
  when: { ageGroup, headcount, minutes },
});

const blocksOf = (topic: TopicId, ctx: LessonContext) =>
  composeForTopic(topic, ctx).items.map((i) => lib.get(i.blockId!)!);

describe('minPlayers', () => {
  it('reads the player count from "N대M"', () => {
    expect(minPlayers({ title: '4대1 론도', description: '' })).toBe(5);
    expect(minPlayers({ title: '두 터치 경기', description: '5대5. 한 사람이…' })).toBe(10);
    expect(minPlayers({ title: '4:4 미니게임 (2골대)', description: '' })).toBe(8);
    expect(minPlayers({ title: '볼 마스터리', description: '1인 1볼로' })).toBe(0);
  });
});

describe('composeForTopic — the shape of the hour', () => {
  it('opens with a warm-up, ends in a game, with the drills in between', () => {
    expect(blocksOf('passing', ctxOf()).map((b) => b.category)).toEqual(['warmup', 'skill', 'skill', 'game']);
  });

  it('runs one drill in a short class', () => {
    const cats = blocksOf('passing', ctxOf([], { minutes: 50 })).map((b) => b.category);
    expect(cats.filter((c) => c === 'skill')).toHaveLength(1);
  });

  it('takes every drill from the blocks mapped to the topic', () => {
    const ctx = ctxOf();
    for (const topic of runnableTopics(ctx)) {
      const drills = blocksOf(topic, ctx).filter((b) => b.category === 'skill');
      expect(drills.length, topic).toBeGreaterThan(0);
      for (const b of drills) expect(b.topics, `${topic} ${b.id}`).toContain(topic);
    }
  });

  it('fills the class exactly', () => {
    for (const minutes of [60, 70, 90]) {
      const { items } = composeForTopic('dribbling', ctxOf([], { minutes }));
      expect(sessionDuration(items, lib), `${minutes}분`).toBe(minutes);
    }
  });

  it('trims to a short class without gutting any block', () => {
    const { items } = composeForTopic('basic', ctxOf([], { minutes: 45 }));
    expect(sessionDuration(items, lib)).toBeLessThanOrEqual(45);
    for (const item of items) expect(item.durationMin ?? 99).toBeGreaterThanOrEqual(5);
  });

  it('gives the few minutes fives cannot cover to the game', () => {
    const odd = STANDARD_BLOCKS.map((b) => (b.id === 'std-t-gates' ? { ...b, durationMin: 18 } : b));
    const { items } = composeForTopic('passing', ctxOf([], { minutes: 65, library: odd }));
    expect(sessionDuration(items, new Map(odd.map((b) => [b.id, b])))).toBe(65);
  });
});

describe('composeForTopic — the children who are coming', () => {
  it('never hands seven children a block that needs more', () => {
    const ctx = ctxOf([], { headcount: 7 });
    for (const topic of runnableTopics(ctx)) {
      for (const b of blocksOf(topic, ctx)) expect(minPlayers(b), `${topic} ${b.title}`).toBeLessThanOrEqual(7);
    }
  });

  it('keeps every block suitable for the age group', () => {
    const ctx = ctxOf([], { ageGroup: 'U7' });
    for (const topic of runnableTopics(ctx)) {
      for (const b of blocksOf(topic, ctx)) expect(b.ageGroups.includes('U7'), `${topic} ${b.id}`).toBe(true);
    }
  });

  it('only offers topics the age group has a drill for', () => {
    // With only a U9+ shooting drill, 슈팅 is offered from U9.
    const library = STANDARD_BLOCKS.filter((b) => b.id === 'std-t-finish');
    expect(runnableTopics(ctxOf([], { ageGroup: 'U7', library })).has('shooting')).toBe(false);
    expect(runnableTopics(ctxOf([], { ageGroup: 'U9', library })).has('shooting')).toBe(true);
  });

  it('never puts the same block in twice', () => {
    const ids = composeForTopic('basic', ctxOf([], { ageGroup: 'U7', headcount: 4 })).items.map((i) => i.blockId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('is empty when the topic has no drill for the class', () => {
    expect(composeForTopic('shooting', ctxOf([], { library: [] }))).toEqual({ items: [], notes: [] });
  });
});

describe('composeForTopic — which blocks', () => {
  it("puts the centre's own block ahead of the standard library", () => {
    const own: TrainingBlock = { ...lib.get('std-t-gates')!, id: 'own', source: 'center', title: '우리 센터 패스' };
    const { items } = composeForTopic('passing', ctxOf([], { library: [...STANDARD_BLOCKS, own] }));
    expect(items.find((i) => i.category === 'skill')?.blockId).toBe('own');
  });

  it("doesn't bring last lesson's drills straight back when others fit", () => {
    const first = blocksOf('dribbling', ctxOf()).filter((b) => b.category === 'skill').map((b) => b.id);
    const last = lesson(['std-w-ball', ...first, 'std-g-endzone'], '2026-09-29');
    const next = blocksOf('dribbling', ctxOf([last])).filter((b) => b.category === 'skill').map((b) => b.id);
    for (const id of next) expect(first).not.toContain(id);
  });
});

describe('lessonName', () => {
  it('is the 훈련 주제 the lesson was built from', () => {
    expect(lessonName({ items: [], topic: 'passing' }, lib)).toBe('패스');
  });

  it('falls back to the main drill for a lesson without one', () => {
    const items = lesson(['std-w-ball', 'std-c-scan', 'std-g-3pass'], 'x').plan!.items;
    expect(lessonName({ items, topic: null }, lib)).toBe('색깔 보고 받기');
  });
});

describe('mainBlock', () => {
  it('is the first drill, not the longer game', () => {
    const beads = beadsOf(lesson(['std-w-ball', 'std-c-scan', 'std-g-3pass'], 'x').plan!.items, lib, 0);
    expect(mainBlock(beads)?.blockId).toBe('std-c-scan');
  });

  it('falls back to the game when there is no drill', () => {
    const beads = beadsOf(lesson(['std-w-move', 'std-g-talk'], 'x').plan!.items, lib, 0);
    expect(mainBlock(beads)?.blockId).toBe('std-g-talk');
  });
});

describe('blockAsRun', () => {
  const block = STANDARD_BLOCKS[0];

  it('is the library block when the lesson did not rewrite it', () => {
    expect(blockAsRun(block, {})).toBe(block);
  });

  it("lays the lesson's rewrite over the library block", () => {
    const run = blockAsRun(block, { edit: { title: '오늘은 왼발만', coachingPoints: ['왼발'] } });
    expect(run.title).toBe('오늘은 왼발만');
    expect(run.coachingPoints).toEqual(['왼발']);
    expect(run.description).toBe(block.description);
  });
});

describe('plan items round-trip', () => {
  it('keeps a lesson edit through the database mappers', () => {
    const plan = {
      id: 'p', academyId: 'a', classId: 'c', coachId: 'k', date: '2026-09-28',
      templateId: null, createdAt: '', status: 'scheduled' as const,
      items: [{ category: 'skill' as const, blockId: 'std-t-gates', durationMin: null, edit: { title: '수정' } }],
    };
    expect(toSessionPlan(fromSessionPlan(plan)).items[0].edit).toEqual({ title: '수정' });
  });
});
