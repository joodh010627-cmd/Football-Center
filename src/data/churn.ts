/**
 * Churn Risk Alert Engine.
 *
 * Turns raw attendance history into a 0–100 score plus the human-readable
 * reasons behind it. Every point of score traces back to an observable fact,
 * so the owner can act on the alert without second-guessing the number.
 */

import type { AttendanceLog, ChurnSignal, ID, ISODate, Student, StudentStatus } from '@/types';
import { TODAY, diffDays } from './dates';

/** Weights sum to 100. Tuned so a 2-week no-show alone clears the alert bar. */
const WEIGHTS = {
  recency: 45,
  absenceRate: 30,
  parentContact: 15,
  tenure: 10,
} as const;

/** Score at or above this lands the student on the Red Alert list. */
export const AT_RISK_THRESHOLD = 55;
export const CRITICAL_THRESHOLD = 78;

const ABSENCE_WINDOW_DAYS = 30;

export interface ChurnInput {
  student: Student;
  logs: AttendanceLog[];
  /** Defaults to today; injectable for tests. */
  asOf?: ISODate;
}

/** What a student with no attendance history yet gets — an honest blank. */
function insufficientData(studentId: ID): ChurnSignal {
  return {
    studentId,
    score: 0,
    daysSinceLastAttendance: 0,
    absenceRateLast30d: 0,
    daysSinceParentContact: 0,
    reasons: ['출결 기록이 쌓이면 산출됩니다 (약 3주)'],
    severity: 'watch',
    computable: false,
  };
}

export function computeChurnSignal({ student, logs, asOf = TODAY }: ChurnInput): ChurnSignal {
  // A freshly imported roster has no attendance at all. Scoring it anyway would
  // put every student at ~15 points (the parent-contact axis saturates on a
  // null), which reads as "everyone is fine" on a dashboard that cannot yet
  // know anything. Refuse to produce a number instead.
  if (!student.lastAttendanceDate) return insufficientData(student.id);

  const daysSinceLastAttendance = Math.max(0, diffDays(asOf, student.lastAttendanceDate));

  const recentLogs = logs.filter(
    (l) => l.studentId === student.id && diffDays(asOf, l.date) <= ABSENCE_WINDOW_DAYS,
  );
  const absences = recentLogs.filter((l) => l.status === 'absent').length;
  const absenceRateLast30d = recentLogs.length > 0 ? absences / recentLogs.length : 0;

  const daysSinceParentContact = student.lastParentContactDate
    ? Math.max(0, diffDays(asOf, student.lastParentContactDate))
    : 60;

  const tenureDays = Math.max(1, diffDays(asOf, student.enrolledAt));

  const reasons: string[] = [];

  // --- 1. Recency: silence is the loudest signal --------------------------
  // 14 days with no show-up saturates this component.
  const recencyRatio = Math.min(1, daysSinceLastAttendance / 14);
  const recencyPoints = recencyRatio * WEIGHTS.recency;
  if (daysSinceLastAttendance >= 14) {
    reasons.push(`${daysSinceLastAttendance}일째 미출석 (2주 초과)`);
  } else if (daysSinceLastAttendance >= 7) {
    reasons.push(`${daysSinceLastAttendance}일째 미출석`);
  }

  // --- 2. Absence rate: the slow fade -------------------------------------
  // 50% absence over the window saturates.
  const absencePoints = Math.min(1, absenceRateLast30d / 0.5) * WEIGHTS.absenceRate;
  if (absenceRateLast30d >= 0.4) {
    reasons.push(`최근 30일 결석률 ${Math.round(absenceRateLast30d * 100)}%`);
  } else if (absenceRateLast30d >= 0.25) {
    reasons.push(`결석 빈도 증가 (${absences}회/${recentLogs.length}회)`);
  }

  // --- 3. Parent contact gap: the coach stopped reporting -----------------
  const contactPoints = Math.min(1, daysSinceParentContact / 21) * WEIGHTS.parentContact;
  if (daysSinceParentContact >= 21) {
    reasons.push(`학부모 피드백 ${daysSinceParentContact}일 지연`);
  } else if (daysSinceParentContact >= 14) {
    reasons.push(`피드백 주기 지연 (${daysSinceParentContact}일)`);
  }

  // --- 4. Tenure: new students churn far more easily ----------------------
  // Under ~3 months is the fragile window; past 6 months this goes to zero.
  const tenurePoints = Math.max(0, 1 - tenureDays / 180) * WEIGHTS.tenure;
  if (tenureDays <= 90) {
    reasons.push(`등록 ${Math.round(tenureDays / 30)}개월차 — 정착 초기`);
  }

  const score = Math.round(
    Math.min(100, recencyPoints + absencePoints + contactPoints + tenurePoints),
  );

  if (reasons.length === 0) reasons.push('출석 패턴 안정적');

  return {
    studentId: student.id,
    score,
    daysSinceLastAttendance,
    absenceRateLast30d,
    daysSinceParentContact,
    reasons,
    severity: score >= CRITICAL_THRESHOLD ? 'critical' : score >= AT_RISK_THRESHOLD ? 'high' : 'watch',
    computable: true,
  };
}

/** A student who hasn't attended in 30+ days is treated as dormant, not at-risk. */
const INACTIVE_AFTER_DAYS = 30;

export function deriveStatus(signal: ChurnSignal): StudentStatus {
  // No history is not the same as a long absence. An imported roster must not
  // land in the dashboard as 100 dormant students on its first day.
  if (!signal.computable) return 'active';
  if (signal.daysSinceLastAttendance >= INACTIVE_AFTER_DAYS) return 'inactive';
  return signal.score >= AT_RISK_THRESHOLD ? 'at_risk' : 'active';
}

/**
 * Recomputes `churnScore` + `status` for every student.
 *
 * `resolvedStudentIds` are students the owner has already actioned — they keep
 * their score (the underlying facts haven't changed) but drop off the alert
 * list so the queue stays workable.
 */
export function rescoreStudents(
  students: Student[],
  logs: AttendanceLog[],
  asOf: ISODate = TODAY,
): Student[] {
  return students.map((student) => {
    const signal = computeChurnSignal({ student, logs, asOf });
    return { ...student, churnScore: signal.score, status: deriveStatus(signal) };
  });
}

export function buildChurnSignals(
  students: Student[],
  logs: AttendanceLog[],
  asOf: ISODate = TODAY,
): Map<ID, ChurnSignal> {
  return new Map(
    students.map((student) => [student.id, computeChurnSignal({ student, logs, asOf })]),
  );
}
