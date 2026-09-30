-- =============================================================================
-- 0008 — 설문: 이미 아는 학부모에게 묻는 폼
--
-- 0006의 폼 링크는 모르는 사람을 위한 문이다. 누구나 열 수 있고, 접수는
-- 전부 문의(leads)가 된다. 이 파일은 반대편이다 — 재원생(또는 체험을 마친
-- 문의) 보호자 한 명 한 명에게 **그 집만 가진 링크**를 보내고, 답이 처음부터
-- 그 원생 행에 붙어 온다. 학부모는 아이 이름을 다시 쓰지 않는다.
--
--   surveys            — 설문 한 건. 질문, 대상 반, 마감일.
--   survey_recipients  — 한 가정의 몫. token이 학부모의 유일한 신분이다.
--
-- 로그인 없는 학부모(anon)에게는 이번에도 테이블을 열지 않는다. 함수 둘만:
--
--   get_survey(token)             — 제목·질문·아이 이름·이전 답만.
--   submit_survey(token, answers) — 질문에 있는 항목·보기만 받는다.
--
-- 답(answers)은 학부모의 것이다. 코치·대표가 대신 써 넣을 수 있으면 "동의서"가
-- 의미를 잃는다. RLS는 행 단위라 "이 컬럼만"을 말할 수 없으므로 여기서는
-- **컬럼 권한(GRANT)** 으로 막는다: 앱은 수신자 행을 만들 때 식별 컬럼만,
-- 고칠 때는 called_at·reminded_at만 쓸 수 있다. answers·answered_at은
-- submit_survey()만 쓴다.
--
-- 0005·0006처럼 몇 번 실행해도 안전하다.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 설문
-- -----------------------------------------------------------------------------

create table if not exists surveys (
  id          uuid primary key default gen_random_uuid(),
  academy_id  uuid not null references academies(id) on delete cascade,
  kind        text not null default 'custom'
              check (kind in ('rsvp', 'schedule', 'consent', 'renewal',
                              'satisfaction', 'order', 'enrollment', 'custom')),
  title       text not null check (char_length(title) between 1 and 80),
  -- [{ label, choices[], multi, flagged[] }] — src/data/surveys.ts 의 Question.
  questions   jsonb not null
              check (jsonb_typeof(questions) = 'array'
                     and jsonb_array_length(questions) between 1 and 10
                     and octet_length(questions::text) <= 8192),
  class_ids   uuid[] not null default '{}',
  due_date    date,
  closed      boolean not null default false,
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now()
);

create index if not exists surveys_academy_idx on surveys (academy_id, created_at desc);

-- -----------------------------------------------------------------------------
-- 한 가정의 몫
-- -----------------------------------------------------------------------------

create table if not exists survey_recipients (
  id           uuid primary key default gen_random_uuid(),
  survey_id    uuid not null references surveys(id) on delete cascade,
  academy_id   uuid not null references academies(id) on delete cascade,
  student_id   uuid references students(id) on delete cascade,
  lead_id      uuid references leads(id) on delete cascade,
  -- 16자 이상, 헷갈리는 글자 없는 소문자·숫자. 학부모의 알림톡 링크에 들어간다.
  token        text not null unique check (token ~ '^[a-z0-9]{16,40}$'),
  answers      jsonb not null default '{}'::jsonb,
  answered_at  timestamptz,
  reminded_at  timestamptz,
  -- 보기 끝에 !가 붙은 답("고민 중이에요!")을 고른 집에 전화한 시각.
  called_at    timestamptz,
  created_at   timestamptz not null default now(),
  check ((student_id is null) <> (lead_id is null))
);

create index if not exists survey_recipients_survey_idx on survey_recipients (survey_id);
create index if not exists survey_recipients_lead_idx on survey_recipients (lead_id)
  where lead_id is not null;
create unique index if not exists survey_recipients_student_uniq
  on survey_recipients (survey_id, student_id) where student_id is not null;
create unique index if not exists survey_recipients_lead_uniq
  on survey_recipients (survey_id, lead_id) where lead_id is not null;

-- -----------------------------------------------------------------------------
-- RLS
--
-- 설문 자체(제목·질문)는 회원 누구나 읽는다 — 개인정보가 없다.
-- 수신자 행은 원생 정책을 그대로 따른다: 대표는 전부, 코치는 자기 반 원생의
-- 것만. 문의 가정의 행은 문의와 같이 회원 전체.
-- -----------------------------------------------------------------------------

alter table surveys enable row level security;
alter table survey_recipients enable row level security;

drop policy if exists surveys_member_read on surveys;
create policy surveys_member_read on surveys
  for select using (is_member(academy_id));

drop policy if exists surveys_member_insert on surveys;
create policy surveys_member_insert on surveys
  for insert with check (is_member(academy_id));

-- 마감은 만든 사람이나 대표가.
drop policy if exists surveys_update on surveys;
create policy surveys_update on surveys
  for update using (is_owner(academy_id) or created_by = auth.uid())
  with check (is_owner(academy_id) or created_by = auth.uid());

drop policy if exists surveys_owner_delete on surveys;
create policy surveys_owner_delete on surveys
  for delete using (is_owner(academy_id));

/* 이 수신자 행을 내가 다뤄도 되는가. 원생이면 students_read와 같은 조건. */
create or replace function public.can_reach_recipient(
  p_academy_id uuid, p_student_id uuid, p_lead_id uuid
)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select case
    when p_student_id is not null then exists (
      select 1 from students s
      where s.id = p_student_id and s.academy_id = p_academy_id
        and (public.is_owner(p_academy_id) or public.coaches_class(s.class_id))
    )
    when p_lead_id is not null then exists (
      select 1 from leads l
      where l.id = p_lead_id and l.academy_id = p_academy_id
        and public.is_member(p_academy_id)
    )
    else false
  end;
$$;

revoke execute on function public.can_reach_recipient(uuid, uuid, uuid) from public;
grant execute on function public.can_reach_recipient(uuid, uuid, uuid) to authenticated;

drop policy if exists survey_recipients_read on survey_recipients;
create policy survey_recipients_read on survey_recipients
  for select using (can_reach_recipient(academy_id, student_id, lead_id));

drop policy if exists survey_recipients_insert on survey_recipients;
create policy survey_recipients_insert on survey_recipients
  for insert with check (
    can_reach_recipient(academy_id, student_id, lead_id)
    -- 한정자 필수: 서브쿼리 안의 맨 academy_id는 v.academy_id로 풀려 늘 참이 된다.
    and exists (select 1 from surveys v
                where v.id = survey_recipients.survey_id
                  and v.academy_id = survey_recipients.academy_id)
  );

drop policy if exists survey_recipients_update on survey_recipients;
create policy survey_recipients_update on survey_recipients
  for update using (can_reach_recipient(academy_id, student_id, lead_id))
  with check (can_reach_recipient(academy_id, student_id, lead_id));

drop policy if exists survey_recipients_owner_delete on survey_recipients;
create policy survey_recipients_owner_delete on survey_recipients
  for delete using (is_owner(academy_id));

-- 컬럼 권한 — 머리말 참조. 정책이 "어느 행"을, 이것이 "어느 칸"을 정한다.
revoke insert, update on survey_recipients from authenticated;
grant insert (id, survey_id, academy_id, student_id, lead_id, token)
  on survey_recipients to authenticated;
grant update (called_at, reminded_at) on survey_recipients to authenticated;
revoke all on survey_recipients from anon;
revoke all on surveys from anon;

-- -----------------------------------------------------------------------------
-- 학부모 — 조회
--
-- 아이 이름을 돌려준다. 링크를 연 사람이 보호자라는 전제이고, 그 전제는
-- 80비트 토큰과 "보호자 번호로만 발송" 두 가지가 받친다. 이름 대신 "학생"이라고
-- 부르는 링크는 학부모에게 스팸처럼 읽히고, 그러면 아무도 답하지 않는다.
-- 성(姓)을 빼는 식의 가림은 하지 않는다 — 같은 반에 같은 이름이 흔하다.
-- -----------------------------------------------------------------------------

create or replace function public.get_survey(p_token text)
returns jsonb language sql stable security definer
set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'title',        v.title,
    'kind',         v.kind,
    'questions',    v.questions,
    'due_date',     v.due_date,
    'open',         not v.closed
                    and (v.due_date is null
                         or v.due_date >= (now() at time zone 'Asia/Seoul')::date),
    'academy_name', coalesce(nullif(st.brand_name, ''), a.name),
    'child_name',   coalesce(s.name, nullif(l.child_name, ''), ''),
    'answers',      r.answers,
    'answered_at',  r.answered_at
  )
  from survey_recipients r
  join surveys v   on v.id = r.survey_id
  join academies a on a.id = r.academy_id
  left join academy_settings st on st.academy_id = a.id
  left join students s on s.id = r.student_id
  left join leads l    on l.id = r.lead_id
  where r.token = lower(trim(p_token))
    and a.deleted_at is null;
$$;

-- -----------------------------------------------------------------------------
-- 학부모 — 답하기
--
-- 마감 전이면 몇 번이든 고칠 수 있다(마지막 답이 답이다). 받는 것:
--   · 질문에 있는 항목 이름만. 모르는 키는 거절.
--   · 보기가 있는 질문은 보기 중에서만. 복수가 아니면 하나만.
--   · 보기가 있는 질문은 필수 — 참가 조사에서 "참가 여부 빈칸"은 답이 아니다.
--   · 서술은 500자까지.
-- -----------------------------------------------------------------------------

create or replace function public.submit_survey(p_token text, p_answers jsonb)
returns boolean language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_rec     survey_recipients;
  v_survey  surveys;
  v_answers jsonb := coalesce(p_answers, '{}'::jsonb);
  v_clean   jsonb := '{}'::jsonb;
  v_q       jsonb;
  v_label   text;
  v_value   text;
  v_pick    text;
  v_picks   text[];
begin
  select * into v_rec from survey_recipients where token = lower(trim(p_token));
  if v_rec.id is null then
    raise exception '없는 링크입니다';
  end if;

  select * into v_survey from surveys where id = v_rec.survey_id;
  if v_survey.closed
     or (v_survey.due_date is not null
         and v_survey.due_date < (now() at time zone 'Asia/Seoul')::date) then
    raise exception '마감된 설문입니다';
  end if;

  if jsonb_typeof(v_answers) <> 'object' or octet_length(v_answers::text) > 8192 then
    raise exception '입력 내용이 너무 깁니다';
  end if;

  if exists (
    select 1 from jsonb_object_keys(v_answers) k
    where k not in (select q ->> 'label' from jsonb_array_elements(v_survey.questions) q)
  ) then
    raise exception '설문이 바뀌었습니다. 페이지를 새로 열어 주세요';
  end if;

  for v_q in select * from jsonb_array_elements(v_survey.questions) loop
    v_label := v_q ->> 'label';
    v_value := trim(coalesce(v_answers ->> v_label, ''));

    if jsonb_array_length(coalesce(v_q -> 'choices', '[]'::jsonb)) = 0 then
      if char_length(v_value) > 500 then
        raise exception '"%"은 500자까지 쓸 수 있습니다', v_label;
      end if;
    else
      v_picks := array(select trim(x) from unnest(string_to_array(v_value, ', ')) x
                       where trim(x) <> '');
      if coalesce(array_length(v_picks, 1), 0) = 0 then
        raise exception '"%"에 답해 주세요', v_label;
      end if;
      if array_length(v_picks, 1) > 1 and not coalesce((v_q ->> 'multi')::boolean, false) then
        raise exception '"%"은 하나만 고를 수 있습니다', v_label;
      end if;
      foreach v_pick in array v_picks loop
        if not (v_q -> 'choices') ? v_pick then
          raise exception '"%"의 보기에 없는 답입니다', v_label;
        end if;
      end loop;
      v_value := array_to_string(v_picks, ', ');
    end if;

    if v_value <> '' then
      v_clean := v_clean || jsonb_build_object(v_label, v_value);
    end if;
  end loop;

  update survey_recipients
     set answers = v_clean, answered_at = now()
   where id = v_rec.id;

  return true;
end;
$$;

-- -----------------------------------------------------------------------------
-- 알림톡 대기열 — 설문 템플릿 두 개를 허용 목록에 더한다.
-- 본문은 0006과 같고, 바뀐 곳은 템플릿 코드 목록 한 줄이다. 0009의 welcome도
-- 미리 넣어 둔다: 0009 뒤에 이 파일을 다시 실행해도 목록이 줄어들지 않게.
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

revoke execute on function public.get_survey(text) from public;
revoke execute on function public.submit_survey(text, jsonb) from public;
revoke execute on function public.enqueue_alimtalk(uuid, jsonb) from public;

grant execute on function public.get_survey(text) to anon, authenticated;
grant execute on function public.submit_survey(text, jsonb) to anon, authenticated;
grant execute on function public.enqueue_alimtalk(uuid, jsonb) to authenticated;

commit;
