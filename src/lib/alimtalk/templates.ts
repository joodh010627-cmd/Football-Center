/**
 * 알림톡 템플릿 — 카카오 심사에 그대로 제출할 원문.
 *
 * 알림톡은 문자와 다르다. 발신 전에 템플릿을 카카오에 등록해 심사를 받아야
 * 하고, 발송할 때는 심사를 통과한 원문에서 `#{변수}` 자리만 바뀐 문구여야
 * 한다. 글자 하나, 줄바꿈 하나라도 다르면 대행사 단에서 거부된다.
 *
 * 그래서 이 파일이 단일 원본이다.
 *   · 앱의 미리보기와 대기열에 쌓이는 문구는 전부 `render()`를 거친다.
 *   · 설정 화면의 "심사 제출용 원문 복사"도 이 `body`를 그대로 복사한다.
 *   · `inquiry_received`는 DB 함수(0006 submit_public_form)도 같은 문구를
 *     만든다. 한쪽을 고치면 다른 쪽도 고쳐야 하고, 테스트가 둘을 대조한다.
 *
 * 심사에서 흔히 걸리는 것들을 피해서 썼다: 광고성 문구 없음, 변수만으로 된
 * 줄 최소화, 전체 1,000자 이내, 수신 사유(왜 이 메시지를 받는지)가 본문에 있음.
 */

export type TemplateCode = 'attendance_report' | 'trial_booked' | 'inquiry_received';

export interface AlimtalkTemplate {
  code: TemplateCode;
  /** 대행사 콘솔에 등록할 템플릿 이름. */
  name: string;
  /** 언제 나가는지 — 심사 담당자가 묻는 "발송 시점". */
  trigger: string;
  body: string;
}

export const TEMPLATES: Record<TemplateCode, AlimtalkTemplate> = {
  attendance_report: {
    code: 'attendance_report',
    name: '수업 리포트',
    trigger: '코치가 수업 출결을 제출한 직후, 해당 수업 원생의 보호자에게 1회',
    body: [
      '[#{학원명}] #{반이름} 수업 리포트',
      '',
      '#{학생명} 학생의 #{수업일} 수업 소식입니다.',
      '',
      '▪ 출결: #{출결}',
      '▪ 오늘의 훈련: #{훈련구성}',
      '▪ 코치 관찰: #{관찰기록}',
      '▪ 최근 30일 출석률: #{출석률}',
      '',
      '#{맺음말}',
      '',
      '— #{코치명} 코치 드림',
      '',
      '이 메시지는 수업 출결 기록 시 보호자님께 발송됩니다.',
    ].join('\n'),
  },

  trial_booked: {
    code: 'trial_booked',
    name: '체험 수업 예약 안내',
    trigger: '문의 상세에서 체험 날짜를 확정한 직후, 문의한 보호자에게 1회',
    body: [
      '[#{학원명}] 체험 수업 예약 안내',
      '',
      '#{보호자명} 님, #{아이이름} 학생의 체험 수업이 예약되었습니다.',
      '',
      '▪ 일시: #{체험일}',
      '▪ 클래스: #{반이름}',
      '',
      '편한 운동복과 운동화, 물을 챙겨 주세요.',
      '일정 변경이 필요하시면 이 채널로 말씀해 주세요.',
      '',
      '이 메시지는 체험 수업을 신청하신 분께 발송됩니다.',
    ].join('\n'),
  },

  inquiry_received: {
    code: 'inquiry_received',
    name: '문의 접수 확인',
    trigger: '학부모가 폼 링크로 문의를 접수한 직후 1회 (DB 함수가 적재)',
    body: [
      '[#{학원명}] 문의가 접수되었습니다',
      '',
      '#{보호자명} 님, 문의해 주셔서 감사합니다.',
      '담당 코치가 확인 후 영업일 기준 1일 안에 연락드리겠습니다.',
      '',
      '이 메시지는 문의 접수 시 1회 발송됩니다.',
    ].join('\n'),
  },
};

/** Kakao's hard ceiling for a template body, variables filled in. */
export const MAX_BODY = 1000;

/** Variables a template body asks for, in order of first appearance. */
export function variablesOf(body: string): string[] {
  const out: string[] = [];
  for (const m of body.matchAll(/#\{([^}]+)\}/g)) {
    if (!out.includes(m[1])) out.push(m[1]);
  }
  return out;
}

export class TemplateError extends Error {}

/**
 * Fill a template. Refuses a missing variable rather than leaving `#{…}` in a
 * message a parent would read, and refuses a body over the limit rather than
 * letting the provider truncate it.
 */
export function render(code: TemplateCode, vars: Record<string, string>): string {
  const template = TEMPLATES[code];
  const missing = variablesOf(template.body).filter((v) => !(v in vars));
  if (missing.length > 0) {
    throw new TemplateError(`${template.name}: 변수 누락 — ${missing.join(', ')}`);
  }

  const text = template.body.replace(/#\{([^}]+)\}/g, (_, key: string) => vars[key]);
  if (text.length > MAX_BODY) {
    throw new TemplateError(`${template.name}: ${text.length}자 — ${MAX_BODY}자를 넘습니다`);
  }
  return text;
}
