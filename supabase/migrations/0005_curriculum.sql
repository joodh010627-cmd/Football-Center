-- -----------------------------------------------------------------------------
-- 0005 — 커리큘럼 계층 + 자유 구성 세션
--
-- 0001에서 "커리큘럼"은 training_blocks.is_core_curriculum 불리언 하나였다.
-- 그건 커리큘럼이 아니라 태그다. 대표가 사전 인터뷰에서 말하는 커리큘럼은
-- 나이대 × 클래스 목적으로 갈라지는 트랙이고, 그 안에 주차별 표준 수업 세션이
-- 있고, 세션 안에 블록이 순서대로 들어간다. 이 파일이 그 세 층을 만든다.
--
--   철학 → curricula → session_templates → training_blocks
--
-- 동시에 session_plans의 3칸 고정 슬롯(warmup/skill/game 컬럼)을 순서 있는
-- jsonb 배열로 바꾼다. 스킬 두 번, 미니게임 먼저, 웜업 뒤 게임만 — 전부 실제로
-- 하는 수업인데 3컬럼 스키마로는 표현할 수가 없었고, 표현 못 하는 스키마는
-- 코치에게 "안 한 수업을 기록"하게 만든다.
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- 승인 상태
-- -----------------------------------------------------------------------------

-- 코치가 제안한 행과 대표가 등재한 행은 같은 테이블에 산다. 그래서 대표의
-- 승인 대기 큐는 별도 스키마가 아니라 그냥 필터다.
create type approval_status as enum ('published', 'pending', 'rejected');

-- -----------------------------------------------------------------------------
-- curricula
-- -----------------------------------------------------------------------------

create table curricula (
  id          uuid primary key default gen_random_uuid(),
  academy_id  uuid not null references academies(id) on delete cascade,
  title       text not null,
  age_group   text not null,
  -- 클래스 목적. 같은 U9라도 평일 기초반과 주말 클럽은 다른 커리큘럼이다.
  track       text not null check (track in
                ('kinder', 'foundation', 'skill', 'tactical', 'elite', 'physical', 'club')),
  objective   text not null default '',
  focus_areas text[] not null default '{}',
  cycle_weeks integer not null default 8 check (cycle_weeks > 0),
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create index on curricula (academy_id);

-- 클래스가 어느 트랙을 도는지. null 허용 — 방금 만든 클래스는 아직 미배정이고,
-- 그때 설계 화면은 블록 전체를 보여주는 쪽으로 열화된다(빈 화면보다 낫다).
alter table classes
  add column curriculum_id uuid references curricula(id) on delete set null;

create index on classes (curriculum_id);

-- -----------------------------------------------------------------------------
-- session_templates — 표준 수업 세션
-- -----------------------------------------------------------------------------

create table session_templates (
  id            uuid primary key default gen_random_uuid(),
  academy_id    uuid not null references academies(id) on delete cascade,
  curriculum_id uuid not null references curricula(id) on delete cascade,
  title         text not null,
  week          integer not null default 1 check (week > 0),
  goal          text not null default '',
  -- 순서 있는 블록 id 배열. 길이 제한이 없는 것이 요점이다.
  block_ids     uuid[] not null default '{}',
  status        approval_status not null default 'published',
  -- 코치 제안이면 그 코치. 대표가 직접 만든 것은 null.
  proposed_by   uuid references coaches(id) on delete set null,
  review_note   text not null default '',
  -- 코치는 직접 못 올린다. increment_template_usage() RPC만 허용.
  usage_count   integer not null default 0,
  created_at    timestamptz not null default now(),
  -- 제안 행은 대표가 승인할 때 proposed_by가 남아야 누가 만든 커리큘럼인지
  -- 추적된다. 그래서 pending은 반드시 제안자가 있다.
  constraint session_templates_pending_has_author
    check (status <> 'pending' or proposed_by is not null)
);

create index on session_templates (academy_id);
create index on session_templates (curriculum_id, week);
create index on session_templates (status);

-- -----------------------------------------------------------------------------
-- training_blocks — 코치 제안 허용
-- -----------------------------------------------------------------------------

alter table training_blocks
  add column status      approval_status not null default 'published',
  add column proposed_by uuid references coaches(id) on delete set null;

alter table training_blocks
  add constraint training_blocks_pending_has_author
    check (status <> 'pending' or proposed_by is not null);

create index on training_blocks (status);

-- -----------------------------------------------------------------------------
-- session_plans — 3칸 고정 슬롯 → 순서 있는 배열
-- -----------------------------------------------------------------------------

alter table session_plans
  add column items       jsonb not null default '[]'::jsonb,
  add column template_id uuid references session_templates(id) on delete set null;

-- 기존 행 이관. 3컬럼은 웜업-스킬-게임 순서로만 존재했으므로 그 순서로 편다.
-- 빈 슬롯은 빈 배열이 되어 자연히 빠진다.
update session_plans set items =
     case when warmup_block_id is null then '[]'::jsonb else jsonb_build_array(
       jsonb_build_object('category', 'warmup', 'blockId', warmup_block_id, 'durationMin', null)) end
  || case when skill_block_id is null then '[]'::jsonb else jsonb_build_array(
       jsonb_build_object('category', 'skill', 'blockId', skill_block_id, 'durationMin', null)) end
  || case when game_block_id is null then '[]'::jsonb else jsonb_build_array(
       jsonb_build_object('category', 'game', 'blockId', game_block_id, 'durationMin', null)) end;

alter table session_plans
  drop column warmup_block_id,
  drop column skill_block_id,
  drop column game_block_id;

-- 'ready'는 "설계 완료"였고 달력이 없던 시절의 이름이다. 지금은 달력에 등재된
-- 상태를 뜻하므로 'scheduled'로 부른다. 'draft'는 아직 등재 전.
alter table session_plans drop constraint session_plans_status_check;

update session_plans set status = 'scheduled' where status = 'ready';

alter table session_plans
  add constraint session_plans_status_check
    check (status in ('draft', 'scheduled', 'completed'));

alter table session_plans alter column status set default 'draft';

-- 한 클래스의 한 날짜에 수업은 하나다. 달력 칸이 두 개의 설계를 가리키면
-- "등록됨"이 무슨 뜻인지 말할 수 없게 된다. 재설계는 덮어쓴다.
-- 0001의 비고유 (class_id, date) 인덱스를 대체한다.
drop index session_plans_class_id_date_idx;

create unique index session_plans_class_date_key on session_plans (class_id, date);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

alter table curricula         enable row level security;
alter table session_templates enable row level security;

-- 커리큘럼은 코치도 본다. 코치가 자기 수업의 근거를 읽지 못하면 표준화는
-- 통제가 아니라 잔소리가 된다.
create policy curricula_read on curricula
  for select using (is_member(academy_id));

create policy curricula_owner_write on curricula
  for all using (is_owner(academy_id)) with check (is_owner(academy_id));

-- 대표는 전부, 코치는 등재된 것 + 자기가 낸 제안. 남의 반려된 제안은 안 보인다.
create policy session_templates_read on session_templates
  for select using (
    is_owner(academy_id)
    or (
      is_member(academy_id)
      and (status = 'published' or proposed_by = my_coach_id(academy_id))
    )
  );

-- ★ 코치의 쓰기는 "제안"으로만 열린다.
--
-- with check가 status='pending'을 강제하므로, 코치가 insert로 바로 등재된 행을
-- 만들 방법이 없다. 등재는 대표의 update만 할 수 있고(아래 owner 정책),
-- 코치에게는 update 정책 자체를 주지 않는다 — 주면 자기 pending 행을
-- published로 바꿀 수 있게 된다.
create policy session_templates_coach_propose on session_templates
  for insert with check (
    is_member(academy_id)
    and status = 'pending'
    and proposed_by = my_coach_id(academy_id)
    and my_coach_id(academy_id) is not null
  );

-- 대표가 아직 보지 않은 자기 제안은 코치가 철회할 수 있다.
create policy session_templates_coach_withdraw on session_templates
  for delete using (status = 'pending' and proposed_by = my_coach_id(academy_id));

create policy session_templates_owner_write on session_templates
  for all using (is_owner(academy_id)) with check (is_owner(academy_id));

-- training_blocks도 같은 구조. 0002의 읽기 정책은 등재/제안을 구분하지 않으므로
-- 여기서 조인다 — 남의 pending 블록이 라이브러리에 뜨면 승인 절차가 무의미하다.
drop policy training_blocks_read on training_blocks;

create policy training_blocks_read on training_blocks
  for select using (
    is_owner(academy_id)
    or (
      is_member(academy_id)
      and (status = 'published' or proposed_by = my_coach_id(academy_id))
    )
  );

create policy training_blocks_coach_propose on training_blocks
  for insert with check (
    is_member(academy_id)
    and status = 'pending'
    and proposed_by = my_coach_id(academy_id)
    and my_coach_id(academy_id) is not null
    -- 제안 단계에서 표준 커리큘럼 지정은 대표의 권한이다.
    and is_core_curriculum = false
    and usage_count = 0
  );

create policy training_blocks_coach_withdraw on training_blocks
  for delete using (status = 'pending' and proposed_by = my_coach_id(academy_id));

-- -----------------------------------------------------------------------------
-- RPC — 표준 세션 사용 횟수
-- -----------------------------------------------------------------------------

-- increment_block_usage()와 같은 이유로 존재한다. 코치는 session_templates에
-- update 권한이 없고, 그래야 pending을 published로 바꾸지 못한다. 그런데 표준
-- 세션을 실제로 몇 번 돌렸는지는 코치의 설계에서만 알 수 있다. 그 컬럼 하나만
-- 만지는 문을 낸다.
create or replace function public.increment_template_usage(p_template_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update session_templates t
     set usage_count = t.usage_count + 1
   where t.id = p_template_id
     and t.status = 'published'
     -- 호출자가 이 아카데미 소속일 때만. security definer는 RLS를 우회하므로
     -- 테넌트 경계를 함수 안에서 직접 확인해야 한다.
     and public.is_member(t.academy_id);
end;
$$;

revoke execute on function public.increment_template_usage(uuid) from public;
grant  execute on function public.increment_template_usage(uuid) to authenticated;
