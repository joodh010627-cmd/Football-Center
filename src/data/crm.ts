/**
 * 문의 → 체험 → 등록 파이프라인.
 *
 * Why this is a pipeline and not a list of phone numbers: a football centre's
 * roster turns over fast, so the number that decides whether the centre grows is
 * not how many enquiries arrive but how many of them are still being handled
 * three days later. A list can't tell you that. A stage with a clock can.
 *
 * Everything here is client-side for now — there is no `leads` table yet. The
 * shapes are written as if there were one (flat rows, `academyId` on every
 * record, ids minted the same way) so the day it lands is a mapper, not a
 * rewrite. See `docs/PRODUCTIZATION.md` for why the DB work waits on a pilot.
 */

import type { ID, ISODate } from '@/types';
import { TODAY, addDays, dayOf, diffDays } from './dates';

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

/**
 * Where an enquiry has got to.
 *
 * `lost` is a terminal stage with a reason, not a deletion. An enquiry that went
 * nowhere is the most useful record in the table — it is the only place the
 * centre learns *why* people don't sign up.
 */
export type LeadStage =
  | 'inquiry'
  | 'contacted'
  | 'trial_booked'
  | 'trial_done'
  | 'enrolled'
  | 'lost';

export type LeadSource = 'form' | 'phone' | 'walk_in' | 'referral' | 'social';

export interface Lead {
  id: ID;
  academyId: ID;
  /** The child. Free text, and the age group is free text too — an enquiry
   *  arrives saying "8살" long before anyone decides which class that is. */
  childName: string;
  ageLabel: string;
  parentName: string;
  parentPhone: string;
  stage: LeadStage;
  source: LeadSource;
  /** Which form link produced this, when it came in through one. */
  formLinkId: ID | null;
  /** The class the parent asked about. `null` = undecided. */
  interestClassId: ID | null;
  trialDate: ISODate | null;
  trialClassId: ID | null;
  memo: string;
  /** ISO datetime. */
  createdAt: string;
  /** ISO datetime — when the stage last moved. Drives the overdue clock. */
  stageChangedAt: string;
  /** Set when the lead converts; links the enquiry to the student row. */
  enrolledStudentId: ID | null;
  lostReason: string;
}

/** A shareable link that collects enquiries — the centre's front door. */
export interface FormLink {
  id: ID;
  academyId: ID;
  title: string;
  kind: FormKind;
  /** The path fragment a parent would open. */
  slug: string;
  /** Which fields the parent is asked for, beyond name and phone. */
  fields: string[];
  active: boolean;
  createdAt: string;
  /** How many enquiries arrived through it. */
  submissions: number;
}

export type FormKind = 'inquiry' | 'trial' | 'enrollment' | 'survey';

// ---------------------------------------------------------------------------
// Stage metadata
// ---------------------------------------------------------------------------

export interface StageMeta {
  label: string;
  /** What the centre owes the parent at this stage. */
  duty: string;
  /** The button that moves it on. */
  action: string;
  /** Days before this stage counts as neglected. `null` = no clock. */
  slaDays: number | null;
  /** Tailwind classes for the stage pill. */
  pill: string;
  dot: string;
}

/**
 * The clocks are short on purpose. A parent who filled in a form on Saturday
 * morning and hasn't been called by Sunday has already messaged two other
 * centres — an SLA of a week would be a clock that never goes off.
 */
export const STAGE_META: Record<LeadStage, StageMeta> = {
  inquiry: {
    label: '신규 문의',
    duty: '아직 아무도 연락하지 않았습니다',
    action: '상담 완료로 표시',
    slaDays: 1,
    pill: 'bg-tint-yellow-bold text-charcoal',
    dot: 'bg-stone',
  },
  contacted: {
    label: '상담 완료',
    duty: '체험 날짜를 잡을 차례입니다',
    action: '체험 예약',
    slaDays: 3,
    pill: 'bg-tint-sky text-brand-teal',
    dot: 'bg-brand-teal',
  },
  trial_booked: {
    label: '체험 예약',
    duty: '체험 하루 전 안내를 보냅니다',
    action: '체험 완료로 표시',
    slaDays: null,
    pill: 'bg-primary-wash text-primary',
    dot: 'bg-primary',
  },
  trial_done: {
    label: '체험 완료',
    duty: '등록 여부를 확인할 차례입니다',
    action: '등록 확정',
    slaDays: 2,
    pill: 'bg-tint-peach text-brand-orange-deep',
    dot: 'bg-brand-orange',
  },
  enrolled: {
    label: '등록 완료',
    duty: '원생으로 전환되었습니다',
    action: '원생 카드 보기',
    slaDays: null,
    pill: 'bg-tint-mint text-brand-green',
    dot: 'bg-success',
  },
  lost: {
    label: '미등록',
    duty: '등록으로 이어지지 않았습니다',
    action: '다시 열기',
    slaDays: null,
    pill: 'bg-surface text-steel',
    dot: 'bg-stone',
  },
};

/** The order a lead walks the pipeline. `lost` is off to the side, not at the end. */
export const PIPELINE: readonly LeadStage[] = [
  'inquiry',
  'contacted',
  'trial_booked',
  'trial_done',
  'enrolled',
] as const;

/** Stages that still need someone to do something. */
export const OPEN_STAGES: readonly LeadStage[] = [
  'inquiry',
  'contacted',
  'trial_booked',
  'trial_done',
] as const;

export const SOURCE_LABEL: Record<LeadSource, string> = {
  form: '온라인 폼',
  phone: '전화',
  walk_in: '방문',
  referral: '소개',
  social: 'SNS',
};

export const FORM_KIND_LABEL: Record<FormKind, string> = {
  inquiry: '문의 접수',
  trial: '체험 신청',
  enrollment: '등록 신청',
  survey: '설문',
};

/** The next stage in the pipeline, or `null` at the end. */
export function nextStage(stage: LeadStage): LeadStage | null {
  const i = PIPELINE.indexOf(stage);
  if (i === -1 || i === PIPELINE.length - 1) return null;
  return PIPELINE[i + 1];
}

// ---------------------------------------------------------------------------
// Derived signals
// ---------------------------------------------------------------------------

export const isOpen = (lead: Lead): boolean =>
  (OPEN_STAGES as readonly string[]).includes(lead.stage);

/**
 * Days a lead has been sitting in its current stage.
 *
 * `dayOf` rather than a slice: an enquiry taken at 08:00 in Seoul carries
 * yesterday's UTC date, and an SLA that goes off a day early is an SLA people
 * learn to ignore.
 */
export const daysWaiting = (lead: Lead, asOf: ISODate = TODAY): number =>
  diffDays(asOf, dayOf(lead.stageChangedAt));

/**
 * Has this lead been left too long?
 *
 * Only open stages have a clock — an enrolled lead sitting untouched for a month
 * is a lead that did its job.
 */
export function isOverdue(lead: Lead, asOf: ISODate = TODAY): boolean {
  const sla = STAGE_META[lead.stage].slaDays;
  if (sla === null || !isOpen(lead)) return false;
  return daysWaiting(lead, asOf) > sla;
}

/**
 * The queue, worst first: overdue before on-time, then longest wait, then
 * newest. Sorting by recency alone buries the enquiry from four days ago under
 * the three that came in this morning — which is exactly how leads go cold.
 */
export function triage(leads: Lead[], asOf: ISODate = TODAY): Lead[] {
  return [...leads].sort((a, b) => {
    const overdue = Number(isOverdue(b, asOf)) - Number(isOverdue(a, asOf));
    if (overdue !== 0) return overdue;
    const wait = daysWaiting(b, asOf) - daysWaiting(a, asOf);
    if (wait !== 0) return wait;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export interface LeadCounts {
  /** Stage → how many leads are in it. */
  byStage: Record<LeadStage, number>;
  /** Everything still needing action. */
  open: number;
  /** Open and past its SLA. The number the 폼 tab badges. */
  overdue: number;
  /** Trials booked for today or later. */
  upcomingTrials: number;
  /** Enquiries that arrived today. */
  todayInquiries: number;
  /** enrolled ÷ (enrolled + lost), or `null` before anything has resolved. */
  conversionRate: number | null;
}

export function countLeads(leads: Lead[], asOf: ISODate = TODAY): LeadCounts {
  const byStage = {
    inquiry: 0,
    contacted: 0,
    trial_booked: 0,
    trial_done: 0,
    enrolled: 0,
    lost: 0,
  } as Record<LeadStage, number>;

  let overdue = 0;
  let upcomingTrials = 0;
  let todayInquiries = 0;

  for (const lead of leads) {
    byStage[lead.stage] += 1;
    if (isOverdue(lead, asOf)) overdue += 1;
    if (lead.stage === 'trial_booked' && lead.trialDate && lead.trialDate >= asOf) {
      upcomingTrials += 1;
    }
    if (dayOf(lead.createdAt) === asOf) todayInquiries += 1;
  }

  const resolved = byStage.enrolled + byStage.lost;

  return {
    byStage,
    open: OPEN_STAGES.reduce((sum, s) => sum + byStage[s], 0),
    overdue,
    upcomingTrials,
    todayInquiries,
    conversionRate: resolved > 0 ? byStage.enrolled / resolved : null,
  };
}

/** Trials happening on a given day — the 일정 tab folds these in beside classes. */
export const trialsOn = (leads: Lead[], date: ISODate): Lead[] =>
  leads.filter((l) => l.trialDate === date && l.stage !== 'lost');

// ---------------------------------------------------------------------------
// Onboarding checklist
// ---------------------------------------------------------------------------

/**
 * What still has to happen before this enquiry is a settled student.
 *
 * Rendered as a checklist on the lead card rather than inferred from the stage
 * alone, because the steps genuinely aren't sequential: a parent can pay before
 * the trial, and the uniform order goes in whenever it goes in. The stage says
 * where the *conversation* is; this says what is outstanding.
 */
export interface OnboardingStep {
  key: string;
  label: string;
  done: boolean;
  /** Shown under the label when the step isn't done yet. */
  hint: string;
}

export function onboardingSteps(lead: Lead): OnboardingStep[] {
  const reached = (stage: LeadStage) => PIPELINE.indexOf(lead.stage) >= PIPELINE.indexOf(stage);

  return [
    {
      key: 'contact',
      label: '첫 상담 연락',
      done: reached('contacted'),
      hint: `${STAGE_META.inquiry.slaDays}일 안에 연락하는 것이 목표입니다`,
    },
    {
      key: 'trial',
      label: '체험 수업 일정',
      done: lead.trialDate !== null,
      hint: '날짜가 정해지면 학부모에게 안내가 나갑니다',
    },
    {
      key: 'attend',
      label: '체험 참석',
      done: reached('trial_done'),
      hint: '체험 당일 출결에서 기록됩니다',
    },
    {
      key: 'class',
      label: '반 배정',
      done: lead.interestClassId !== null,
      hint: '연령과 요일이 맞는 반을 고릅니다',
    },
    {
      key: 'enroll',
      label: '등록 확정',
      done: lead.stage === 'enrolled',
      hint: '확정하면 원생 명단에 추가됩니다',
    },
  ];
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

const uid = (): ID =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;

export function newLead(academyId: ID, fields: Partial<Lead> = {}): Lead {
  const now = new Date().toISOString();
  return {
    id: uid(),
    academyId,
    childName: '',
    ageLabel: '',
    parentName: '',
    parentPhone: '',
    stage: 'inquiry',
    source: 'phone',
    formLinkId: null,
    interestClassId: null,
    trialDate: null,
    trialClassId: null,
    memo: '',
    createdAt: now,
    stageChangedAt: now,
    enrolledStudentId: null,
    lostReason: '',
    ...fields,
  };
}

export function newFormLink(academyId: ID, fields: Partial<FormLink> = {}): FormLink {
  return {
    id: uid(),
    academyId,
    title: '',
    kind: 'inquiry',
    slug: `form-${Math.random().toString(36).slice(2, 8)}`,
    fields: ['학부모 성함', '연락처', '아이 이름', '나이'],
    active: true,
    createdAt: new Date().toISOString(),
    submissions: 0,
    ...fields,
  };
}

/**
 * A plausible opening pipeline, for an academy that has no `leads` table yet.
 *
 * Dated relative to today so the SLA clocks actually read as overdue — a seed
 * where everything is comfortably on time would demonstrate nothing. Replaced
 * wholesale the moment real enquiries exist.
 */
export function seedLeads(academyId: ID, classIds: ID[]): Lead[] {
  // No `Z`: these are wall-clock times at the academy, not UTC instants.
  const at = (days: number, hour = 10) =>
    `${addDays(TODAY, -days)}T${`${hour}`.padStart(2, '0')}:00:00`;
  const pick = (i: number): ID | null => classIds[i % Math.max(classIds.length, 1)] ?? null;

  const rows: Array<Partial<Lead> & { childName: string }> = [
    {
      childName: '김지우',
      ageLabel: 'U10',
      parentName: '김서연',
      parentPhone: '010-2841-7730',
      stage: 'inquiry',
      source: 'form',
      createdAt: at(0, 9),
      stageChangedAt: at(0, 9),
      memo: '주 2회 반을 찾고 있습니다. 토요일 오전 가능한지 문의.',
      interestClassId: pick(0),
    },
    {
      childName: '이도윤',
      ageLabel: 'U8',
      parentName: '이현수',
      parentPhone: '010-9932-1184',
      stage: 'inquiry',
      source: 'form',
      createdAt: at(0, 11),
      stageChangedAt: at(0, 11),
      memo: '형이 다니고 있어 동생도 같이 보내고 싶다고 함.',
      interestClassId: pick(1),
    },
    {
      childName: '박하준',
      ageLabel: 'U11',
      parentName: '박정민',
      parentPhone: '010-3377-2098',
      stage: 'inquiry',
      source: 'phone',
      // Two days in 신규 문의 — past the one-day clock, so the queue opens red.
      createdAt: at(2, 14),
      stageChangedAt: at(2, 14),
      memo: '전화 문의. 다른 센터와 비교 중이라고 함.',
    },
    {
      childName: '최서준',
      ageLabel: 'U9',
      parentName: '최민경',
      parentPhone: '010-4412-6651',
      stage: 'contacted',
      source: 'referral',
      createdAt: at(4),
      stageChangedAt: at(1),
      memo: '체험 희망. 평일 저녁만 가능.',
      interestClassId: pick(0),
    },
    {
      childName: '정유나',
      ageLabel: 'U10',
      parentName: '정다은',
      parentPhone: '010-7781-3320',
      stage: 'trial_booked',
      source: 'social',
      createdAt: at(6),
      stageChangedAt: at(3),
      trialDate: TODAY,
      trialClassId: pick(0),
      memo: '인스타그램 보고 문의. 오늘 체험 예정.',
    },
    {
      childName: '한지호',
      ageLabel: 'U12',
      parentName: '한승우',
      parentPhone: '010-2264-9017',
      stage: 'trial_booked',
      source: 'form',
      createdAt: at(5),
      stageChangedAt: at(2),
      trialDate: addDays(TODAY, 2),
      trialClassId: pick(1),
    },
    {
      childName: '오시윤',
      ageLabel: 'U9',
      parentName: '오세진',
      parentPhone: '010-5590-4428',
      stage: 'trial_done',
      source: 'walk_in',
      createdAt: at(9),
      // Three days since the trial with no decision — also overdue.
      stageChangedAt: at(3),
      trialDate: addDays(TODAY, -3),
      trialClassId: pick(0),
      memo: '체험 후 아이는 만족. 수업료 상담 남음.',
      interestClassId: pick(0),
    },
    {
      childName: '강태현',
      ageLabel: 'U11',
      parentName: '강나영',
      parentPhone: '010-8803-5512',
      stage: 'enrolled',
      source: 'referral',
      createdAt: at(21),
      stageChangedAt: at(12),
      trialDate: addDays(TODAY, -16),
      interestClassId: pick(1),
    },
    {
      childName: '윤시우',
      ageLabel: 'U8',
      parentName: '윤경호',
      parentPhone: '010-6627-7781',
      stage: 'lost',
      source: 'form',
      createdAt: at(24),
      stageChangedAt: at(15),
      lostReason: '거리가 멀어 통원이 어렵다고 함',
    },
  ];

  return rows.map((row) => newLead(academyId, row));
}

export function seedFormLinks(academyId: ID): FormLink[] {
  return [
    newFormLink(academyId, {
      title: '체험 수업 신청',
      kind: 'trial',
      slug: 'trial',
      fields: ['학부모 성함', '연락처', '아이 이름', '나이', '희망 요일'],
      submissions: 12,
      createdAt: `${addDays(TODAY, -40)}T09:00:00`,
    }),
    newFormLink(academyId, {
      title: '일반 문의',
      kind: 'inquiry',
      slug: 'ask',
      fields: ['학부모 성함', '연락처', '문의 내용'],
      submissions: 7,
      createdAt: `${addDays(TODAY, -40)}T09:00:00`,
    }),
  ];
}
