/**
 * Row ↔ entity mapping.
 *
 * Postgres is snake_case, the app is camelCase, and `session_plans` stores its
 * three slots as three columns while the UI wants one object. Rather than let
 * that translation leak into components (or, worse, rename the columns to
 * please JavaScript), it all happens here.
 *
 * Keep this file boring. If a mapper starts making decisions, that decision
 * belongs in a selector.
 */

import type {
  AttendanceLog,
  AttendanceStatus,
  AgeGroup,
  BehaviorTag,
  Class,
  ClassFinance,
  Coach,
  CsAction,
  ID,
  Payment,
  SessionPlan,
  Student,
  StudentStatus,
  TrainingBlock,
  TrainingCategory,
  Weekday,
} from '@/types';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

export const toCoach = (r: Row): Coach => ({
  id: r.id,
  academyId: r.academy_id,
  name: r.name,
  certifications: r.certifications ?? [],
});

export const toClass = (r: Row): Class => ({
  id: r.id,
  academyId: r.academy_id,
  title: r.title,
  coachId: r.coach_id,
  schedule: {
    days: (r.schedule_days ?? []) as Weekday[],
    startTime: r.start_time,
    durationMin: r.duration_min,
  },
  ageGroup: r.age_group as AgeGroup,
  capacity: r.capacity,
  venue: r.venue ?? '',
});

export const toClassFinance = (r: Row): ClassFinance => ({
  classId: r.class_id,
  academyId: r.academy_id,
  monthlyCost: r.monthly_cost,
  retentionRate: Number(r.retention_rate),
});

export const toStudent = (r: Row): Student => ({
  id: r.id,
  academyId: r.academy_id,
  name: r.name,
  ageGroup: r.age_group as AgeGroup,
  status: r.status as StudentStatus,
  // The churn engine recomputes both of these on load, so whatever is stored
  // is only a starting point — see `createInitialState`.
  churnScore: r.churn_score ?? 0,
  classId: r.class_id,
  parentName: r.parent_name ?? '',
  parentPhone: r.parent_phone ?? '',
  enrolledAt: r.enrolled_at,
  lastAttendanceDate: r.last_attendance_date,
  lastParentContactDate: r.last_parent_contact_date,
  memo: r.memo ?? undefined,
});

export const toTrainingBlock = (r: Row): TrainingBlock => ({
  id: r.id,
  academyId: r.academy_id,
  title: r.title,
  category: r.category as TrainingCategory,
  durationMin: r.duration_min,
  description: r.description ?? '',
  ageGroups: (r.age_groups ?? []) as AgeGroup[],
  equipment: r.equipment ?? [],
  usageCount: r.usage_count ?? 0,
  isCoreCurriculum: r.is_core_curriculum ?? false,
});

export const toBehaviorTag = (r: Row): BehaviorTag => ({
  id: r.id,
  academyId: r.academy_id,
  label: r.label,
  dimension: r.dimension,
  polarity: r.polarity,
});

export const toSessionPlan = (r: Row): SessionPlan => ({
  id: r.id,
  academyId: r.academy_id,
  classId: r.class_id,
  coachId: r.coach_id,
  date: r.date,
  slots: {
    warmup: r.warmup_block_id,
    skill: r.skill_block_id,
    game: r.game_block_id,
  },
  createdAt: r.created_at,
  status: r.status,
});

export const fromSessionPlan = (p: SessionPlan): Row => ({
  id: p.id,
  academy_id: p.academyId,
  class_id: p.classId,
  coach_id: p.coachId,
  date: p.date,
  warmup_block_id: p.slots.warmup,
  skill_block_id: p.slots.skill,
  game_block_id: p.slots.game,
  status: p.status,
});

export const toAttendanceLog = (r: Row): AttendanceLog => ({
  id: r.id,
  academyId: r.academy_id,
  studentId: r.student_id,
  classId: r.class_id,
  date: r.date,
  status: r.status as AttendanceStatus,
  tags: r.tags ?? [],
  coachComment: r.coach_comment ?? '',
  sessionPlanId: r.session_plan_id ?? undefined,
  coachId: r.coach_id ?? undefined,
  loggedAt: r.logged_at ?? undefined,
});

export const fromAttendanceLog = (l: AttendanceLog): Row => ({
  id: l.id,
  academy_id: l.academyId,
  student_id: l.studentId,
  class_id: l.classId,
  date: l.date,
  status: l.status,
  tags: l.tags,
  coach_comment: l.coachComment,
  session_plan_id: l.sessionPlanId ?? null,
  coach_id: l.coachId ?? null,
});

export const toCsAction = (r: Row): CsAction => ({
  id: r.id,
  academyId: r.academy_id,
  studentId: r.student_id,
  actedAt: r.acted_at,
  actorId: r.actor_id,
  note: r.note ?? '',
});

export const toPayment = (r: Row): Payment => ({
  id: r.id,
  academyId: r.academy_id,
  studentId: r.student_id,
  period: r.period,
  amount: r.amount ?? 0,
  dueDate: r.due_date ?? null,
  paidAt: r.paid_at ?? null,
  method: r.method ?? null,
  memo: r.memo ?? null,
});

export const fromPayment = (p: Payment): Row => ({
  id: p.id,
  academy_id: p.academyId,
  student_id: p.studentId,
  period: p.period,
  amount: p.amount,
  due_date: p.dueDate,
  paid_at: p.paidAt,
  method: p.method,
  memo: p.memo,
});

/** Keyed lookups for the owner-only tables. */
export const billingMap = (rows: Row[]): Record<ID, number> =>
  Object.fromEntries(rows.map((r) => [r.student_id as ID, r.monthly_fee as number]));

export const financeMap = (rows: Row[]): Record<ID, ClassFinance> =>
  Object.fromEntries(rows.map((r) => [r.class_id as ID, toClassFinance(r)]));

export const evaluationMap = (rows: Row[]): Record<ID, number> =>
  Object.fromEntries(rows.map((r) => [r.coach_id as ID, Number(r.satisfaction_score)]));
