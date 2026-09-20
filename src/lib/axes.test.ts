/**
 * What the pentagon is allowed to claim.
 *
 * Two failures are being guarded against here, and both were real.
 *
 * 1. 멘탈 as a bin. Watch tags are phrased as symptoms — "통증호소",
 *    "소극적참여" — so none of them matched a competence name and every one
 *    fell through to the `caution` fallback. One student's chart showed 멘탈 8
 *    against 태도 85, which reads as a child with a psychological problem. What
 *    it actually meant was "three tags did not parse".
 *
 * 2. A linear score. Six watch tags pinned an axis to the floor, turning a rough
 *    month into a permanent-looking spike. A tag a coach taps in ten seconds
 *    must not be able to say something that strong.
 */

import { describe, expect, it } from 'vitest';
import type { AttendanceLog, BehaviorTag } from '@/types';
import {
  AXES,
  axisFor,
  axisForBlock,
  axisForTag,
  buildAxisProfile,
  isUnobserved,
  NEUTRAL_SCORE,
  weakestAxis,
} from './axes';

// The tags the seeded academy actually ships with (`scripts/seedData.ts`).
const TAGS: BehaviorTag[] = [
  { id: 't1', academyId: 'a', label: '#드리블우수', dimension: 'skill', polarity: 'positive' },
  { id: 't2', academyId: 'a', label: '#패스정확', dimension: 'skill', polarity: 'positive' },
  { id: 't3', academyId: 'a', label: '#시야확보', dimension: 'skill', polarity: 'positive' },
  { id: 't4', academyId: 'a', label: '#끝까지집중', dimension: 'attitude', polarity: 'positive' },
  { id: 't5', academyId: 'a', label: '#팀워크좋음', dimension: 'teamwork', polarity: 'positive' },
  { id: 't6', academyId: 'a', label: '#체력향상', dimension: 'physical', polarity: 'positive' },
  { id: 't7', academyId: 'a', label: '#컨디션저하', dimension: 'caution', polarity: 'watch' },
  { id: 't8', academyId: 'a', label: '#집중력흔들림', dimension: 'caution', polarity: 'watch' },
  { id: 't9', academyId: 'a', label: '#소극적참여', dimension: 'caution', polarity: 'watch' },
  { id: 't10', academyId: 'a', label: '#통증호소', dimension: 'caution', polarity: 'watch' },
];

const tag = (label: string): BehaviorTag => TAGS.find((t) => t.label === label)!;

function log(tags: string[], i = 0): AttendanceLog {
  return {
    id: `log-${i}`,
    academyId: 'a',
    studentId: 'stu-1',
    classId: 'cls-1',
    date: `2026-09-${`${(i % 28) + 1}`.padStart(2, '0')}`,
    status: 'present',
    tags,
    coachComment: '',
  };
}

/** `n` sessions, each carrying the same tag. */
const repeat = (label: string, n: number): AttendanceLog[] =>
  Array.from({ length: n }, (_, i) => log([label], i));

describe('axisFor', () => {
  it('matches a competence by name', () => {
    expect(axisFor('#패스정확')).toBe('technical');
    expect(axisFor('압박대응 훈련')).toBe('tactical');
    expect(axisFor('#밸런스안정')).toBe('physical');
  });

  it('matches vocabulary that names a competence without using its word', () => {
    expect(axisFor('#체력향상')).toBe('physical');
    expect(axisFor('수비 조직')).toBe('tactical');
  });

  it('returns null rather than guessing', () => {
    expect(axisFor('#오늘도화이팅')).toBeNull();
  });
});

describe('axisForTag — the 주의 vocabulary', () => {
  // The regression. Every one of these used to land on 멘탈.
  it('reads a watch tag as the thing it is actually about', () => {
    expect(axisForTag(tag('#통증호소'))).toBe('physical');
    expect(axisForTag(tag('#컨디션저하'))).toBe('physical');
    expect(axisForTag(tag('#소극적참여'))).toBe('attitude');
    expect(axisForTag(tag('#집중력흔들림'))).toBe('mental');
  });

  it('does not pile every watch tag onto one axis', () => {
    const axes = new Set(
      TAGS.filter((t) => t.polarity === 'watch').map(axisForTag),
    );
    expect(axes.size).toBeGreaterThan(1);
  });
});

describe('axisForBlock', () => {
  it('reads the title before falling back to the session phase', () => {
    expect(
      axisForBlock({ title: '3 대 1 압박 탈출', description: '', category: 'warmup' }),
    ).toBe('tactical');
  });

  it('falls back to the phase only when nothing else speaks', () => {
    expect(axisForBlock({ title: '몸풀기', description: '', category: 'warmup' })).toBe(
      'physical',
    );
    expect(axisForBlock({ title: '마무리', description: '', category: 'game' })).toBe('tactical');
  });
});

describe('buildAxisProfile', () => {
  it('sits at neutral and reports itself unobserved with no tags', () => {
    const profile = buildAxisProfile([], 'stu-1', TAGS);
    expect(isUnobserved(profile)).toBe(true);
    for (const axis of AXES) expect(profile[axis].score).toBe(NEUTRAL_SCORE);
  });

  it('ignores logs belonging to other students', () => {
    const other = { ...log(['#패스정확']), studentId: 'stu-2' };
    const profile = buildAxisProfile([other], 'stu-1', TAGS);
    expect(isUnobserved(profile)).toBe(true);
  });

  it('raises the axis a positive tag belongs to, and only that one', () => {
    const profile = buildAxisProfile(repeat('#패스정확', 3), 'stu-1', TAGS);
    expect(profile.technical.score).toBeGreaterThan(NEUTRAL_SCORE);
    expect(profile.physical.score).toBe(NEUTRAL_SCORE);
    expect(profile.technical.hits).toBe(3);
  });

  it('saturates instead of pegging — a bad month is not a floor', () => {
    const profile = buildAxisProfile(repeat('#집중력흔들림', 8), 'stu-1', TAGS);
    // Clearly low, but nowhere near zero: eight taps is a concern, not a verdict.
    expect(profile.mental.score).toBeLessThan(NEUTRAL_SCORE - 20);
    expect(profile.mental.score).toBeGreaterThan(5);
  });

  it('saturates upward too — twenty compliments is not a perfect score', () => {
    const profile = buildAxisProfile(repeat('#드리블우수', 20), 'stu-1', TAGS);
    expect(profile.technical.score).toBeLessThan(100);
    expect(profile.technical.score).toBeGreaterThan(NEUTRAL_SCORE + 30);
  });

  it('nets positives against watches on the same axis', () => {
    const mixed = [...repeat('#체력향상', 4), ...repeat('#통증호소', 4).map((l, i) => ({
      ...l,
      id: `w-${i}`,
      date: `2026-08-${`${i + 1}`.padStart(2, '0')}`,
    }))];
    const profile = buildAxisProfile(mixed, 'stu-1', TAGS);
    // Four up, four down, with watches weighted a little heavier.
    expect(profile.physical.score).toBeLessThan(NEUTRAL_SCORE);
    expect(profile.physical.hits).toBe(4);
    expect(profile.physical.watches).toBe(4);
  });

  it('keeps the evidence behind each score, most frequent first', () => {
    const profile = buildAxisProfile(
      [...repeat('#패스정확', 3), log(['#드리블우수'], 90)],
      'stu-1',
      TAGS,
    );
    expect(profile.technical.evidence[0]).toEqual(['#패스정확', 3]);
  });

  it('points 다음 훈련 at the axis with the most room', () => {
    const profile = buildAxisProfile(
      [...repeat('#드리블우수', 4), ...repeat('#소극적참여', 3).map((l, i) => ({
        ...l,
        id: `w-${i}`,
        date: `2026-07-${`${i + 1}`.padStart(2, '0')}`,
      }))],
      'stu-1',
      TAGS,
    );
    expect(weakestAxis(profile)).toBe('attitude');
  });
});
