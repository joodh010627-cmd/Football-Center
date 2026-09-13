/**
 * Read-side joins over the flat entity tables.
 *
 * Kept as pure functions taking the whole state so they can be lifted into
 * SQL views or Supabase RPCs later without touching component code.
 */

import type {
  AgeGroup,
  AttendanceLog,
  ChurnSignal,
  Class,
  ClassFinance,
  ClassPerformance,
  Coach,
  Curriculum,
  DashboardKpis,
  ID,
  ISODate,
  SessionItem,
  SessionPlan,
  SessionTemplate,
  Student,
  TrainingBlock,
  TrainingCategory,
} from '@/types';
import { AT_RISK_THRESHOLD } from './churn';
import { TODAY, diffDays, inMonth, monthGrid, type YearMonth } from './dates';

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
  curricula: Curriculum[];
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
// Curriculum
// ---------------------------------------------------------------------------

export const curriculumForClass = (
  curricula: Curriculum[],
  cls: Pick<Class, 'curriculumId'>,
): Curriculum | null => curricula.find((c) => c.id === cls.curriculumId) ?? null;

/** A curriculum's standard sessions, in the order a coach walks the cycle. */
export const templatesForCurriculum = (
  templates: SessionTemplate[],
  curriculumId: ID,
): SessionTemplate[] =>
  templates
    .filter((t) => t.curriculumId === curriculumId)
    .sort((a, b) => a.week - b.week || a.title.localeCompare(b.title, 'ko'));

/** Every block a curriculum's published sessions actually call for. */
export function blockIdsForCurriculum(
  templates: SessionTemplate[],
  curriculumId: ID,
): Set<ID> {
  const ids = new Set<ID>();
  for (const t of publishedTemplates(templates)) {
    if (t.curriculumId !== curriculumId) continue;
    for (const id of t.blockIds) ids.add(id);
  }
  return ids;
}

const AGE_ORDER: AgeGroup[] = ['U7', 'U9', 'U11', 'U13', 'U15'];

/**
 * How far one curriculum is from another. Lower is closer, 0 is itself.
 *
 * Track identity dominates age: a U9 in the weekend club is doing something
 * closer to a U11 weekend club than to the weekday U9 foundation track, because
 * the *purpose* of the session is what decides whether a drill transfers. Age
 * then breaks ties, one point per step up the ladder.
 */
export function curriculumDistance(a: Curriculum, b: Curriculum): number {
  const ageGap = Math.abs(AGE_ORDER.indexOf(a.ageGroup) - AGE_ORDER.indexOf(b.ageGroup));
  return (a.track === b.track ? 0 : 6) + ageGap;
}

/** The class's own curriculum first, then the rest by relatedness. */
export function relatedCurricula(curricula: Curriculum[], base: Curriculum): Curriculum[] {
  return curricula
    .filter((c) => c.id !== base.id)
    .sort(
      (x, y) =>
        curriculumDistance(base, x) - curriculumDistance(base, y) ||
        x.sortOrder - y.sortOrder,
    );
}

/** One group of library blocks, labelled by where they came from. */
export interface BlockGroup {
  /** `null` = blocks no published standard session calls for yet. */
  curriculum: Curriculum | null;
  /** 0 for the class's own curriculum. */
  rank: number;
  blocks: TrainingBlock[];
}

/**
 * The session builder's library, ordered the way the owner describes it:
 *
 *   1. the blocks this class's own curriculum prescribes, most-used first;
 *   2. then the next-most-related curriculum's blocks, most-used first;
 *   3. …and so on, with anything no curriculum has claimed last.
 *
 * A block claimed by several curricula is listed under the closest one only, so
 * scrolling never shows the same card twice.
 */
export function blockGroupsForCurriculum(
  slice: Pick<DataSlice, 'trainingBlocks' | 'curricula' | 'sessionTemplates'>,
  base: Curriculum | null,
  category: TrainingCategory,
): BlockGroup[] {
  const pool = publishedBlocks(slice.trainingBlocks).filter((b) => b.category === category);
  const byUsage = (a: TrainingBlock, b: TrainingBlock) => b.usageCount - a.usageCount;

  // No track assigned: there is no "related" to order by, so one flat list of
  // everything beats an empty screen with a filter on it.
  if (!base) return [{ curriculum: null, rank: 0, blocks: [...pool].sort(byUsage) }];

  const order = [base, ...relatedCurricula(slice.curricula, base)];
  const claimed = new Set<ID>();
  const groups: BlockGroup[] = [];

  order.forEach((curriculum, rank) => {
    const wanted = blockIdsForCurriculum(slice.sessionTemplates, curriculum.id);
    const blocks = pool
      .filter((b) => wanted.has(b.id) && !claimed.has(b.id))
      .sort(byUsage);
    if (blocks.length === 0) return;
    for (const b of blocks) claimed.add(b.id);
    groups.push({ curriculum, rank, blocks });
  });

  const unclaimed = pool.filter((b) => !claimed.has(b.id)).sort(byUsage);
  if (unclaimed.length > 0) {
    groups.push({ curriculum: null, rank: order.length, blocks: unclaimed });
  }

  return groups;
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

export const planFor = (
  plans: SessionPlan[],
  classId: ID,
  date: ISODate,
): SessionPlan | null => plans.find((p) => p.classId === classId && p.date === date) ?? null;

/**
 * What one calendar cell shows.
 *
 * `off` is not a state of a session, it is the absence of one — the class does
 * not meet that weekday. Keeping it in the same union is what stops the calendar
 * from rendering an inviting empty cell on a day nobody is coming.
 */
export type ScheduleState = 'off' | 'unplanned' | 'scheduled' | 'completed';

export function meetsOn(cls: Class, date: ISODate): boolean {
  const day = new Date(`${date}T00:00:00`).getDay();
  return cls.schedule.days.includes(day as Class['schedule']['days'][number]);
}

export function scheduleStateFor(
  cls: Class,
  plans: SessionPlan[],
  logs: AttendanceLog[],
  date: ISODate,
): ScheduleState {
  if (!meetsOn(cls, date)) return 'off';
  const plan = planFor(plans, cls.id, date);
  if (plan?.status === 'completed') return 'completed';
  // Attendance can exist without a plan — imported history, or a session logged
  // before this flow existed. It still ran, so the cell must say so.
  if (logs.some((l) => l.classId === cls.id && l.date === date)) return 'completed';
  if (plan && plan.items.some((i) => i.blockId)) return 'scheduled';
  return 'unplanned';
}

export interface CalendarCell {
  date: ISODate;
  state: ScheduleState;
  /** False for the leading/trailing days borrowed from the neighbouring months. */
  inMonth: boolean;
  plan: SessionPlan | null;
}

export function buildCalendar(
  cls: Class,
  slice: Pick<DataSlice, 'sessionPlans' | 'attendanceLogs'>,
  ym: YearMonth,
): CalendarCell[] {
  return monthGrid(ym).map((date) => ({
    date,
    state: scheduleStateFor(cls, slice.sessionPlans, slice.attendanceLogs, date),
    inMonth: inMonth(date, ym),
    plan: planFor(slice.sessionPlans, cls.id, date),
  }));
}

/** Cell counts for the month header — "8회 중 3회 설계 완료". */
export function monthSummary(cells: CalendarCell[]): Record<ScheduleState, number> {
  const counts: Record<ScheduleState, number> = {
    off: 0,
    unplanned: 0,
    scheduled: 0,
    completed: 0,
  };
  for (const cell of cells) if (cell.inMonth) counts[cell.state] += 1;
  return counts;
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
   * Share of designed sessions that started from a standard session of the
   * class's own curriculum.
   *
   * This is the honest version of "does this coach follow the curriculum".
   * `coreCurriculumRate` counts flagged blocks and so rewards a coach who picks
   * three core blocks that belong to three different tracks; this one asks
   * whether the *session* was one the owner actually designed for that class.
   */
  templateAdherenceRate: number;
  categoryMix: Record<TrainingBlock['category'], number>;
}

export function buildCoachPortfolio(slice: DataSlice, coachId: ID): CoachPortfolio {
  const blockMap = byId(slice.trainingBlocks);
  const templateMap = byId(slice.sessionTemplates);
  const classMap = byId(slice.classes);
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

    const template = plan.templateId ? templateMap.get(plan.templateId) : undefined;
    if (template && template.curriculumId === classMap.get(plan.classId)?.curriculumId) {
      onCurriculum += 1;
    }
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
