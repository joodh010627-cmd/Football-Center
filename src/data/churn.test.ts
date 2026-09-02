/**
 * The cold-start contract.
 *
 * An imported roster arrives with no attendance history at all. The engine used
 * to score it anyway — the parent-contact axis saturates on a null and every
 * student came out around 15 points, which a dashboard renders as "이탈 위험
 * 0명". That reads as *safe* when it actually means *unknown*, and it is the
 * more dangerous of the two mistakes: the owner concludes the product works,
 * acts on nothing, and loses the students it was bought to keep.
 */

import { describe, expect, it } from 'vitest';
import type { AttendanceLog, ISODate, Student } from '@/types';
import { AT_RISK_THRESHOLD, computeChurnSignal, deriveStatus } from './churn';

const ASOF: ISODate = '2026-09-02';

function student(overrides: Partial<Student> = {}): Student {
  return {
    id: 'stu-1',
    academyId: 'aca-1',
    name: '김서준',
    ageGroup: 'U9',
    status: 'active',
    lastAttendanceDate: null,
    churnScore: 0,
    classId: 'cls-1',
    parentName: '김철수',
    parentPhone: '010-1234-5678',
    enrolledAt: '2024-03-04',
    lastParentContactDate: null,
    ...overrides,
  };
}

const presentOn = (dates: ISODate[]): AttendanceLog[] =>
  dates.map((date, i) => ({
    id: `log-${i}`,
    academyId: 'aca-1',
    studentId: 'stu-1',
    classId: 'cls-1',
    date,
    status: 'present',
    tags: [],
    coachComment: '',
  }));

describe('콜드 스타트 — 임포트 직후', () => {
  it('출결 이력이 없으면 점수를 산출하지 않는다', () => {
    const signal = computeChurnSignal({ student: student(), logs: [], asOf: ASOF });

    expect(signal.computable).toBe(false);
    expect(signal.reasons.join(' ')).toContain('3주');
  });

  it('이력이 없는 원생을 휴원으로 분류하지 않는다', () => {
    // 등록일을 최근출석일로 채우던 시절의 버그: 2년 전 등록한 원생이
    // 임포트하자마자 전원 '휴원'으로 떨어졌다.
    const signal = computeChurnSignal({ student: student(), logs: [], asOf: ASOF });
    expect(deriveStatus(signal)).toBe('active');
  });

  it('산출 불가를 위험 없음(0점)과 구분한다', () => {
    const cold = computeChurnSignal({ student: student(), logs: [], asOf: ASOF });
    const healthy = computeChurnSignal({
      student: student({ lastAttendanceDate: '2026-09-01', lastParentContactDate: '2026-09-01' }),
      logs: presentOn(['2026-08-25', '2026-08-27', '2026-09-01']),
      asOf: ASOF,
    });

    // 둘 다 경보에 뜨지 않지만 이유가 정반대다. 화면은 이 둘을 같게 그리면 안 된다.
    expect(cold.computable).toBe(false);
    expect(healthy.computable).toBe(true);
    expect(healthy.score).toBeLessThan(AT_RISK_THRESHOLD);
  });
});

describe('이력이 쌓인 뒤', () => {
  it('2주 미출석만으로 경보 기준을 넘는다', () => {
    const signal = computeChurnSignal({
      student: student({ lastAttendanceDate: '2026-08-19', lastParentContactDate: '2026-08-19' }),
      logs: presentOn(['2026-08-19']),
      asOf: ASOF,
    });

    expect(signal.computable).toBe(true);
    expect(signal.score).toBeGreaterThanOrEqual(AT_RISK_THRESHOLD);
    expect(signal.reasons.join(' ')).toContain('미출석');
  });

  it('30일 이상 미출석은 위험군이 아니라 휴원이다', () => {
    const signal = computeChurnSignal({
      student: student({ lastAttendanceDate: '2026-07-01' }),
      logs: presentOn(['2026-07-01']),
      asOf: ASOF,
    });

    expect(deriveStatus(signal)).toBe('inactive');
  });

  it('점수에는 항상 근거 문장이 붙는다', () => {
    const signal = computeChurnSignal({
      student: student({ lastAttendanceDate: '2026-08-19' }),
      logs: presentOn(['2026-08-19']),
      asOf: ASOF,
    });

    // 대표가 숫자를 의심하지 않고 바로 전화를 걸 수 있어야 한다.
    expect(signal.reasons.length).toBeGreaterThan(0);
    expect(signal.reasons.every((r) => r.trim().length > 0)).toBe(true);
  });
});
