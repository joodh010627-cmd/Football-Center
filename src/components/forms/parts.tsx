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
  if (result.state === 'unavailable') return `${what} 알림톡 발송 실패 · ${result.reason}`;
  if (result.queued === 0) return `${what} 알림톡 이미 대기 중`;
  const n = result.queued > 1 ? ` ${result.queued}건` : '';
  switch (result.dispatch) {
    case 'sent':
      return `${what} 알림톡${n} 발송됨`;
    case 'dry_run':
      return `${what} 알림톡${n} 드라이런 처리 (발송 대행사 연결 전)`;
    case 'partial':
      return `${what} 알림톡 일부 실패 (${result.detail ?? ''})`;
    case 'not_connected':
    default:
      return `${what} 알림톡${n} 대기열 등록 (발송 서버 연결 전)`;
  }
}

/** `tel:` without the dashes — some Android dialers choke on them. */
export const telHref = (phone: string): string => `tel:${phone.replace(/[^0-9+]/g, '')}`;
