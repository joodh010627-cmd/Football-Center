/**
 * 발송 대행사 어댑터.
 *
 * 카카오 알림톡은 카카오에 직접 보내지 않는다. 공식 딜러사(발송 대행사)의 API를
 * 거치고, 대행사마다 요청 모양이 다르다. 그래서 발송 서버는 이 인터페이스만
 * 알고, 대행사를 정하는 날 어댑터 하나를 추가한다.
 *
 * 어댑터가 받는 것은 대행사 공통 필수 항목이다:
 *   발신 프로필 키(senderKey) — 카카오 채널을 대행사에 등록하면 받는다
 *   템플릿 코드(templateCode) — 템플릿 심사를 통과하면 대행사가 부여한다
 *   수신 번호, 본문(심사 원문에 변수만 채운 것)
 *
 * 어느 대행사를 쓸지, 단가는 얼마인지는 아직 정하지 않았다(미검증).
 * 지금 존재하는 어댑터는 dry_run 하나다.
 */

export interface OutgoingMessage {
  id: string;
  /** Our code, e.g. 'attendance_report'. */
  templateCode: string;
  /** The code the provider assigned when Kakao approved the template. */
  providerTemplateCode: string | null;
  recipientPhone: string;
  body: string;
  variables: Record<string, string>;
}

export type SendResult =
  | { ok: true; dryRun: boolean; providerMessageId?: string }
  | { ok: false; error: string; retryable: boolean };

export interface AlimtalkProvider {
  readonly name: string;
  send(message: OutgoingMessage): Promise<SendResult>;
}

/** Records what would have been sent and sends nothing. The default. */
class DryRunProvider implements AlimtalkProvider {
  readonly name = 'dry_run';

  send(message: OutgoingMessage): Promise<SendResult> {
    console.log(
      `[dry_run] ${message.templateCode} → ${message.recipientPhone.slice(0, 3)}****${message.recipientPhone.slice(-4)} (${message.body.length}자)`,
    );
    return Promise.resolve({ ok: true, dryRun: true });
  }
}

/**
 * Pick the provider from the function's secrets.
 *
 *   ALIMTALK_PROVIDER      unset or 'dry_run' → DryRunProvider
 *   ALIMTALK_SENDER_KEY    발신 프로필 키 (실제 대행사 사용 시 필수)
 *   ALIMTALK_TEMPLATE_MAP  {"attendance_report": "<대행사 템플릿 코드>", …}
 *
 * An unknown provider name is a configuration error, not a silent dry run —
 * someone who set it believes messages are going out.
 */
export function createProvider(env: { get(key: string): string | undefined }): AlimtalkProvider {
  const name = (env.get('ALIMTALK_PROVIDER') ?? 'dry_run').trim();

  switch (name) {
    case '':
    case 'dry_run':
      return new DryRunProvider();
    // 대행사를 정하면 여기에 추가한다:
    //   case '<vendor>': return new VendorProvider(env.get('ALIMTALK_API_KEY'), env.get('ALIMTALK_SENDER_KEY'));
    default:
      throw new Error(`알 수 없는 ALIMTALK_PROVIDER: ${name}`);
  }
}

export function templateCodeMap(env: {
  get(key: string): string | undefined;
}): Record<string, string> {
  try {
    return JSON.parse(env.get('ALIMTALK_TEMPLATE_MAP') ?? '{}');
  } catch {
    return {};
  }
}
