/**
 * The two rules the curriculum layer is actually judged on.
 *
 * 1. Library order. The owner's rule is "this class's curriculum first, most-used
 *    first; then the most related curriculum, most-used first; and so on." Every
 *    part of that sentence is a sort key, and getting any of them backwards means
 *    a coach scrolling past the drill they were supposed to run. It is also the
 *    one piece of logic in this app with no visible failure mode — a wrongly
 *    ordered list still looks like a list.
 *
 * 2. Calendar state. `unplanned` / `scheduled` / `completed` are what the month
 *    grid colours itself from, and confusing the last two means telling a coach a
 *    session already happened.
 */

import { describe, expect, it } from 'vitest';
import type {
  AttendanceLog,
  Class,
  Curriculum,
  ID,
  ISODate,
  SessionPlan,
  SessionTemplate,
  TrainingBlock,
  TrainingCategory,
} from '@/types';
import {
  blockGroupsForCurriculum,
  curriculumDistance,
  relatedCurricula,
  scheduleStateFor,
} from './selectors';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const curriculum = (
  id: ID,
  track: Curriculum['track'],
  ageGroup: Curriculum['ageGroup'],
  sortOrder = 0,
): Curriculum => ({
  id,
  academyId: 'aca-1',
  title: id,
  ageGroup,
  track,
  objective: '',
  focusAreas: [],
  cycleWeeks: 8,
  sortOrder,
});

const block = (
  id: ID,
  usageCount: number,
  category: TrainingCategory = 'skill',
  status: TrainingBlock['status'] = 'published',
): TrainingBlock => ({
  id,
  academyId: 'aca-1',
  title: id,
  category,
  durationMin: 20,
  description: '',
  ageGroups: ['U9'],
  equipment: [],
  usageCount,
  isCoreCurriculum: false,
  status,
  proposedBy: status === 'pending' ? 'coach-1' : null,
});

const template = (
  id: ID,
  curriculumId: ID,
  blockIds: ID[],
  status: SessionTemplate['status'] = 'published',
): SessionTemplate => ({
  id,
  academyId: 'aca-1',
  curriculumId,
  title: id,
  week: 1,
  goal: '',
  blockIds,
  status,
  proposedBy: status === 'pending' ? 'coach-1' : null,
  reviewNote: '',
  usageCount: 0,
  createdAt: '2026-01-01T00:00:00Z',
});

// U9 weekday foundation is the class we are building for.
const OWN = curriculum('own', 'foundation', 'U9', 0);
// Same track one age up — close.
const SAME_TRACK = curriculum('sameTrack', 'foundation', 'U11', 1);
// Same age, different purpose — further, by design.
const SAME_AGE = curriculum('sameAge', 'club', 'U9', 2);

describe('커리큘럼 연관성', () => {
  it('나이 차이보다 클래스 목적이 우선한다', () => {
    // 같은 트랙 두 칸 위(U9→U13)가 같은 나이 다른 트랙보다 가깝다. 드릴이
    // 전이되는 것은 나이가 아니라 수업의 목적이기 때문이다.
    const sameTrackTwoSteps = curriculum('x', 'foundation', 'U13');

    expect(curriculumDistance(OWN, sameTrackTwoSteps)).toBeLessThan(
      curriculumDistance(OWN, SAME_AGE),
    );
  });

  it('자기 자신과의 거리는 0이다', () => {
    expect(curriculumDistance(OWN, OWN)).toBe(0);
  });

  it('연관 순서에서 자기 자신은 빠진다', () => {
    const related = relatedCurricula([OWN, SAME_TRACK, SAME_AGE], OWN);

    expect(related.map((c) => c.id)).toEqual(['sameTrack', 'sameAge']);
  });
});

describe('설계 화면 블록 정렬', () => {
  const slice = {
    curricula: [OWN, SAME_TRACK, SAME_AGE],
    sessionTemplates: [
      template('t-own', 'own', ['b-own-low', 'b-own-high']),
      template('t-same-track', 'sameTrack', ['b-track']),
      template('t-same-age', 'sameAge', ['b-age']),
    ],
    trainingBlocks: [
      // Deliberately declared in the *wrong* order, and with the unclaimed block
      // carrying the highest usage of all — so a passing test can only mean the
      // grouping beat raw popularity.
      block('b-loose', 999),
      block('b-age', 50),
      block('b-track', 10),
      block('b-own-low', 1),
      block('b-own-high', 5),
    ],
  };

  it('이 반의 커리큘럼이 첫 그룹이고, 그 안에서 사용 빈도순이다', () => {
    const groups = blockGroupsForCurriculum(slice, OWN, 'skill');

    expect(groups[0].curriculum?.id).toBe('own');
    expect(groups[0].rank).toBe(0);
    expect(groups[0].blocks.map((b) => b.id)).toEqual(['b-own-high', 'b-own-low']);
  });

  it('그 다음은 연관성 높은 커리큘럼 순이다 — 사용 빈도가 높아도 뒤로 간다', () => {
    const groups = blockGroupsForCurriculum(slice, OWN, 'skill');

    // b-age(50회)가 b-track(10회)보다 많이 쓰였지만, 같은 트랙인 sameTrack이
    // 먼저 온다. 빈도는 그룹 안에서만 정렬 기준이다.
    expect(groups.map((g) => g.curriculum?.id)).toEqual([
      'own',
      'sameTrack',
      'sameAge',
      undefined, // 커리큘럼 미지정
    ]);
  });

  it('어느 커리큘럼도 쓰지 않는 블록은 사용 빈도와 무관하게 마지막이다', () => {
    const groups = blockGroupsForCurriculum(slice, OWN, 'skill');
    const last = groups[groups.length - 1];

    expect(last.curriculum).toBeNull();
    expect(last.blocks.map((b) => b.id)).toEqual(['b-loose']);
  });

  it('여러 커리큘럼이 같은 블록을 쓰면 가장 가까운 쪽에만 한 번 나온다', () => {
    const shared = {
      ...slice,
      sessionTemplates: [
        template('t-own', 'own', ['b-shared']),
        template('t-same-track', 'sameTrack', ['b-shared']),
      ],
      trainingBlocks: [block('b-shared', 3)],
    };

    const groups = blockGroupsForCurriculum(shared, OWN, 'skill');
    const appearances = groups.flatMap((g) => g.blocks).filter((b) => b.id === 'b-shared');

    expect(appearances).toHaveLength(1);
    expect(groups[0].curriculum?.id).toBe('own');
  });

  it('승인 대기 블록과 대기 세션은 라이브러리에 오르지 않는다', () => {
    const pending = {
      curricula: [OWN],
      sessionTemplates: [
        template('t-own', 'own', ['b-published']),
        // 대기 중인 세션이 요구하는 블록은 "이 반의 커리큘럼" 그룹에 들어가면 안 된다.
        template('t-pending', 'own', ['b-published2'], 'pending'),
      ],
      trainingBlocks: [
        block('b-published', 1),
        block('b-published2', 2),
        block('b-pending', 99, 'skill', 'pending'),
      ],
    };

    const groups = blockGroupsForCurriculum(pending, OWN, 'skill');
    const ids = groups.flatMap((g) => g.blocks.map((b) => b.id));

    expect(ids).not.toContain('b-pending');
    expect(groups[0].blocks.map((b) => b.id)).toEqual(['b-published']);
  });

  it('커리큘럼이 없는 클래스는 빈 화면이 아니라 전체 목록을 받는다', () => {
    const groups = blockGroupsForCurriculum(slice, null, 'skill');

    expect(groups).toHaveLength(1);
    expect(groups[0].blocks.map((b) => b.id)).toEqual([
      'b-loose',
      'b-age',
      'b-track',
      'b-own-high',
      'b-own-low',
    ]);
  });
});

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------

/** Mondays and Wednesdays. 2026-09-14 is a Monday, 2026-09-15 a Tuesday. */
const CLS: Class = {
  id: 'cls-1',
  academyId: 'aca-1',
  title: 'U9 챌린저반',
  coachId: 'coach-1',
  schedule: { days: [1, 3], startTime: '17:00', durationMin: 55 },
  ageGroup: 'U9',
  capacity: 14,
  venue: '본원 A구장',
  curriculumId: 'own',
};

const MONDAY: ISODate = '2026-09-14';
const TUESDAY: ISODate = '2026-09-15';

const plan = (date: ISODate, overrides: Partial<SessionPlan> = {}): SessionPlan => ({
  id: 'plan-1',
  academyId: 'aca-1',
  classId: 'cls-1',
  coachId: 'coach-1',
  date,
  items: [{ category: 'warmup', blockId: 'b-1', durationMin: null }],
  templateId: null,
  createdAt: '2026-09-01T00:00:00Z',
  status: 'scheduled',
  ...overrides,
});

const log = (date: ISODate): AttendanceLog => ({
  id: 'log-1',
  academyId: 'aca-1',
  studentId: 'stu-1',
  classId: 'cls-1',
  date,
  status: 'present',
  tags: [],
  coachComment: '',
});

describe('달력 칸 상태', () => {
  it('수업이 없는 요일은 off — 채워야 할 빈칸이 아니다', () => {
    expect(scheduleStateFor(CLS, [], [], TUESDAY)).toBe('off');
  });

  it('수업일에 설계가 없으면 미등록이다', () => {
    expect(scheduleStateFor(CLS, [], [], MONDAY)).toBe('unplanned');
  });

  it('블록이 담긴 설계가 있으면 등록이다', () => {
    expect(scheduleStateFor(CLS, [plan(MONDAY)], [], MONDAY)).toBe('scheduled');
  });

  it('블록이 하나도 없는 설계는 등록으로 세지 않는다', () => {
    const empty = plan(MONDAY, { items: [] });

    expect(scheduleStateFor(CLS, [empty], [], MONDAY)).toBe('unplanned');
  });

  it('학부모 발송까지 끝나 completed로 표시된 설계는 완료다', () => {
    const done = plan(MONDAY, { status: 'completed' });

    expect(scheduleStateFor(CLS, [done], [], MONDAY)).toBe('completed');
  });

  it('설계가 없어도 출결 기록이 있으면 완료다', () => {
    // 임포트한 과거 이력, 혹은 이 화면이 생기기 전에 기록된 수업. 실제로
    // 진행된 수업을 "미등록"으로 칠하면 코치가 같은 날을 다시 기록하게 된다.
    expect(scheduleStateFor(CLS, [], [log(MONDAY)], MONDAY)).toBe('completed');
  });

  it('다른 반의 출결은 이 반의 칸을 바꾸지 않는다', () => {
    const other = { ...log(MONDAY), classId: 'cls-2' };

    expect(scheduleStateFor(CLS, [], [other], MONDAY)).toBe('unplanned');
  });
});
