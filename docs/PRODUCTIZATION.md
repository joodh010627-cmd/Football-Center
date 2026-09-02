# Football Center — 제품화 계획서

프로토타입을 **돈 받고 파는 서비스**로 바꾸기 위한 실행 계획.
작성 2026-09-01. 전제: 확보된 파일럿 팀 **없음**.

---

## 0. 요약

지금 없는 것은 기능이 아니라 **남의 데이터를 맡을 수 있는 상태**다.
엔진(이탈 산출·조인·세션 빌더 UX)은 이미 자산이고, 없는 것은 그 밑에 깔릴 차대다.

파일럿이 없으므로 **두 트랙을 병렬로** 굴린다.

| 트랙 | 목표 | 성격 |
|---|---|---|
| **A. 영업** | 파일럿 1팀 확보 | 코드 아님. 이게 진짜 병목 |
| **B. 제품** | 고객이 누구든 필요한 것만 선행 | 낭비 없는 부분만 |

트랙 B에서 **지금 짓지 말아야 할 것**을 정하는 게 계획의 절반이다.
고객 없이 결제 연동·알림톡 실발송·학부모 앱을 지으면 대부분 다시 짓는다.

---

## 1. 현재 위치

| 선 | 의미 | 상태 |
|---|---|---|
| 데모 가능 | 화면으로 설득할 수 있다 | ✅ |
| **위탁 가능** | 남의 원생 데이터를 맡아도 된다 | ❌ |
| **판매 가능** | 돈 받고 계약할 수 있다 | ❌ |

### 코드에서 확인된 공백

| 항목 | 근거 | 심각도 |
|---|---|---|
| 테넌트 키 부재 | `src/types.ts` 전체에 `academyId` 없음 | **치명 · 지금만 쌈** |
| 영속화 없음 | 상태가 `useReducer` 메모리에만 | 치명 |
| 인증/권한 없음 | 역할이 UI 토글. 코치가 매출·본인 평가점수를 봄 | 치명 |
| 개인정보 처리 근거 없음 | `parentPhone` 평문, 동의 기록·파기 정책·접근 로그 전무 | **법적 리스크** |
| 결제/수납 없음 | `Class.retentionRate`가 하드코딩 상수인 게 그 증거 | 높음 (가치 직결) |
| 임포트/익스포트 없음 | 계약 성사와 잠금 공포에 직결 | 높음 |
| 테넌트 설정 없음 | 행동 태그 21종이 `mockData.ts:286`에 하드코딩 | 높음 |
| churn 주기 가정 오류 | `churn.ts:52` — 아래 §2 참조 | **높음 · 첫 고객 신뢰** |
| 테스트 0개 | 남의 돈을 계산하는 코드에 검증 없음 | 중간 |

---

## 2. 먼저 고쳐야 할 설계 결함 두 가지

고객이 없어도 지금 고쳐야 한다. 둘 다 **첫 고객 데이터가 들어오는 순간 터지고**,
그때는 이미 신뢰를 잃은 뒤다.

### 2-1. 이탈 엔진이 수업 주기를 가정한다

`src/data/churn.ts:52`

```ts
const recencyRatio = Math.min(1, daysSinceLastAttendance / 14);
```

"14일 미출석 = 위험 포화"는 **주 2~3회 클래스에서만 맞는 기준**이다.

| 클래스 주기 | 14일이 뜻하는 것 | 실제 의미 |
|---|---|---|
| 주 3회 | 6회 결석 | 심각 — 맞음 |
| 주 2회 | 4회 결석 | 위험 — 맞음 |
| **주 1회** | **2회 결석** | **감기 한 번. 정상** |

주 1회 클래스를 운영하는 팀이 들어오면 **정상 원생 상당수가 Red Alert로 뜬다.**
대표가 전화를 두 번 헛돌리면 그 뒤로 알림을 안 본다. 첫 고객을 잃는 가장 빠른 경로다.

**수정 방향**: 기준을 "일수"가 아니라 **"놓친 세션 수"** 로 바꾼다.
`Class.schedule.days`가 이미 있으므로 클래스의 주당 수업 횟수를 알 수 있다.
`daysSinceLastAttendance` → `missedSessionsSinceLastAttendance` (포화 기준 4~5회).
`parentContact`(21일)·`tenure`(180일)는 달력 기준이 맞으므로 그대로 둔다.

### 2-2. 테넌트 키는 지금이 아니면 영영 비싸다

유저 0명인 지금은 `types.ts`에 한 줄 추가하는 일이다.
첫 팀 데이터가 들어간 뒤에는 **마이그레이션 + 전 쿼리 감사 + "A팀 대표가 B팀 원생을 봤나?"**
가 된다. 유소년 개인정보에서 그 사고는 한 번이면 사업이 끝난다.

원칙: **격리는 앱 코드가 아니라 DB가 강제한다.**
앱 레벨 `where academy_id = ?`는 언젠가 빼먹는다. RLS는 빼먹어도 막힌다.

---

## 3. 데이터 모델 설계안

`src/types.ts`의 평평한 FK 설계를 그대로 옮긴다 (README.md:58의 전제가 여기서 값을 한다).
아래는 **설계 초안**이며 실제 적용 전 검토 필요.

### 3-1. 신규 / 변경

```
academies                 ← 테넌트 루트 (신규)
academy_members           ← auth.users × academy × role (신규)
academy_settings          ← 개인화의 유일한 통로 (신규)
students                  + academy_id, 전화번호 암호화
consents                  ← 법정대리인 동의 기록 (신규, 법적 필수)
classes / coaches         + academy_id
training_blocks           + academy_id (NULL = 공용 템플릿)
behavior_tags             + academy_id (현재 하드코딩 → 테이블로)
session_plans             + academy_id
attendance_logs           + academy_id
cs_actions                + academy_id
payments                  ← 신규. retentionRate의 진짜 출처
audit_logs                ← 신규. 누가 어떤 원생 정보를 열람했나
```

### 3-2. 핵심 테이블 스케치

```sql
create table academies (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  plan         text not null default 'pilot',   -- pilot | standard
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz                       -- 해지 후 유예 기간용
);

create type member_role as enum ('owner', 'coach');

create table academy_members (
  user_id      uuid not null references auth.users(id) on delete cascade,
  academy_id   uuid not null references academies(id) on delete cascade,
  role         member_role not null,
  coach_id     uuid,                             -- role='coach'일 때 coaches 연결
  primary key (user_id, academy_id)
);

-- 개인화는 전부 여기로. 팀마다 코드 브랜치를 만들면 세 팀째에 죽는다.
create table academy_settings (
  academy_id        uuid primary key references academies(id) on delete cascade,
  brand_name        text,
  logo_url          text,
  age_groups        text[]  not null default '{U7,U9,U11,U13,U15}',
  churn_thresholds  jsonb   not null,            -- at_risk / critical / 가중치
  notify_templates  jsonb   not null default '{}'
);

-- 법정대리인 동의. 개인정보보호법 제22조의2 대응.
create table consents (
  id            uuid primary key default gen_random_uuid(),
  academy_id    uuid not null references academies(id) on delete cascade,
  student_id    uuid not null,
  guardian_name text not null,
  scope         text[] not null,                 -- 수집·이용 / 제3자제공 / 사진
  granted_at    timestamptz not null,
  revoked_at    timestamptz,
  evidence_url  text                             -- 서명 이미지 / 전자동의 로그
);

-- 재등록률을 상수에서 해방시킨다.
create table payments (
  id           uuid primary key default gen_random_uuid(),
  academy_id   uuid not null references academies(id) on delete cascade,
  student_id   uuid not null,
  period       date not null,                    -- 해당 월 1일
  amount       integer not null,                 -- KRW
  due_date     date not null,
  paid_at      timestamptz,                      -- null = 미납
  method       text,
  unique (student_id, period)
);
```

### 3-3. RLS 패턴

모든 테넌트 테이블에 동일하게 적용:

```sql
alter table students enable row level security;

create policy tenant_isolation on students
  using (academy_id in (
    select academy_id from academy_members where user_id = auth.uid()
  ));
```

**대표 전용 데이터**(매출·마진·코치 만족도·`payments`)는 정책을 한 단계 더 좁힌다:

```sql
create policy owner_only on payments
  using (academy_id in (
    select academy_id from academy_members
    where user_id = auth.uid() and role = 'owner'
  ));
```

> `Coach.satisfactionScore`는 **대표가 코치를 평가한 점수**다.
> 이게 코치에게 새면 그 팀에서 앱이 즉시 퇴출된다. 컬럼 단위로 막아야 한다.

---

## 4. 트랙 A — 영업 (선행)

파일럿이 없는 지금, 이게 최우선이다. 코드보다 먼저다.

### A-1. 타겟 정의

| 조건 | 이유 |
|---|---|
| 원생 60~150명 | 너무 작으면 엑셀로 충분, 너무 크면 이미 다른 시스템 사용 |
| 클래스 5개 이상 | 대시보드가 의미를 갖는 최소 규모 |
| 코치 3명 이상 | "코치가 기록 → 대표가 본다" 루프가 성립 |
| 대표가 직접 운영 참여 | 결재자와 사용자가 같아야 계약이 빠르다 |

### A-2. 데모 시나리오 (7분)

현재 앱으로 이미 가능하다. **순서가 중요하다.**

1. **대표 화면을 먼저 연다.** 이탈 위험 원생 수와 지켜야 할 매출 — 두 숫자.
2. Red Alert 한 줄을 짚는다. **근거 문장**을 읽어준다 ("21일째 미출석").
   → "이 전화 한 통이 월 28만원입니다."
3. `[CS 조치 완료]` → 큐에서 빠지는 것을 보여준다.
4. **코치 화면으로 전환.** 전원 출석 기본값 → 예외 2명만 탭 → 태그 3개 → 제출.
   "코치는 글자를 한 자도 안 칩니다."
5. **다시 대표 화면.** 방금 탭한 것이 지표로 올라온 것을 보여준다.
6. 알림톡 미리보기 모달로 마무리.

핵심 메시지 한 줄: **"코치가 탭한 것이 그대로 대표의 판단 근거이자 학부모 리포트가 됩니다."**

### A-3. 계약을 여는 문장 세 개

- **"지금 명단 어떻게 관리하세요?"** → 십중팔구 엑셀 + 카톡방. 여기서 임포터가 무기가 된다.
- **"14세 미만 원생 개인정보 동의서, 감사 나오면 출력되세요?"**
  대부분의 축구교실은 이미 법적으로 위태롭다. `consents` 테이블이 파는 물건이 된다.
  이탈 예측보다 잘 팔리는 말이다.
- **"수강료 미납 대조에 매달 몇 시간 쓰세요?"** → §5-2 참조.

### A-4. 가격 초안 — **전부 검증 필요한 가설**

| 항목 | 초안 | 근거 |
|---|---|---|
| 구축·마이그레이션 (1회) | 50~150만원 | 데이터 이관 + 온보딩 교육 |
| 월 이용료 | 원생 100명 기준 10만원선 | 국내 소규모 B2B SaaS 통상 |
| **파일럿 1호** | **정가의 50%, 6개월 고정** | 무료는 금지 (§4-5) |
| 알림톡 발송비 | 실비 별도 | 단가는 벤더 확인 필요 |

> 대표 입장의 계산: 원생 1명 이탈 방지 = 월 20~30만원.
> **월 이용료가 원생 한 명 수강료보다 싸야** 설명이 한 문장에 끝난다.

### A-5. 파일럿은 무료로 주지 않는다

돈을 안 내면 진짜 피드백이 안 나온다. 무료 사용자는 불편해도 말하지 않고 그냥 안 쓴다.
반값이라도 결제가 일어나면 그때부터 요구사항이 들어온다.
**그 요구사항이 로드맵이다.** 지금 없는 게 바로 그것이다.

### A-6. 병렬로 지금 접수할 것

**카카오 알림톡 발신프로필 등록 + 템플릿 사전 심사.**
승인에 리드타임이 있어, 나중에 하면 출시가 그만큼 밀린다.
고객이 없어도 지금 접수해 둔다. (벤더·단가·소요일은 확인 필요)

---

## 5. 트랙 B — 제품

> **📌 2026-09-02 개정 — 순서가 바뀌었다.**
> 초판은 백엔드(B-2)를 먼저 두었으나, 목표가 **"위탁 가능"에서 "영업 가능"으로**
> 앞당겨지면서 철회한다. 영업용 프로토타입은 **백엔드가 필요 없다** —
> 브라우저에서 파싱하고 `AppContext`에 넣고 엑셀로 되뱉으면 미팅 한 번이 돌아간다.
> Supabase는 없어지는 게 아니라 **첫 계약 뒤로 2주 미뤄진다.**
> 상세: [`IMPORT-SPEC.md`](IMPORT-SPEC.md)

### 지금 짓는 것 / 짓지 않는 것

| 짓는다 (영업에 즉시 필요) | 미룬다 (첫 계약 후) | 미룬다 (고객이 정해야 함) |
|---|---|---|
| **엑셀 임포터** | 테넌트 스키마 + RLS | 결제 PG 연동 |
| 정규 스키마 + 양식 | 인증 + 역할 분리 | 알림톡 실발송 로직 |
| Day-1 대시보드 | 영속화 (리듀서 → Supabase) | 학부모 화면 |
| 익스포트 + localStorage | 서버 이관 | 정산·세금계산서 |
| churn 주기 수정 + 테스트 | | Archive+ 연결 · 모바일 앱 |

### B-1. churn 주기 수정 + 테스트 (0.5주)

가장 작고 가장 급하다. `churn.ts`·`selectors.ts` 둘 다 순수 함수라 테스트를 붙이기 쉽다.
**남의 돈을 계산하는 코드**에 검증이 없는 상태로 고객을 받지 않는다.

### B-2. ~~스키마 + 인증 + 영속화~~ → **첫 계약 후로 연기** (2주)

- `types.ts`에 `academyId` 주입
- Supabase 프로젝트 + 위 DDL + RLS 정책
- 인증(대표/코치) — UI 토글 제거, 세션에서 역할 결정
- `AppContext.tsx`의 리듀서 case 본문을 Supabase 호출로 교체.
  **현재 로직은 낙관적 업데이트로 남긴다. 컴포넌트는 손대지 않는다.**
  (`AppContext.tsx:1-8`의 주석이 이 교체를 이미 전제하고 있다)
- 하드코딩 태그 21종 → `behavior_tags` 테이블

### B-3. 엑셀 임포터 (1주) — **영업 무기**

기능이 아니라 **계약 성사 장치**다.
"명단 파일 주시면 10분 만에 올려드립니다"가 미팅을 파일럿으로 바꾼다.

- 파일 드롭 → 컬럼 자동 추론 → 매핑 UI → 미리보기 → 검증(중복·필수값·전화번호 형식) → 커밋
- 첫 팀은 손으로 해주더라도 **두 번째 팀부터 손으로 하면 사업이 안 굴러간다**
- 짝으로 **익스포트 버튼**을 반드시 같이 낸다.
  잠금 공포가 계약의 가장 큰 장벽이고, "언제든 전부 빼갈 수 있습니다"가 그걸 없앤다

### B-4. 여기서 멈추고 고객을 기다린다

B-3까지가 **"위탁 가능"** 선이다. 이 상태에서 파일럿을 받고,
그 팀의 실제 요구를 보고 다음을 정한다. 유력한 다음 순서:

1. **수납 관리** — 미납 현황 + 알림. PG 연동 없이 납부 기록만으로 충분히 가치가 있다.
   지금 대시보드에서 `retentionRate`가 상수인 이유가 결제 테이블이 없어서다.
   `payments`가 생기면 **대시보드 핵심 숫자 하나가 진짜가 되고, 동시에 대표의 1순위 고통이 풀린다.**
2. 개인정보 동의 수집 화면 + 처리방침
3. 알림톡 실발송
4. 학부모 화면 → **여기가 열리면 Archive+가 자연스럽게 붙는다** (§7)

---

## 6. 운영 준비물

계약 전에 있어야 하는 것들. 코드보다 문서가 많다.

- [ ] 개인정보 처리방침 / 위탁 계약서(수탁자 지위) / 표준 이용약관
- [ ] 법정대리인 동의서 양식 (전자 동의 흐름 포함)
- [ ] 파기 정책 — 해지 후 보관 기간, 파기 증빙
- [ ] `parentPhone` 암호화 저장 + `audit_logs` (누가 언제 어떤 원생을 열람했나)
- [ ] 백업 정책 (일 1회 + 복구 리허설 1회 실제 수행)
- [ ] 에러 모니터링 (Sentry), 스테이징 환경
- [ ] 온보딩 런북 — 계약부터 첫 출결 기록까지 체크리스트
- [ ] 지원 채널·응답 기준 (카톡 채널이면 충분. 단, 기준은 문서로)

---

## 7. Archive+ · 광고와의 관계

우선순위는 **이 계획 다음**이 맞다. 다만 **순서를 뒤집을 필요는 없다.**

§5-B4의 4번 **학부모 화면이 생기는 순간** Archive+가 제자리를 찾는다.
학부모가 자녀 성장 리포트를 보러 정기적으로 들어오는 화면이 있어야,
거기서 나가는 Archive+ 링크와 광고 노출이 실제 가치를 갖는다.
지금처럼 아무도 안 보는 데모에 붙어 있는 것보다 훨씬 낫다.

즉 **광고 계약은 이 로드맵과 충돌하지 않는다. 오히려 이 로드맵이 광고 가치를 만든다.**
관련: `FC-Growth` / `Archive-Plus` 레포의 계약 조건은 그대로 유지한다.

---

## 8. 일정 (2026-09-02 개정)

```
✅ 완료   정규 스키마 + 엑셀 양식                                    (0.5일)
          docs/IMPORT-SPEC.md · docs/templates/FC_원생명단_양식_v1.xlsx
          → 코드 없이 지금 바로 현장 검증 가능:
            "대표님 명단 파일이랑 이거, 얼마나 다른가요?"

지금      트랙 A 착수 — 타겟 리스트, 데모 연습, 알림톡 템플릿 심사 접수
          양식 파일을 아는 대표들에게 먼저 돌린다 (조사 겸 영업)

~1주      B-2' 임포터: 시노님 자동추론 + 매핑 UI + 검증               (3~4일)
          B-1  churn 주기 수정 + churn/selectors 테스트              (0.5일, 병렬)

~2주      B-3' Day-1 대시보드 — 명단만으로 계산되는 화면              (2~3일)
          매출 · 미납 · 정원 충족률 · 등록 개월차
          출결 기반 지표는 "기록 3주 후 활성화"로 비활성 표시

~2.5주    B-4' 2단 데모 구성 + localStorage + [전체 삭제]            (1일)
          ① 대표 실데이터 임포트 → 신뢰
          ② 시드 데모 팀 전환   → 욕망 ("3주 쓰시면 이 화면입니다")
          → 이 시점부터 "명단 주시면 10분 안에 올려드립니다"가 가능하다

3주~      파일럿 1팀 확보까지 영업에 집중.
          코드를 더 짓지 말고, 안 팔리는 이유를 미팅에서 듣는다

계약 후   B-2  스키마 + academyId + RLS + 인증 + 영속화              (2주)
+2~4주    수납 관리 · 동의 수집 · 알림톡 실발송
          → 여기서 처음으로 "정가로 파는 물건"이 된다
```

---

## 9. 리스크

| 리스크 | 대응 |
|---|---|
| **파일럿 확보 실패** | 가장 큰 리스크. B-3 이후 코드를 더 짓지 말고 영업에만 집중. 안 팔리는 이유를 미팅에서 듣는다 |
| 개인정보 사고 | RLS를 DB에서 강제. 앱 레벨 필터에 의존 금지. 전화번호 암호화. 열람 로그 |
| 요구사항이 팀마다 갈림 | 개인화는 전부 `academy_settings`로. **포크 금지** |
| 대표가 대시보드를 안 봄 | 기록 충실도가 떨어지면 모든 숫자가 무너진다. 파일럿 중 주 1회 사용 리포트를 직접 확인 |
| 1인 유지보수 한계 | 지원 기준을 계약서에 명시. 무제한 커스터마이징 약속 금지 |

---

## 부록 — 판단 근거가 된 코드 위치

| 내용 | 위치 |
|---|---|
| 테넌트 키 부재 | `src/types.ts` 전체 |
| 리듀서 교체 지점 | `src/store/AppContext.tsx:1-8`, `:127` |
| churn 주기 가정 | `src/data/churn.ts:52` |
| retentionRate 상수 | `src/types.ts:83`, `README.md:144` |
| 하드코딩 태그 21종 | `src/data/mockData.ts:286` |
| 알림톡 시뮬레이션 | `src/lib/notification.ts` |
| 알려진 한계 (자체 기록) | `README.md:141-146` |
