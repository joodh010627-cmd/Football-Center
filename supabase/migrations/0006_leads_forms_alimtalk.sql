-- =============================================================================
-- 0006 — 문의(leads) · 공개 폼 링크 · 알림톡 발송 대기열
--
-- 지금까지 문의 파이프라인은 브라우저 메모리에만 있었다(WorkspaceContext).
-- 파일럿 전에는 테이블을 만들지 않는다는 원칙이 있었는데, 2026-09-26에 바꿨다:
-- 학부모가 실제 폼 링크로 접수하려면 접수가 떨어질 곳이 있어야 한다.
--
-- 세 가지를 만든다.
--
--   form_links          — 학부모에게 보내는 링크. slug가 공개 주소다.
--   leads               — 문의 한 건. 폼 접수든 전화든 여기로 모인다.
--   notification_outbox — 알림톡 발송 대기열. 카카오 연동 직전 단계까지.
--
-- 로그인하지 않은 학부모(anon)에게는 테이블을 하나도 열지 않는다. 대신
-- security definer 함수 두 개만 연다:
--
--   get_public_form(slug)     — 폼 제목·항목·아카데미 이름만. 다른 건 새지 않는다.
--   submit_public_form(...)   — 검증·동의 확인·속도 제한 후 leads 에 한 줄.
--
-- 알림톡 대기열도 클라이언트가 직접 insert 하지 못한다. enqueue_alimtalk()가
-- 수신 번호를 원생/문의 행에서 **직접** 찾아 넣는다. 클라이언트가 번호를 넘기게
-- 하면 로그인한 누구든 아무 번호로 메시지를 쌓을 수 있다.
--
-- 0005와 같은 이유로 이 파일은 몇 번 실행해도 안전하다. 실패하면 원인만 고치고
-- 파일 전체를 다시 붙여넣으면 된다.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 폼 링크
-- -----------------------------------------------------------------------------

create table if not exists form_links (
  id          uuid primary key default gen_random_uuid(),
  academy_id  uuid not null references academies(id) on delete cascade,
  title       text not null default '',
  kind        text not null default 'inquiry'
              check (kind in ('inquiry', 'trial', 'enrollment', 'survey')),
  -- 공개 주소의 일부. 전 테넌트에서 유일해야 한다 — 학부모의 링크에는
  -- 아카데미 id가 없다.
  slug        text not null unique check (slug ~ '^[a-z0-9-]{4,40}$'),
  fields      text[] not null default '{}',
  active      boolean not null default true,
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now()
);

create index if not exists form_links_academy_idx on form_links (academy_id);

-- -----------------------------------------------------------------------------
-- 문의
-- -----------------------------------------------------------------------------

create table if not exists leads (
  id                   uuid primary key default gen_random_uuid(),
  academy_id           uuid not null references academies(id) on delete cascade,
  child_name           text not null default '',
  age_label            text not null default '',
  parent_name          text not null default '',
  -- students.parent_phone과 같은 이유로 평문은 임시다 (PRODUCTIZATION §6).
  parent_phone         text not null default '',
  stage                text not null default 'inquiry'
                       check (stage in ('inquiry', 'contacted', 'trial_booked',
                                        'trial_done', 'enrolled', 'lost')),
  source               text not null default 'phone'
                       check (source in ('form', 'phone', 'walk_in', 'referral', 'social')),
  form_link_id         uuid references form_links(id) on delete set null,
  interest_class_id    uuid references classes(id) on delete set null,
  trial_date           date,
  trial_class_id       uuid references classes(id) on delete set null,
  memo                 text not null default '',
  -- 폼의 자유 항목(희망 요일, 문의 내용 …). 항목 이름 → 답.
  answers              jsonb not null default '{}'::jsonb,
  -- 개인정보 수집·이용 동의. 폼 접수는 이 값 없이 들어올 수 없다.
  consent_at           timestamptz,
  consent_version      text,
  created_at           timestamptz not null default now(),
  stage_changed_at     timestamptz not null default now(),
  enrolled_student_id  uuid references students(id) on delete set null,
  lost_reason          text not null default ''
);

create index if not exists leads_academy_idx on leads (academy_id, created_at desc);
create index if not exists leads_form_link_idx on leads (form_link_id);

-- -----------------------------------------------------------------------------
-- 알림톡 발송 대기열
--
-- 상태 흐름:  queued → sending → sent
--                           ↘ failed
--             queued → dry_run   (발송 대행사 키가 없을 때 — 지금 전부 여기)
--
-- body는 템플릿에 변수를 채운 최종 문구다. 카카오는 심사받은 템플릿과 글자
-- 하나라도 다르면 발송을 거부하므로, 템플릿 원문과 변수는 따로 남겨 둔다
-- (재발송·감사용).
-- -----------------------------------------------------------------------------

create table if not exists notification_outbox (
  id                  uuid primary key default gen_random_uuid(),
  academy_id          uuid not null references academies(id) on delete cascade,
  channel             text not null default 'alimtalk' check (channel in ('alimtalk')),
  template_code       text not null,
  recipient_name      text not null default '',
  recipient_phone     text not null,
  student_id          uuid references students(id) on delete set null,
  lead_id             uuid references leads(id) on delete set null,
  variables           jsonb not null default '{}'::jsonb,
  body                text not null check (char_length(body) <= 1000),
  status              text not null default 'queued'
                      check (status in ('queued', 'sending', 'sent', 'failed',
                                        'dry_run', 'cancelled')),
  provider            text,
  provider_message_id text,
  error               text,
  attempts            integer not null default 0,
  -- 같은 원생에게 같은 수업 리포트가 두 번 쌓이지 않게 하는 키.
  dedupe_key          text,
  created_by          uuid default auth.uid(),
  created_at          timestamptz not null default now(),
  sent_at             timestamptz
);

create index if not exists outbox_academy_idx on notification_outbox (academy_id, created_at desc);
create index if not exists outbox_queued_idx on notification_outbox (status) where status = 'queued';
create unique index if not exists outbox_dedupe_idx
  on notification_outbox (academy_id, dedupe_key) where dedupe_key is not null;

-- -----------------------------------------------------------------------------
-- RLS
--
-- 문의 응대는 대표만의 일이 아니다 — 체험 수업을 받는 건 코치다. 그래서
-- leads·form_links는 회원 전체가 읽고 쓴다. 삭제는 대표만.
--
-- 대기열은 읽기만 연다: 대표는 전부, 코치는 자기가 쌓은 것만. 쓰기는
-- enqueue_alimtalk()와 발송 서버(service_role)만 한다.
-- -----------------------------------------------------------------------------

alter table form_links enable row level security;
alter table leads enable row level security;
alter table notification_outbox enable row level security;

drop policy if exists form_links_member_read on form_links;
create policy form_links_member_read on form_links
  for select using (is_member(academy_id));

drop policy if exists form_links_member_insert on form_links;
create policy form_links_member_insert on form_links
  for insert with check (is_member(academy_id));

drop policy if exists form_links_member_update on form_links;
create policy form_links_member_update on form_links
  for update using (is_member(academy_id)) with check (is_member(academy_id));

drop policy if exists form_links_owner_delete on form_links;
create policy form_links_owner_delete on form_links
  for delete using (is_owner(academy_id));

drop policy if exists leads_member_read on leads;
create policy leads_member_read on leads
  for select using (is_member(academy_id));

drop policy if exists leads_member_insert on leads;
create policy leads_member_insert on leads
  for insert with check (is_member(academy_id));

drop policy if exists leads_member_update on leads;
create policy leads_member_update on leads
  for update using (is_member(academy_id)) with check (is_member(academy_id));

drop policy if exists leads_owner_delete on leads;
create policy leads_owner_delete on leads
  for delete using (is_owner(academy_id));

drop policy if exists outbox_read on notification_outbox;
create policy outbox_read on notification_outbox
  for select using (is_owner(academy_id) or (is_member(academy_id) and created_by = auth.uid()));

-- -----------------------------------------------------------------------------
-- 공개 폼 — 조회
--
-- 링크가 꺼졌거나 없으면 null. 어느 쪽인지 구분해 주지 않는다: "없음"과
-- "중단됨"을 구별하게 해 주면 slug를 긁어 보는 쪽에 힌트가 된다.
-- -----------------------------------------------------------------------------

create or replace function public.get_public_form(p_slug text)
returns jsonb language sql stable security definer
set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'title',        f.title,
    'kind',         f.kind,
    'fields',       to_jsonb(f.fields),
    'academy_name', coalesce(nullif(s.brand_name, ''), a.name)
  )
  from form_links f
  join academies a on a.id = f.academy_id
  left join academy_settings s on s.academy_id = a.id
  where f.slug = lower(trim(p_slug))
    and f.active
    and a.deleted_at is null;
$$;

-- -----------------------------------------------------------------------------
-- 공개 폼 — 접수
--
-- 로그인이 없으니 이 함수가 유일한 문지기다.
--   · 동의 없이는 받지 않는다.
--   · 연락처는 숫자만 남겨 9~11자리인지 본다.
--   · 모든 텍스트에 길이 상한. answers는 항목 20개·전체 4KB까지.
--   · 같은 번호로 같은 링크에 10분 안에 3건, 링크 하나에 1시간 60건까지.
--     그 이상은 사람이 아니거나, 사람이라도 받아서 좋을 게 없다.
-- 성공해도 lead id를 돌려주지 않는다 — 학부모 화면에 필요 없는 정보다.
-- -----------------------------------------------------------------------------

create or replace function public.submit_public_form(
  p_slug         text,
  p_parent_name  text,
  p_parent_phone text,
  p_child_name   text,
  p_age_label    text,
  p_answers      jsonb,
  p_consent      boolean
)
returns boolean language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_link    form_links;
  v_phone   text := regexp_replace(coalesce(p_parent_phone, ''), '[^0-9]', '', 'g');
  v_answers jsonb := coalesce(p_answers, '{}'::jsonb);
  v_lead    uuid;
  v_academy text;
begin
  select * into v_link from form_links
  where slug = lower(trim(p_slug)) and active;

  if v_link.id is null then
    raise exception '접수가 마감되었거나 없는 링크입니다';
  end if;

  if p_consent is distinct from true then
    raise exception '개인정보 수집·이용에 동의해 주세요';
  end if;

  if char_length(trim(coalesce(p_parent_name, ''))) not between 1 and 40 then
    raise exception '보호자 성함을 확인해 주세요';
  end if;

  if char_length(v_phone) not between 9 and 11 then
    raise exception '연락처를 확인해 주세요';
  end if;

  if char_length(coalesce(p_child_name, '')) > 40 or char_length(coalesce(p_age_label, '')) > 20 then
    raise exception '입력 내용이 너무 깁니다';
  end if;

  if jsonb_typeof(v_answers) <> 'object'
     or (select count(*) from jsonb_object_keys(v_answers)) > 20
     or octet_length(v_answers::text) > 4096 then
    raise exception '입력 내용이 너무 깁니다';
  end if;

  if (select count(*) from leads
      where form_link_id = v_link.id and parent_phone = v_phone
        and created_at > now() - interval '10 minutes') >= 3
     or (select count(*) from leads
         where form_link_id = v_link.id
           and created_at > now() - interval '1 hour') >= 60 then
    raise exception '잠시 후 다시 시도해 주세요';
  end if;

  insert into leads (
    academy_id, child_name, age_label, parent_name, parent_phone,
    stage, source, form_link_id, answers, memo, consent_at, consent_version
  ) values (
    v_link.academy_id,
    trim(coalesce(p_child_name, '')),
    trim(coalesce(p_age_label, '')),
    trim(p_parent_name),
    v_phone,
    'inquiry', 'form', v_link.id, v_answers,
    left(coalesce(v_answers ->> '문의 내용', ''), 500),
    now(), 'form-v1'
  )
  returning id into v_lead;

  -- 접수 확인 알림톡을 대기열에 쌓는다. 실제 발송은 발송 서버가 붙은 뒤의 일이고,
  -- 지금은 쌓이기만 한다. 문구는 src/lib/alimtalk/templates.ts 의
  -- inquiry_received 와 글자 하나까지 같아야 한다.
  select coalesce(nullif(s.brand_name, ''), a.name) into v_academy
  from academies a left join academy_settings s on s.academy_id = a.id
  where a.id = v_link.academy_id;

  insert into notification_outbox (
    academy_id, template_code, recipient_name, recipient_phone, lead_id,
    variables, body, dedupe_key, created_by
  ) values (
    v_link.academy_id, 'inquiry_received', trim(p_parent_name), v_phone, v_lead,
    jsonb_build_object('학원명', v_academy, '보호자명', trim(p_parent_name)),
    format(E'[%s] 문의가 접수되었습니다\n\n%s 님, 문의해 주셔서 감사합니다.\n담당 코치가 확인 후 영업일 기준 1일 안에 연락드리겠습니다.\n\n이 메시지는 문의 접수 시 1회 발송됩니다.',
           v_academy, trim(p_parent_name)),
    'lead:' || v_lead || ':received',
    null
  );

  return true;
end;
$$;

-- -----------------------------------------------------------------------------
-- 알림톡 대기열 적재
--
-- p_items: [{ "template_code": "...", "student_id" | "lead_id": "...",
--             "variables": {...}, "body": "...", "dedupe_key": "..." }, …]
--
-- 수신 번호는 여기서 찾는다. 원생이면 대표이거나 그 반 담당 코치여야 하고,
-- 문의면 회원이면 된다. 번호가 비어 있는 행은 failed로 남긴다 — 조용히
-- 빠뜨리면 "왜 우리 집만 안 왔냐"에 답할 수 없다.
--
-- dedupe_key가 이미 있으면 건너뛴다. 출결을 다시 제출해도 같은 수업 리포트가
-- 두 번 쌓이지 않는다.
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

    if coalesce(v_code, '') not in ('attendance_report', 'trial_booked', 'inquiry_received') then
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

-- anon(로그인 안 한 학부모)에게는 공개 폼 두 함수만.
revoke execute on function public.get_public_form(text) from public;
revoke execute on function public.submit_public_form(text, text, text, text, text, jsonb, boolean) from public;
revoke execute on function public.enqueue_alimtalk(uuid, jsonb) from public;

grant execute on function public.get_public_form(text) to anon, authenticated;
grant execute on function public.submit_public_form(text, text, text, text, text, jsonb, boolean) to anon, authenticated;
grant execute on function public.enqueue_alimtalk(uuid, jsonb) to authenticated;

commit;
