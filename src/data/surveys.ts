/**
 * 설문 — questions the centre asks parents it already knows.
 *
 * The 문의 pipeline (`crm.ts`) is for strangers: an open link, anyone can fill
 * it in, and every answer becomes a lead. This is the other half — a question
 * sent to *this* child's guardian, through a link only they hold, so the
 * answer arrives already attached to a student and nobody has to type the
 * child's name twice.
 *
 * What earns a survey instead of a phone call, decided on what an academy
 * actually does in a month:
 *
 *   survey — the same short question to many families (대회 참가, 촬영 동의,
 *            유니폼 사이즈), where the answer is a pick and a record is worth
 *            keeping. Twenty calls for twenty yes/no answers is an evening
 *            gone; a KakaoTalk group thread is twenty answers nobody counts.
 *   call   — one family, and something to talk through: an injury, fees, a
 *            class change, a complaint, a child who wants to stop. A form in
 *            those moments reads as the centre avoiding the conversation.
 *
 * The two meet in one place, and that is the point of this module: a survey
 * can flag an answer as "call about this" (`!` after a choice). 재등록 의향
 * goes to thirty families; the two who pick "고민 중이에요" come back as a call
 * list, not as a row in a spreadsheet. The form does the counting so the
 * phone is spent where it matters.
 */

import type { ID, ISODate, Student } from '@/types';
import { TODAY, addDays, diffDays } from './dates';

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export type SurveyKind =
  | 'rsvp'
  | 'schedule'
  | 'consent'
  | 'renewal'
  | 'satisfaction'
  | 'order'
  | 'enrollment'
  | 'custom';

/**
 * One question. No `type` field: a question with choices is a pick, one
 * without is a sentence. Everything a centre asks fits in those two, and a
 * third type is a third thing every parent has to learn.
 */
export interface Question {
  label: string;
  /** Empty = free text. */
  choices: string[];
  /** Several choices may be picked. */
  multi: boolean;
  /** Choices that put this family on the call list. Subset of `choices`. */
  flagged: string[];
}

export interface Survey {
  id: ID;
  academyId: ID;
  kind: SurveyKind;
  title: string;
  questions: Question[];
  /** The classes it went to. Empty for a one-family survey (등록 신청서). */
  classIds: ID[];
  /** Last day a parent can answer. `null` = until closed. */
  dueDate: ISODate | null;
  closed: boolean;
  createdAt: string;
}

/**
 * One family's copy of a survey. Exactly one of `studentId` / `leadId` is set:
 * a student's guardian, or a family that has not enrolled yet.
 *
 * The token is the whole of the parent's identity — the link they got in
 * 알림톡. It is what lets the page greet them by the child's name and lets
 * the answer land on the right row without a login.
 */
export interface SurveyRecipient {
  id: ID;
  surveyId: ID;
  academyId: ID;
  studentId: ID | null;
  leadId: ID | null;
  token: string;
  /** Question label → answer. Multi-picks are joined with ", ". */
  answers: Record<string, string>;
  answeredAt: string | null;
  remindedAt: string | null;
  /** When someone rang about a flagged answer. Takes the family off the call list. */
  calledAt: string | null;
}

// ---------------------------------------------------------------------------
// Situations
// ---------------------------------------------------------------------------

/**
 * What the owner picks from when they tap 새 폼. Each is a sensible default
 * for a real moment in the term — the title, the questions and the deadline
 * are all filled in, so the common case is two taps and 보내기. The
 * questions are written in the same text the editor shows (`parseQuestions`),
 * so "edit the preset" and "write your own" are one feature.
 */
export interface Situation {
  kind: SurveyKind;
  label: string;
  /** When you'd reach for it — one line under the label. */
  when: string;
  title: string;
  questions: string;
  /** Days until the deadline, or `null` for no deadline. */
  dueDays: number | null;
}

export const SITUATIONS: Record<SurveyKind, Situation> = {
  rsvp: {
    kind: 'rsvp',
    label: '참가 조사',
    when: '대회·캠프·친선경기, 인원을 세야 할 때',
    title: '대회 참가 조사',
    questions: ['참가하나요? : 참가 / 불참', '코치에게 전할 말'].join('\n'),
    dueDays: 3,
  },
  schedule: {
    kind: 'schedule',
    label: '일정 조사',
    when: '보강일이나 새 반 시간을 정할 때',
    title: '보강 일정 조사',
    questions: [
      '가능한 요일 (복수) : 월 / 화 / 수 / 목 / 금 / 토 / 일',
      '가능한 시간 (복수) : 오후 4시 / 오후 5시 / 오후 6시 / 오후 7시',
    ].join('\n'),
    dueDays: 3,
  },
  consent: {
    kind: 'consent',
    label: '동의서',
    when: '촬영·원정처럼 기록이 남아야 할 때',
    title: '수업 사진·영상 촬영 동의',
    questions: '수업 사진·영상을 센터 소식에 싣는 것에 동의하시나요? : 동의 / 동의하지 않음',
    dueDays: 7,
  },
  renewal: {
    kind: 'renewal',
    label: '재등록 의향',
    when: '다음 달 인원을 미리 알고, 고민 중인 가족을 먼저 찾을 때',
    title: '다음 달 수업 안내',
    questions: [
      '다음 달에도 함께하나요? : 계속할게요 / 고민 중이에요! / 쉬려고 해요!',
      '고민되는 점이 있다면 알려 주세요',
    ].join('\n'),
    dueDays: 5,
  },
  satisfaction: {
    kind: 'satisfaction',
    label: '만족도',
    when: '학기 끝에 한 번, 수업을 돌아볼 때',
    title: '이번 학기 수업 만족도',
    questions: [
      '이번 학기 수업은 어떠셨나요? : 아주 좋아요 / 좋아요 / 보통이에요 / 아쉬워요!',
      '더 바라는 점',
    ].join('\n'),
    dueDays: 7,
  },
  order: {
    kind: 'order',
    label: '물품 신청',
    when: '유니폼·용품 사이즈를 모을 때',
    title: '유니폼 사이즈 조사',
    questions: [
      '유니폼 사이즈 : 110 / 120 / 130 / 140 / 150 / 160',
      '수량 : 1벌 / 2벌',
    ].join('\n'),
    dueDays: 5,
  },
  enrollment: {
    kind: 'enrollment',
    label: '등록 신청서',
    when: '체험을 마친 가정에게, 등록 전에 한 번',
    title: '등록 신청서',
    questions: [
      '아이 생년월일',
      '다니는 학교와 학년',
      '건강상 알아야 할 점 (알레르기·지병 등)',
      '보호자 외 비상 연락처',
      '수업 사진·영상 촬영에 동의하시나요? : 동의 / 동의하지 않음',
    ].join('\n'),
    dueDays: 7,
  },
  custom: {
    kind: 'custom',
    label: '직접 만들기',
    when: '위에 없는 것을 물을 때',
    title: '',
    questions: '',
    dueDays: 3,
  },
};

/** The picker's order — most frequent first. 등록 신청서 is sent from a lead, not from here. */
export const PICKER: readonly SurveyKind[] = [
  'rsvp',
  'renewal',
  'consent',
  'schedule',
  'order',
  'satisfaction',
  'custom',
] as const;

/**
 * Said next to the picker, once. The most useful thing this screen can do in
 * those moments is not offer a form for them.
 */
export const CALL_INSTEAD = '부상·사고, 수업료, 반 변경, 불만, 그만두려는 가정';

// ---------------------------------------------------------------------------
// Question text
// ---------------------------------------------------------------------------

/**
 * One question per line:
 *
 *   코치에게 전할 말                         → a sentence
 *   참가하나요? : 참가 / 불참                  → a pick
 *   가능한 요일 (복수) : 월 / 화 / 수          → several picks
 *   다음 달에도? : 계속 / 고민 중! / 쉴게요!    → `!` = call this family
 *
 * Plain text because a phone keyboard is the editor, and because the owner who
 * wants something the presets don't cover should be able to just write it.
 * The syntax has three marks and every preset demonstrates all of them.
 */
export const MAX_QUESTIONS = 10;
export const MAX_CHOICES = 12;
const MULTI_MARK = '(복수)';

export function parseQuestions(text: string): Question[] {
  const out: Question[] = [];

  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;

    const colon = line.indexOf(':');
    const head = (colon === -1 ? line : line.slice(0, colon)).trim();
    const tail = colon === -1 ? '' : line.slice(colon + 1);

    const multi = head.includes(MULTI_MARK);
    const label = head.replace(MULTI_MARK, '').replace(/\s+/g, ' ').trim().slice(0, 120);
    if (!label) continue;

    const choices: string[] = [];
    const flagged: string[] = [];
    for (const part of tail.split('/')) {
      let choice = part.trim();
      const flag = choice.endsWith('!');
      if (flag) choice = choice.replace(/!+$/, '').trim();
      if (!choice || choices.includes(choice)) continue;
      choices.push(choice.slice(0, 40));
      if (flag) flagged.push(choice.slice(0, 40));
    }

    // Labels are answer keys. Two questions with the same words would write
    // over each other's answers, so the second one is dropped.
    if (out.some((q) => q.label === label)) continue;

    out.push({
      label,
      choices: choices.slice(0, MAX_CHOICES),
      multi: multi && choices.length > 1,
      flagged: flagged.filter((f) => choices.slice(0, MAX_CHOICES).includes(f)),
    });
    if (out.length === MAX_QUESTIONS) break;
  }

  return out;
}

/** The inverse of `parseQuestions` — what the editor shows for a stored survey. */
export function serializeQuestions(questions: Question[]): string {
  return questions
    .map((q) => {
      const head = q.multi ? `${q.label} ${MULTI_MARK}` : q.label;
      if (q.choices.length === 0) return head;
      const choices = q.choices.map((c) => (q.flagged.includes(c) ? `${c}!` : c)).join(' / ');
      return `${head} : ${choices}`;
    })
    .join('\n');
}

// ---------------------------------------------------------------------------
// Derived signals
// ---------------------------------------------------------------------------

/** Answers are stored joined; this is the list a parent actually picked. */
export const picksOf = (answer: string | undefined): string[] =>
  (answer ?? '')
    .split(', ')
    .map((s) => s.trim())
    .filter(Boolean);

/** The flagged answers this family gave, e.g. `['고민 중이에요']`. */
export function flaggedAnswers(survey: Survey, recipient: SurveyRecipient): string[] {
  if (!recipient.answeredAt) return [];
  return survey.questions.flatMap((q) =>
    picksOf(recipient.answers[q.label]).filter((p) => q.flagged.includes(p)),
  );
}

export const needsCall = (survey: Survey, recipient: SurveyRecipient): boolean =>
  recipient.calledAt === null && flaggedAnswers(survey, recipient).length > 0;

/** Still taking answers: not closed by hand and not past its last day. */
export const isOpenSurvey = (survey: Survey, asOf: ISODate = TODAY): boolean =>
  !survey.closed && (survey.dueDate === null || survey.dueDate >= asOf);

export interface SurveyProgress {
  total: number;
  answered: number;
  pending: SurveyRecipient[];
  toCall: SurveyRecipient[];
  /** Days left, 0 = today is the last day, `null` = no deadline or closed. */
  daysLeft: number | null;
}

export function progressOf(
  survey: Survey,
  recipients: SurveyRecipient[],
  asOf: ISODate = TODAY,
): SurveyProgress {
  const mine = recipients.filter((r) => r.surveyId === survey.id);
  return {
    total: mine.length,
    answered: mine.filter((r) => r.answeredAt).length,
    pending: mine.filter((r) => !r.answeredAt),
    toCall: mine.filter((r) => needsCall(survey, r)),
    daysLeft:
      isOpenSurvey(survey, asOf) && survey.dueDate ? diffDays(survey.dueDate, asOf) : null,
  };
}

export interface ChoiceTally {
  choice: string;
  flagged: boolean;
  recipientIds: ID[];
}

/** How many picked each choice, in the order the question lists them. */
export function tallyOf(question: Question, recipients: SurveyRecipient[]): ChoiceTally[] {
  return question.choices.map((choice) => ({
    choice,
    flagged: question.flagged.includes(choice),
    recipientIds: recipients
      .filter((r) => r.answeredAt && picksOf(r.answers[question.label]).includes(choice))
      .map((r) => r.id),
  }));
}

/** "마감 D-2", "오늘 마감", "마감됨", "상시". */
export function dueLabel(survey: Survey, asOf: ISODate = TODAY): string {
  if (!isOpenSurvey(survey, asOf)) return '마감됨';
  if (!survey.dueDate) return '상시';
  const left = diffDays(survey.dueDate, asOf);
  return left === 0 ? '오늘 마감' : `마감 D-${left}`;
}

/**
 * The plain-text result, for pasting into the class KakaoTalk room or a
 * tournament entry form — which is where a 참가 조사 actually ends up.
 */
export function summaryText(
  survey: Survey,
  recipients: SurveyRecipient[],
  nameOf: (r: SurveyRecipient) => string,
): string {
  const mine = recipients.filter((r) => r.surveyId === survey.id);
  const lines = [`[${survey.title}] 응답 ${mine.filter((r) => r.answeredAt).length}/${mine.length}`];

  for (const q of survey.questions) {
    if (q.choices.length === 0) continue;
    lines.push('', q.label);
    for (const t of tallyOf(q, mine)) {
      const names = t.recipientIds
        .map((id) => nameOf(mine.find((r) => r.id === id)!))
        .join(', ');
      lines.push(`· ${t.choice} ${t.recipientIds.length}${names ? ` — ${names}` : ''}`);
    }
  }

  const pending = mine.filter((r) => !r.answeredAt);
  if (pending.length > 0) lines.push('', `미응답 ${pending.length} — ${pending.map(nameOf).join(', ')}`);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

const uid = (): ID =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;

/**
 * Sixteen characters from an unambiguous alphabet — 80 bits. The token is the
 * parent's only credential, and it opens a page with their child's name on it,
 * so it is twice the length of a public form slug.
 */
export function newToken(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

/** The address in the parent's 알림톡. Query string for the same reason as `formUrl`. */
export function surveyUrl(token: string): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}?s=${encodeURIComponent(token)}`;
}

export function newSurvey(academyId: ID, fields: Partial<Survey> = {}): Survey {
  return {
    id: uid(),
    academyId,
    kind: 'custom',
    title: '',
    questions: [],
    classIds: [],
    dueDate: null,
    closed: false,
    createdAt: new Date().toISOString(),
    ...fields,
  };
}

export function newRecipient(
  survey: Survey,
  to: { studentId: ID } | { leadId: ID },
): SurveyRecipient {
  return {
    id: uid(),
    surveyId: survey.id,
    academyId: survey.academyId,
    studentId: 'studentId' in to ? to.studentId : null,
    leadId: 'leadId' in to ? to.leadId : null,
    token: newToken(),
    answers: {},
    answeredAt: null,
    remindedAt: null,
    calledAt: null,
  };
}

/** Deadline chips in the composer, and what each resolves to. */
export const DUE_CHOICES: Array<{ label: string; days: number | null }> = [
  { label: '내일', days: 1 },
  { label: '3일', days: 3 },
  { label: '1주', days: 7 },
  { label: '없음', days: null },
];

export const dueFromDays = (days: number | null, asOf: ISODate = TODAY): ISODate | null =>
  days === null ? null : addDays(asOf, days);

// ---------------------------------------------------------------------------
// Seed — local mode only
// ---------------------------------------------------------------------------

/**
 * Two surveys mid-flight, for an academy without the 0007 tables: a 재등록
 * 의향 that has already turned up families to call, and a 참가 조사 closing
 * the day after tomorrow with half the class still silent. Those are the two
 * states the screen exists to surface; a seed where everyone has answered
 * would demonstrate nothing.
 */
export function seedSurveys(
  academyId: ID,
  students: Student[],
  classIds: ID[],
): { surveys: Survey[]; recipients: SurveyRecipient[] } {
  const [first, second] = classIds;
  if (!first) return { surveys: [], recipients: [] };

  const at = (days: number, hour = 10) =>
    `${addDays(TODAY, -days)}T${`${hour}`.padStart(2, '0')}:00:00`;

  const renewal = newSurvey(academyId, {
    kind: 'renewal',
    title: SITUATIONS.renewal.title,
    questions: parseQuestions(SITUATIONS.renewal.questions),
    classIds: [first],
    dueDate: addDays(TODAY, 2),
    createdAt: at(3),
  });

  const rsvp = newSurvey(academyId, {
    kind: 'rsvp',
    title: '10월 유소년 리그 참가 조사',
    questions: parseQuestions(SITUATIONS.rsvp.questions),
    classIds: [second ?? first],
    dueDate: addDays(TODAY, 1),
    createdAt: at(1, 18),
  });

  const recipients: SurveyRecipient[] = [];
  const renewalAnswers = ['계속할게요', '계속할게요', '고민 중이에요', '계속할게요', '쉬려고 해요'];
  const renewalNotes: Record<number, string> = {
    2: '학원 시간이 겹쳐서 요일을 바꿀 수 있을지 궁금해요',
    4: '요즘 아이가 흥미를 잃은 것 같아요',
  };

  students
    .filter((s) => s.classId === first)
    .slice(0, 9)
    .forEach((s, i) => {
      const r = newRecipient(renewal, { studentId: s.id });
      if (i < renewalAnswers.length) {
        r.answers = { [renewal.questions[0].label]: renewalAnswers[i] };
        if (renewalNotes[i]) r.answers[renewal.questions[1].label] = renewalNotes[i];
        r.answeredAt = at(2 - (i % 2), 20);
      }
      recipients.push(r);
    });

  students
    .filter((s) => s.classId === (second ?? first))
    .slice(0, 10)
    .forEach((s, i) => {
      const r = newRecipient(rsvp, { studentId: s.id });
      if (i < 4) {
        r.answers = { [rsvp.questions[0].label]: i === 2 ? '불참' : '참가' };
        r.answeredAt = at(0, 8 + i);
      }
      recipients.push(r);
    });

  return { surveys: [renewal, rsvp], recipients };
}

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

export function surveyFromRow(r: Row): Survey {
  return {
    id: r.id,
    academyId: r.academy_id,
    kind: r.kind,
    title: r.title ?? '',
    questions: (r.questions as Question[]) ?? [],
    classIds: r.class_ids ?? [],
    dueDate: r.due_date ?? null,
    closed: !!r.closed,
    createdAt: r.created_at,
  };
}

export function surveyToRow(s: Survey): Row {
  return {
    id: s.id,
    academy_id: s.academyId,
    kind: s.kind,
    title: s.title,
    questions: s.questions,
    class_ids: s.classIds,
    due_date: s.dueDate,
    closed: s.closed,
    created_at: s.createdAt,
  };
}

export function recipientFromRow(r: Row): SurveyRecipient {
  return {
    id: r.id,
    surveyId: r.survey_id,
    academyId: r.academy_id,
    studentId: r.student_id ?? null,
    leadId: r.lead_id ?? null,
    token: r.token,
    answers: (r.answers as Record<string, string>) ?? {},
    answeredAt: r.answered_at ?? null,
    remindedAt: r.reminded_at ?? null,
    calledAt: r.called_at ?? null,
  };
}

/**
 * Only the columns the app may insert. Answers are the parent's, and the
 * database refuses to take them from anyone but `submit_survey()`.
 */
export function recipientToRow(r: SurveyRecipient): Row {
  return {
    id: r.id,
    survey_id: r.surveyId,
    academy_id: r.academyId,
    student_id: r.studentId,
    lead_id: r.leadId,
    token: r.token,
  };
}
