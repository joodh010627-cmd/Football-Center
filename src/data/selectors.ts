/**
 * Read-side joins over the flat entity tables.
 *
 * Kept as pure functions taking the whole state so they can be lifted into
 * SQL views or Supabase RPCs later without touching component code.
 */

import type {
  Ability,
  AgeGroup,
  AttendanceLog,
  ChurnSignal,
  Class,
  ClassFinance,
  ClassPerformance,
  Coach,
  DashboardKpis,
  ID,
  ISODate,
  SessionItem,
  SessionPlan,
  SessionTemplate,
  Student,
  TrainingBlock,
} from '@/types';
import { AT_RISK_THRESHOLD } from './churn';
import { TODAY, diffDays, toISODate } from './dates';

/**
 * Owner-only figures, keyed by the id they belong to.
 *
 * These are maps rather than fields on the entities because the database
 * returns them from separate, owner-only tables. In a coach session every one
 * of these is `{}` — not because the UI hid them, but because the query came
 * back empty. Anything reading them must therefore tolerate a miss, which is
 * why `buildClassPerformance` and `buildKpis` are the only callers: both are
 * owner-side aggregates that a coach never renders.
 */
export interface OwnerFinancials {
  /** studentId → monthly tuition, KRW. */
  billing: Record<ID, number>;
  /** classId → cost & retention. */
  finances: Record<ID, ClassFinance>;
  /** coachId → the owner's 0–5 rating of that coach. */
  evaluations: Record<ID, number>;
}

export interface DataSlice extends OwnerFinancials {
  students: Student[];
  classes: Class[];
  coaches: Coach[];
  attendanceLogs: AttendanceLog[];
  trainingBlocks: TrainingBlock[];
  sessionPlans: SessionPlan[];
  sessionTemplates: SessionTemplate[];
  resolvedStudentIds: ID[];
}

/** Tuition for one student, or 0 when this session isn't allowed to see it. */
export const feeFor = (fin: OwnerFinancials, studentId: ID): number =>
  fin.billing[studentId] ?? 0;

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

/** Only what the owner has admitted to the library. Pending proposals never
 *  reach the builder — that is the whole point of the approval step. */
export const publishedBlocks = (blocks: TrainingBlock[]): TrainingBlock[] =>
  blocks.filter((b) => b.status === 'published');

export const publishedTemplates = (templates: SessionTemplate[]): SessionTemplate[] =>
  templates.filter((t) => t.status === 'published');

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
// Sessions
// ---------------------------------------------------------------------------

/**
 * Sessions a coach can pick, for one ability (or all), suited to an age group.
 *
 * The centre's own sessions come first — they are the ones the owner chose to
 * write down — then the standard library. Within each, most-used first, so the
 * session a class keeps coming back to is at the top without anyone curating.
 */
export function sessionsFor(
  templates: SessionTemplate[],
  ability: Ability | 'all',
  ageGroup?: AgeGroup,
): SessionTemplate[] {
  return publishedTemplates(templates)
    .filter((t) => ability === 'all' || t.ability === ability)
    .filter((t) => !ageGroup || t.ageGroups.length === 0 || t.ageGroups.includes(ageGroup))
    .sort(
      (a, b) =>
        Number(a.source === 'standard') - Number(b.source === 'standard') ||
        b.usageCount - a.usageCount,
    );
}

/** Blocks for the add-a-block list, same ordering rule as `sessionsFor`. */
export function blocksFor(
  blocks: TrainingBlock[],
  ability: Ability | 'all',
  ageGroup?: AgeGroup,
): TrainingBlock[] {
  return publishedBlocks(blocks)
    .filter((b) => ability === 'all' || b.ability === ability)
    .filter((b) => !ageGroup || b.ageGroups.length === 0 || b.ageGroups.includes(ageGroup))
    .sort(
      (a, b) =>
        Number(a.source === 'standard') - Number(b.source === 'standard') ||
        b.usageCount - a.usageCount,
    );
}

/** A class's sessions that have already happened, newest first. */
export function pastSessions(
  slice: Pick<DataSlice, 'sessionPlans' | 'attendanceLogs'>,
  cls: Class,
  asOf: ISODate = TODAY,
  limit = 6,
): Array<{
  date: ISODate;
  plan: SessionPlan | null;
  present: number;
  total: number;
}> {
  const dates = new Set<ISODate>();
  for (const p of slice.sessionPlans) if (p.classId === cls.id && p.date < asOf) dates.add(p.date);
  for (const l of slice.attendanceLogs)
    if (l.classId === cls.id && l.date < asOf) dates.add(l.date);

  return [...dates]
    .sort((a, b) => (a < b ? 1 : -1))
    .slice(0, limit)
    .map((date) => {
      const logs = slice.attendanceLogs.filter((l) => l.classId === cls.id && l.date === date);
      return {
        date,
        plan: planFor(slice.sessionPlans, cls.id, date),
        present: logs.filter((l) => l.status === 'present').length,
        total: logs.length,
      };
    });
}

/** The next day this class meets, today included. */
export function nextMeeting(cls: Class, from: ISODate = TODAY): ISODate | null {
  const offset = daysUntilNextSession(cls, from);
  if (offset === null) return null;
  const d = new Date(`${from}T00:00:00`);
  d.setDate(d.getDate() + offset);
  return toISODate(d);
}

// ---------------------------------------------------------------------------
// Session plans & the calendar
// ---------------------------------------------------------------------------

/** Minutes a composition takes, using each block's own default unless overridden. */
export function sessionDuration(items: SessionItem[], blocks: Map<ID, TrainingBlock>): number {
  return items.reduce((sum, item) => {
    if (item.durationMin !== null) return sum + item.durationMin;
    return sum + (item.blockId ? (blocks.get(item.blockId)?.durationMin ?? 0) : 0);
  }, 0);
}

export const planFor = (plans: SessionPlan[], classId: ID, date: ISODate): SessionPlan | null =>
  plans.find((p) => p.classId === classId && p.date === date) ?? null;

export function meetsOn(cls: Class, date: ISODate): boolean {
  const day = new Date(`${date}T00:00:00`).getDay();
  return cls.schedule.days.includes(day as Class['schedule']['days'][number]);
}

// ---------------------------------------------------------------------------
// Approval queue
// ---------------------------------------------------------------------------

export interface Proposal {
  kind: 'template' | 'block';
  id: ID;
  title: string;
  proposedBy: ID | null;
  createdAt: string;
  template?: SessionTemplate;
  block?: TrainingBlock;
}

/** Everything waiting on the owner, oldest first — a queue, not a feed. */
export function buildProposalQueue(
  slice: Pick<DataSlice, 'sessionTemplates' | 'trainingBlocks'>,
): Proposal[] {
  const templates: Proposal[] = slice.sessionTemplates
    .filter((t) => t.status === 'pending')
    .map((t) => ({
      kind: 'template' as const,
      id: t.id,
      title: t.title,
      proposedBy: t.proposedBy,
      createdAt: t.createdAt,
      template: t,
    }));

  const blocks: Proposal[] = slice.trainingBlocks
    .filter((b) => b.status === 'pending')
    .map((b) => ({
      kind: 'block' as const,
      id: b.id,
      title: b.title,
      proposedBy: b.proposedBy,
      // Blocks carry no created_at in the app type; the queue only needs a
      // stable sort key, and an empty string sorts them after dated templates.
      createdAt: '',
      block: b,
    }));

  return [...templates, ...blocks].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
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

    const monthlyRevenue = roster.reduce((sum, s) => sum + feeFor(slice, s.id), 0);
    const finance = slice.finances[cls.id];
    const monthlyCost = finance?.monthlyCost ?? 0;
    const contributionMargin = monthlyRevenue - monthlyCost;

    return {
      classId: cls.id,
      title: cls.title,
      coachName: coach?.name ?? '미배정',
      headcount: roster.filter((s) => s.status !== 'inactive').length,
      capacity: cls.capacity,
      retentionRate: finance?.retentionRate ?? 0,
      monthlyRevenue,
      monthlyCost,
      contributionMargin,
      marginRate: monthlyRevenue > 0 ? contributionMargin / monthlyRevenue : 0,
      attendanceRate: attendanceRateForClass(slice.attendanceLogs, cls.id, asOf),
      coachSatisfaction: slice.evaluations[cls.coachId] ?? 0,
      atRiskCount: roster.filter((s) => s.status === 'at_risk').length,
    };
  });
}

export function buildKpis(slice: DataSlice, asOf: ISODate = TODAY): DashboardKpis {
  const active = slice.students.filter((s) => s.status === 'active');
  const atRisk = slice.students.filter((s) => s.status === 'at_risk');
  const perf = buildClassPerformance(slice, asOf);

  // Rolled up from the per-class figures rather than re-summed from the raw
  // tables, so the KPI strip and the class table can never disagree.
  const monthlyRevenue = perf.reduce((sum, p) => sum + p.monthlyRevenue, 0);
  const monthlyCost = perf.reduce((sum, p) => sum + p.monthlyCost, 0);

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
  /**
   * Share of planned days that ran a named session (standard or the centre's
   * own) rather than blocks assembled by hand. A session carries a goal; a
   * hand-assembled list does not, and a parent report without a goal is a
   * list of drills.
   */
  templateAdherenceRate: number;
  categoryMix: Record<TrainingBlock['category'], number>;
}

export function buildCoachPortfolio(slice: DataSlice, coachId: ID): CoachPortfolio {
  const blockMap = byId(slice.trainingBlocks);
  const templateMap = byId(slice.sessionTemplates);
  const plans = slice.sessionPlans.filter((p) => p.coachId === coachId);

  const counts = new Map<ID, number>();
  const categoryMix: Record<TrainingBlock['category'], number> = { warmup: 0, skill: 0, game: 0 };
  let coreHits = 0;
  let totalSlots = 0;
  let onCurriculum = 0;

  for (const plan of plans) {
    for (const item of plan.items) {
      if (!item.blockId) continue;
      const block = blockMap.get(item.blockId);
      if (!block) continue;
      counts.set(item.blockId, (counts.get(item.blockId) ?? 0) + 1);
      categoryMix[block.category] += 1;
      totalSlots += 1;
      if (block.isCoreCurriculum) coreHits += 1;
    }

    if (plan.templateId && templateMap.has(plan.templateId)) onCurriculum += 1;
  }

  return {
    sessionCount: plans.length,
    blockUsage: [...counts.entries()]
      .map(([blockId, count]) => ({ block: blockMap.get(blockId)!, count }))
      .sort((a, b) => b.count - a.count),
    coreCurriculumRate: totalSlots > 0 ? coreHits / totalSlots : 0,
    templateAdherenceRate: plans.length > 0 ? onCurriculum / plans.length : 0,
    categoryMix,
  };
}
