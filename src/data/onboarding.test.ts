import { describe, expect, it } from 'vitest';
import type { AttendanceLog, Class, Student } from '@/types';
import { newLead, type Lead } from './crm';
import { newRecipient, newSurvey, parseQuestions, SITUATIONS } from './surveys';
import {
  buildFamilies,
  firstClassOn,
  isDue,
  todayQueue,
  type Family,
  type JourneyInput,
  type Touch,
  type TouchOutcome,
  type TouchStep,
} from './onboarding';
import { addDays } from './dates';

// 2026-09-30 is a Wednesday. The class meets Mon/Wed.
const TODAY = '2026-09-30';
const cls = {
  id: 'c1',
  academyId: 'a',
  title: 'U9',
  coachId: 'k',
  schedule: { days: [1, 3], startTime: '16:00', durationMin: 60 },
  ageGroup: 'U9',
  capacity: 12,
  venue: 'A구장',
  curriculumId: null,
} as Class;

const at = (day: string, hour = 10) => `${day}T${`${hour}`.padStart(2, '0')}:00:00`;

const lead = (fields: Partial<Lead>): Lead =>
  newLead('a', { childName: '김지우', ageLabel: 'U9', parentPhone: '01012345678', ...fields });

const student = (fields: Partial<Student> = {}): Student =>
  ({
    id: 's1',
    academyId: 'a',
    name: '박하준',
    ageGroup: 'U9',
    status: 'active',
    lastAttendanceDate: null,
    churnScore: 0,
    classId: 'c1',
    parentName: '박',
    parentPhone: '010',
    enrolledAt: TODAY,
    lastParentContactDate: null,
    ...fields,
  }) as Student;

let n = 0;
const touch = (
  who: { leadId?: string; studentId?: string },
  step: TouchStep,
  outcome: TouchOutcome,
  day: string,
  note = '',
): Touch => ({
  id: `t${(n += 1)}`,
  academyId: 'a',
  leadId: who.leadId ?? null,
  studentId: who.studentId ?? null,
  step,
  outcome,
  note,
  actorName: '',
  at: at(day),
});

const build = (partial: Partial<JourneyInput>, asOf = TODAY): Family[] =>
  buildFamilies({
    leads: [],
    students: [],
    classes: [cls],
    attendanceLogs: [],
    touches: [],
    surveys: [],
    recipients: [],
    asOf,
    ...partial,
  });

const one = (partial: Partial<JourneyInput>, asOf = TODAY) => {
  const fams = build(partial, asOf);
  expect(fams).toHaveLength(1);
  return fams[0];
};

describe('문의', () => {
  it('a new enquiry is a first call due today', () => {
    const f = one({ leads: [lead({ createdAt: at(TODAY, 9), stageChangedAt: at(TODAY, 9) })] });
    expect(f.phase).toBe('inquiry');
    expect(f.next).toMatchObject({ kind: 'first_call', channel: 'call', late: false, due: TODAY });
    expect(isDue(f, TODAY)).toBe(true);
  });

  it('turns late after a day and says how long it has waited', () => {
    const day = addDays(TODAY, -2);
    const f = one({ leads: [lead({ createdAt: at(day), stageChangedAt: at(day) })] });
    expect(f.next?.late).toBe(true);
    expect(f.next?.reason).toContain('2일');
  });

  it('an unanswered call comes back tomorrow, not later today', () => {
    const l = lead({ createdAt: at(TODAY, 9), stageChangedAt: at(TODAY, 9) });
    const touches = [touch({ leadId: l.id }, 'first_call', 'no_answer', TODAY)];
    expect(isDue(one({ leads: [l], touches }), TODAY)).toBe(false);

    const tomorrow = one({ leads: [l], touches }, addDays(TODAY, 1));
    expect(isDue(tomorrow, addDays(TODAY, 1))).toBe(true);
    expect(tomorrow.next?.reason).toContain('부재중');
  });

  it('after the call, the next thing is a trial date', () => {
    const f = one({ leads: [lead({ stage: 'contacted', stageChangedAt: at(TODAY) })] });
    expect(f.next?.kind).toBe('book_trial');
  });
});

describe('체험', () => {
  it('a booked trial is a milestone ahead, not a task', () => {
    const f = one({ leads: [lead({ stage: 'trial_booked', trialDate: addDays(TODAY, 2) })] });
    expect(f.phase).toBe('trial');
    expect(f.next?.channel).toBe('wait');
    expect(isDue(f, TODAY)).toBe(false);
  });

  it('on the day, it asks for the result', () => {
    const f = one({ leads: [lead({ stage: 'trial_booked', trialDate: TODAY })] });
    expect(f.next).toMatchObject({ kind: 'mark_trial', late: false });
  });
});

describe('등록', () => {
  const trialDay = addDays(TODAY, -1);
  const done = lead({ stage: 'trial_done', trialDate: trialDay, stageChangedAt: at(trialDay, 18) });

  it('the day after the trial is a follow-up call', () => {
    const f = one({ leads: [done] });
    expect(f.phase).toBe('decision');
    expect(f.next).toMatchObject({ kind: 'trial_followup', due: TODAY, touch: 'trial_followup' });
  });

  it('an unsettled call comes back in three days with its note', () => {
    const touches = [touch({ leadId: done.id }, 'trial_followup', 'concern', TODAY, '비용 고민')];
    const f = one({ leads: [done], touches });
    expect(f.next?.due).toBe(addDays(TODAY, 3));
    expect(f.next?.carry).toBe('비용 고민');
    expect(f.next?.label).toBe('재통화');
  });

  it('after a good call: send the form, wait for it, chase it, then enroll', () => {
    const touches = [touch({ leadId: done.id }, 'trial_followup', 'done', TODAY)];
    expect(one({ leads: [done], touches }).next?.kind).toBe('send_form');

    const survey = newSurvey('a', {
      kind: 'enrollment',
      title: '등록 신청서',
      questions: parseQuestions(SITUATIONS.enrollment.questions),
      createdAt: at(TODAY, 12),
    });
    const r = newRecipient(survey, { leadId: done.id });
    const withForm = { leads: [done], touches, surveys: [survey], recipients: [r] };

    expect(one(withForm).next?.channel).toBe('wait');
    expect(one(withForm, addDays(TODAY, 3)).next?.kind).toBe('form_check');

    r.answeredAt = at(addDays(TODAY, 1), 21);
    expect(one(withForm, addDays(TODAY, 1)).next?.kind).toBe('enroll');
  });
});

describe('첫 달', () => {
  it('opens with a welcome message on the day of enrolment', () => {
    const f = one({ students: [student()] });
    expect(f.phase).toBe('firstMonth');
    expect(f.next).toMatchObject({ kind: 'welcome', channel: 'message' });
  });

  it('after the welcome, the first-week call waits until day seven', () => {
    const touches = [touch({ studentId: 's1' }, 'welcome', 'done', TODAY)];
    const now = one({ students: [student()], touches });
    expect(now.next).toMatchObject({ kind: 'week1', channel: 'wait' });

    const later = one({ students: [student()], touches }, addDays(TODAY, 7));
    expect(later.next).toMatchObject({ kind: 'week1', channel: 'call' });
  });

  it('a missed first class brings the call forward', () => {
    const touches = [touch({ studentId: 's1' }, 'welcome', 'done', TODAY)];
    const firstDay = firstClassOn(cls, addDays(TODAY, 1))!;
    expect(firstDay).toBe('2026-10-05'); // the next Monday
    const logs = [
      { id: 'l', academyId: 'a', studentId: 's1', classId: 'c1', date: firstDay, status: 'absent', tags: [], coachComment: '' },
    ] as AttendanceLog[];
    const f = one({ students: [student()], touches, attendanceLogs: logs }, addDays(firstDay, 1));
    expect(f.next).toMatchObject({ kind: 'week1', channel: 'call' });
    expect(f.next?.reason).toContain('결석');
  });

  it('counts attendance against the classes held so far', () => {
    const enrolled = '2026-09-01'; // a Tuesday
    const logs = ['2026-09-02', '2026-09-07', '2026-09-09'].map((date, i) => ({
      id: `l${i}`, academyId: 'a', studentId: 's1', classId: 'c1', date, status: 'present', tags: [], coachComment: '',
    })) as AttendanceLog[];
    const touches = [
      touch({ studentId: 's1' }, 'welcome', 'done', enrolled),
      touch({ studentId: 's1' }, 'week1', 'done', '2026-09-08'),
    ];
    const f = one({ students: [student({ enrolledAt: enrolled })], touches, attendanceLogs: logs });
    // Mon/Wed from 9/2 to 9/28 inclusive: 8 classes.
    expect(f.attendance).toEqual({ present: 3, held: 8 });
    expect(f.next).toMatchObject({ kind: 'month1', channel: 'call' });
  });

  it('leaves the journey once the first-month review is done', () => {
    const touches = [
      touch({ studentId: 's1' }, 'welcome', 'done', TODAY),
      touch({ studentId: 's1' }, 'month1', 'done', TODAY),
    ];
    expect(build({ students: [student()], touches })).toHaveLength(0);
  });

  it('an old roster is not put through a first month', () => {
    expect(build({ students: [student({ enrolledAt: '2025-03-01' })] })).toHaveLength(0);
  });

  it('the demo override puts a student into it anyway', () => {
    const s = student({ enrolledAt: '2025-03-01' });
    expect(build({ students: [s], enrolledOverride: { s1: TODAY } })).toHaveLength(1);
  });
});

describe('the whole list', () => {
  it('drops lost leads and turns an enrolled lead into its student', () => {
    const enrolled = lead({ stage: 'enrolled', enrolledStudentId: 's1' });
    const fams = build({ leads: [lead({ stage: 'lost' }), enrolled], students: [student()] });
    expect(fams).toHaveLength(1);
    expect(fams[0].key).toBe('student:s1');
    expect(fams[0].lead?.id).toBe(enrolled.id);
  });

  it("today's queue puts the late first, and a stranger before a member", () => {
    const old = addDays(TODAY, -3);
    const fams = build({
      leads: [
        lead({ childName: '오늘', createdAt: at(TODAY), stageChangedAt: at(TODAY) }),
        lead({ childName: '사흘', createdAt: at(old), stageChangedAt: at(old) }),
      ],
      students: [student({ name: '신입' })],
    });
    expect(todayQueue(fams, TODAY).map((f) => f.name)).toEqual(['사흘', '오늘', '신입']);
  });
});
