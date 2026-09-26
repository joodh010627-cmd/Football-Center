# 알림톡 — 지금 어디까지 왔고, 실제 발송까지 무엇이 남았나

> 2026-09-26 기준. 카카오 채널·발송 대행사 계약 없이 할 수 있는 데까지 만들어 둔 상태다.
> 대행사 선택과 단가는 **아직 정하지 않았다(미검증)**. 이 문서의 어떤 부분도 특정 대행사의
> 조건을 사실로 적은 것이 아니다.

## 흐름

```
출결 제출 / 체험 예약 / 학부모 폼 접수
        │  (앱: 심사 원문 템플릿에 변수를 채움 — src/lib/alimtalk/templates.ts)
        ▼
enqueue_alimtalk()  ─ 수신 번호는 원생·문의 행에서 DB가 직접 찾는다 (0006)
        │
        ▼
notification_outbox  status = queued
        │  (앱이 곧바로 Edge Function 호출. 없으면 queued 로 남아 기다린다)
        ▼
send-alimtalk  (supabase/functions/send-alimtalk)
        │  queued → sending 선점 → 대행사 어댑터 → sent / failed / dry_run
        ▼
카카오 알림톡
```

앱에서 보는 곳: **클럽 → 알림톡** (발송 기록, 템플릿 원문 복사).

## 완료된 것

| 단계 | 상태 | 위치 |
|---|---|---|
| 템플릿 원문 3종 (수업 리포트 · 체험 예약 안내 · 문의 접수 확인) | ✅ | `src/lib/alimtalk/templates.ts` |
| 발송 대기열 테이블 + 적재 함수 + 중복 방지 | ✅ | `supabase/migrations/0006_leads_forms_alimtalk.sql` |
| 앱에서 적재 (출결 제출·체험 예약), DB에서 적재 (폼 접수) | ✅ | `NotificationPreviewModal`, `WorkspaceContext`, `submit_public_form()` |
| 발송 서버 + 대행사 어댑터 인터페이스 + 드라이런 | ✅ 코드 | `supabase/functions/send-alimtalk/` |
| 발송 기록 화면 | ✅ | `src/components/club/AlimtalkScreen.tsx` |

## 남은 것 — 순서대로

### 1. 마이그레이션 0006 적용 (지금 가능, 2분)
`docs/SETUP.md` §2 참조. 이것만 해도 메시지가 **대기열에 쌓이기 시작한다.**

### 2. 발송 서버 배포 (지금 가능, 드라이런)
Supabase CLI가 필요하다.

```bash
npx supabase login
npx supabase link --project-ref wmeakzkaykfeulauzbjt
npx supabase functions deploy send-alimtalk
```

`ALIMTALK_PROVIDER`를 설정하지 않으면 **드라이런**이다: 대기열의 메시지를 `dry_run`
상태로 바꾸고 아무것도 보내지 않는다. 배포 직후 클럽 → 알림톡 → "대기 중인 N건 발송 시도"로
전체 경로가 동작하는지 확인할 수 있다.

### 3. 카카오 비즈니스 채널 개설 (계정 필요)
카카오톡 채널을 만들고 비즈니스 인증을 받는다. 알림톡은 비즈니스 채널에서만 보낼 수 있다.

### 4. 발송 대행사 선택 · 발신 프로필 등록 (계약 필요)
알림톡은 카카오 공식 딜러사를 통해 보낸다. 대행사에 채널을 등록하면 **발신 프로필 키**를 받는다.
대행사를 정하면 `supabase/functions/send-alimtalk/providers.ts`에 어댑터 하나를 추가한다
(인터페이스는 `send(message) → { ok, providerMessageId } | { ok: false, error, retryable }`).

### 5. 템플릿 심사 제출
클럽 → 알림톡 → 템플릿 → **심사 제출용 원문 복사**로 복사해 대행사 콘솔에 그대로 붙여넣는다.
통과하면 템플릿마다 대행사 템플릿 코드가 부여된다.

> 원문을 고치면 **재심사**가 필요하다. `inquiry_received`는 DB 함수에도 같은 문구가 있으므로
> 두 곳을 함께 고쳐야 한다 — `templates.test.ts`가 둘이 다르면 실패한다.

### 6. 비밀 값 설정 → 실제 발송 시작

```bash
npx supabase secrets set ALIMTALK_PROVIDER=<어댑터 이름>
npx supabase secrets set ALIMTALK_API_KEY=<대행사 API 키>
npx supabase secrets set ALIMTALK_SENDER_KEY=<발신 프로필 키>
npx supabase secrets set ALIMTALK_TEMPLATE_MAP='{"attendance_report":"…","trial_booked":"…","inquiry_received":"…"}'
```

키는 Edge Function 비밀에만 둔다. 앱 번들(`VITE_…`)이나 DB에 넣지 않는다.

## 설계상 지켜야 할 것

- **수신 번호는 클라이언트가 정하지 않는다.** `enqueue_alimtalk()`가 원생/문의 행에서 찾는다.
  번호를 인자로 받게 바꾸면 로그인한 누구든 아무 번호로 메시지를 쌓을 수 있다.
- **대기열 쓰기 권한은 클라이언트에 없다.** 상태 변경은 발송 서버(service_role)만 한다.
- **같은 수업 리포트는 한 번만.** `dedupe_key = attendance:<반>:<날짜>:<원생>`.
  출결을 다시 제출해도 새로 쌓이지 않는다. 내용을 고쳐 다시 보내는 기능은 아직 없다.
- **보호자 연락처가 없는 원생**은 `failed / 보호자 연락처 없음`으로 남는다. 조용히 빠뜨리지 않는다.
- 알림톡은 정보성 메시지만 보낼 수 있다. 템플릿에 광고성 문구를 넣지 않는다.
