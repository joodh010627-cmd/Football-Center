-- -----------------------------------------------------------------------------
-- 0007 — 세션을 주차가 아니라 능력으로 묶는다
--
-- 0005의 커리큘럼은 "트랙 × 나이대 → 주차별 표준 세션"이었다. 축구교실은 원생이
-- 매달 바뀐다. 1주차를 들은 아이가 5주차에도 있다는 가정이 성립하지 않으므로,
-- 주차가 누적되는 커리큘럼은 실제 반을 설명하지 못한다.
--
-- 이제 세션은 목표 하나와 그 목표를 위한 블록들이고, 성장 5각형의 다섯 능력
-- (기술·전술·피지컬·멘탈·태도) 중 하나에 속한다. 코치는 그날 세션을 고르고,
-- 블록은 기본값으로 따라온다.
--
-- 표준 세션 라이브러리는 앱에 들어 있다(`src/data/sessionLibrary.ts`, id가
-- `std-`로 시작). DB에는 센터가 직접 만든 세션만 산다. 그래서 수업 계획이 어느
-- 세션을 골랐는지는 uuid FK인 template_id 에 담을 수 없고, session_key 에 담는다.
--
-- curricula 테이블과 classes.curriculum_id 는 지우지 않는다. 앱은 더 이상 읽지
-- 않지만, 데이터를 버리는 결정은 파일럿 뒤에 한다.
--
-- 이 파일은 몇 번 실행해도 안전하다(0005와 같은 원칙).
-- 이 파일을 적용하기 전에도 앱은 동작한다: 모르는 컬럼은 쓰기에서 빠지고
-- (`upsertCompat`), 능력은 제목·목표 문구에서 추론한다(`mappers.ts`). 적용 전에
-- 안 되는 것은 대표가 센터 세션을 새로 만드는 것 하나다(curriculum_id not null).
-- -----------------------------------------------------------------------------

begin;

-- 다섯 능력. 성장 5각형의 축과 같은 이름이다.
alter table session_templates
  add column if not exists ability    text,
  add column if not exists age_groups text[] not null default '{}';

alter table session_templates drop constraint if exists session_templates_ability_check;
alter table session_templates
  add constraint session_templates_ability_check
    check (ability is null or ability in ('technical', 'tactical', 'physical', 'mental', 'attitude'));

-- 세션은 더 이상 커리큘럼 안에 살지 않는다.
alter table session_templates alter column curriculum_id drop not null;

-- 기존 세션의 연령은 예전 커리큘럼의 연령에서 가져온다. 비워 두면 "모든 연령"으로
-- 읽혀서, 킨더 세션이 U13 반의 세션 고르기에 뜬다.
update session_templates t
   set age_groups = array[c.age_group]
  from curricula c
 where t.curriculum_id = c.id
   and t.age_groups = '{}';

alter table training_blocks
  add column if not exists ability         text,
  add column if not exists coaching_points text[] not null default '{}';

alter table training_blocks drop constraint if exists training_blocks_ability_check;
alter table training_blocks
  add constraint training_blocks_ability_check
    check (ability is null or ability in ('technical', 'tactical', 'physical', 'mental', 'attitude'));

-- 표준 세션 키(`std-…`) 또는 센터 세션 uuid. template_id 는 센터 세션일 때만
-- 채워져 FK 무결성을 계속 지킨다.
alter table session_plans
  add column if not exists session_key text;

update session_plans
   set session_key = template_id::text
 where session_key is null and template_id is not null;

commit;
