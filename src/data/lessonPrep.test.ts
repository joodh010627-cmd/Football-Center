/**
 * 수업 준비's composer decides what a coach walks onto the pitch with, so the
 * rules are the ones a coach would notice first: the hour adds up, nobody is
 * handed a 5대5 with seven children, and a U7 class never gets a U11 drill.
 */

import { describe, expect, it } from 'vitest';
import type { SessionTemplate } from '@/types';
import { STANDARD_BLOCKS, STANDARD_SESSIONS } from './sessionLibrary';
import { blockAsRun, composeLesson, goalOptions, minPlayers } from './lessonPrep';
import { fromSessionPlan, toSessionPlan } from './mappers';
import { sessionDuration } from './selectors';

const blockMap = new Map(STANDARD_BLOCKS.map((b) => [b.id, b]));
const session = (id: string) => STANDARD_SESSIONS.find((s) => s.id === id) as SessionTemplate;
const minutesOf = (items: ReturnType<typeof composeLesson>['items']) =>
  sessionDuration(items, blockMap);

describe('minPlayers', () => {
  it('reads the player count from "N대M"', () => {
    expect(minPlayers({ title: '4대1 론도', description: '' })).toBe(5);
    expect(minPlayers({ title: '두 터치 경기', description: '5대5. 한 사람이…' })).toBe(10);
    expect(minPlayers({ title: '4:4 미니게임 (2골대)', description: '' })).toBe(8);
    expect(minPlayers({ title: '볼 마스터리', description: '1인 1볼로' })).toBe(0);
  });
});

describe('composeLesson with odd-minute blocks', () => {
  it('gives the few minutes fives cannot cover to the game', () => {
    const odd = STANDARD_BLOCKS.map((b) => (b.id === 'std-t-gates' ? { ...b, durationMin: 18 } : b));
    const { items } = composeLesson(session('std-s-pass'), odd, {
      ageGroup: 'U9',
      headcount: 12,
      minutes: 65,
    });
    expect(sessionDuration(items, new Map(odd.map((b) => [b.id, b])))).toBe(65);
  });
});

describe('composeLesson', () => {
  it('fills the class exactly when the class runs longer than the goal', () => {
    // 10 + 15 + 15 + 20 = 60 → 70
    const { items, notes } = composeLesson(session('std-s-pass'), STANDARD_BLOCKS, {
      ageGroup: 'U9',
      headcount: 12,
      minutes: 70,
    });
    expect(minutesOf(items)).toBe(70);
    expect(notes.some((n) => n.includes('70분'))).toBe(true);
  });

  it('trims to a class shorter than the goal without gutting any block', () => {
    const { items } = composeLesson(session('std-s-pass'), STANDARD_BLOCKS, {
      ageGroup: 'U9',
      headcount: 12,
      minutes: 50,
    });
    expect(minutesOf(items)).toBeLessThanOrEqual(50);
    for (const item of items) expect(item.durationMin ?? 99).toBeGreaterThanOrEqual(5);
  });

  it('leaves a goal alone when it already fits', () => {
    const { items, notes } = composeLesson(session('std-s-pass'), STANDARD_BLOCKS, {
      ageGroup: 'U9',
      headcount: 12,
      minutes: 60,
    });
    expect(items.every((i) => i.durationMin === null)).toBe(true);
    expect(notes).toEqual([]);
  });

  it('swaps a block that needs more players than are coming', () => {
    // 두 터치 경기 is 5대5.
    const { items, notes } = composeLesson(session('std-s-firsttouch'), STANDARD_BLOCKS, {
      ageGroup: 'U9',
      headcount: 7,
      minutes: 60,
    });
    const ids = items.map((i) => i.blockId);
    expect(ids).not.toContain('std-g-2touch');
    for (const id of ids) expect(minPlayers(blockMap.get(id!)!)).toBeLessThanOrEqual(7);
    expect(notes.some((n) => n.includes('7명'))).toBe(true);
  });

  it('keeps every block suitable for the age group', () => {
    // 공간 인식 opens with a U9+ rondo.
    const { items } = composeLesson(session('std-s-scan'), STANDARD_BLOCKS, {
      ageGroup: 'U7',
      headcount: 10,
      minutes: 60,
    });
    for (const item of items) {
      const block = blockMap.get(item.blockId!)!;
      expect(block.ageGroups.includes('U7'), block.id).toBe(true);
    }
  });

  it('never puts the same block in twice', () => {
    const { items } = composeLesson(session('std-s-scan'), STANDARD_BLOCKS, {
      ageGroup: 'U7',
      headcount: 4,
      minutes: 60,
    });
    const ids = items.map((i) => i.blockId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('goalOptions', () => {
  const own: SessionTemplate = { ...session('std-s-dribble'), id: 'own', source: 'center', curriculumId: 'cur-1', usageCount: 0 };

  it("puts the class's own curriculum first", () => {
    const list = goalOptions([...STANDARD_SESSIONS, own], { ageGroup: 'U9', curriculumId: 'cur-1' }, 'technical', []);
    expect(list[0].id).toBe('own');
  });

  it('sinks goals run recently below ones that have not been', () => {
    const list = goalOptions(STANDARD_SESSIONS, { ageGroup: 'U9', curriculumId: null }, 'technical', ['std-s-pass']);
    expect(list[list.length - 1].id).toBe('std-s-pass');
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
