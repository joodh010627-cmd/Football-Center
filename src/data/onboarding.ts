/**
 * 온보딩 여정 — 문의 → 체험 → 등록 → 신규 원생(등록 후 4주).
 *
 * A football centre's roster turns over every term, so the business is decided
 * at two cliffs, and both are about new families:
 *
 *   1. The first reply. Leads contacted within minutes are many times likelier
 *      to convert than ones called back the next day (the MIT/InsideSales
 *      lead-response study put it at 21× at five minutes vs thirty). A form
 *      filled in on Saturday morning is a family comparing centres by Sunday.
 *
 *   2. The first month. Gyms, martial-arts schools and 학원 all converge on the
 *      same finding: whether a new member is still there at three months is
 *      settled in the first thirty days — by a welcome on day one, a personal
 *      check-in in the first week (a call that asks, and sells nothing), and a
 *      review at day thirty that counts visits rather than feelings.
 *
 * So the journey doesn't end at 등록. It runs 문의 → 체험 → 등록 → 첫 달, and a
 * family leaves it only when the 첫 달 점검 is done. For every family this
 * module answers one question — *what is the next thing, and is it due?* — and
 * the screen is built on that answer rather than on a list of stages.
 *
 * Everything here is derived: from the lead row, the student row, attendance,
 * the 등록 신청서, and a small ledger of contact attempts (`Touch`). Nothing
 * about "where a family is" is stored twice.
 */

import type { AttendanceLog, Class, ID, ISODate, Student, Weekday } from '@/types';
import type { Lead } from './crm';
import type { Survey, SurveyRecipient } from './surveys';
import { TODAY, addDays, dayOf, diffDays } from './dates';

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export type Phase = 'inquiry' | 'trial' | 'decision' | 'firstMonth';

export const PHASES: ReadonlyArray<{ key: Phase; label: string; blurb: string }> = [
  { key: 'inquiry', label: '문의', blurb: '체험 전' },
  { key: 'trial', label: '체험', blurb: '체험 예정' },
  { key: 'decision', label: '등록', blurb: '체험 후 등록 전' },
  { key: 'firstMonth', label: '신규 원생', blurb: '등록 후 4주' },
];

export const PHASE_LABEL: Record<Phase, string> = {
  inquiry: '문의',
  trial: '체험',
  decision: '등록',
  firstMonth: '신규 원생',
};

/** The four stages as a step bar, lit up to where the family is. */
export function phaseSteps(phase: Phase): Array<{ label: string; state: 'done' | 'current' | 'todo' }> {
  const at = PHASES.findIndex((p) => p.key === phase);
  return PHASES.map((p, i) => ({
    label: p.label,
    state: i < at ? 'done' : i === at ? 'current' : 'todo',
  }));
}

/** The contacts worth writing down. Stage moves live on the lead itself. */
export type TouchStep = 'first_call' | 'trial_followup' | 'welcome' | 'week1' | 'month1';

/**
 * What came of it. Only `done` completes a step: `no_answer` tries again
 * tomorrow, `concern` means "we talked, something is unsettled" and brings the
 * family back in three days with the note attached.
 */
export type TouchOutcome = 'done' | 'no_answer' | 'concern';

export const STEP_LABEL: Record<TouchStep, string> = {
  first_call: '첫 상담 전화',
  trial_followup: '체험 후 통화',
  welcome: '환영 안내',
  week1: '1주 차 통화',
  month1: '4주 차 통화',
};

export const OUTCOME_LABEL: Record<TouchOutcome, string> = {
  done: '완료',
  no_answer: '부재중',
  concern: '보류',
};

export interface Touch {
  id: ID;
  academyId: ID;
  leadId: ID | null;
  studentId: ID | null;
  step: TouchStep;
  outcome: TouchOutcome;
  note: string;
  actorName: string;
  /** ISO datetime. */
  at: string;
}

export type ActionKind =
  | 'first_call'
  | 'book_trial'
  | 'mark_trial'
  | 'trial_followup'
  | 'send_form'
  | 'form_check'
  | 'enroll'
  | 'welcome'
  | 'week1'
  | 'month1'
  | 'wait';

/** The one thing to do next for a family. */
export interface NextAction {
  kind: ActionKind;
  /** Verb phrase, shown as the card title: "체험 후 연락". */
  label: string;
  /** Why now, in one line: "체험 2일 지남 · 소감 듣기". */
  reason: string;
  due: ISODate;
  late: boolean;
  /** How it's done. `wait` is a milestone ahead, not a task. */
  channel: 'call' | 'message' | 'tap' | 'wait';
  /** For calls: what the call is for, in a sentence. */
  script?: string;
  /** Which touch step logging an outcome writes, for calls. */
  touch?: TouchStep;
  /** The note from the last unsettled call, carried forward. */
  carry?: string;
}

export interface JourneyStep {
  key: string;
  phase: Phase;
  label: string;
  done: boolean;
  /** Short, e.g. "9/21" or "3/6회". */
  detail?: string;
}

export interface Family {
  /** `lead:<id>` or `student:<id>` — a lead that enrolled becomes its student. */
  key: string;
  lead: Lead | null;
  student: Student | null;
  name: string;
  ageLabel: string;
  parentName: string;
  phone: string;
  phase: Phase;
  next: NextAction | null;
  steps: JourneyStep[];
  /** For the first month: attended / held so far in the first 28 days. */
  attendance?: { present: number; held: number };
  /** For the first month: the enrolment date the journey counts from. */
  enrolledAt?: ISODate;
  /** For the first month: the first class day after enrolling. */
  firstClass?: ISODate;
}

// ---------------------------------------------------------------------------
// Scripts — what each call is for
// ---------------------------------------------------------------------------

const SCRIPT: Record<'first_call' | 'trial_followup' | 'form_check' | 'week1' | 'month1', string> = {
  first_call: '가능한 요일 확인 → 체험 날짜 잡기',
  trial_followup: '아이 반응 확인 → 등록 의사 확인',
  form_check: '신청서 작성 여부 확인',
  week1: '적응 확인 (권유 없이)',
  month1: '첫 달 출석 공유 → 다음 달 확인',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const md = (iso: ISODate): string => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;

/** The latest touch for a step, if any. */
function latest(touches: Touch[], step: TouchStep): Touch | undefined {
  let best: Touch | undefined;
  for (const t of touches) if (t.step === step && (!best || t.at > best.at)) best = t;
  return best;
}

/**
 * Where a step stands from its touches. `due` is pushed out by an unanswered
 * or unsettled call; `carry` is the note an unsettled call left behind.
 */
function stepState(touches: Touch[], step: TouchStep, baseDue: ISODate) {
  const t = latest(touches, step);
  if (!t) return { done: false, due: baseDue, carry: undefined as string | undefined, last: t };
  if (t.outcome === 'done') return { done: true, due: baseDue, carry: undefined, last: t };
  const day = dayOf(t.at);
  return {
    done: false,
    due: addDays(day, t.outcome === 'no_answer' ? 1 : 3),
    carry: t.outcome === 'concern' ? t.note || '고민 중' : undefined,
    last: t,
  };
}

/** First class day on or after `from`, by the class's weekdays. */
export function firstClassOn(cls: Class | undefined, from: ISODate): ISODate | null {
  if (!cls || cls.schedule.days.length === 0) return null;
  for (let i = 0; i < 14; i += 1) {
    const d = addDays(from, i);
    if (cls.schedule.days.includes(new Date(`${d}T00:00:00`).getDay() as Weekday)) return d;
  }
  return null;
}

/** Class days in [from, to). */
function classDaysBetween(cls: Class | undefined, from: ISODate, to: ISODate): number {
  if (!cls) return 0;
  let n = 0;
  for (let d = from; d < to; d = addDays(d, 1)) {
    if (cls.schedule.days.includes(new Date(`${d}T00:00:00`).getDay() as Weekday)) n += 1;
  }
  return n;
}

// ---------------------------------------------------------------------------
// Lead phases
// ---------------------------------------------------------------------------

function leadFamily(
  lead: Lead,
  touches: Touch[],
  form: { sentAt: ISODate; answeredAt: ISODate | null } | null,
  asOf: ISODate,
): Family {
  const created = dayOf(lead.createdAt);
  const moved = dayOf(lead.stageChangedAt);
  const first = stepState(touches, 'first_call', created);
  const contacted = lead.stage !== 'inquiry';

  let phase: Phase = 'inquiry';
  let next: NextAction | null = null;

  if (lead.stage === 'inquiry') {
    const waited = diffDays(asOf, created);
    next = {
      kind: 'first_call',
      label: '첫 상담 전화',
      reason:
        first.last?.outcome === 'no_answer'
          ? `${md(dayOf(first.last.at))} 부재중`
          : waited === 0
            ? '오늘 문의'
            : `문의 후 ${waited}일 · 미연락`,
      due: first.due,
      late: diffDays(asOf, first.due) >= 1,
      channel: 'call',
      script: SCRIPT.first_call,
      touch: 'first_call',
    };
  } else if (lead.stage === 'contacted') {
    const waited = diffDays(asOf, moved);
    next = {
      kind: 'book_trial',
      label: '체험 날짜 잡기',
      reason: waited === 0 ? '상담 완료 · 체험 미정' : `상담 후 ${waited}일 · 체험 미정`,
      due: moved,
      late: waited > 3,
      channel: 'tap',
    };
  } else if (lead.stage === 'trial_booked') {
    phase = 'trial';
    const day = lead.trialDate ?? moved;
    if (day > asOf) {
      next = {
        kind: 'wait',
        label: '체험 예정',
        reason: `${md(day)} 체험 예정`,
        due: day,
        late: false,
        channel: 'wait',
      };
    } else {
      next = {
        kind: 'mark_trial',
        label: '체험 결과 기록',
        reason: day === asOf ? '오늘 체험' : `${md(day)} 체험 · 결과 미기록`,
        due: day,
        late: day < asOf,
        channel: 'tap',
      };
    }
  } else if (lead.stage === 'trial_done') {
    phase = 'decision';
    const trialDay = lead.trialDate ?? moved;
    const follow = stepState(touches, 'trial_followup', addDays(trialDay, 1));

    if (!follow.done) {
      const since = diffDays(asOf, trialDay);
      next = {
        kind: 'trial_followup',
        label: follow.carry ? '재통화' : '체험 후 통화',
        reason: follow.carry
          ? `보류: ${follow.carry}`
          : follow.last?.outcome === 'no_answer'
            ? `${md(dayOf(follow.last.at))} 부재중`
            : `체험 후 ${since}일`,
        due: follow.due,
        late: diffDays(asOf, follow.due) >= 2,
        channel: 'call',
        script: SCRIPT.trial_followup,
        touch: 'trial_followup',
        carry: follow.carry,
      };
    } else if (form?.answeredAt) {
      next = {
        kind: 'enroll',
        label: '등록 확정',
        reason: `${md(form.answeredAt)} 신청서 도착`,
        due: form.answeredAt,
        late: diffDays(asOf, form.answeredAt) >= 2,
        channel: 'tap',
      };
    } else if (form) {
      const since = diffDays(asOf, form.sentAt);
      const due = addDays(form.sentAt, 3);
      next =
        asOf < due
          ? {
              kind: 'wait',
              label: '신청서 응답 대기',
              reason: `${md(form.sentAt)} 발송`,
              due,
              late: false,
              channel: 'wait',
            }
          : {
              kind: 'form_check',
              label: '신청서 확인 전화',
              reason: `신청서 발송 후 ${since}일 · 미응답`,
              due,
              late: diffDays(asOf, due) >= 2,
              channel: 'call',
              script: SCRIPT.form_check,
              touch: 'trial_followup',
            };
    } else {
      const day = dayOf(follow.last!.at);
      next = {
        kind: 'send_form',
        label: '등록 신청서 보내기',
        reason: '등록 희망 · 신청서 미발송',
        due: day,
        late: diffDays(asOf, day) >= 2,
        channel: 'message',
      };
    }
  }

  const followDone = stepState(touches, 'trial_followup', asOf).done;
  const steps: JourneyStep[] = [
    { key: 'first_call', phase: 'inquiry', label: '첫 연락', done: contacted },
    { key: 'book', phase: 'trial', label: '체험 예약', done: !!lead.trialDate, detail: lead.trialDate ? md(lead.trialDate) : undefined },
    { key: 'attend', phase: 'trial', label: '체험 참석', done: lead.stage === 'trial_done' },
    { key: 'followup', phase: 'decision', label: '체험 후 통화', done: followDone },
    {
      key: 'form',
      phase: 'decision',
      label: '등록 신청서',
      done: !!form?.answeredAt,
      detail: form ? (form.answeredAt ? `${md(form.answeredAt)} 도착` : `${md(form.sentAt)} 보냄`) : undefined,
    },
    { key: 'enroll', phase: 'decision', label: '등록 확정', done: false },
    ...NEWCOMER_STEPS.map((s) => ({ ...s, done: false })),
  ];

  return {
    key: `lead:${lead.id}`,
    lead,
    student: null,
    name: lead.childName || '이름 미상',
    ageLabel: lead.ageLabel,
    parentName: lead.parentName,
    phone: lead.parentPhone,
    phase,
    next,
    steps,
  };
}

const NEWCOMER_STEPS: Omit<JourneyStep, 'done'>[] = [
  { key: 'welcome', phase: 'firstMonth', label: '환영 안내' },
  { key: 'first_class', phase: 'firstMonth', label: '첫 수업' },
  { key: 'week1', phase: 'firstMonth', label: '1주 차 통화' },
  { key: 'month1', phase: 'firstMonth', label: '4주 차 통화' },
];

// ---------------------------------------------------------------------------
// First month
// ---------------------------------------------------------------------------

function newcomerFamily(
  student: Student,
  enrolledAt: ISODate,
  cls: Class | undefined,
  logs: AttendanceLog[],
  touches: Touch[],
  lead: Lead | null,
  asOf: ISODate,
): Family | null {
  const month = stepState(touches, 'month1', addDays(enrolledAt, 28));
  if (month.done) return null; // settled — a regular member now

  const welcome = stepState(touches, 'welcome', enrolledAt);
  const firstDay = firstClassOn(cls, addDays(enrolledAt, 1)) ?? addDays(enrolledAt, 7);
  const mine = logs.filter((l) => l.studentId === student.id && l.date >= enrolledAt);
  const present = mine.filter((l) => l.status === 'present');
  const attendedFirst = present.length > 0;
  const missedFirst = !attendedFirst && mine.some((l) => l.date === firstDay && l.status !== 'present');
  const windowEnd = addDays(enrolledAt, 28);
  const heldEnd = addDays(asOf, 1) < windowEnd ? addDays(asOf, 1) : windowEnd;
  const held = classDaysBetween(cls, addDays(enrolledAt, 1), heldEnd);
  const presentInWindow = present.filter((l) => l.date < windowEnd).length;

  const week = stepState(
    touches,
    'week1',
    missedFirst ? addDays(firstDay, 1) : addDays(enrolledAt, 7),
  );

  let next: NextAction;
  const since = diffDays(asOf, enrolledAt);

  if (!welcome.done) {
    next = {
      kind: 'welcome',
      label: '환영 안내 보내기',
      reason: since === 0 ? '오늘 등록' : `등록 후 ${since}일`,
      due: welcome.due,
      late: diffDays(asOf, enrolledAt) >= 1,
      channel: 'message',
    };
  } else if (!week.done) {
    next = {
      kind: 'week1',
      label: week.carry ? '재통화' : missedFirst ? '첫 수업 결석 확인' : '1주 차 통화',
      reason: week.carry
        ? `보류: ${week.carry}`
        : week.last?.outcome === 'no_answer'
          ? `${md(dayOf(week.last.at))} 부재중`
          : missedFirst
            ? `첫 수업(${md(firstDay)}) 결석`
            : asOf < week.due
              ? `첫 수업 ${md(firstDay)}`
              : `등록 후 ${since}일`,
      due: week.due,
      late: diffDays(asOf, week.due) >= 3,
      channel: asOf < week.due ? 'wait' : 'call',
      script: SCRIPT.week1,
      touch: 'week1',
      carry: week.carry,
    };
  } else {
    next = {
      kind: 'month1',
      label: month.carry ? '재통화' : '4주 차 통화',
      reason: month.carry
        ? `보류: ${month.carry}`
        : `출석 ${presentInWindow}/${held}회`,
      due: month.due,
      late: diffDays(asOf, month.due) >= 3,
      channel: asOf < month.due ? 'wait' : 'call',
      script: SCRIPT.month1,
      touch: 'month1',
      carry: month.carry,
    };
  }

  const steps: JourneyStep[] = [
    { key: 'first_call', phase: 'inquiry', label: '첫 연락', done: true },
    { key: 'book', phase: 'trial', label: '체험 예약', done: true, detail: lead?.trialDate ? md(lead.trialDate) : undefined },
    { key: 'attend', phase: 'trial', label: '체험 참석', done: true },
    { key: 'followup', phase: 'decision', label: '체험 후 통화', done: true },
    { key: 'form', phase: 'decision', label: '등록 신청서', done: true },
    { key: 'enroll', phase: 'decision', label: '등록 확정', done: true, detail: md(enrolledAt) },
    { key: 'welcome', phase: 'firstMonth', label: '환영 안내', done: welcome.done },
    {
      key: 'first_class',
      phase: 'firstMonth',
      label: '첫 수업',
      done: attendedFirst,
      detail: attendedFirst ? md(present[0].date) : missedFirst ? '결석' : md(firstDay),
    },
    { key: 'week1', phase: 'firstMonth', label: '1주 차 통화', done: week.done },
    {
      key: 'month1',
      phase: 'firstMonth',
      label: '4주 차 통화',
      done: false,
      detail: `출석 ${presentInWindow}/${held}회`,
    },
  ];

  return {
    key: `student:${student.id}`,
    lead,
    student,
    name: student.name,
    ageLabel: student.ageGroup,
    parentName: student.parentName,
    phone: student.parentPhone,
    phase: 'firstMonth',
    next,
    steps,
    attendance: { present: presentInWindow, held },
    enrolledAt,
    firstClass: firstDay,
  };
}

// ---------------------------------------------------------------------------
// Everything
// ---------------------------------------------------------------------------

export interface JourneyInput {
  leads: Lead[];
  students: Student[];
  classes: Class[];
  attendanceLogs: AttendanceLog[];
  touches: Touch[];
  surveys: Survey[];
  recipients: SurveyRecipient[];
  /**
   * Local demo only: treat these students as enrolled on these dates. The
   * demo roster was all enrolled months ago, and a 첫 달 with nobody in it
   * shows nothing of what the phase is for.
   */
  enrolledOverride?: Record<ID, ISODate>;
  asOf?: ISODate;
}

/** How long after enrolling a family without a finished 첫 달 점검 is still shown. */
export const NEWCOMER_WINDOW = 45;

export function buildFamilies(input: JourneyInput): Family[] {
  const asOf = input.asOf ?? TODAY;
  const override = input.enrolledOverride ?? {};

  const touchesOf = (key: 'leadId' | 'studentId', id: ID) =>
    input.touches.filter((t) => t[key] === id);

  // The newest 등록 신청서 per lead.
  const enrollmentIds = new Set(input.surveys.filter((v) => v.kind === 'enrollment').map((v) => v.id));
  const surveyDay = new Map(input.surveys.map((v) => [v.id, dayOf(v.createdAt)]));
  const forms = new Map<ID, { sentAt: ISODate; answeredAt: ISODate | null }>();
  for (const r of input.recipients) {
    if (!r.leadId || !enrollmentIds.has(r.surveyId)) continue;
    const sentAt = surveyDay.get(r.surveyId)!;
    const prev = forms.get(r.leadId);
    if (!prev || sentAt > prev.sentAt) {
      forms.set(r.leadId, { sentAt, answeredAt: r.answeredAt ? dayOf(r.answeredAt) : null });
    }
  }

  const out: Family[] = [];
  const leadByStudent = new Map<ID, Lead>();

  for (const lead of input.leads) {
    if (lead.stage === 'enrolled') {
      if (lead.enrolledStudentId) leadByStudent.set(lead.enrolledStudentId, lead);
      continue;
    }
    if (lead.stage === 'lost') continue;
    out.push(leadFamily(lead, touchesOf('leadId', lead.id), forms.get(lead.id) ?? null, asOf));
  }

  const classMap = new Map(input.classes.map((c) => [c.id, c]));
  for (const s of input.students) {
    if (s.status === 'inactive') continue;
    const enrolledAt = override[s.id] ?? s.enrolledAt;
    const age = diffDays(asOf, enrolledAt);
    if (age < 0 || age > NEWCOMER_WINDOW) continue;
    // Imported history: an old roster can't be put through a first month.
    const fam = newcomerFamily(
      s,
      enrolledAt,
      classMap.get(s.classId),
      input.attendanceLogs,
      touchesOf('studentId', s.id),
      leadByStudent.get(s.id) ?? null,
      asOf,
    );
    if (fam) out.push(fam);
  }

  return out;
}

/** Due today or overdue, and something a person does. */
export const isDue = (f: Family, asOf: ISODate = TODAY): boolean =>
  !!f.next && f.next.channel !== 'wait' && f.next.due <= asOf;

const PHASE_ORDER: Record<Phase, number> = { inquiry: 0, trial: 1, decision: 2, firstMonth: 3 };

/**
 * Today's list, worst first: late before on time, then the oldest due date,
 * then earlier in the journey — a stranger waiting on a first call outranks a
 * member waiting on a check-in by the same number of days.
 */
export function todayQueue(families: Family[], asOf: ISODate = TODAY): Family[] {
  return families
    .filter((f) => isDue(f, asOf))
    .sort(
      (a, b) =>
        Number(b.next!.late) - Number(a.next!.late) ||
        a.next!.due.localeCompare(b.next!.due) ||
        PHASE_ORDER[a.phase] - PHASE_ORDER[b.phase],
    );
}

/** A phase's families: due first, then what's coming, soonest first. */
export function phaseList(families: Family[], phase: Phase, asOf: ISODate = TODAY): Family[] {
  return families
    .filter((f) => f.phase === phase)
    .sort(
      (a, b) =>
        Number(isDue(b, asOf)) - Number(isDue(a, asOf)) ||
        Number(b.next?.late ?? 0) - Number(a.next?.late ?? 0) ||
        (a.next?.due ?? '9999').localeCompare(b.next?.due ?? '9999'),
    );
}

// ---------------------------------------------------------------------------
// Seed — local mode only
// ---------------------------------------------------------------------------

/**
 * A first month in motion, for an academy without the 0009 table: one family
 * enrolled today (welcome not sent), one at day eight (week-one call due), one
 * at day three (nothing due yet), one at day twenty-nine (first-month review
 * due). Plus an enquiry whose first call went unanswered yesterday. Those are
 * the states the screen exists for.
 */
export function seedOnboarding(
  academyId: ID,
  leads: Lead[],
  students: Student[],
  asOf: ISODate = TODAY,
): { touches: Touch[]; enrolledOverride: Record<ID, ISODate> } {
  const touches: Touch[] = [];
  const enrolledOverride: Record<ID, ISODate> = {};
  let n = 0;
  const add = (who: { leadId?: ID; studentId?: ID }, step: TouchStep, outcome: TouchOutcome, day: ISODate, note = '') =>
    touches.push({
      id: `seed-touch-${(n += 1)}`,
      academyId,
      leadId: who.leadId ?? null,
      studentId: who.studentId ?? null,
      step,
      outcome,
      note,
      actorName: '',
      at: `${day}T18:30:00`,
    });

  // One student per class, so the four land in four different rosters.
  const seen = new Set<ID>();
  const picks = students.filter((s) => {
    if (s.status !== 'active' || seen.has(s.classId)) return false;
    seen.add(s.classId);
    return true;
  });

  const [today, week, early, month] = picks;
  if (today) enrolledOverride[today.id] = asOf;
  if (week) {
    enrolledOverride[week.id] = addDays(asOf, -8);
    add({ studentId: week.id }, 'welcome', 'done', addDays(asOf, -8));
  }
  if (early) {
    enrolledOverride[early.id] = addDays(asOf, -3);
    add({ studentId: early.id }, 'welcome', 'done', addDays(asOf, -3));
  }
  if (month) {
    enrolledOverride[month.id] = addDays(asOf, -29);
    add({ studentId: month.id }, 'welcome', 'done', addDays(asOf, -29));
    add({ studentId: month.id }, 'week1', 'done', addDays(asOf, -21));
  }

  const phoned = leads.find((l) => l.stage === 'inquiry' && l.source === 'phone');
  if (phoned) add({ leadId: phoned.id }, 'first_call', 'no_answer', addDays(asOf, -1));

  return { touches, enrolledOverride };
}

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

export function touchFromRow(r: Row): Touch {
  return {
    id: r.id,
    academyId: r.academy_id,
    leadId: r.lead_id ?? null,
    studentId: r.student_id ?? null,
    step: r.step,
    outcome: r.outcome,
    note: r.note ?? '',
    actorName: r.actor_name ?? '',
    at: r.created_at,
  };
}

export function touchToRow(t: Touch): Row {
  return {
    id: t.id,
    academy_id: t.academyId,
    lead_id: t.leadId,
    student_id: t.studentId,
    step: t.step,
    outcome: t.outcome,
    note: t.note,
    actor_name: t.actorName,
    created_at: t.at,
  };
}
