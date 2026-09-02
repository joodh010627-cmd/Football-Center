/**
 * Load the demo academy into a real Supabase project.
 *
 *   npm run seed
 *
 * Uses the service_role key, so it bypasses RLS — which is the point: the
 * seeder has to write rows on behalf of users who don't exist yet. That key
 * must never reach the browser, which is why it has no `VITE_` prefix and why
 * this file lives outside `src/`.
 *
 * Idempotent by academy name: re-running deletes the demo academy and rebuilds
 * it. Everything else cascades from `academies.id`.
 */

import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import {
  attendanceLogs,
  behaviorTags,
  classes,
  coaches,
  csActions,
  sessionPlans,
  students,
  trainingBlocks,
} from './seedData';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    '\n  SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.' +
      '\n  .env.example 을 .env 로 복사해 값을 채운 뒤 다시 실행하세요.\n',
  );
  process.exit(1);
}

const db = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ACADEMY_NAME = 'FC GROWTH 데모 축구교실';

/**
 * 시드 계정 비밀번호.
 *
 * 하드코딩하지 않는다. 이 저장소는 공개돼 있고, GitHub Pages로 배포된 앱이
 * 같은 Supabase 프로젝트를 바라본다. 상수로 두면 저장소를 찾은 누구나 대표
 * 계정으로 로그인할 수 있다 — 지금은 가짜 원생뿐이라 피해가 없지만, 이
 * 아카데미에 실제 명단이 한 번이라도 들어가는 순간 그대로 유출이다.
 *
 * SEED_PASSWORD 를 주면 그것을 쓰고, 없으면 매번 새로 만들어 아래에 출력한다.
 */
const PASSWORD =
  process.env.SEED_PASSWORD?.trim() || `demo-${randomBytes(6).toString('base64url')}`;

/**
 * Two coaches, not one.
 *
 * One coach account proves the owner/coach split. Two proves the *other* half
 * of the model — that 김도현 cannot see 박서준's classes, students or logs. That
 * is the harder guarantee and the one worth being able to demonstrate live.
 */
const ACCOUNTS = [
  { email: 'owner@fcgrowth.demo', role: 'owner' as const, coachKey: null, name: '박대표' },
  { email: 'coach1@fcgrowth.demo', role: 'coach' as const, coachKey: 'coach-1', name: '김도현' },
  { email: 'coach2@fcgrowth.demo', role: 'coach' as const, coachKey: 'coach-2', name: '박서준' },
];

/** Seed ids are readable strings ('coach-1'); Postgres wants uuids. */
const ids = new Map<string, string>();
const uuidFor = (key: string): string => {
  let v = ids.get(key);
  if (!v) {
    v = crypto.randomUUID();
    ids.set(key, v);
  }
  return v;
};

async function main() {
  console.log(`\n  → ${url}`);

  // --- Reset ---------------------------------------------------------------
  const { data: existing } = await db.from('academies').select('id').eq('name', ACADEMY_NAME);
  for (const row of existing ?? []) {
    await db.from('academies').delete().eq('id', row.id);
    console.log('  · 기존 데모 아카데미 삭제');
  }

  // --- Academy -------------------------------------------------------------
  const academyId = crypto.randomUUID();
  await check(
    db.from('academies').insert({ id: academyId, name: ACADEMY_NAME, plan: 'pilot' }),
    'academies',
  );
  await check(
    db.from('academy_settings').insert({ academy_id: academyId, brand_name: 'FC GROWTH' }),
    'academy_settings',
  );

  const withAcademy = <T extends object>(row: T) => ({ ...row, academy_id: academyId });

  // --- Coaches -------------------------------------------------------------
  await check(
    db.from('coaches').insert(
      coaches.map((c) =>
        withAcademy({ id: uuidFor(c.id), name: c.name, certifications: c.certifications }),
      ),
    ),
    'coaches',
  );

  // The owner's rating of each coach. Separate table, owner-only policy.
  await check(
    db.from('coach_evaluations').insert(
      coaches.map((c) =>
        withAcademy({ coach_id: uuidFor(c.id), satisfaction_score: c.satisfactionScore }),
      ),
    ),
    'coach_evaluations',
  );

  // --- Classes -------------------------------------------------------------
  await check(
    db.from('classes').insert(
      classes.map((c) =>
        withAcademy({
          id: uuidFor(c.id),
          title: c.title,
          coach_id: uuidFor(c.coachId),
          schedule_days: c.schedule.days,
          start_time: c.schedule.startTime,
          duration_min: c.schedule.durationMin,
          age_group: c.ageGroup,
          capacity: c.capacity,
          venue: c.venue,
        }),
      ),
    ),
    'classes',
  );

  await check(
    db.from('class_finances').insert(
      classes.map((c) =>
        withAcademy({
          class_id: uuidFor(c.id),
          monthly_cost: c.monthlyCost,
          retention_rate: c.retentionRate,
        }),
      ),
    ),
    'class_finances',
  );

  // --- Curriculum ----------------------------------------------------------
  await check(
    db.from('behavior_tags').insert(
      behaviorTags.map((t, i) =>
        withAcademy({
          id: uuidFor(t.id),
          label: t.label,
          dimension: t.dimension,
          polarity: t.polarity,
          sort_order: i,
        }),
      ),
    ),
    'behavior_tags',
  );

  await check(
    db.from('training_blocks').insert(
      trainingBlocks.map((b) =>
        withAcademy({
          id: uuidFor(b.id),
          title: b.title,
          category: b.category,
          duration_min: b.durationMin,
          description: b.description,
          age_groups: b.ageGroups,
          equipment: b.equipment,
          usage_count: b.usageCount,
          is_core_curriculum: b.isCoreCurriculum,
        }),
      ),
    ),
    'training_blocks',
  );

  // --- Students ------------------------------------------------------------
  await insertChunked(
    'students',
    students.map((s) =>
      withAcademy({
        id: uuidFor(s.id),
        name: s.name,
        age_group: s.ageGroup,
        class_id: uuidFor(s.classId),
        parent_name: s.parentName,
        parent_phone: s.parentPhone,
        enrolled_at: s.enrolledAt,
        memo: s.memo ?? null,
        last_attendance_date: s.lastAttendanceDate,
        last_parent_contact_date: s.lastParentContactDate,
        status: s.status,
        churn_score: s.churnScore,
      }),
    ),
  );

  await insertChunked(
    'student_billing',
    students.map((s) => withAcademy({ student_id: uuidFor(s.id), monthly_fee: s.monthlyFee })),
  );

  // --- Sessions & attendance ----------------------------------------------
  await check(
    db.from('session_plans').insert(
      sessionPlans.map((p) =>
        withAcademy({
          id: uuidFor(p.id),
          class_id: uuidFor(p.classId),
          coach_id: uuidFor(p.coachId),
          date: p.date,
          warmup_block_id: p.slots.warmup ? uuidFor(p.slots.warmup) : null,
          skill_block_id: p.slots.skill ? uuidFor(p.slots.skill) : null,
          game_block_id: p.slots.game ? uuidFor(p.slots.game) : null,
          status: p.status,
        }),
      ),
    ),
    'session_plans',
  );

  await insertChunked(
    'attendance_logs',
    attendanceLogs.map((l) =>
      withAcademy({
        id: uuidFor(l.id),
        student_id: uuidFor(l.studentId),
        class_id: uuidFor(l.classId),
        date: l.date,
        status: l.status,
        tags: l.tags,
        coach_comment: l.coachComment,
        coach_id: l.coachId ? uuidFor(l.coachId) : null,
        logged_at: l.loggedAt ?? null,
      }),
    ),
  );

  if (csActions.length > 0) {
    await check(
      db.from('cs_actions').insert(
        csActions.map((a) =>
          withAcademy({ id: uuidFor(a.id), student_id: uuidFor(a.studentId), note: a.note }),
        ),
      ),
      'cs_actions',
    );
  }

  // --- Accounts ------------------------------------------------------------
  for (const account of ACCOUNTS) {
    // Recreate rather than reuse: a stale password on a demo account is a
    // five-minute detour in front of a prospect.
    const { data: list } = await db.auth.admin.listUsers();
    const stale = list?.users.find((u) => u.email === account.email);
    if (stale) await db.auth.admin.deleteUser(stale.id);

    const { data: created, error } = await db.auth.admin.createUser({
      email: account.email,
      password: PASSWORD,
      email_confirm: true,
    });
    if (error || !created.user) throw error ?? new Error(`계정 생성 실패: ${account.email}`);

    await check(
      db.from('academy_members').insert({
        user_id: created.user.id,
        academy_id: academyId,
        role: account.role,
        coach_id: account.coachKey ? uuidFor(account.coachKey) : null,
        display_name: account.name,
      }),
      'academy_members',
    );
  }

  const coach1Classes = classes.filter((c) => c.coachId === 'coach-1').length;

  console.log(`
  완료.

    아카데미   ${ACADEMY_NAME}
    원생       ${students.length}명 · 클래스 ${classes.length}개 · 출결 ${attendanceLogs.length}건

  로그인 계정 (비밀번호는 모두 ${PASSWORD})

    owner@fcgrowth.demo    대표   — 전체 매출·원가·코치 평가까지 전부
    coach1@fcgrowth.demo   김도현 — 담당 ${coach1Classes}개 반만
    coach2@fcgrowth.demo   박서준 — 김도현의 반은 보이지 않음

  코치로 로그인해 개발자도구 네트워크 탭을 열어보면, 매출과 평가점수가
  화면에서 숨겨진 게 아니라 응답에 아예 없다는 것을 확인할 수 있습니다.
`);
}

/** Postgres rejects very large single inserts; 500 rows is comfortably under. */
async function insertChunked(table: string, rows: object[]) {
  for (let i = 0; i < rows.length; i += 500) {
    await check(db.from(table).insert(rows.slice(i, i + 500)), table);
  }
  console.log(`  · ${table} ${rows.length}행`);
}

async function check<T extends { error: unknown }>(op: PromiseLike<T>, label: string) {
  const result = await op;
  if (result.error) {
    console.error(`\n  ✗ ${label}`, result.error);
    process.exit(1);
  }
  return result;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
