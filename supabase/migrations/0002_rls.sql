-- =============================================================================
-- 0002 — 행 수준 보안 (RLS)
--
-- 앱 레벨 `where academy_id = ?`는 언젠가 빼먹는다. RLS는 빼먹어도 막힌다.
--
-- 정책은 두 축으로 나뉜다:
--   테넌트 격리 — 내가 속한 아카데미의 행만 보인다
--   역할 격리   — 경영 정보는 대표만, 코치는 자기 반의 것만
--
-- 정책이 없는 테이블/동작은 전부 거부된다. 여기 적히지 않은 것은 못 한다.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 헬퍼
--
-- security definer 인 이유: 이 함수들은 academy_members를 읽는데, 그 테이블
-- 자체에도 RLS가 걸린다. definer가 아니면 정책이 스스로를 다시 평가해 무한
-- 재귀에 빠진다. search_path를 고정해 두는 것은 definer 함수의 필수 방어다.
-- -----------------------------------------------------------------------------

create or replace function public.is_member(aid uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select exists (
    select 1 from academy_members m
    where m.user_id = auth.uid() and m.academy_id = aid
  );
$$;

create or replace function public.is_owner(aid uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select exists (
    select 1 from academy_members m
    where m.user_id = auth.uid() and m.academy_id = aid and m.role = 'owner'
  );
$$;

/* 이 아카데미에서 내가 어떤 코치인지. 대표이거나 비회원이면 null. */
create or replace function public.my_coach_id(aid uuid)
returns uuid language sql stable security definer
set search_path = public, pg_temp as $$
  select m.coach_id from academy_members m
  where m.user_id = auth.uid() and m.academy_id = aid and m.role = 'coach';
$$;

/* 해당 클래스를 내가 맡고 있는가. 코치 정책의 공통 조건. */
create or replace function public.coaches_class(cid uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select exists (
    select 1 from classes c
    where c.id = cid and c.coach_id = public.my_coach_id(c.academy_id)
  );
$$;

revoke execute on function public.is_member(uuid)      from public;
revoke execute on function public.is_owner(uuid)       from public;
revoke execute on function public.my_coach_id(uuid)    from public;
revoke execute on function public.coaches_class(uuid)  from public;
grant  execute on function public.is_member(uuid)      to authenticated;
grant  execute on function public.is_owner(uuid)       to authenticated;
grant  execute on function public.my_coach_id(uuid)    to authenticated;
grant  execute on function public.coaches_class(uuid)  to authenticated;

-- -----------------------------------------------------------------------------
-- 전 테이블 RLS 활성화
-- -----------------------------------------------------------------------------

alter table academies         enable row level security;
alter table academy_members   enable row level security;
alter table academy_invites   enable row level security;
alter table academy_settings  enable row level security;
alter table coaches           enable row level security;
alter table coach_evaluations enable row level security;
alter table classes           enable row level security;
alter table class_finances    enable row level security;
alter table students          enable row level security;
alter table student_billing   enable row level security;
alter table consents          enable row level security;
alter table behavior_tags     enable row level security;
alter table training_blocks   enable row level security;
alter table session_plans     enable row level security;
alter table attendance_logs   enable row level security;
alter table cs_actions        enable row level security;
alter table audit_logs        enable row level security;

-- -----------------------------------------------------------------------------
-- 테넌트 루트
-- -----------------------------------------------------------------------------

create policy academies_read on academies
  for select using (is_member(id));

create policy academies_owner_write on academies
  for update using (is_owner(id)) with check (is_owner(id));

-- 본인 소속은 본인이 읽는다(로그인 직후 역할 판정에 필요).
-- 대표는 소속 코치 명단 전체를 본다.
create policy members_read on academy_members
  for select using (user_id = auth.uid() or is_owner(academy_id));

create policy members_owner_write on academy_members
  for all using (is_owner(academy_id)) with check (is_owner(academy_id));

-- 초대 코드는 대표만 본다. 코치의 코드 교환은 redeem_invite() RPC가 처리하므로
-- 가입자가 이 테이블을 직접 읽을 필요가 없다 — 코드 대조 공격면을 없앤다.
create policy invites_owner_all on academy_invites
  for all using (is_owner(academy_id)) with check (is_owner(academy_id));

create policy settings_read on academy_settings
  for select using (is_member(academy_id));

create policy settings_owner_write on academy_settings
  for all using (is_owner(academy_id)) with check (is_owner(academy_id));

-- -----------------------------------------------------------------------------
-- 코치
-- -----------------------------------------------------------------------------

-- 이름·자격증은 민감정보가 아니다. 코치 앱이 본인 이름을 띄우려면 필요하다.
create policy coaches_read on coaches
  for select using (is_member(academy_id));

create policy coaches_owner_write on coaches
  for all using (is_owner(academy_id)) with check (is_owner(academy_id));

-- ★ 대표가 코치를 평가한 점수. 코치 세션에서는 이 테이블이 0행을 반환한다.
create policy coach_evaluations_owner_only on coach_evaluations
  for all using (is_owner(academy_id)) with check (is_owner(academy_id));

-- -----------------------------------------------------------------------------
-- 클래스
-- -----------------------------------------------------------------------------

-- 대표는 전 클래스, 코치는 자기가 맡은 반만.
create policy classes_read on classes
  for select using (
    is_owner(academy_id)
    or (my_coach_id(academy_id) is not null and coach_id = my_coach_id(academy_id))
  );

create policy classes_owner_write on classes
  for all using (is_owner(academy_id)) with check (is_owner(academy_id));

-- ★ 원가·재등록률 = 경영 정보.
create policy class_finances_owner_only on class_finances
  for all using (is_owner(academy_id)) with check (is_owner(academy_id));

-- -----------------------------------------------------------------------------
-- 원생
-- -----------------------------------------------------------------------------

-- 코치는 자기 반 원생만. 남의 반 원생 개인정보를 볼 이유가 없다.
create policy students_read on students
  for select using (is_owner(academy_id) or coaches_class(class_id));

-- 코치에게 update 정책을 주지 않는 것은 의도된 것이다.
--
-- 출결을 제출하면 원생의 최종 출석일·학부모 연락일이 갱신되어야 하므로 쓰기가
-- 필요한 것은 맞다. 그런데 RLS는 행 단위여서 "이 두 컬럼만"을 표현할 수 없고,
-- update 정책을 열면 코치가 자기 반 원생의 이름이나 소속 반까지 바꿀 수 있게
-- 된다 — 남의 반 원생을 자기 반으로 끌어오는 것도 포함해서.
--
-- 그래서 그 두 컬럼만 만지는 touch_attendance_dates() RPC 하나만 연다 (0003).
create policy students_owner_write on students
  for all using (is_owner(academy_id)) with check (is_owner(academy_id));

-- ★ 수강료.
create policy student_billing_owner_only on student_billing
  for all using (is_owner(academy_id)) with check (is_owner(academy_id));

-- 법정대리인 동의 기록은 대표만 다룬다.
create policy consents_owner_only on consents
  for all using (is_owner(academy_id)) with check (is_owner(academy_id));

-- -----------------------------------------------------------------------------
-- 커리큘럼 — 코치는 읽고 쓰지 않는다
-- -----------------------------------------------------------------------------

create policy behavior_tags_read on behavior_tags
  for select using (is_member(academy_id));

create policy behavior_tags_owner_write on behavior_tags
  for all using (is_owner(academy_id)) with check (is_owner(academy_id));

create policy training_blocks_read on training_blocks
  for select using (is_member(academy_id));

-- usage_count조차 직접 못 올린다. increment_block_usage() RPC만 허용.
create policy training_blocks_owner_write on training_blocks
  for all using (is_owner(academy_id)) with check (is_owner(academy_id));

-- -----------------------------------------------------------------------------
-- 세션 · 출결
-- -----------------------------------------------------------------------------

create policy session_plans_read on session_plans
  for select using (is_owner(academy_id) or coaches_class(class_id));

create policy session_plans_coach_insert on session_plans
  for insert with check (coaches_class(class_id) and coach_id = my_coach_id(academy_id));

create policy session_plans_coach_update on session_plans
  for update using (coaches_class(class_id)) with check (coaches_class(class_id));

create policy session_plans_owner_write on session_plans
  for all using (is_owner(academy_id)) with check (is_owner(academy_id));

create policy attendance_read on attendance_logs
  for select using (is_owner(academy_id) or coaches_class(class_id));

create policy attendance_coach_insert on attendance_logs
  for insert with check (coaches_class(class_id));

create policy attendance_coach_update on attendance_logs
  for update using (coaches_class(class_id)) with check (coaches_class(class_id));

create policy attendance_coach_delete on attendance_logs
  for delete using (coaches_class(class_id));

create policy attendance_owner_write on attendance_logs
  for all using (is_owner(academy_id)) with check (is_owner(academy_id));

-- ★ 대표의 이탈 대응 기록.
create policy cs_actions_owner_only on cs_actions
  for all using (is_owner(academy_id)) with check (is_owner(academy_id));

-- -----------------------------------------------------------------------------
-- 감사 로그 — append only
-- 수정·삭제 정책이 없다. 아무도 지울 수 없다는 뜻이고, 그게 감사 로그의 요건이다.
-- -----------------------------------------------------------------------------

create policy audit_insert on audit_logs
  for insert with check (is_member(academy_id) and actor_id = auth.uid());

create policy audit_owner_read on audit_logs
  for select using (is_owner(academy_id));
