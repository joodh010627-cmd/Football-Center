import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MAX_BODY, TEMPLATES, TemplateError, render, variablesOf } from './templates';
import { composeParentNotification } from '@/lib/notification';
import {
  CORE_FIELDS,
  defaultFields,
  leadFromRow,
  leadToRow,
  newLead,
  newSlug,
  type FormKind,
} from '@/data/crm';
import type { Student } from '@/types';

const fill = (body: string) => Object.fromEntries(variablesOf(body).map((v) => [v, `<${v}>`]));

describe('알림톡 templates', () => {
  it('every template renders with all of its variables and nothing left over', () => {
    for (const t of Object.values(TEMPLATES)) {
      const text = render(t.code, fill(t.body));
      expect(text).not.toMatch(/#\{/);
      expect(text.length).toBeLessThanOrEqual(MAX_BODY);
    }
  });

  it('refuses to render with a variable missing', () => {
    expect(() => render('trial_booked', { 학원명: 'FC' })).toThrow(TemplateError);
  });

  it('refuses a body over the Kakao limit', () => {
    const vars = fill(TEMPLATES.attendance_report.body);
    vars['관찰기록'] = '가'.repeat(MAX_BODY);
    expect(() => render('attendance_report', vars)).toThrow(/1000자/);
  });

  // The DB function writes this message itself, in SQL. If the two drift apart,
  // Kakao rejects the one that no longer matches the approved template.
  it('inquiry_received matches what submit_public_form() builds', () => {
    const sql = readFileSync(
      resolve(__dirname, '../../../supabase/migrations/0006_leads_forms_alimtalk.sql'),
      'utf8',
    );
    const match = sql.match(/format\(E'((?:[^'\\]|\\.)*)'/);
    expect(match).not.toBeNull();

    const args = ['FC GROWTH', '홍길동'];
    const fromSql = match![1].replace(/\\n/g, '\n').replace(/%s/g, () => args.shift()!);

    expect(fromSql).toBe(render('inquiry_received', { 학원명: 'FC GROWTH', 보호자명: '홍길동' }));
  });

  it('the attendance report is the template, filled', () => {
    const student = {
      id: 's1',
      name: '김하준',
      parentName: '김엄마',
      parentPhone: '010-1234-5678',
    } as Student;

    const n = composeParentNotification({
      student,
      status: 'present',
      tags: [],
      date: '2026-09-26',
      academyName: 'FC GROWTH',
      className: 'U9 A반',
      coachName: '박코치',
      attendanceRate: 0.9,
      sessionSummary: [],
    });

    expect(n.templateCode).toBe('attendance_report');
    expect(n.message).toBe(render('attendance_report', n.variables));
    // Empty inputs still produce a sentence, never a blank line.
    expect(n.variables['관찰기록']).toBe('특이사항 없음');
    expect(n.message).toContain('90%');
  });
});

describe('form links', () => {
  it('slugs fit the column check and avoid look-alike characters', () => {
    for (let i = 0; i < 200; i += 1) {
      const slug = newSlug();
      expect(slug).toMatch(/^[a-z0-9-]{4,40}$/);
      expect(slug).not.toMatch(/[01lio]/);
    }
  });

  it('every form kind asks for the core fields first', () => {
    for (const kind of ['inquiry', 'trial', 'enrollment', 'survey'] as FormKind[]) {
      expect(defaultFields(kind).slice(0, CORE_FIELDS.length)).toEqual([...CORE_FIELDS]);
    }
  });

  it('a lead survives the trip through its row', () => {
    const lead = newLead('a1', {
      childName: '하준',
      parentPhone: '01012345678',
      answers: { '희망 요일': '화, 목' },
    });
    const row = { ...leadToRow(lead), consent_at: null };
    expect(leadFromRow(row)).toEqual(lead);
  });

  it('a partial update writes only the columns it names, and never consent', () => {
    expect(leadToRow({ stage: 'contacted' })).toEqual({ stage: 'contacted' });
    expect(leadToRow({ consentAt: '2026-01-01' })).toEqual({});
  });
});
