-- =============================================================================
-- 0010 — 훈련 주제, 그리고 수업의 해시태그
--
-- 수업 준비는 이제 이렇게 흐른다: 오늘 키울 역량을 해시태그처럼 누르고
-- (여러 개, 혹은 하나도 없이), 훈련 주제 하나를 고르면 그 주제에 매핑된 훈련
-- 블록으로 수업이 짜이고, 코치가 블록을 고쳐 확정한다.
--
-- 훈련 주제는 교과서적인 축구 능력이다. 다섯 능력과는 관계가 없다:
--
--   볼 마스터리 · 퍼스트 터치 · 패스 · 드리블 · 슈팅 · 헤딩
--   볼 소유 · 오프 더 볼 · 빌드업 · 수비 · 공수 전환 · 세트피스
--   스피드 · 민첩성 · 협응·균형 · 근력·파워 · 지구력 · 골키핑
--
-- 목록과 출처는 src/data/topics.ts 에 있다. 값은 앱이 검사한다 — 목록이 바뀔
-- 때마다 제약을 고치지 않기 위해서, 여기서는 형식만 막는다.
--
--   training_blocks.topics   블록이 쓰이는 주제들. 4대4 게임은 볼 소유이자
--                            공수 전환이다. 비어 있어도 된다.
--   session_plans.abilities  그날의 해시태그(technical, mental …). 아무것도
--                            만들지 않는 메모다.
--   session_plans.topic      수업을 짠 훈련 주제.
--
-- 이 파일을 적용하기 전에도 앱은 동작한다: 쓰기에서 모르는 컬럼은 빠지고
-- (`upsertCompat`), 블록의 주제는 제목·설명에서 추론한다(`mappers.ts`). 적용
-- 전에는 해시태그와 주제가 저장되지 않는다. 기존 행은 비워 둔다.
--
-- 몇 번 실행해도 안전하다.
-- =============================================================================

begin;

alter table training_blocks
  add column if not exists topics text[] not null default '{}';

alter table training_blocks drop constraint if exists training_blocks_topics_check;
alter table training_blocks
  add constraint training_blocks_topics_check
    check (array_to_string(topics, ',') ~ '^([a-z]+(-[a-z]+)*(,[a-z]+(-[a-z]+)*)*)?$');

alter table session_plans
  add column if not exists abilities text[] not null default '{}',
  add column if not exists topic     text;

alter table session_plans drop constraint if exists session_plans_abilities_check;
alter table session_plans
  add constraint session_plans_abilities_check
    check (abilities <@ array['technical', 'tactical', 'physical', 'mental', 'attitude']);

alter table session_plans drop constraint if exists session_plans_topic_check;
alter table session_plans
  add constraint session_plans_topic_check
    check (topic is null or topic ~ '^[a-z]+(-[a-z]+)*$');

commit;
