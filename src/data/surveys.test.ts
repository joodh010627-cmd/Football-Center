import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  MAX_QUESTIONS,
  PICKER,
  SITUATIONS,
  dueLabel,
  flaggedAnswers,
  isOpenSurvey,
  needsCall,
  newRecipient,
  newSurvey,
  newToken,
  parseQuestions,
  progressOf,
  serializeQuestions,
  summaryText,
  tallyOf,
  type SurveyKind,
} from './surveys';
import { TEMPLATES } from '@/lib/alimtalk/templates';
import { addDays } from './dates';

const TODAY = '2026-09-30';

describe('question text', () => {
  it('reads sentences, picks, multi-picks and call flags', () => {
    const qs = parseQuestions(
      [
        '코치에게 전할 말',
        '참가하나요? : 참가 / 불참',
        '가능한 요일 (복수) : 월 / 화 / 수',
        '다음 달에도? : 계속 / 고민 중! / 쉴게요 !',
      ].join('\n'),
    );

    expect(qs).toEqual([
      { label: '코치에게 전할 말', choices: [], multi: false, flagged: [] },
      { label: '참가하나요?', choices: ['참가', '불참'], multi: false, flagged: [] },
      { label: '가능한 요일', choices: ['월', '화', '수'], multi: true, flagged: [] },
      {
        label: '다음 달에도?',
        choices: ['계속', '고민 중', '쉴게요'],
        multi: false,
        flagged: ['고민 중', '쉴게요'],
      },
    ]);
  });

  it('shrugs off blank lines, empty choices and duplicate choices', () => {
    const [q] = parseQuestions('\n\n  사이즈 :  110 /  / 120 / 110 / \n\n');
    expect(q.choices).toEqual(['110', '120']);
  });

  // Labels are the answer keys. Two identical ones would overwrite each other.
  it('drops a second question with the same wording', () => {
    expect(parseQuestions('참가? : 네 / 아니요\n참가? : 네').map((q) => q.choices)).toEqual([
      ['네', '아니요'],
    ]);
  });

  it('a (복수) mark on a one-choice question is not a multi-pick', () => {
    expect(parseQuestions('동의 (복수) : 동의')[0].multi).toBe(false);
  });

  it(`stops at ${MAX_QUESTIONS} questions`, () => {
    const text = Array.from({ length: 14 }, (_, i) => `질문 ${i}`).join('\n');
    expect(parseQuestions(text)).toHaveLength(MAX_QUESTIONS);
  });

  it('round-trips through the editor text for every preset', () => {
    for (const s of Object.values(SITUATIONS)) {
      const parsed = parseQuestions(s.questions);
      expect(parseQuestions(serializeQuestions(parsed))).toEqual(parsed);
    }
  });

  it('every preset but 직접 만들기 has a title and at least one question', () => {
    for (const s of Object.values(SITUATIONS)) {
      if (s.kind === 'custom') continue;
      expect(s.title.length).toBeGreaterThan(0);
      expect(parseQuestions(s.questions).length).toBeGreaterThan(0);
    }
  });

  it('the picker offers every situation except the per-lead 등록 신청서', () => {
    const offered = new Set<SurveyKind>(PICKER);
    expect(offered.has('enrollment')).toBe(false);
    expect(offered.size + 1).toBe(Object.keys(SITUATIONS).length);
  });
});

describe('answers', () => {
  const survey = newSurvey('a1', {
    title: '다음 달 수업 안내',
    questions: parseQuestions(SITUATIONS.renewal.questions),
    dueDate: addDays(TODAY, 2),
  });
  const [q1, q2] = survey.questions;

  const answered = (pick: string, note = '') => {
    const r = newRecipient(survey, { studentId: `s-${pick}-${note}` });
    r.answers = { [q1.label]: pick, ...(note ? { [q2.label]: note } : {}) };
    r.answeredAt = `${TODAY}T20:00:00`;
    return r;
  };

  it('a flagged pick puts the family on the call list until someone rings', () => {
    const r = answered('고민 중이에요', '요일이 겹쳐요');
    expect(flaggedAnswers(survey, r)).toEqual(['고민 중이에요']);
    expect(needsCall(survey, r)).toBe(true);
    expect(needsCall(survey, { ...r, calledAt: `${TODAY}T21:00:00` })).toBe(false);
  });

  it('an unflagged pick, or no answer at all, does not', () => {
    const silent = newRecipient(survey, { studentId: 's9' });
    expect(needsCall(survey, answered('계속할게요'))).toBe(false);
    expect(needsCall(survey, silent)).toBe(false);
  });

  it('progress counts answers, the silent and the calls due', () => {
    const rs = [
      answered('계속할게요'),
      answered('쉬려고 해요'),
      newRecipient(survey, { studentId: 's3' }),
    ];
    const p = progressOf(survey, rs, TODAY);
    expect([p.total, p.answered, p.pending.length, p.toCall.length, p.daysLeft]).toEqual([
      3, 2, 1, 1, 2,
    ]);
  });

  it('tallies each choice in the order the question lists them', () => {
    const rs = [answered('계속할게요'), answered('계속할게요'), answered('쉬려고 해요')];
    expect(tallyOf(q1, rs).map((t) => [t.choice, t.recipientIds.length, t.flagged])).toEqual([
      ['계속할게요', 2, false],
      ['고민 중이에요', 0, true],
      ['쉬려고 해요', 1, true],
    ]);
  });

  it('multi-picks are counted under each choice picked', () => {
    const q = parseQuestions('요일 (복수) : 월 / 화 / 수')[0];
    const r = newRecipient(survey, { studentId: 's1' });
    r.answers = { 요일: '월, 수' };
    r.answeredAt = TODAY;
    expect(tallyOf(q, [r]).map((t) => t.recipientIds.length)).toEqual([1, 0, 1]);
  });

  it('the copied summary names who picked what and who is silent', () => {
    const rs = [answered('계속할게요'), newRecipient(survey, { studentId: 'silent' })];
    const names: Record<string, string> = { [rs[0].id]: '김하준', [rs[1].id]: '이서준' };
    const text = summaryText(survey, rs, (r) => names[r.id]);
    expect(text).toContain('응답 1/2');
    expect(text).toContain('· 계속할게요 1 — 김하준');
    expect(text).toContain('미응답 1 — 이서준');
  });
});

describe('deadline', () => {
  const base = newSurvey('a1', { title: 't', questions: parseQuestions('q') });

  it('is open through its last day and closed the day after', () => {
    const s = { ...base, dueDate: TODAY };
    expect(isOpenSurvey(s, TODAY)).toBe(true);
    expect(dueLabel(s, TODAY)).toBe('오늘 마감');
    expect(isOpenSurvey(s, addDays(TODAY, 1))).toBe(false);
    expect(dueLabel(s, addDays(TODAY, 1))).toBe('마감됨');
  });

  it('closing by hand wins over the date', () => {
    const s = { ...base, dueDate: addDays(TODAY, 5), closed: true };
    expect(isOpenSurvey(s, TODAY)).toBe(false);
  });

  it('no deadline reads as 상시', () => {
    expect(dueLabel(base, TODAY)).toBe('상시');
    expect(dueLabel({ ...base, dueDate: addDays(TODAY, 3) }, TODAY)).toBe('마감 D-3');
  });
});

describe('tokens', () => {
  it('are 16 characters the database will accept, and do not repeat', () => {
    const seen = new Set(Array.from({ length: 500 }, newToken));
    expect(seen.size).toBe(500);
    for (const t of seen) expect(t).toMatch(/^[a-z0-9]{16,40}$/);
  });
});

// The migration spells the same lists in SQL. If they drift, the app offers a
// kind the table refuses, or queues a template the function rejects.
describe('0007 agrees with the app', () => {
  const sql = readFileSync(
    resolve(__dirname, '../../supabase/migrations/0007_surveys.sql'),
    'utf8',
  );

  it('the kind check lists exactly the situations', () => {
    const m = sql.match(/check \(kind in \(([^)]*)\)\)/);
    expect(m).not.toBeNull();
    const kinds = [...m![1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]).sort();
    expect(kinds).toEqual(Object.keys(SITUATIONS).sort());
  });

  it('enqueue_alimtalk accepts every template the app renders', () => {
    const m = sql.match(/not in \(('attendance_report'[^)]*)\)/);
    expect(m).not.toBeNull();
    const codes = [...m![1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]).sort();
    expect(codes).toEqual(Object.keys(TEMPLATES).sort());
  });
});
