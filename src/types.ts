/**
 * Core relational schema — mirrors `supabase/migrations/0001_schema.sql` row for
 * row. Every entity is a flat record with foreign-key ids (never nested
 * objects); joins happen in selectors (`src/data/selectors.ts`), not in the data.
 *
 * Two rules this file encodes:
 *
 * 1. Every tenant row carries `academyId`. It is never optional — a row without
 *    an academy is a row that could leak into another team's dashboard.
 *
 * 2. Owner-only figures live in their own types (`CoachEvaluation`,
 *    `ClassFinance`, `StudentBilling`), never as fields on the entity a coach
 *    can read. That mirrors the table split in the migration, which exists
 *    because Postgres RLS is row-level: a field on a row a coach may select is
 *    a field a coach can read, no matter what the UI does. Keeping the split in
 *    the types means a coach-side component *cannot compile* against a salary
 *    or an evaluation score.
 */

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export type ID = string;

/** ISO-8601 date, `YYYY-MM-DD`. */
export type ISODate = string;

export type AgeGroup = 'U7' | 'U9' | 'U11' | 'U13' | 'U15';

export type StudentStatus = 'active' | 'at_risk' | 'inactive';

export type AttendanceStatus = 'present' | 'absent' | 'injured';

export type TrainingCategory = 'warmup' | 'skill' | 'game';

/** Weekday index, 0 = Sunday … 6 = Saturday (matches `Date.getDay()`). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Which interface a signed-in user gets. Comes from `academy_members.role` —
 * never from UI state. There is no way to "switch" roles at runtime; you log
 * out and log in as someone else.
 */
export type MemberRole = 'owner' | 'coach';

// ---------------------------------------------------------------------------
// Identity & tenancy
// ---------------------------------------------------------------------------

export interface Academy {
  id: ID;
  name: string;
  plan: 'pilot' | 'standard';
}

/** One person's place in one academy. The source of every permission decision. */
export interface Membership {
  userId: ID;
  academyId: ID;
  role: MemberRole;
  /** The `Coach` row this login acts as. `null` for owners. */
  coachId: ID | null;
  displayName: string;
}

/** Everything the app knows about who is signed in. */
export interface Session {
  userId: ID;
  email: string;
  academy: Academy;
  membership: Membership;
}

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------

export interface Student {
  id: ID;
  academyId: ID;
  name: string;
  ageGroup: AgeGroup;
  status: StudentStatus;
  /**
   * `null` until the student is first marked present.
   *
   * That is the normal state for a freshly imported roster — academies keep
   * attendance in KakaoTalk or on paper, not in the spreadsheet they hand us.
   * Defaulting it to the enrolment date marks the whole roster dormant;
   * defaulting it to today invents attendance that never happened. Both were
   * tried and both make the dashboard lie on day one. See `docs/IMPORT-SPEC.md` §5.
   */
  lastAttendanceDate: ISODate | null;
  /** 0–100. Higher = more likely to churn. Recomputed by `computeChurnScore`. */
  churnScore: number;

  // --- Relational / CRM fields -------------------------------------------
  classId: ID;
  parentName: string;
  parentPhone: string;
  enrolledAt: ISODate;
  /** Last time a coach or the owner sent the parent a report. */
  lastParentContactDate: ISODate | null;
  memo?: string;
}

/** Owner-only. Tuition is the owner's business, not the coach's. */
export interface StudentBilling {
  studentId: ID;
  academyId: ID;
  /** Monthly tuition in KRW — feeds class revenue roll-ups. */
  monthlyFee: number;
}

/**
 * One month's tuition for one student. Owner-only, like everything else with a
 * figure on it (`supabase/migrations/0004_payments.sql`).
 *
 * This is the only dashboard signal that works on day one: a freshly imported
 * roster has no attendance yet, so churn cannot be scored, but revenue and
 * arrears can be read straight off the spreadsheet the owner already keeps.
 */
export interface Payment {
  id: ID;
  academyId: ID;
  studentId: ID;
  /** First day of the month being paid for, `YYYY-MM-01`. */
  period: ISODate;
  amount: number;
  dueDate: ISODate | null;
  /** `null` means unpaid. Status is derived, never stored. */
  paidAt: string | null;
  method: string | null;
  memo: string | null;
}

export interface Coach {
  id: ID;
  academyId: ID;
  name: string;
  certifications: string[];
}

/**
 * Owner-only. This is the owner's rating *of* the coach — the single most
 * damaging thing that could leak, since the coach being rated is a user of the
 * same app. It is a separate table with an owner-only policy for that reason.
 */
export interface CoachEvaluation {
  coachId: ID;
  academyId: ID;
  /** 0–5. */
  satisfactionScore: number;
  note: string;
}

export interface Class {
  id: ID;
  academyId: ID;
  title: string;
  coachId: ID;
  schedule: ClassSchedule;
  ageGroup: AgeGroup;
  capacity: number;
  venue: string;
}

/**
 * Owner-only. Note there is no `monthlyRevenue` here: revenue is the sum of the
 * roster's tuition, so storing it would let the two drift apart. It is derived
 * in `buildClassPerformance`.
 */
export interface ClassFinance {
  classId: ID;
  academyId: ID;
  /** KRW/month — coach pay, pitch rental, equipment. */
  monthlyCost: number;
  /** Share of students who renewed last cycle, 0–1. */
  retentionRate: number;
}

export interface ClassSchedule {
  days: Weekday[];
  /** `HH:mm`, 24h. */
  startTime: string;
  durationMin: number;
}

export interface TrainingBlock {
  id: ID;
  academyId: ID;
  title: string;
  category: TrainingCategory;
  durationMin: number;
  description: string;

  ageGroups: AgeGroup[];
  /** Equipment the coach must set up — rendered as chips on the block card. */
  equipment: string[];
  /** How often this block has been run. Powers the coach's portfolio view. */
  usageCount: number;
  /** Set by the owner: standardised curriculum blocks every class must cover. */
  isCoreCurriculum: boolean;
}

/**
 * A designed session: three ordered slots (warmup / skill / game), each holding
 * at most one `TrainingBlock` id.
 */
export interface SessionPlan {
  id: ID;
  academyId: ID;
  classId: ID;
  coachId: ID;
  date: ISODate;
  slots: SessionSlots;
  createdAt: string;
  status: 'draft' | 'ready' | 'completed';
}

export interface SessionSlots {
  warmup: ID | null;
  skill: ID | null;
  game: ID | null;
}

export interface AttendanceLog {
  id: ID;
  academyId: ID;
  studentId: ID;
  classId: ID;
  date: ISODate;
  status: AttendanceStatus;
  /** Behaviour tags, e.g. `["#드리블우수", "#적극적수비"]`. */
  tags: string[];
  coachComment: string;

  sessionPlanId?: ID;
  coachId?: ID;
  loggedAt?: string;
}

/** Owner action log — proves a churn intervention actually happened. Owner-only. */
export interface CsAction {
  id: ID;
  academyId: ID;
  studentId: ID;
  actedAt: string;
  actorId: ID;
  note: string;
}

/**
 * Preset behaviour tag. Coaches only ever tap these — the mobile UI never asks
 * for typed input.
 */
export interface BehaviorTag {
  id: ID;
  academyId: ID;
  label: string;
  /** Groups chips into rails so a coach can find one in a single glance. */
  dimension: 'skill' | 'attitude' | 'teamwork' | 'physical' | 'caution';
  /** Positive tags lift the growth report; caution tags flag a follow-up. */
  polarity: 'positive' | 'watch';
}

// ---------------------------------------------------------------------------
// Derived / view-model types (never persisted)
// ---------------------------------------------------------------------------

export interface ChurnSignal {
  studentId: ID;
  score: number;
  daysSinceLastAttendance: number;
  absenceRateLast30d: number;
  daysSinceParentContact: number;
  /** Human-readable drivers, rendered as the "why" on the alert row. */
  reasons: string[];
  severity: 'critical' | 'high' | 'watch';
  /**
   * `false` when the student has no attendance history yet, i.e. straight after
   * an import. `score` is then a placeholder zero and must never be rendered as
   * a number — "이탈 위험 0" reads as "safe" when it actually means "unknown",
   * which is the more dangerous of the two mistakes.
   */
  computable: boolean;
}

export interface ClassPerformance {
  classId: ID;
  title: string;
  coachName: string;
  headcount: number;
  capacity: number;
  retentionRate: number;
  monthlyRevenue: number;
  monthlyCost: number;
  /** Revenue − cost. */
  contributionMargin: number;
  /** Margin as a share of revenue, 0–1. */
  marginRate: number;
  attendanceRate: number;
  coachSatisfaction: number;
  atRiskCount: number;
}

export interface DashboardKpis {
  activeStudents: number;
  atRiskStudents: number;
  monthlyRevenue: number;
  monthlyMargin: number;
  averageAttendanceRate: number;
  averageRetentionRate: number;
  logCoverageRate: number;
}

/** Payload previewed in the parent-notification simulation modal. */
export interface ParentNotification {
  studentId: ID;
  studentName: string;
  parentName: string;
  parentPhone: string;
  message: string;
}
