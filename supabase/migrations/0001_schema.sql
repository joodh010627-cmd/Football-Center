-- =============================================================================
-- 0001 — 테넌트 스키마
--
-- 설계 원칙 두 가지:
--
-- 1. 모든 업무 테이블은 academy_id를 갖는다. 격리는 앱 코드가 아니라 DB가
--    강제한다 (docs/PRODUCTIZATION.md §2-2).
--
-- 2. 대표 전용 데이터는 컬럼이 아니라 별도 테이블에 둔다.
--    Supabase는 모든 로그인 사용자가 동일한 `authenticated` DB 역할을 쓰므로
--    컬럼 단위 GRANT로 사람을 구분할 수 없다. RLS는 행 단위다. 따라서
--    "코치는 못 보는 필드"는 반드시 별도 행/테이블이어야 막을 수 있다.
--
--      coaches.satisfaction_score  → coach_evaluations   (대표 전용)
--      classes.monthly_cost/재등록  → class_finances      (대표 전용)
--      students.monthly_fee        → student_billing     (대표 전용)
--
--    코치가 select * 를 날려도 평가점수가 있는 테이블 자체가 0행을 반환한다.
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- 테넌트 루트
-- -----------------------------------------------------------------------------

create table academies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  plan        text not null default 'pilot' check (plan in ('pilot', 'standard')),
  created_at  timestamptz not null default now(),
  -- 해지 후 유예 기간. 즉시 삭제하지 않는다 (파기 정책은 운영 문서 참조).
  deleted_at  timestamptz
);

create type member_role as enum ('owner', 'coach');

-- auth.users × academy. 한 사람이 여러 아카데미에 속할 수 있다.
create table academy_members (
  user_id      uuid not null references auth.users(id) on delete cascade,
  academy_id   uuid not null references academies(id) on delete cascade,
  role         member_role not null,
  -- role='coach'일 때 coaches 행과 연결. 대표는 null.
  coach_id     uuid,
  display_name text not null default '',
  created_at   timestamptz not null default now(),
  primary key (user_id, academy_id)
);

create index on academy_members (academy_id);

-- 코치 가입 경로. 코치는 스스로 아카데미를 만들 수 없고, 대표가 발급한
-- 코드로만 합류한다. 코드 교환은 redeem_invite() RPC로만 가능 (0003 참조).
create table academy_invites (
  code        text primary key,
  academy_id  uuid not null references academies(id) on delete cascade,
  role        member_role not null default 'coach',
  -- 미리 만들어 둔 coaches 행에 붙일 때 사용. null이면 합류 시 새로 만든다.
  coach_id    uuid,
  label       text not null default '',
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '14 days'),
  used_at     timestamptz,
  used_by     uuid references auth.users(id) on delete set null
);

create index on academy_invites (academy_id);

-- 개인화는 전부 여기로. 팀마다 코드 브랜치를 만들면 세 팀째에 죽는다.
create table academy_settings (
  academy_id       uuid primary key references academies(id) on delete cascade,
  brand_name       text,
  logo_url         text,
  age_groups       text[] not null default '{U7,U9,U11,U13,U15}',
  churn_thresholds jsonb  not null default
    '{"at_risk": 55, "critical": 75, "weights": {"recency": 0.45, "absence": 0.25, "contact": 0.2, "tenure": 0.1}}'::jsonb,
  notify_templates jsonb  not null default '{}'::jsonb
);

-- -----------------------------------------------------------------------------
-- 코치
-- -----------------------------------------------------------------------------

create table coaches (
  id             uuid primary key default gen_random_uuid(),
  academy_id     uuid not null references academies(id) on delete cascade,
  name           text not null,
  certifications text[] not null default '{}',
  created_at     timestamptz not null default now()
);

create index on coaches (academy_id);

alter table academy_members
  add constraint academy_members_coach_fk
  foreign key (coach_id) references coaches(id) on delete set null;

alter table academy_invites
  add constraint academy_invites_coach_fk
  foreign key (coach_id) references coaches(id) on delete set null;

-- 대표가 코치를 평가한 점수. 이게 코치에게 새면 그 팀에서 앱이 즉시 퇴출된다.
-- 그래서 coaches의 컬럼이 아니라 별도 테이블이고, RLS가 대표만 통과시킨다.
create table coach_evaluations (
  coach_id           uuid primary key references coaches(id) on delete cascade,
  academy_id         uuid not null references academies(id) on delete cascade,
  satisfaction_score numeric(2,1) not null default 0
                     check (satisfaction_score >= 0 and satisfaction_score <= 5),
  note               text not null default '',
  updated_at         timestamptz not null default now()
);

create index on coach_evaluations (academy_id);

-- -----------------------------------------------------------------------------
-- 클래스
-- -----------------------------------------------------------------------------

create table classes (
  id           uuid primary key default gen_random_uuid(),
  academy_id   uuid not null references academies(id) on delete cascade,
  title        text not null,
  coach_id     uuid references coaches(id) on delete set null,
  -- 0=일 … 6=토. Date.getDay()와 같은 인덱스.
  schedule_days smallint[] not null default '{}',
  start_time    text not null default '16:00',
  duration_min  integer not null default 60,
  age_group     text not null,
  capacity      integer not null default 0,
  venue         text not null default '',
  created_at    timestamptz not null default now()
);

create index on classes (academy_id);
create index on classes (coach_id);

-- 원가와 재등록률은 경영 정보다. 코치에게 보이면 안 된다.
-- monthly_revenue는 여기 없다 — 원생 수강료의 합이므로 파생값이다.
create table class_finances (
  class_id       uuid primary key references classes(id) on delete cascade,
  academy_id     uuid not null references academies(id) on delete cascade,
  monthly_cost   integer not null default 0,
  retention_rate numeric(4,3) not null default 0
                 check (retention_rate >= 0 and retention_rate <= 1)
);

create index on class_finances (academy_id);

-- -----------------------------------------------------------------------------
-- 원생
-- -----------------------------------------------------------------------------

create table students (
  id                       uuid primary key default gen_random_uuid(),
  academy_id               uuid not null references academies(id) on delete cascade,
  name                     text not null,
  age_group                text not null,
  class_id                 uuid references classes(id) on delete set null,
  parent_name              text not null default '',
  -- 평문 저장은 임시다. 운영 전 암호화 필요 (docs/PRODUCTIZATION.md §6).
  parent_phone             text not null default '',
  enrolled_at              date not null default current_date,
  memo                     text,
  last_attendance_date     date,
  last_parent_contact_date date,
  -- 이탈 엔진이 계산해 되써넣는 값. 원본이 아니라 캐시다.
  churn_score              integer not null default 0,
  status                   text not null default 'active'
                           check (status in ('active', 'at_risk', 'inactive')),
  created_at               timestamptz not null default now()
);

create index on students (academy_id);
create index on students (class_id);

-- 수강료는 대표 것이다. 코치가 원생별 납부액을 아는 것은 업무 범위가 아니다.
create table student_billing (
  student_id  uuid primary key references students(id) on delete cascade,
  academy_id  uuid not null references academies(id) on delete cascade,
  monthly_fee integer not null default 0
);

create index on student_billing (academy_id);

-- 법정대리인 동의. 개인정보보호법 제22조의2 대응.
create table consents (
  id            uuid primary key default gen_random_uuid(),
  academy_id    uuid not null references academies(id) on delete cascade,
  student_id    uuid not null references students(id) on delete cascade,
  guardian_name text not null,
  scope         text[] not null default '{}',
  granted_at    timestamptz not null default now(),
  revoked_at    timestamptz,
  evidence_url  text
);

create index on consents (academy_id);

-- -----------------------------------------------------------------------------
-- 커리큘럼
-- -----------------------------------------------------------------------------

create table behavior_tags (
  id         uuid primary key default gen_random_uuid(),
  academy_id uuid not null references academies(id) on delete cascade,
  label      text not null,
  dimension  text not null check (dimension in ('skill', 'attitude', 'teamwork', 'physical', 'caution')),
  polarity   text not null check (polarity in ('positive', 'watch')),
  sort_order integer not null default 0
);

create index on behavior_tags (academy_id);

create table training_blocks (
  id                 uuid primary key default gen_random_uuid(),
  academy_id         uuid not null references academies(id) on delete cascade,
  title              text not null,
  category           text not null check (category in ('warmup', 'skill', 'game')),
  duration_min       integer not null default 10,
  description        text not null default '',
  age_groups         text[] not null default '{}',
  equipment          text[] not null default '{}',
  -- 코치는 직접 못 쓴다. increment_block_usage() RPC를 통해서만 오른다.
  usage_count        integer not null default 0,
  is_core_curriculum boolean not null default false,
  created_at         timestamptz not null default now()
);

create index on training_blocks (academy_id);

-- -----------------------------------------------------------------------------
-- 세션 · 출결
-- -----------------------------------------------------------------------------

create table session_plans (
  id             uuid primary key default gen_random_uuid(),
  academy_id     uuid not null references academies(id) on delete cascade,
  class_id       uuid not null references classes(id) on delete cascade,
  coach_id       uuid references coaches(id) on delete set null,
  date           date not null,
  warmup_block_id uuid references training_blocks(id) on delete set null,
  skill_block_id  uuid references training_blocks(id) on delete set null,
  game_block_id   uuid references training_blocks(id) on delete set null,
  status         text not null default 'ready' check (status in ('draft', 'ready', 'completed')),
  created_at     timestamptz not null default now()
);

create index on session_plans (academy_id);
create index on session_plans (class_id, date);
create index on session_plans (coach_id);

create table attendance_logs (
  id              uuid primary key default gen_random_uuid(),
  academy_id      uuid not null references academies(id) on delete cascade,
  student_id      uuid not null references students(id) on delete cascade,
  class_id        uuid not null references classes(id) on delete cascade,
  date            date not null,
  status          text not null check (status in ('present', 'absent', 'injured')),
  tags            text[] not null default '{}',
  coach_comment   text not null default '',
  session_plan_id uuid references session_plans(id) on delete set null,
  coach_id        uuid references coaches(id) on delete set null,
  logged_at       timestamptz not null default now(),
  -- 같은 날 같은 원생을 두 번 기록하지 않는다. 재제출은 덮어쓴다.
  unique (student_id, date)
);

create index on attendance_logs (academy_id);
create index on attendance_logs (class_id, date);
create index on attendance_logs (student_id);

-- 대표의 이탈 대응 기록. 코치에게 보일 이유가 없다.
create table cs_actions (
  id         uuid primary key default gen_random_uuid(),
  academy_id uuid not null references academies(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  acted_at   timestamptz not null default now(),
  actor_id   uuid references auth.users(id) on delete set null,
  note       text not null default ''
);

create index on cs_actions (academy_id);
create index on cs_actions (student_id);

-- 누가 언제 어떤 원생 정보를 열람했나. 유소년 개인정보 취급의 최소 요건.
create table audit_logs (
  id         bigserial primary key,
  academy_id uuid not null references academies(id) on delete cascade,
  actor_id   uuid references auth.users(id) on delete set null,
  action     text not null,
  entity     text not null,
  entity_id  uuid,
  at         timestamptz not null default now()
);

create index on audit_logs (academy_id, at desc);
