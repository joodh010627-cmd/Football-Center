-- =============================================================================
-- 0004 — 수납
--
-- 왜 별도 마이그레이션인가:
--
-- 1. Day-1에 대표에게 보여줄 수 있는 유일한 지표가 수납이다. 임포트 직후에는
--    출결 이력이 없어 이탈 경보가 산출되지 않는다(types.ts의 lastAttendanceDate
--    주석 · docs/IMPORT-SPEC.md §5). 매출·미납·정원만이 명단만으로 계산된다.
--
-- 2. 임포터가 이미 월별 납부 그리드를 파싱한다. 국내 소상공인 엑셀은 납부를
--    '2026-06 / 2026-07' 처럼 가로 컬럼으로 관리하는 경우가 많아, 그 습관을
--    고치라고 하는 대신 그대로 읽어 세로로 편다
--    (src/lib/import/extract.ts 의 PaymentEntry).
--
-- 3. class_finances.retention_rate 가 지금은 손으로 넣는 상수다. 재등록률은
--    본래 결제 이력에서 나와야 하는 값이고, 이 테이블이 그 출처가 된다.
--
-- 수납은 대표 전용이다. 0001의 원칙대로 코치가 읽을 수 있는 행에 금액을 두지
-- 않는다 — student_billing / class_finances / coach_evaluations 와 같은 취급.
-- =============================================================================

create table payments (
  id          uuid primary key default gen_random_uuid(),
  academy_id  uuid not null references academies(id) on delete cascade,
  student_id  uuid not null references students(id) on delete cascade,

  -- 해당 월의 1일. 월 단위 수납이므로 날짜가 아니라 '기간'을 가리킨다.
  -- date 로 두는 이유는 범위 조회(between)와 정렬이 자연스럽기 때문.
  period      date not null,
  amount      integer not null default 0,
  due_date    date,

  -- null = 미납. 별도 status 컬럼을 두지 않는 이유는 상태가 파생값이기 때문이다
  -- (납부일이 있으면 완납, 없고 due_date 가 지났으면 연체).
  paid_at     timestamptz,
  method      text,
  memo        text,

  created_at  timestamptz not null default now(),

  -- 같은 원생의 같은 달은 한 행뿐이다. 임포트를 두 번 돌려도 중복되지 않도록
  -- 애플리케이션이 아니라 DB가 보장한다 (upsert 대상 키이기도 하다).
  unique (student_id, period)
);

comment on column payments.period is '해당 월의 1일 (YYYY-MM-01)';
comment on column payments.paid_at is 'null 이면 미납. 상태는 저장하지 않고 파생한다.';

-- 미납 조회는 "이 아카데미의 이번 달 중 paid_at 이 null 인 것"이 기본 형태다.
create index payments_academy_period_idx on payments (academy_id, period desc);
create index payments_student_idx on payments (student_id);
-- 미납만 훑는 부분 인덱스. 완납 행이 대부분이라 전체 인덱스보다 훨씬 작다.
create index payments_unpaid_idx on payments (academy_id, period) where paid_at is null;

-- -----------------------------------------------------------------------------
-- RLS — 대표 전용
-- -----------------------------------------------------------------------------

alter table payments enable row level security;

-- ★ 수납 금액. 코치가 select * 를 날려도 0행이 돌아온다.
create policy payments_owner_only on payments
  for all using (is_owner(academy_id)) with check (is_owner(academy_id));

-- -----------------------------------------------------------------------------
-- 파생 조회
-- -----------------------------------------------------------------------------

-- 미납 현황. 대표 대시보드의 Day-1 화면이 이 하나를 읽는다.
-- security_invoker 로 두어야 호출자의 RLS가 그대로 적용된다. 기본값(definer)
-- 이면 뷰가 정책을 우회해 코치에게도 금액이 보인다.
create or replace view payments_outstanding
with (security_invoker = true) as
select
  p.academy_id,
  p.student_id,
  s.name        as student_name,
  s.class_id,
  p.period,
  p.amount,
  p.due_date,
  (current_date - p.due_date)::int as days_overdue
from payments p
join students s on s.id = p.student_id
where p.paid_at is null
order by p.period desc, p.due_date;

comment on view payments_outstanding is
  '미납 건만. security_invoker 이므로 대표에게만 행이 보인다.';
