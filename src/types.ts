/**
 * Core relational schema.
 *
 * Every entity is modelled as a flat row with foreign-key ids (never nested
 * objects) so the mock store can be swapped for a Firebase/Supabase table
 * one-for-one. Joins happen in selectors (`src/data/selectors.ts`), not in the
 * data itself.
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
 * Which of the two interfaces is on screen. In production this comes from the
 * session and each user only ever sees one; the prototype lets you switch.
 */
export type Role = 'admin' | 'coach';

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------

export interface Student {
  id: ID;
  name: string;
  ageGroup: AgeGroup;
  status: StudentStatus;
  lastAttendanceDate: ISODate;
  /** 0–100. Higher = more likely to churn. Recomputed by `computeChurnScore`. */
  churnScore: number;

  // --- Relational / CRM fields -------------------------------------------
  classId: ID;
  parentName: string;
  parentPhone: string;
  enrolledAt: ISODate;
  /** Monthly tuition in KRW — feeds class revenue roll-ups. */
  monthlyFee: number;
  /** Last time a coach or the owner sent the parent a report. */
  lastParentContactDate: ISODate | null;
  memo?: string;
}

export interface Coach {
  id: ID;
  name: string;
  /** Owner-facing quality signal, 0–5. */
  satisfactionScore: number;
  certifications: string[];
}

export interface Class {
  id: ID;
  title: string;
  coachId: ID;
  schedule: ClassSchedule;
  /** KRW/month, collected across enrolled students. */
  monthlyRevenue: number;
  /** KRW/month — coach pay, pitch rental, equipment. */
  monthlyCost: number;

  ageGroup: AgeGroup;
  capacity: number;
  venue: string;
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

/** Owner action log — proves a churn intervention actually happened. */
export interface CsAction {
  id: ID;
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
