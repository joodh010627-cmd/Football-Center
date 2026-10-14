/**
 * 훈련 주제 is the textbook list a block is mapped to. What matters is that the
 * standard library is fully mapped, that the everyday topics have a drill
 * behind them, and that a centre block's topics are read off its words without
 * guessing when they say nothing.
 */

import { describe, expect, it } from 'vitest';
import { STANDARD_BLOCKS } from './sessionLibrary';
import { fromSessionPlan, toSessionPlan, toTrainingBlock } from './mappers';
import { TOPICS, isTopicId, topicsForBlock } from './topics';

describe('TOPICS', () => {
  it('has no two topics with the same name', () => {
    expect(new Set(TOPICS.map((t) => t.label)).size).toBe(TOPICS.length);
  });
});

describe('the standard library', () => {
  it('maps blocks only to topics that exist', () => {
    for (const b of STANDARD_BLOCKS) for (const t of b.topics) expect(isTopicId(t), `${b.id} ${t}`).toBe(true);
  });

  it('has a drill behind the everyday topics', () => {
    const drilled = new Set(STANDARD_BLOCKS.filter((b) => b.category === 'skill').flatMap((b) => b.topics));
    for (const t of [
      'ball-mastery', 'first-touch', 'passing', 'dribbling', 'shooting', 'possession', 'off-ball',
      'defending', 'transition', 'speed', 'agility', 'strength',
    ] as const) {
      expect(drilled.has(t), t).toBe(true);
    }
  });
});

describe('topicsForBlock', () => {
  const read = (title: string, description = '') => topicsForBlock({ title, description });

  it("reads a centre block's topics off its words", () => {
    expect(read('코너킥 패턴 A')).toEqual(['set-pieces']);
    expect(read('론도 4:1 볼 소유')).toEqual(['possession']);
    expect(read('1대1 수비 자세')).toEqual(['defending']);
    expect(read('드리블 돌파 B')).toEqual(['dribbling']);
    expect(read('GK 핸들링 워밍업')).toEqual(['goalkeeping']);
    expect(read('반응 속도 컬러콘')).toEqual(['speed']);
  });

  it('leaves a block blank rather than guess', () => {
    expect(read('핸디캡 매치', '실력 격차 반영해 인원 제한')).toEqual([]);
  });

  it('keeps the topics it was saved with', () => {
    expect(topicsForBlock({ title: '패스 게임', description: '', topics: ['shooting', 'nope'] })).toEqual(['shooting']);
  });
});

describe('the database mappers', () => {
  it('reads the topics column, or infers them before 0010', () => {
    const row = { id: 'b', academy_id: 'a', title: '코너킥 패턴', category: 'skill', duration_min: 20 };
    expect(toTrainingBlock(row).topics).toEqual(['set-pieces']);
    expect(toTrainingBlock({ ...row, topics: ['build-up'] }).topics).toEqual(['build-up']);
  });

  it("keeps a plan's hashtags and topic", () => {
    const plan = {
      id: 'p', academyId: 'a', classId: 'c', coachId: 'k', date: '2026-10-22', createdAt: '',
      status: 'scheduled' as const, templateId: null, items: [],
      abilities: ['technical' as const, 'mental' as const], topic: 'passing' as const,
    };
    const back = toSessionPlan(fromSessionPlan(plan));
    expect(back.abilities).toEqual(['technical', 'mental']);
    expect(back.topic).toBe('passing');
  });
});
