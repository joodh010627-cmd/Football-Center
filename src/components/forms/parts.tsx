/**
 * Small pieces the 폼 screens share: the line that says a write failed, the
 * sentence for what became of an 알림톡, and a dialable phone link.
 */

import { CloudOff } from 'lucide-react';
import { useWorkspace } from '@/store/WorkspaceContext';
import type { EnqueueResult } from '@/lib/alimtalk/outbox';

/**
 * A failed save, said where the person is looking. The optimistic change has
 * already been rolled back by a reload, so the only thing left to do is try
 * again — which is the one button offered.
 */
export function SyncError() {
  const { syncError, reload } = useWorkspace();
  if (!syncError) return null;
  return (
    <div
      role="alert"
      className="mb-5 flex items-center gap-2.5 rounded-[14px] bg-tint-alert-soft px-4 py-3 text-[14px] text-error"
    >
      <CloudOff size={16} className="shrink-0" />
      <span className="min-w-0 flex-1">{syncError}</span>
      <button type="button" onClick={reload} className="shrink-0 font-semibold">
        다시 불러오기
      </button>
    </div>
  );
}

/** One line on what became of queued 알림톡, in the owner's words. */
export function describeEnqueue(result: EnqueueResult, what: string): string {
  if (result.state === 'unavailable') return `${what} 알림톡은 보내지 못했어요 — ${result.reason}`;
  if (result.queued === 0) return `${what} 알림톡은 이미 대기열에 있어요.`;
  const n = result.queued > 1 ? ` ${result.queued}건` : '';
  switch (result.dispatch) {
    case 'sent':
      return `${what} 알림톡${n}을 보냈어요.`;
    case 'dry_run':
      return `${what} 알림톡${n}을 드라이런으로 처리했어요 — 발송 대행사 키를 넣으면 실제로 나갑니다.`;
    case 'partial':
      return `${what} 알림톡 발송에 문제가 있어요 (${result.detail ?? ''}).`;
    case 'not_connected':
    default:
      return `${what} 알림톡${n}을 발송 대기열에 넣었어요. 발송 서버가 연결되면 나갑니다.`;
  }
}

/** `tel:` without the dashes — some Android dialers choke on them. */
export const telHref = (phone: string): string => `tel:${phone.replace(/[^0-9+]/g, '')}`;
