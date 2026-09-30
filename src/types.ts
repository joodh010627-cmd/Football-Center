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

/**
 * Approval state for anything a coach can *propose* into the shared library.
 *
 * `pending` rows exist in the same table as published ones, which is what makes
 * the owner's queue a filter rather than a second schema. Nothing pending is
 * offered in the session builder — see `publishedBlocks` / `publishedTemplates`.
 */
export type ApprovalStatus = 'published' | 'pending' | 'rejected';

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
  /**
   * Legacy link to a curriculum track (0005). Nothing reads it any more — a
   * class no longer walks a fixed weekly cycle, it picks a session per day.
   * Kept so the column's data survives until a migration drops it.
   */
  curriculumId: ID | null;
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

// ---------------------------------------------------------------------------
// Sessions & blocks
// ---------------------------------------------------------------------------

/**
 * The five abilities a session trains — the same five the growth pentagon is
 * drawn on (`lib/axes.ts`). A session is filed under exactly one, so a coach
 * looking for "something for passing" opens 기술 and not a curriculum tree.
 */
export type Ability = 'technical' | 'tactical' | 'physical' | 'mental' | 'attitude';

/**
 * Where a session or block came from.
 *
 * `standard` rows ship with the app (`data/sessionLibrary.ts`) and are the same
 * for every academy; `center` rows are the academy's own, in the database. The
 * split is what lets a licensed library (a federation's, say) be dropped in
 * later without touching anyone's own sessions.
 */
export type ContentSource = 'standard' | 'center';

/**
 * A session: one goal, and the blocks that serve it, in order.
 *
 * Picking a session is the whole of planning — its blocks come along as the
 * default. There is no week number: an academy's roster turns over every
 * month, so a cycle that assumes the same children in week 5 as in week 1
 * describes no real class.
 */
export interface SessionTemplate {
  id: ID;
  academyId: ID;
  source: ContentSource;
  ability: Ability;
  /** Short name, e.g. "패스 정확도". This is what the coach reads first. */
  title: string;
  /** What this session moves, in one sentence. Shown behind 더 보기. */
  goal: string;
  blockIds: ID[];
  /** Age groups it suits. Empty = any. */
  ageGroups: AgeGroup[];
  status: ApprovalStatus;
  /** The coach who proposed it. `null` when the owner authored it directly. */
  proposedBy: ID | null;
  /** The owner's note on an approval or rejection. Empty until reviewed. */
  reviewNote: string;
  /** How many session plans started from this template. */
  usageCount: number;
  createdAt: string;
  /** Legacy (0005). `null` for anything authored since. */
  curriculumId: ID | null;
}

export interface TrainingBlock {
  id: ID;
  academyId: ID;
  source: ContentSource;
  title: string;
  /** Where it sits in the hour: 준비 · 훈련 · 게임. */
  category: TrainingCategory;
  /** Which ability the block mainly trains. Library filter and chip colour. */
  ability: Ability;
  durationMin: number;
  /** How to run it — one or two sentences. */
  description: string;
  /** What the coach watches for. Shown only when the block is opened. */
  coachingPoints: string[];

  ageGroups: AgeGroup[];
  /** Equipment the coach must set up — rendered as chips on the block card. */
  equipment: string[];
  /** How often this block has been run. Powers the coach's portfolio view. */
  usageCount: number;
  /** Set by the owner: standardised curriculum blocks every class must cover. */
  isCoreCurriculum: boolean;
  /** `pending` = a coach proposed it and the owner hasn't ruled yet. */
  status: ApprovalStatus;
  proposedBy: ID | null;
}

// ---------------------------------------------------------------------------
// Session plans
// ---------------------------------------------------------------------------

/**
 * The session chosen for one class on one date.
 *
 * Choosing *is* saving — there is no separate "register" step, so `draft` is
 * only ever seen on legacy rows. `completed` means the session was wrapped up.
 */
export interface SessionPlan {
  id: ID;
  academyId: ID;
  classId: ID;
  coachId: ID;
  date: ISODate;
  items: SessionItem[];
  /**
   * The session this plan runs — a standard-library key (`std-…`) or a
   * centre session's uuid. `null` = blocks assembled by hand. Editing the
   * blocks keeps the link: the goal is still the goal.
   */
  templateId: ID | null;
  createdAt: string;
  status: SessionPlanStatus;
}

export type SessionPlanStatus = 'draft' | 'scheduled' | 'completed';

/** One step of a session. Order is the order the coach will run it in. */
export interface SessionItem {
  category: TrainingCategory;
  /** `null` while the coach has chosen the shape but not yet the drill. */
  blockId: ID | null;
  /** Coach's override; falls back to the block's own `durationMin`. */
  durationMin: number | null;
  /**
   * The coach's rewrite of the block for this one lesson. The library block is
   * untouched, and because it rides in the plan's jsonb the lesson keeps what
   * was actually run even if the library changes later.
   */
  edit?: BlockEdit;
}

/** Fields a coach can rewrite on a block for one lesson. Absent = as written. */
export interface BlockEdit {
  title?: string;
  description?: string;
  coachingPoints?: string[];
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
  /** The rendered 알림톡 — exactly what the parent would receive. */
  message: string;
  /** Which approved template `message` was rendered from. */
  templateCode: 'attendance_report';
  variables: Record<string, string>;
}
