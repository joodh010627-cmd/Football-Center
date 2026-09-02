-- =============================================================================
-- 0003 — 가입 · 초대 · 쓰기 RPC
--
-- 여기 있는 함수들은 전부 "RLS를 통과할 수 없지만 반드시 필요한 동작"이다.
--
--   가입 직전의 사용자는 아직 어느 아카데미의 회원도 아니다. 그래서 테이블에
--   직접 insert 할 수 없다. 그 최초의 한 걸음만 security definer로 연다.
--
-- definer 함수는 RLS를 우회하므로, 각 함수가 스스로 권한을 검사한다.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 대표 가입 — 아카데미를 새로 만든다
--
-- 코치는 이 경로를 쓸 수 없다. 코치는 반드시 초대 코드로만 들어온다.
-- -----------------------------------------------------------------------------

create or replace function public.create_academy(
  p_name         text,
  p_display_name text default ''
)
returns uuid language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_user uuid := auth.uid();
  v_id   uuid;
begin
  if v_user is null then
    raise exception '로그인이 필요합니다';
  end if;

  if coalesce(trim(p_name), '') = '' then
    raise exception '아카데미 이름을 입력해 주세요';
  end if;

  -- 한 계정이 아카데미를 무한히 찍어내지 못하게 막는다. 다중 아카데미 운영이
  -- 필요해지면 그때 요금제와 함께 푼다.
  if exists (select 1 from academy_members where user_id = v_user and role = 'owner') then
    raise exception '이미 운영 중인 아카데미가 있습니다';
  end if;

  insert into academies (name) values (trim(p_name)) returning id into v_id;

  insert into academy_members (user_id, academy_id, role, display_name)
  values (v_user, v_id, 'owner', coalesce(nullif(trim(p_display_name), ''), '대표'));

  insert into academy_settings (academy_id, brand_name) values (v_id, trim(p_name));

  perform public.seed_default_behavior_tags(v_id);

  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 기본 행동 태그 21종
--
-- 지금까지 mockData.ts에 하드코딩돼 있던 것. 테이블로 내려오면서 아카데미마다
-- 고쳐 쓸 수 있게 된다 — 개인화는 코드 브랜치가 아니라 데이터로 한다.
-- -----------------------------------------------------------------------------

create or replace function public.seed_default_behavior_tags(p_academy_id uuid)
returns void language sql security definer
set search_path = public, pg_temp as $$
  insert into behavior_tags (academy_id, label, dimension, polarity, sort_order)
  select p_academy_id, t.label, t.dimension, t.polarity, t.ord
  from (values
    ('#드리블우수',   'skill',    'positive',  1),
    ('#패스정확',     'skill',    'positive',  2),
    ('#슈팅과감',     'skill',    'positive',  3),
    ('#퍼스트터치',   'skill',    'positive',  4),
    ('#적극적수비',   'skill',    'positive',  5),
    ('#시야확보',     'skill',    'positive',  6),
    ('#끝까지집중',   'attitude', 'positive',  7),
    ('#자신감상승',   'attitude', 'positive',  8),
    ('#질문많음',     'attitude', 'positive',  9),
    ('#즐겁게참여',   'attitude', 'positive', 10),
    ('#팀워크좋음',   'teamwork', 'positive', 11),
    ('#동생챙김',     'teamwork', 'positive', 12),
    ('#리더십발휘',   'teamwork', 'positive', 13),
    ('#격려하기',     'teamwork', 'positive', 14),
    ('#체력향상',     'physical', 'positive', 15),
    ('#스피드좋음',   'physical', 'positive', 16),
    ('#밸런스안정',   'physical', 'positive', 17),
    ('#컨디션저하',   'caution',  'watch',    18),
    ('#집중력흔들림', 'caution',  'watch',    19),
    ('#소극적참여',   'caution',  'watch',    20),
    ('#통증호소',     'caution',  'watch',    21)
  ) as t(label, dimension, polarity, ord);
$$;

-- -----------------------------------------------------------------------------
-- 초대 코드 발급 — 대표만
-- -----------------------------------------------------------------------------

create or replace function public.create_coach_invite(
  p_academy_id uuid,
  p_coach_name text,
  p_label      text default ''
)
returns text language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_coach uuid;
  v_code  text;
begin
  if not public.is_owner(p_academy_id) then
    raise exception '대표만 코치를 초대할 수 있습니다';
  end if;

  -- 코치 행을 먼저 만들어 둔다. 그래야 대표가 초대장을 보내기 전에 반 배정을
  -- 끝낼 수 있고, 코치는 로그인하자마자 자기 반이 보인다.
  insert into coaches (academy_id, name)
  values (p_academy_id, coalesce(nullif(trim(p_coach_name), ''), '신규 코치'))
  returning id into v_coach;

  insert into coach_evaluations (coach_id, academy_id) values (v_coach, p_academy_id);

  -- 사람이 불러줄 수 있는 8자리. 혼동되는 0/O/1/I는 뺀다.
  v_code := (
    select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
                             floor(random() * 32)::int + 1, 1), '')
    from generate_series(1, 8)
  );

  insert into academy_invites (code, academy_id, role, coach_id, label, created_by)
  values (v_code, p_academy_id, 'coach', v_coach, coalesce(p_label, ''), auth.uid());

  return v_code;
end;
$$;

-- -----------------------------------------------------------------------------
-- 초대 코드 교환 — 코치 가입의 유일한 경로
--
-- 호출자는 아직 회원이 아니므로 academy_invites를 select 할 수 없다.
-- 이 함수 안에서만 코드가 대조되고, 실패해도 어느 아카데미인지 새지 않는다.
-- -----------------------------------------------------------------------------

create or replace function public.redeem_invite(
  p_code         text,
  p_display_name text default ''
)
returns uuid language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_user   uuid := auth.uid();
  v_invite academy_invites%rowtype;
  v_coach  uuid;
begin
  if v_user is null then
    raise exception '로그인이 필요합니다';
  end if;

  -- for update: 두 사람이 같은 코드를 동시에 넣어도 하나만 통과한다.
  select * into v_invite from academy_invites
  where code = upper(trim(p_code)) for update;

  if not found or v_invite.used_at is not null or v_invite.expires_at < now() then
    -- 세 경우를 구분해 알려주지 않는다. 유효한 코드를 찾는 탐색을 돕게 된다.
    raise exception '사용할 수 없는 초대 코드입니다';
  end if;

  if exists (select 1 from academy_members
             where user_id = v_user and academy_id = v_invite.academy_id) then
    raise exception '이미 이 아카데미에 소속되어 있습니다';
  end if;

  v_coach := v_invite.coach_id;

  if v_coach is null then
    insert into coaches (academy_id, name)
    values (v_invite.academy_id, coalesce(nullif(trim(p_display_name), ''), '신규 코치'))
    returning id into v_coach;

    insert into coach_evaluations (coach_id, academy_id)
    values (v_coach, v_invite.academy_id);
  elsif nullif(trim(p_display_name), '') is not null then
    -- 대표가 넣어둔 이름보다 본인이 적은 이름을 우선한다.
    update coaches set name = trim(p_display_name) where id = v_coach;
  end if;

  insert into academy_members (user_id, academy_id, role, coach_id, display_name)
  values (v_user, v_invite.academy_id, v_invite.role, v_coach,
          coalesce(nullif(trim(p_display_name), ''), '코치'));

  update academy_invites
  set used_at = now(), used_by = v_user
  where code = v_invite.code;

  return v_invite.academy_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 블록 사용 횟수
--
-- 코치는 training_blocks에 update 권한이 없다(0002). 세션을 짜면 usage_count가
-- 올라가야 하는데, 그 한 컬럼 때문에 테이블 쓰기를 열면 코어 커리큘럼 지정까지
-- 같이 열린다. 그래서 이 함수만 연다.
-- -----------------------------------------------------------------------------

create or replace function public.increment_block_usage(p_block_ids uuid[])
returns void language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  update training_blocks b
  set usage_count = b.usage_count + 1
  where b.id = any(p_block_ids)
    and public.is_member(b.academy_id);
end;
$$;

-- -----------------------------------------------------------------------------
-- 출결 제출에 따른 원생 날짜 갱신
--
-- 코치는 students에 update 권한이 없다(0002). 출결을 넣으면 최종 출석일과
-- 학부모 연락일은 갱신되어야 하는데, 그 두 컬럼 때문에 행 전체 쓰기를 열면
-- 이름·소속 반까지 열린다. 그래서 이 함수가 딱 두 컬럼만 만진다.
--
-- 이탈 점수는 일부러 저장하지 않는다. 매 로드마다 출결 로그에서 다시 계산되므로,
-- 저장해 봐야 낡을 방법이 하나 더 생길 뿐이다.
-- -----------------------------------------------------------------------------

create or replace function public.touch_attendance_dates(
  p_student_ids uuid[],
  p_present_ids uuid[],
  p_date        date
)
returns void language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  update students s
  set
    -- 출석한 원생만 출석 시계가 리셋된다. 결석·부상은 그대로 둔다.
    last_attendance_date = case
      when s.id = any(p_present_ids) then p_date
      else s.last_attendance_date
    end,
    -- 기록 자체가 학부모 리포트다. 출결 여부와 무관하게 갱신된다.
    last_parent_contact_date = p_date
  where s.id = any(p_student_ids)
    -- 자기 반 원생이거나, 대표 본인일 때만.
    and (public.coaches_class(s.class_id) or public.is_owner(s.academy_id));
end;
$$;

-- -----------------------------------------------------------------------------
-- 실행 권한
--
-- definer 함수는 기본적으로 public에 열려 있다. 익명 사용자에게 남겨 두지
-- 않는다 — 특히 redeem_invite는 코드 대조 지점이다.
-- -----------------------------------------------------------------------------

revoke execute on function public.create_academy(text, text)                from public;
revoke execute on function public.seed_default_behavior_tags(uuid)          from public;
revoke execute on function public.create_coach_invite(uuid, text, text)     from public;
revoke execute on function public.redeem_invite(text, text)                 from public;
revoke execute on function public.increment_block_usage(uuid[])             from public;
revoke execute on function public.touch_attendance_dates(uuid[], uuid[], date) from public;

grant execute on function public.create_academy(text, text)            to authenticated;
grant execute on function public.create_coach_invite(uuid, text, text) to authenticated;
grant execute on function public.redeem_invite(text, text)             to authenticated;
grant execute on function public.increment_block_usage(uuid[])         to authenticated;
grant execute on function public.touch_attendance_dates(uuid[], uuid[], date) to authenticated;
-- seed_default_behavior_tags는 create_academy 내부에서만 쓰인다. 외부 노출 없음.
