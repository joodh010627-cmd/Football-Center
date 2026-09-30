-- =============================================================================
-- 0008 — 온보딩: 문의에서 첫 달까지
--
-- 등록 확정이 지금까지는 문의 행의 stage 하나를 바꾸는 것뿐이었다. 원생 행이
-- 생기지 않으니 반 명단에도, 출결에도, 첫 수업 리포트에도 새 아이가 없었다 —
-- 온보딩이 가장 중요한 바로 그 순간에 흐름이 끊겨 있었다.
--
--   enroll_lead(lead, class, age_group) — 문의 한 건을 원생 한 명으로. 한 번에.
--   onboarding_touches                  — 연락 시도 기록. 첫 상담 전화, 체험 후
--                                         연락, 환영 안내, 첫 주 안부, 첫 달 점검.
--
-- 연락 기록이 표로 필요한 이유: "안 받음"이면 내일 다시, "고민 중"이면 사흘 뒤
-- 다시 — 다음 할 일의 날짜가 이 기록에서 나온다(src/data/onboarding.ts).
-- 한 번 쓴 기록은 고치지 않는다. 틀렸으면 새 기록을 남긴다.
--
-- 0007의 can_reach_recipient()를 그대로 쓴다: 원생이면 대표 또는 그 반 코치,
-- 문의면 회원 누구나. 몇 번 실행해도 안전하다.
-- =============================================================================

begin;

create table if not exists onboarding_touches (
  id          uuid primary key default gen_random_uuid(),
  academy_id  uuid not null references academies(id) on delete cascade,
  lead_id     uuid references leads(id) on delete cascade,
  student_id  uuid references students(id) on delete cascade,
  step        text not null
              check (step in ('first_call', 'trial_followup', 'welcome', 'week1', 'month1')),
  outcome     text not null default 'done'
              check (outcome in ('done', 'no_answer', 'concern')),
  note        text not null default '' check (char_length(note) <= 500),
  actor_name  text not null default '' check (char_length(actor_name) <= 60),
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now(),
  check ((lead_id is null) <> (student_id is null))
);

create index if not exists onboarding_touches_academy_idx
  on onboarding_touches (academy_id, created_at desc);

alter table onboarding_touches enable row level security;

drop policy if exists onboarding_touches_read on onboarding_touches;
create policy onboarding_touches_read on onboarding_touches
  for select using (can_reach_recipient(academy_id, student_id, lead_id));

drop policy if exists onboarding_touches_insert on onboarding_touches;
create policy onboarding_touches_insert on onboarding_touches
  for insert with check (can_reach_recipient(academy_id, student_id, lead_id));

-- update 정책은 없다(기록은 고치지 않는다). 지우는 건 대표만.
drop policy if exists onboarding_touches_owner_delete on onboarding_touches;
create policy onboarding_touches_owner_delete on onboarding_touches
  for delete using (is_owner(academy_id));

revoke all on onboarding_touches from anon;

-- -----------------------------------------------------------------------------
-- 등록 확정
--
-- 대표, 또는 그 반을 맡은 코치. 체험을 받은 코치가 자기 반으로 들이는 건
-- 자연스럽고, 남의 반에 원생을 넣는 건 대표의 일이다. 수강료(student_billing)는
-- 여기서 만들지 않는다 — 여전히 대표 전용 표이고 대표가 정한다.
--
-- 이미 등록된 문의면 새로 만들지 않고 그 원생을 돌려준다(두 번 눌러도 한 명).
-- -----------------------------------------------------------------------------

create or replace function public.enroll_lead(p_lead_id uuid, p_class_id uuid, p_age_group text)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_lead    leads;
  v_class   classes;
  v_student students;
begin
  select * into v_lead from leads where id = p_lead_id;
  if v_lead.id is null or not public.is_member(v_lead.academy_id) then
    raise exception '문의를 찾을 수 없습니다';
  end if;

  if v_lead.enrolled_student_id is not null then
    select * into v_student from students where id = v_lead.enrolled_student_id;
    if v_student.id is not null then
      return to_jsonb(v_student);
    end if;
  end if;

  if v_lead.stage = 'lost' then
    raise exception '미등록으로 정리된 문의입니다. 먼저 다시 열어 주세요';
  end if;

  select * into v_class from classes where id = p_class_id and academy_id = v_lead.academy_id;
  if v_class.id is null then
    raise exception '반을 찾을 수 없습니다';
  end if;

  if not (public.is_owner(v_lead.academy_id) or public.coaches_class(v_class.id)) then
    raise exception '담당 반으로만 등록할 수 있습니다';
  end if;

  if coalesce(p_age_group, '') not in ('U7', 'U9', 'U11', 'U13', 'U15') then
    raise exception '연령대를 골라 주세요';
  end if;

  insert into students (
    academy_id, name, age_group, class_id, parent_name, parent_phone, enrolled_at, status
  ) values (
    v_lead.academy_id,
    coalesce(nullif(trim(v_lead.child_name), ''), '이름 미상'),
    p_age_group,
    v_class.id,
    v_lead.parent_name,
    v_lead.parent_phone,
    (now() at time zone 'Asia/Seoul')::date,
    'active'
  )
  returning * into v_student;

  update leads
     set stage = 'enrolled',
         stage_changed_at = now(),
         enrolled_student_id = v_student.id,
         interest_class_id = v_class.id
   where id = v_lead.id;

  return to_jsonb(v_student);
end;
$$;

-- -----------------------------------------------------------------------------
-- 알림톡 대기열 — 환영 안내(welcome)를 허용 목록에 더한다. 나머지는 0007과 같다.
-- -----------------------------------------------------------------------------

create or replace function public.enqueue_alimtalk(p_academy_id uuid, p_items jsonb)
returns integer language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_item    jsonb;
  v_code    text;
  v_body    text;
  v_name    text;
  v_phone   text;
  v_student uuid;
  v_lead    uuid;
  v_class   uuid;
  v_count   integer := 0;
begin
  if not public.is_member(p_academy_id) then
    raise exception '이 아카데미의 회원이 아닙니다';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 200 then
    raise exception '한 번에 200건까지 보낼 수 있습니다';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_code    := v_item ->> 'template_code';
    v_body    := v_item ->> 'body';
    v_student := nullif(v_item ->> 'student_id', '')::uuid;
    v_lead    := nullif(v_item ->> 'lead_id', '')::uuid;
    v_name    := null;
    v_phone   := null;

    if coalesce(v_code, '') not in ('attendance_report', 'trial_booked', 'inquiry_received',
                                    'survey_request', 'survey_reminder', 'welcome') then
      raise exception '등록되지 않은 템플릿입니다: %', v_code;
    end if;

    if v_body is null or char_length(v_body) > 1000 then
      raise exception '메시지는 1000자를 넘을 수 없습니다';
    end if;

    if v_student is not null then
      select s.parent_name, s.parent_phone, s.class_id into v_name, v_phone, v_class
      from students s where s.id = v_student and s.academy_id = p_academy_id;

      if not found then
        raise exception '원생을 찾을 수 없습니다';
      end if;
      if not (public.is_owner(p_academy_id) or public.coaches_class(v_class)) then
        raise exception '담당 반 원생에게만 보낼 수 있습니다';
      end if;
    elsif v_lead is not null then
      select l.parent_name, l.parent_phone into v_name, v_phone
      from leads l where l.id = v_lead and l.academy_id = p_academy_id;

      if not found then
        raise exception '문의를 찾을 수 없습니다';
      end if;
    else
      raise exception '받는 사람이 없습니다';
    end if;

    v_phone := regexp_replace(coalesce(v_phone, ''), '[^0-9]', '', 'g');

    insert into notification_outbox (
      academy_id, template_code, recipient_name, recipient_phone,
      student_id, lead_id, variables, body, dedupe_key, status, error
    ) values (
      p_academy_id, v_code, coalesce(v_name, ''), v_phone,
      v_student, v_lead, coalesce(v_item -> 'variables', '{}'::jsonb), v_body,
      nullif(v_item ->> 'dedupe_key', ''),
      case when char_length(v_phone) between 9 and 11 then 'queued' else 'failed' end,
      case when char_length(v_phone) between 9 and 11 then null else '보호자 연락처 없음' end
    )
    on conflict (academy_id, dedupe_key) where dedupe_key is not null do nothing;

    if found then
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

revoke execute on function public.enroll_lead(uuid, uuid, text) from public;
revoke execute on function public.enqueue_alimtalk(uuid, jsonb) from public;
grant execute on function public.enroll_lead(uuid, uuid, text) to authenticated;
grant execute on function public.enqueue_alimtalk(uuid, jsonb) to authenticated;

commit;
