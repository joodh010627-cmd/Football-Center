/**
 * 활동 기록 — the app's ledger.
 *
 * Every meaningful thing anyone does here becomes one immutable row: who, when,
 * what, and to whom. Not an audit trail bolted on for compliance — it is how the
 * owner answers the only question that matters when a parent phones up angry:
 * *what did we actually do for this child, and when.* The entity tables hold the
 * current state; this holds the sequence that produced it.
 *
 * Two sources feed it, and the split is deliberate:
 *
 *   derived — read back out of rows that are already persisted (session plans,
 *             attendance logs, CS actions). Costs no schema and means the ledger
 *             is populated on day one instead of starting empty.
 *   recorded — appended live by `useWorkspace().record(...)` for the actions that
 *             have no table of their own yet, chiefly the CRM pipeline.
 *
 * When a `activity_log` table lands, `recorded` becomes an insert and `derived`
 * shrinks to a backfill. Nothing that reads this module has to change.
 */

import type { AttendanceLog, CsAction, ID, SessionPlan, Student } from '@/types';
import type { DataSlice } from './selectors';
import { byId } from './selectors';
import { dayOf } from './dates';

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export type ActivityKind =
  // --- 수업 -------------------------------------------------------------
  | 'session.planned'
  | 'session.completed'
  | 'attendance.recorded'
  // --- 문의 · 등록 ------------------------------------------------------
  | 'lead.created'
  | 'lead.advanced'
  | 'lead.trial_booked'
  | 'lead.enrolled'
  | 'lead.lost'
  | 'form.created'
  | 'form.shared'
  // --- 원생 -------------------------------------------------------------
  | 'student.evaluated'
  | 'parent.notified'
  | 'cs.resolved'
  // --- 커리큘럼 ---------------------------------------------------------
  | 'curriculum.proposed'
  | 'curriculum.reviewed';

export type SubjectType = 'student' | 'lead' | 'class' | 'session' | 'form' | 'coach';

export interface ActivityEvent {
  id: ID;
  academyId: ID;
  /** ISO datetime. The ledger's sort key and its only clock. */
  at: string;
  kind: ActivityKind;
  /** Who did it. Empty string when the event was derived from a row with no actor. */
  actorName: string;
  subjectType: SubjectType;
  subjectId: ID;
  /** The subject's name at the time, denormalised so a deleted row still reads. */
  subjectLabel: string;
  /** One line, past tense, written for the owner rather than for a developer. */
  summary: string;
  /** Optional second line — the memo, the reason, the note. */
  detail?: string;
}

export interface ActivityMeta {
  label: string;
  /** Tailwind classes for the timeline dot. */
  dot: string;
  /** Which filter chip this event sits under. */
  group: ActivityGroup;
}

export type ActivityGroup = 'session' | 'lead' | 'student' | 'curriculum';

export const ACTIVITY_META: Record<ActivityKind, ActivityMeta> = {
  'session.planned': { label: '수업 설계', dot: 'bg-primary', group: 'session' },
  'session.completed': { label: '수업 완료', dot: 'bg-success', group: 'session' },
  'attendance.recorded': { label: '출결 기록', dot: 'bg-brand-teal', group: 'session' },
  'lead.created': { label: '문의 접수', dot: 'bg-gold', group: 'lead' },
  'lead.advanced': { label: '단계 이동', dot: 'bg-brand-teal', group: 'lead' },
  'lead.trial_booked': { label: '체험 예약', dot: 'bg-primary', group: 'lead' },
  'lead.enrolled': { label: '등록 완료', dot: 'bg-success', group: 'lead' },
  'lead.lost': { label: '미등록 처리', dot: 'bg-stone', group: 'lead' },
  'form.created': { label: '폼 생성', dot: 'bg-gold-deep', group: 'lead' },
  'form.shared': { label: '폼 공유', dot: 'bg-gold', group: 'lead' },
  'student.evaluated': { label: '성장 평가', dot: 'bg-brand-orange', group: 'student' },
  'parent.notified': { label: '학부모 발송', dot: 'bg-brand-teal', group: 'student' },
  'cs.resolved': { label: 'CS 조치', dot: 'bg-error', group: 'student' },
  'curriculum.proposed': { label: '커리큘럼 제안', dot: 'bg-gold', group: 'curriculum' },
  'curriculum.reviewed': { label: '커리큘럼 심사', dot: 'bg-primary', group: 'curriculum' },
};

export const ACTIVITY_GROUP_LABEL: Record<ActivityGroup, string> = {
  session: '수업',
  lead: '문의·등록',
  student: '원생',
  curriculum: '커리큘럼',
};

const uid = (): ID =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;

/**
 * An event before the ledger stamps it.
 *
 * `at` and `actorName` are optional because the two sources fill them
 * differently: a recorded event happens now and knows who is signed in, while a
 * derived one carries the timestamp of the row it came from and often has no
 * actor at all (imported history has no author).
 */
export type EventDraft = Omit<ActivityEvent, 'id' | 'academyId' | 'at' | 'actorName'> & {
  at?: string;
  actorName?: string;
};

export function newEvent(academyId: ID, fields: EventDraft): ActivityEvent {
  return {
    id: uid(),
    academyId,
    at: new Date().toISOString(),
    actorName: '',
    ...fields,
  };
}

// ---------------------------------------------------------------------------
// Derivation
// ---------------------------------------------------------------------------

/**
 * Attendance is logged one row per student, so a class of twelve produces twelve
 * rows for one act. The ledger wants the act: "U10 베이직 출결 기록 — 12명 중
 * 10명 출석". Collapsing here rather than at write time keeps the underlying
 * rows exactly as they are.
 */
function attendanceEvents(logs: AttendanceLog[], slice: DataSlice, academyId: ID): ActivityEvent[] {
  const classMap = byId(slice.classes);
  const coachMap = byId(slice.coaches);
  const groups = new Map<string, AttendanceLog[]>();

  for (const log of logs) {
    const key = `${log.classId}|${log.date}`;
    const bucket = groups.get(key);
    if (bucket) bucket.push(log);
    else groups.set(key, [log]);
  }

  return [...groups.entries()].map(([key, rows]) => {
    const [classId, date] = key.split('|');
    const present = rows.filter((r) => r.status === 'present').length;
    const tagged = rows.filter((r) => r.tags.length > 0).length;
    const coachId = rows.find((r) => r.coachId)?.coachId;

    return newEvent(academyId, {
      // `loggedAt` is absent on imported history; the session date is the
      // honest fallback. Written without a `Z` so it is read as local time —
      // an academy's evening is not 20:00 UTC.
      at: rows.find((r) => r.loggedAt)?.loggedAt ?? `${date}T20:00:00`,
      kind: 'attendance.recorded',
      actorName: coachId ? `${coachMap.get(coachId)?.name ?? ''} 코치` : '',
      subjectType: 'class',
      subjectId: classId,
      subjectLabel: classMap.get(classId)?.title ?? '삭제된 클래스',
      summary: `출결 ${rows.length}명 기록 · ${present}명 출석`,
      detail: tagged > 0 ? `행동 태그 ${tagged}건 입력` : undefined,
    });
  });
}

function planEvents(plans: SessionPlan[], slice: DataSlice, academyId: ID): ActivityEvent[] {
  const classMap = byId(slice.classes);
  const coachMap = byId(slice.coaches);

  return plans.flatMap((plan) => {
    const label = classMap.get(plan.classId)?.title ?? '삭제된 클래스';
    const actorName = `${coachMap.get(plan.coachId)?.name ?? ''} 코치`;
    const planned = newEvent(academyId, {
      at: plan.createdAt,
      kind: 'session.planned',
      actorName,
      subjectType: 'session',
      subjectId: plan.id,
      subjectLabel: label,
      summary: `${plan.date} 수업 ${plan.items.length}블록 설계`,
      detail: plan.templateId ? '표준 수업에서 시작' : undefined,
    });

    if (plan.status !== 'completed') return [planned];

    return [
      planned,
      newEvent(academyId, {
        // No completion timestamp is stored; the evening of the session day is
        // the closest true thing and keeps the ledger in the right order.
        at: `${plan.date}T21:00:00`,
        kind: 'session.completed',
        actorName,
        subjectType: 'session',
        subjectId: plan.id,
        subjectLabel: label,
        summary: `${plan.date} 수업 완료`,
      }),
    ];
  });
}

/**
 * CS interventions. Owner-only in the database, so in a coach session this
 * array is empty and the branch simply produces nothing — the ledger narrows
 * itself by what the query returned, not by a check in the UI.
 */
function csEvents(actions: CsAction[], students: Student[], academyId: ID): ActivityEvent[] {
  const studentMap = byId(students);

  return actions.map((action) =>
    newEvent(academyId, {
      at: action.actedAt,
      kind: 'cs.resolved',
      actorName: '대표',
      subjectType: 'student',
      subjectId: action.studentId,
      subjectLabel: studentMap.get(action.studentId)?.name ?? '삭제된 원생',
      summary: '이탈 위험 조치 완료',
      detail: action.note || undefined,
    }),
  );
}

/**
 * The ledger as it can be reconstructed from persisted rows.
 *
 * Deliberately not memoised here — the caller holds it in a `useMemo` keyed on
 * the slice, which is the only place that knows when the data actually changed.
 */
export function deriveActivity(
  slice: DataSlice,
  csActions: CsAction[],
  academyId: ID,
): ActivityEvent[] {
  return [
    ...planEvents(slice.sessionPlans, slice, academyId),
    ...attendanceEvents(slice.attendanceLogs, slice, academyId),
    ...csEvents(csActions, slice.students, academyId),
  ];
}

/** Everything, newest first. */
export const mergeActivity = (...sources: ActivityEvent[][]): ActivityEvent[] =>
  sources.flat().sort((a, b) => b.at.localeCompare(a.at));

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

export const eventsForSubject = (events: ActivityEvent[], subjectId: ID): ActivityEvent[] =>
  events.filter((e) => e.subjectId === subjectId);

export const eventsInGroup = (events: ActivityEvent[], group: ActivityGroup): ActivityEvent[] =>
  events.filter((e) => ACTIVITY_META[e.kind].group === group);

/** Events bucketed by calendar day, newest day first — how the timeline renders. */
export function groupByDay(events: ActivityEvent[]): Array<[string, ActivityEvent[]]> {
  const days = new Map<string, ActivityEvent[]>();
  for (const event of events) {
    const day = dayOf(event.at);
    const bucket = days.get(day);
    if (bucket) bucket.push(event);
    else days.set(day, [event]);
  }
  return [...days.entries()].sort((a, b) => b[0].localeCompare(a[0]));
}
