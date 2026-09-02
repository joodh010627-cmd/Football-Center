# 셋업 — Supabase 연결부터 로그인까지

앱은 이제 Supabase 없이 실행되지 않습니다. 원생 개인정보를 다루는 이상
데이터가 브라우저 번들이 아니라 데이터베이스에 있어야 하고, 권한도 거기서
강제되어야 하기 때문입니다.

소요 시간 약 15분.

---

# 🟢 지금 하실 일 — 3가지

프로젝트는 이미 만들어져 있고(`wmeakzkaykfeulauzbjt`), `.env`도 채워 뒀습니다.
아래 3가지만 하시면 앱이 살아납니다. **위에서부터 순서대로** 하세요.
자세한 설명이 필요하면 각 항목의 상세 절로 가시면 됩니다.

### ① 표 만들기 (2분) — 이걸 안 하면 나머지가 무의미합니다

지금 데이터베이스가 **완전히 비어 있습니다.**

1. 대시보드 왼쪽 메뉴 → **SQL Editor** → **New query**
2. `supabase/APPLY_ALL.generated.sql` 파일을 열어 **전체 복사**
3. 붙여넣고 **Run** (`Ctrl`+`Enter`)

**됐는지 확인:** 왼쪽 **Table Editor** 에 `academies` · `students` · `payments` 등
표 이름이 18개쯤 보이면 성공. 빨간 에러가 나오면 그 문구를 그대로 알려주세요.

### ② 이메일 확인 끄기 (30초)

안 끄면 가입해도 바로 못 들어가고 **메일함을 열어 링크를 눌러야** 합니다.
영업 자리에서 대표님이 메일함을 뒤지는 장면이 나옵니다.

**Authentication → Sign In / Providers → Email → `Confirm email` 끄기 → Save**

### ③ 데모 데이터 넣기 (3분)

원생 104명·8주 출결이 들어가야 시연 화면이 채워져 보입니다.

1. **Project Settings → API Keys** 에서 **`service_role`** 키 복사
2. 프로젝트 폴더의 `.env` 파일 맨 아랫줄에 붙여넣기:
   `SUPABASE_SERVICE_ROLE_KEY=여기에`
3. 터미널: `npm run seed`

> ⚠️ **`service_role` 키는 저에게 주지 마세요. 채팅에 붙여넣지도 마세요.**
> 모든 보안 장치를 무시하고 전 아카데미 데이터를 여는 키입니다.
> `.env` 파일에만 넣으면 되고, 그 파일은 GitHub에 안 올라가게 막아뒀습니다.

### 끝나면

`npm run dev` → <http://localhost:5173/Football-Center/> →
`owner@fcgrowth.demo` / `growth1234` 로 로그인.

| 증상 | 원인 |
|---|---|
| 가입은 되는데 화면이 빔 | ① 안 함 |
| "이메일 인증을 먼저…" | ② 안 함 |
| `npm run seed` 가 키 없다고 함 | ③ 안 함 |
| **코치에게 매출이 보임** | **심각 — 즉시 알려주세요** |

---

## 1. 프로젝트 생성

1. [supabase.com](https://supabase.com) → New project
2. 리전은 **Northeast Asia (Seoul)** 를 고릅니다. 원생·학부모가 국내에 있고,
   개인정보 국외 이전은 별도 고지 의무가 생깁니다.
3. 데이터베이스 비밀번호는 따로 보관하세요.

## 2. 마이그레이션 적용

Supabase 대시보드 → **SQL Editor** 에서 아래 순서대로 붙여넣고 실행합니다.
순서가 중요합니다 — 정책이 헬퍼 함수를 참조하고, 함수가 테이블을 참조합니다.

| 순서 | 파일 | 내용 |
|---|---|---|
| 1 | `supabase/migrations/0001_schema.sql` | 테이블 |
| 2 | `supabase/migrations/0002_rls.sql` | 헬퍼 함수 + RLS 정책 |
| 3 | `supabase/migrations/0003_functions.sql` | 가입·초대·제한된 쓰기 RPC |
| 4 | `supabase/migrations/0004_payments.sql` | 수납(대표 전용) + 미납 뷰 |

**네 개를 하나로 합친 `supabase/APPLY_ALL.generated.sql` 을 붙여넣는 쪽이 편합니다.**
그 파일은 마이그레이션에서 생성되는 파생물이라 커밋되지 않습니다. 다시 만들려면:

```bash
py scripts/build_apply_all.py
```

> ⚠️ **PowerShell로 합치지 마세요.** `Get-Content -Raw` 는 BOM 없는 UTF-8 파일을
> 시스템 기본 인코딩(한국어 Windows = CP949)으로 읽어 한글 주석을 깨뜨립니다.
> 깨진 파일은 대시보드에서 이렇게 터집니다:
>
> ```
> ERROR: 42601: syntax error at or near "?"
> LINE 571: raise exception '?꾩뭅?곕? ?대쫫???낅젰??二쇱꽭??;
> ```
>
> 위 파이썬 스크립트는 인코딩을 명시하고, 합친 뒤 한글이 남아 있는지 스스로 검사합니다.

> Supabase CLI를 쓴다면 `supabase link` 후 `supabase db push` 로도 됩니다.

### 확인

SQL Editor에서:

```sql
select tablename, rowsecurity from pg_tables
where schemaname = 'public' order by tablename;
```

**`rowsecurity` 가 전부 `true`** 여야 합니다. 하나라도 false면 그 테이블은
누구나 읽습니다. 여기서 멈추고 원인을 찾으세요.

## 3. 이메일 인증 끄기 (파일럿 동안만)

Authentication → Providers → Email → **Confirm email 을 off**.

켜두면 가입 직후 세션이 없어서 아카데미 생성 RPC가 실행되지 않습니다.
앱은 이 경우 "인증 후 로그인해 주세요"를 띄우고, 나중에 로그인하면
초대 코드 화면으로 이어지도록 되어 있습니다 — 막히지는 않지만 시연 중에는
거추장스럽습니다. 실제 고객을 받을 때는 다시 켜세요.

## 4. 환경변수

**`.env` 는 이미 만들어져 있습니다.** URL과 publishable 키는 채워져 있고,
`SUPABASE_SERVICE_ROLE_KEY` 한 줄만 비어 있습니다 (위 ③단계).

새로 만들어야 한다면 `cp .env.example .env` 후 Project Settings → API 에서:

- `Project URL` → `VITE_SUPABASE_URL` 과 `SUPABASE_URL`
- `anon public` (신규 프로젝트는 `publishable`) → `VITE_SUPABASE_ANON_KEY`
- `service_role` (`secret`) → `SUPABASE_SERVICE_ROLE_KEY`

> publishable 키는 공개돼도 됩니다 — 브라우저 번들에 그대로 들어갑니다.
> 데이터를 막는 것은 키가 아니라 RLS 정책이기 때문입니다.

> `service_role` 키는 RLS를 통째로 우회합니다. `VITE_` 를 붙이지 마세요 —
> 붙이는 순간 브라우저 번들에 들어가고, 그 키를 가진 사람은 전 아카데미의
> 원생 정보를 읽습니다. `.gitignore` 에 `.env` 가 들어 있는지도 확인하세요.

## 5. 데모 데이터 적재

```bash
npm run seed
```

원생 104명, 클래스 12개, 출결 1,672건과 함께 계정 3개가 생깁니다.
아카데미 이름이 같으면 지우고 다시 만들므로 몇 번이든 재실행할 수 있습니다.

| 계정 | 역할 | 보이는 것 |
|---|---|---|
| `owner@fcgrowth.demo` | 대표 | 전체. 매출·원가·코치 평가점수까지 |
| `coach1@fcgrowth.demo` | 김도현 | 담당 반의 원생과 출결만 |
| `coach2@fcgrowth.demo` | 박서준 | 김도현의 반은 보이지 않음 |

비밀번호는 모두 `growth1234` 입니다. **데모 전용입니다.**

## 6. 실행

```bash
npm run dev
```

---

## 격리가 실제로 되는지 확인하는 법

화면만 보면 "숨긴 것"과 "안 보내는 것"을 구분할 수 없습니다.
아래 두 가지는 네트워크 응답으로 확인하는 절차입니다.

**대표 전용 데이터**

1. `coach1@fcgrowth.demo` 로 로그인
2. 개발자도구 → Console 에서:

   ```js
   const { data, error } = await window.__sb.from('coach_evaluations').select('*');
   console.log(data, error);
   ```

   `data` 가 `[]` 여야 합니다. 에러가 아니라 **빈 배열**인 것이 정상입니다 —
   RLS는 "권한 없음"을 던지지 않고 해당 행이 존재하지 않는 것처럼 처리합니다.
   `class_finances`, `student_billing`, `cs_actions` 도 마찬가지입니다.

   (`window.__sb` 는 기본으로 노출되지 않습니다. 확인이 필요하면
   `src/lib/supabase.ts` 에 임시로 `window.__sb = supabase` 를 넣고 테스트 후
   지우세요.)

**코치 간 격리**

3. `coach1` 로 로그인한 상태에서 원생 수를 세어 둡니다.
4. `coach2` 로 바꿔 로그인합니다. 명단이 완전히 다른지 확인합니다.
5. Network 탭의 `students` 응답에 상대 코치의 원생이 한 명도 없어야 합니다.

이 세 가지가 통과하면 "위탁 가능" 선의 인증·권한 항목은 충족된 것입니다.

---

## 코치 초대

대표 계정에서 코치를 추가할 때는 초대 코드를 발급합니다. 현재는 SQL Editor로
발급합니다 (대표 화면의 초대 UI는 아직 없습니다 — 아래 §남은 일 참조).

```sql
select create_coach_invite(
  '<academy_id>',   -- select id from academies;
  '최유나',          -- 코치 이름
  '주말 U11반'       -- 메모
);
```

반환된 8자리 코드를 코치에게 전달하면, 코치가 가입 화면의 **코치 가입** 탭에서
입력해 합류합니다. 코드는 1회용이고 14일 후 만료됩니다.

---

## 배포 (GitHub Pages)

`npm run deploy` 는 빌드 시점의 `.env` 값을 번들에 박아 넣습니다.
따라서 로컬에 `.env` 가 있는 상태에서 배포해야 시연 사이트가 동작합니다.
`.env` 없이 배포하면 "Supabase 설정이 필요합니다" 화면이 나옵니다.

배포본에 들어가는 것은 `anon` 키뿐이며, 이 키는 공개되어도 됩니다.
데이터를 막는 것은 키가 아니라 RLS 정책입니다.

---

## 남은 일

이번 작업으로 인증·역할 분리·영속화가 들어왔지만, `docs/PRODUCTIZATION.md` 의
"위탁 가능" 선까지 아직 남은 것이 있습니다.

- [ ] **대표 화면의 코치 초대 UI** — 지금은 SQL로 발급해야 합니다
- [ ] **`parentPhone` 암호화** — 현재 평문입니다 (`0001_schema.sql` 주석 참조)
- [ ] **`audit_logs` 기록 연결** — 테이블과 정책은 있지만 앱이 아직 쓰지 않습니다
- [x] **엑셀 임포터 엔진** — `src/lib/import/`. 픽스처 6종 무설정 통과.
      헤더가 없는 파일도 내용 추론만으로 읽습니다 (`docs/IMPORT-SPEC.md`)
- [ ] **임포터 UI** — 드롭/붙여넣기 화면. 엔진은 준비됐고 화면만 남았습니다
- [x] **콜드 스타트** — `lastAttendanceDate` nullable + `churn.computable`.
      임포트 직후 전원이 "휴원"이 되거나 가짜 "위험 0명"이 뜨던 문제
- [ ] **churn 주기 수정** — PRODUCTIZATION §2-1. 주 1회 클래스가 들어오면
      정상 원생이 Red Alert로 뜹니다. `Class.schedule.days` 는 이미 있으므로
      기준을 "일수"에서 "놓친 세션 수"로 바꾸면 됩니다. 첫 고객 신뢰가 걸린 문제
- [ ] **`payments` 적재** — 테이블·타입·매퍼는 완료(0004). 임포터가 파싱한
      월별 납부 데이터를 넣는 경로만 남았습니다
