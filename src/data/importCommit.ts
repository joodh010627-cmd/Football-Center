/**
 * 임포트 결과를 실제 DB에 적재한다.
 *
 * 엔진(`src/lib/import/`)은 Supabase를 모른다 — 파싱과 판별은 순수 함수로 두어야
 * 테스트가 쉽고, 나중에 다른 저장소로 바뀌어도 그대로 쓰인다. 그 경계를 넘는
 * 일만 이 파일이 한다.
 *
 * id를 서버 default에 맡기지 않고 여기서 만들어 넣는 이유가 하나 있다. 원생과
 * 수강료·납부 행을 이어붙이려면 삽입 결과의 순서를 믿어야 하는데, 그건 보장되지
 * 않는다. 동명이인이 있으면 이름으로 되찾는 것도 안전하지 않다. 미리 정해둔
 * uuid를 쓰면 그 문제가 사라진다.
 */

import type { AgeGroup, ID } from '@/types';
import { supabase } from '@/lib/supabase';
import { parseAgeGroup, type DerivedClass, type ImportResult } from '@/lib/import';

/** age_group 은 NOT NULL 이다. 반 이름에서도 못 뽑으면 중간값으로 채운다. */
const FALLBACK_AGE_GROUP: AgeGroup = 'U11';

export interface CommitSummary {
  students: number;
  classesCreated: number;
  payments: number;
}

function ageGroupOf(title: string): AgeGroup {
  // "U9 화목반" 같은 이름에 이미 답이 들어 있는 경우가 대부분이다.
  for (const token of title.split(/[\s·/,]+/)) {
    const parsed = parseAgeGroup(token);
    if (parsed) return parsed;
  }
  return FALLBACK_AGE_GROUP;
}

const newId = (): ID => crypto.randomUUID();

export async function commitImport(
  academyId: ID,
  result: ImportResult,
  existingClasses: { id: ID; title: string }[],
): Promise<CommitSummary> {
  // --- 1. 반 -------------------------------------------------------------
  // 이미 있는 반은 다시 만들지 않는다. 두 번 임포트해도 반이 복제되지 않아야 한다.
  const classIdByTitle = new Map(existingClasses.map((c) => [c.title, c.id]));
  const toCreate: DerivedClass[] = result.classes.filter((c) => !classIdByTitle.has(c.title));

  if (toCreate.length > 0) {
    const rows = toCreate.map((c) => {
      const id = newId();
      classIdByTitle.set(c.title, id);
      return {
        id,
        academy_id: academyId,
        title: c.title,
        // 반 이름에서 뽑은 요일. 이탈 경보가 주기를 알아야 헛울리지 않는다.
        schedule_days: c.scheduleDays,
        age_group: ageGroupOf(c.title),
        capacity: Math.max(c.headcount, 0),
      };
    });

    const { error } = await supabase.from('classes').insert(rows);
    if (error) throw error;
  }

  // --- 2. 원생 -----------------------------------------------------------
  const studentIds = result.students.map(() => newId());

  const studentRows = result.students.map((s, i) => ({
    id: studentIds[i],
    academy_id: academyId,
    name: s.name,
    age_group: s.ageGroup ?? ageGroupOf(s.className),
    class_id: classIdByTitle.get(s.className) ?? null,
    parent_name: s.parentName ?? '',
    parent_phone: s.parentPhone,
    enrolled_at: s.enrolledAt ?? new Date().toISOString().slice(0, 10),
    memo: s.memo,
    // 지어내지 않는다. 출결을 기록하기 전까지는 null 이 정답이다
    // (docs/IMPORT-SPEC.md §5).
    last_attendance_date: s.lastAttendanceDate,
    last_parent_contact_date: null,
  }));

  if (studentRows.length > 0) {
    const { error } = await supabase.from('students').insert(studentRows);
    if (error) throw error;
  }

  // --- 3. 수강료 (대표 전용 테이블) ---------------------------------------
  const billingRows = result.students
    .map((s, i) => ({ student_id: studentIds[i], academy_id: academyId, monthly_fee: s.monthlyFee }))
    .filter((r) => r.monthly_fee > 0);

  if (billingRows.length > 0) {
    const { error } = await supabase.from('student_billing').insert(billingRows);
    if (error) throw error;
  }

  // --- 4. 납부 이력 -------------------------------------------------------
  const paymentRows = result.students.flatMap((s, i) =>
    s.payments.map((p) => ({
      academy_id: academyId,
      student_id: studentIds[i],
      // period 는 '그 달의 1일'이다. 컬럼 헤더는 'YYYY-MM' 이라 일자를 붙인다.
      period: `${p.month}-01`,
      amount: p.amount ?? s.monthlyFee,
      paid_at: p.paid ? (p.paidAt ? `${p.paidAt}T00:00:00Z` : new Date().toISOString()) : null,
    })),
  );

  if (paymentRows.length > 0) {
    // 같은 원생·같은 달은 한 행뿐이다(0004의 unique 제약). 재임포트를 허용하려고
    // insert 대신 upsert 를 쓴다.
    const { error } = await supabase
      .from('payments')
      .upsert(paymentRows, { onConflict: 'student_id,period' });
    if (error) throw error;
  }

  return {
    students: studentRows.length,
    classesCreated: toCreate.length,
    payments: paymentRows.length,
  };
}
