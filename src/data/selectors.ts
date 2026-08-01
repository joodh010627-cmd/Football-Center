/**
 * Read-side joins over the flat entity tables.
 *
 * Kept as pure functions taking the whole state so they can be lifted into
 * SQL views or Supabase RPCs later without touching component code.
 */

import type {
  AttendanceLog,
  ChurnSignal,
  Class,
  ClassPerformance,
  Coach,
  DashboardKpis,
  ID,
  ISODate,
  SessionPlan,
  Student,
  TrainingBlock,
} from '@/types';
import { AT_RISK_THRESHOLD } from './churn';
import { TODAY, diffDays } from './mockData';

export interface DataSlice {
  students: Student[];
  classes: Class[];
  coaches: Coach[];
  attendanceLogs: AttendanceLog[];
  trainingBlocks: TrainingBlock[];
  sessionPlans: SessionPlan[];
  resolvedStudentIds: ID[];
}

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

export const byId = <T extends { id: ID }>(rows: T[]): Map<ID, T> =>
  new Map(rows.map((r) => [r.id, r]));

export const studentsInClass = (students: Student[], classId: ID): Student[] =>
  students.filter((s) => s.classId === classId);

export const classesForCoach = (classes: Class[], coachId: ID): Class[] =>
  classes.filter((c) => c.coachId === coachId);

export const blocksByCategory = (
  blocks: TrainingBlock[],
  category: TrainingBlock['category'],
): TrainingBlock[] => blocks.filter((b) => b.category === category);

/**
 * Days until this class next meets — 0 when it meets today.
 * Returns `null` if the class has no schedule at all.
 */
export function daysUntilNextSession(cls: Class, from: ISODate = TODAY): number | null {
  if (cls.schedule.days.length === 0) return null;
  const start = new Date(`${from}T00:00:00`);
  for (let offset = 0; offset < 7; offset++) {
    const d = new Date(start);
    d.setDate(d.getDate() + offset);
    if (cls.schedule.days.includes(d.getDay() as Class['schedule']['days'][number])) return offset;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------

const WINDOW_DAYS = 30;

export function attendanceRateForClass(
  logs: AttendanceLog[],
  classId: ID,
  asOf: ISODate = TODAY,
): number {
  const recent = logs.filter(
    (l) => l.classId === classId && diffDays(asOf, l.date) <= WINDOW_DAYS,
  );
  if (recent.length === 0) return 0;
  // Injured students are excused — counting them as absent would punish the
  // coach for an honest log and push them toward marking everyone present.
  const eligible = recent.filter((l) => l.status !== 'injured');
  if (eligible.length === 0) return 1;
  return eligible.filter((l) => l.status === 'present').length / eligible.length;
}

export function attendanceRateForStudent(
  logs: AttendanceLog[],
  studentId: ID,
  windowDays = WINDOW_DAYS,
  asOf: ISODate = TODAY,
): number {
  const recent = logs.filter(
    (l) => l.studentId === studentId && diffDays(asOf, l.date) <= windowDays,
  );
  if (recent.length === 0) return 0;
  return recent.filter((l) => l.status === 'present').length / recent.length;
}

export function logsForStudent(logs: AttendanceLog[], studentId: ID): AttendanceLog[] {
  return logs
    .filter((l) => l.studentId === studentId)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

/** Tag frequency for a student, most-used first — the growth report's backbone. */
export function tagFrequency(logs: AttendanceLog[], studentId: ID): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const log of logs) {
    if (log.studentId !== studentId) continue;
    for (const tag of log.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

/** Share of held sessions that actually got logged — the owner's process-compliance metric. */
export function logCoverageRate(
  logs: AttendanceLog[],
  students: Student[],
  asOf: ISODate = TODAY,
): number {
  const recent = logs.filter((l) => diffDays(asOf, l.date) <= WINDOW_DAYS);
  if (recent.length === 0 || students.length === 0) return 0;
  const tagged = recent.filter((l) => l.tags.length > 0 || l.coachComment.length > 0);
  return tagged.length / recent.length;
}

// ---------------------------------------------------------------------------
// Admin dashboard aggregates
// ---------------------------------------------------------------------------

export function buildClassPerformance(slice: DataSlice, asOf: ISODate = TODAY): ClassPerformance[] {
  const coachMap = byId(slice.coaches);

  return slice.classes.map((cls) => {
    const roster = studentsInClass(slice.students, cls.id);
    const coach = coachMap.get(cls.coachId);
    const contributionMargin = cls.monthlyRevenue - cls.monthlyCost;

    return {
      classId: cls.id,
      title: cls.title,
      coachName: coach?.name ?? '미배정',
      headcount: roster.filter((s) => s.status !== 'inactive').length,
      capacity: cls.capacity,
      retentionRate: cls.retentionRate,
      monthlyRevenue: cls.monthlyRevenue,
      monthlyCost: cls.monthlyCost,
      contributionMargin,
      marginRate: cls.monthlyRevenue > 0 ? contributionMargin / cls.monthlyRevenue : 0,
      attendanceRate: attendanceRateForClass(slice.attendanceLogs, cls.id, asOf),
      coachSatisfaction: coach?.satisfactionScore ?? 0,
      atRiskCount: roster.filter((s) => s.status === 'at_risk').length,
    };
  });
}

export function buildKpis(slice: DataSlice, asOf: ISODate = TODAY): DashboardKpis {
  const active = slice.students.filter((s) => s.status === 'active');
  const atRisk = slice.students.filter((s) => s.status === 'at_risk');
  const perf = buildClassPerformance(slice, asOf);

  const monthlyRevenue = slice.classes.reduce((sum, c) => sum + c.monthlyRevenue, 0);
  const monthlyCost = slice.classes.reduce((sum, c) => sum + c.monthlyCost, 0);

  const avg = (nums: number[]) => (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0);

  return {
    activeStudents: active.length,
    atRiskStudents: atRisk.length,
    monthlyRevenue,
    monthlyMargin: monthlyRevenue - monthlyCost,
    averageAttendanceRate: avg(perf.map((p) => p.attendanceRate)),
    averageRetentionRate: avg(perf.map((p) => p.retentionRate)),
    logCoverageRate: logCoverageRate(slice.attendanceLogs, slice.students, asOf),
  };
}

/** Red Alert queue: at-risk students the owner hasn't actioned yet, worst first. */
export function buildAlertQueue(
  slice: DataSlice,
  signals: Map<ID, ChurnSignal>,
): Array<{ student: Student; signal: ChurnSignal; className: string }> {
  const classMap = byId(slice.classes);
  const resolved = new Set(slice.resolvedStudentIds);

  return slice.students
    .filter((s) => !resolved.has(s.id))
    .filter((s) => s.churnScore >= AT_RISK_THRESHOLD)
    .map((student) => ({
      student,
      signal: signals.get(student.id)!,
      className: classMap.get(student.classId)?.title ?? '미배정',
    }))
    .sort((a, b) => b.signal.score - a.signal.score);
}

// ---------------------------------------------------------------------------
// Coach portfolio
// ---------------------------------------------------------------------------

export interface CoachPortfolio {
  sessionCount: number;
  blockUsage: Array<{ block: TrainingBlock; count: number }>;
  coreCurriculumRate: number;
  categoryMix: Record<TrainingBlock['category'], number>;
}

export function buildCoachPortfolio(slice: DataSlice, coachId: ID): CoachPortfolio {
  const blockMap = byId(slice.trainingBlocks);
  const plans = slice.sessionPlans.filter((p) => p.coachId === coachId);

  const counts = new Map<ID, number>();
  const categoryMix: Record<TrainingBlock['category'], number> = { warmup: 0, skill: 0, game: 0 };
  let coreHits = 0;
  let totalSlots = 0;

  for (const plan of plans) {
    for (const blockId of Object.values(plan.slots)) {
      if (!blockId) continue;
      const block = blockMap.get(blockId);
      if (!block) continue;
      counts.set(blockId, (counts.get(blockId) ?? 0) + 1);
      categoryMix[block.category] += 1;
      totalSlots += 1;
      if (block.isCoreCurriculum) coreHits += 1;
    }
  }

  return {
    sessionCount: plans.length,
    blockUsage: [...counts.entries()]
      .map(([blockId, count]) => ({ block: blockMap.get(blockId)!, count }))
      .sort((a, b) => b.count - a.count),
    coreCurriculumRate: totalSlots > 0 ? coreHits / totalSlots : 0,
    categoryMix,
  };
}
