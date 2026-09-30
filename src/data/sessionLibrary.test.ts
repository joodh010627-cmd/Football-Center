/**
 * The standard library is data a coach will run on a pitch, so the rules it is
 * held to are the ones that would embarrass us in front of a class: a session
 * pointing at a block that doesn't exist, an ability with nothing in it, a
 * session that doesn't fit in an hour.
 */

import { describe, expect, it } from 'vitest';
import type { SessionTemplate } from '@/types';
import { STANDARD_BLOCKS, STANDARD_SESSIONS, isStandardId } from './sessionLibrary';
import { sessionsFor } from './selectors';
import { fromSessionPlan, toSessionPlan } from './mappers';
import { AXES } from '@/lib/axes';

const blockIds = new Set(STANDARD_BLOCKS.map((b) => b.id));

describe('표준 세션 라이브러리', () => {
  it('모든 세션의 블록이 실제로 존재한다', () => {
    for (const s of STANDARD_SESSIONS) {
      for (const id of s.blockIds) expect(blockIds.has(id), `${s.id} → ${id}`).toBe(true);
    }
  });

  it('다섯 능력 모두에 세션이 있다', () => {
    for (const axis of AXES) {
      expect(
        STANDARD_SESSIONS.some((s) => s.ability === axis),
        axis,
      ).toBe(true);
    }
  });

  it('세션은 한 시간 안에 끝난다', () => {
    const minutes = new Map(STANDARD_BLOCKS.map((b) => [b.id, b.durationMin]));
    for (const s of STANDARD_SESSIONS) {
      const total = s.blockIds.reduce((sum, id) => sum + (minutes.get(id) ?? 0), 0);
      expect(total, s.id).toBeLessThanOrEqual(60);
      expect(total, s.id).toBeGreaterThanOrEqual(40);
    }
  });

  it('id는 겹치지 않고 전부 std- 로 시작한다', () => {
    const all = [...STANDARD_BLOCKS, ...STANDARD_SESSIONS].map((x) => x.id);
    expect(new Set(all).size).toBe(all.length);
    expect(all.every(isStandardId)).toBe(true);
  });
});

describe('세션 고르기 목록', () => {
  const center: SessionTemplate = {
    ...STANDARD_SESSIONS[0],
    id: '00000000-0000-0000-0000-000000000001',
    source: 'center',
    usageCount: 0,
  };

  it('센터 세션이 표준보다 먼저 나온다', () => {
    const list = sessionsFor([...STANDARD_SESSIONS, center], 'technical');
    expect(list[0].id).toBe(center.id);
  });

  it('능력 필터와 연령 필터가 적용된다', () => {
    const list = sessionsFor(STANDARD_SESSIONS, 'tactical', 'U7');
    expect(list.every((s) => s.ability === 'tactical')).toBe(true);
    // 전술 세션은 U9 이상만 — U7 반에는 권하지 않는다.
    expect(list).toHaveLength(0);
  });

  it('승인 대기 세션은 나오지 않는다', () => {
    const pending = { ...center, status: 'pending' as const };
    expect(sessionsFor([pending], 'all')).toHaveLength(0);
  });
});

describe('수업 계획 저장 형식', () => {
  const plan = {
    id: 'p1',
    academyId: 'a1',
    classId: 'c1',
    coachId: 'k1',
    date: '2026-09-28',
    items: [],
    templateId: 'std-s-pass',
    createdAt: '',
    status: 'scheduled' as const,
  };

  it('표준 세션 키는 template_id(uuid FK)가 아니라 session_key 에 저장된다', () => {
    const row = fromSessionPlan(plan);
    expect(row.template_id).toBeNull();
    expect(row.session_key).toBe('std-s-pass');
    expect(toSessionPlan(row).templateId).toBe('std-s-pass');
  });

  it('0007 이전 행은 template_id 로 읽는다', () => {
    const legacy = {
      ...fromSessionPlan({ ...plan, templateId: 'uuid-1' }),
      session_key: undefined,
    };
    expect(toSessionPlan(legacy).templateId).toBe('uuid-1');
  });
});
