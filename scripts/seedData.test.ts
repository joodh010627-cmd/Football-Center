/**
 * Invariants of the demo dataset.
 *
 * The demo is not a fixture, it is the thing a prospect sees — and the calendar
 * is now the first screen a coach lands on, so a month that seeds wrong is a
 * broken sales call rather than a broken test. These assertions cover the
 * properties that are easy to break while editing the seed by hand and
 * impossible to notice by reading it.
 */

import { describe, expect, it } from 'vitest';
import {
  TODAY,
  classes,
  curricula,
  diffDays,
  sessionPlans,
  sessionTemplates,
  trainingBlocks,
} from './seedData';

const published = sessionTemplates.filter((t) => t.status === 'published');
const blockIds = new Set(trainingBlocks.map((b) => b.id));
const curriculumIds = new Set(curricula.map((c) => c.id));

describe('커리큘럼 시드', () => {
  it('모든 클래스가 존재하는 커리큘럼을 가리킨다', () => {
    for (const cls of classes) {
      expect(curriculumIds, `${cls.title}`).toContain(cls.curriculumId);
    }
  });

  it('클래스의 나이대와 커리큘럼의 나이대가 일치한다', () => {
    const byId = new Map(curricula.map((c) => [c.id, c]));

    for (const cls of classes) {
      expect(byId.get(cls.curriculumId)!.ageGroup, `${cls.title}`).toBe(cls.ageGroup);
    }
  });

  it('모든 표준 세션이 실제로 존재하는 블록만 참조한다', () => {
    // 여기서 깨지면 데모 화면에 "삭제된 블록"이 뜬다.
    for (const template of sessionTemplates) {
      for (const id of template.blockIds) {
        expect(blockIds, `${template.title}`).toContain(id);
      }
    }
  });

  it('모든 커리큘럼에 등재된 표준 세션이 하나 이상 있다', () => {
    for (const curriculum of curricula) {
      const owned = published.filter((t) => t.curriculumId === curriculum.id);
      expect(owned.length, `${curriculum.title}`).toBeGreaterThan(0);
    }
  });

  it('3블록이 아닌 표준 세션이 섞여 있다 — 자유 구성이 실제로 쓰인다', () => {
    // 이 데모의 존재 이유 중 하나. 전부 3블록이면 고정 슬롯 스키마로 되돌려도
    // 아무도 눈치채지 못한다.
    const sizes = new Set(published.map((t) => t.blockIds.length));

    expect(sizes.size).toBeGreaterThan(1);
    expect([...sizes].some((n) => n !== 3)).toBe(true);
  });

  it('미니게임으로 시작하거나 미니게임만 두 번 하는 세션이 있다', () => {
    const categoryOf = new Map(trainingBlocks.map((b) => [b.id, b.category]));
    const shapes = published.map((t) => t.blockIds.map((id) => categoryOf.get(id)!));

    const gameBeforeSkill = shapes.some((shape) => {
      const firstGame = shape.indexOf('game');
      const firstSkill = shape.indexOf('skill');
      return firstGame !== -1 && firstSkill !== -1 && firstGame < firstSkill;
    });
    const gamesOnly = shapes.some(
      (shape) => shape.filter((c) => c === 'game').length >= 2 && !shape.includes('skill'),
    );

    expect(gameBeforeSkill).toBe(true);
    expect(gamesOnly).toBe(true);
  });

  it('대표 승인 대기 중인 코치 제안이 세션과 블록 양쪽에 있다', () => {
    expect(sessionTemplates.filter((t) => t.status === 'pending').length).toBeGreaterThan(0);
    expect(trainingBlocks.filter((b) => b.status === 'pending').length).toBeGreaterThan(0);
  });

  it('승인 대기 행에는 제안자가 있고 사용 횟수가 0이다', () => {
    // RLS의 coach-propose 정책이 강제하는 조건과 같다. 시드가 이를 어기면
    // 데모 데이터는 실제 앱이 만들 수 없는 행을 담게 된다.
    for (const t of sessionTemplates.filter((t) => t.status === 'pending')) {
      expect(t.proposedBy).not.toBeNull();
      expect(t.usageCount).toBe(0);
    }
    for (const b of trainingBlocks.filter((b) => b.status === 'pending')) {
      expect(b.proposedBy).not.toBeNull();
      expect(b.usageCount).toBe(0);
      expect(b.isCoreCurriculum).toBe(false);
    }
  });
});

describe('달력 시드', () => {
  it('한 클래스의 한 날짜에 설계는 하나다', () => {
    // session_plans의 고유 인덱스 (class_id, date)와 같은 조건. 어기면 시더가
    // 중간에 죽는다.
    const keys = sessionPlans.map((p) => `${p.classId}|${p.date}`);

    expect(new Set(keys).size).toBe(keys.length);
  });

  it('설계는 해당 클래스가 실제로 모이는 요일에만 있다', () => {
    const byId = new Map(classes.map((c) => [c.id, c]));

    for (const plan of sessionPlans) {
      const day = new Date(`${plan.date}T00:00:00`).getDay();
      expect(byId.get(plan.classId)!.schedule.days, plan.date).toContain(day);
    }
  });

  it('과거 수업은 완료, 예정 수업은 등록 상태다', () => {
    for (const plan of sessionPlans) {
      const past = diffDays(TODAY, plan.date) > 0;
      expect(plan.status, plan.date).toBe(past ? 'completed' : 'scheduled');
    }
  });

  it('앞으로의 모든 수업을 미리 채우지 않는다 — 미등록 칸이 남아야 한다', () => {
    // 달력 화면의 존재 이유가 "아직 아무도 설계하지 않은 수업"을 드러내는
    // 것이므로, 미래가 전부 등록돼 있으면 데모에서 그 상태를 볼 수가 없다.
    const scheduledAhead = sessionPlans.filter((p) => diffDays(TODAY, p.date) <= 0);
    const perClass = new Map<string, number>();
    for (const p of scheduledAhead) {
      perClass.set(p.classId, (perClass.get(p.classId) ?? 0) + 1);
    }

    for (const cls of classes) {
      expect(perClass.get(cls.id) ?? 0, cls.title).toBeLessThanOrEqual(2);
    }
  });

  it('설계의 모든 항목이 존재하는 블록을 가리키고 카테고리가 일치한다', () => {
    const categoryOf = new Map(trainingBlocks.map((b) => [b.id, b.category]));

    for (const plan of sessionPlans) {
      expect(plan.items.length, plan.id).toBeGreaterThan(0);
      for (const item of plan.items) {
        expect(blockIds, plan.id).toContain(item.blockId);
        expect(item.category).toBe(categoryOf.get(item.blockId));
      }
    }
  });

  it('표준 세션을 그대로 쓴 설계와 코치가 바꾼 설계가 모두 있다', () => {
    // 둘 중 하나만 있으면 대표 대시보드의 준수율이 0% 또는 100% 고정이 되고,
    // 그 숫자는 아무것도 말해주지 않는다.
    expect(sessionPlans.some((p) => p.templateId !== null)).toBe(true);
    expect(sessionPlans.some((p) => p.templateId === null)).toBe(true);
  });

  it('templateId가 붙은 설계는 그 표준 세션의 블록 구성과 정확히 같다', () => {
    const byId = new Map(sessionTemplates.map((t) => [t.id, t]));

    for (const plan of sessionPlans) {
      if (!plan.templateId) continue;
      const template = byId.get(plan.templateId)!;
      expect(plan.items.map((i) => i.blockId), plan.id).toEqual(template.blockIds);
    }
  });

  it('승인 대기 세션은 어떤 설계에도 연결되지 않는다', () => {
    const pending = new Set(
      sessionTemplates.filter((t) => t.status !== 'published').map((t) => t.id),
    );

    for (const plan of sessionPlans) {
      if (plan.templateId) expect(pending).not.toContain(plan.templateId);
    }
  });
});
