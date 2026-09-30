/**
 * Small pieces the 폼 screens share — a labelled field, the line that says
 * whether this is real data, and the sentence for what became of an 알림톡.
 */

import type { ReactNode } from 'react';
import { CloudOff, RefreshCw } from 'lucide-react';
import type { WorkspaceMode } from '@/store/WorkspaceContext';
import type { EnqueueResult } from '@/lib/alimtalk/outbox';

/**
 * A labelled input. `group` for a row of chips: a `<label>` around buttons
 * forwards any tap on its text to the first button, so tapping "받는 반"
 * would silently toggle whichever class happened to be listed first.
 */
export function Field({
  label,
  hint,
  group = false,
  children,
}: {
  label: string;
  hint?: string;
  group?: boolean;
  children: ReactNode;
}) {
  const heading = (
    <span className="flex items-baseline gap-2">
      <span className="text-[13px] font-semibold text-charcoal">{label}</span>
      {hint && <span className="text-[11.5px] text-stone">{hint}</span>}
    </span>
  );

  if (group) {
    return (
      <div role="group" aria-label={label}>
        {heading}
        <div className="mt-1.5">{children}</div>
      </div>
    );
  }

  return (
    <label className="block">
      {heading}
      <span className="mt-1.5 block">{children}</span>
    </label>
  );
}

/**
 * Says out loud whether this screen is real.
 *
 * In local mode a copied link leads nowhere and everything vanishes on reload;
 * an owner who didn't know would send links to parents and wait for answers
 * that can never arrive. So local mode names the fix. The live state says
 * nothing at all — the absence of a banner is the good news, and one more
 * line on every visit is exactly the noise this tab is trying to shed.
 */
export function SyncBanner({
  mode,
  error,
  onReload,
  migration,
  what,
}: {
  mode: WorkspaceMode;
  error: string | null;
  onReload: () => void;
  /** Which migration turns this screen real, e.g. `0006`. */
  migration: string;
  /** What won't work until then, e.g. `폼 링크`. */
  what: string;
}) {
  if (error) {
    return (
      <div className="mb-4 flex items-center gap-2.5 rounded-lg bg-tint-alert-soft px-4 py-3 text-[13px] text-error">
        <CloudOff size={16} className="shrink-0" />
        <span className="min-w-0 flex-1">{error}</span>
        <button
          type="button"
          onClick={onReload}
          className="flex shrink-0 items-center gap-1 font-semibold"
        >
          <RefreshCw size={12} strokeWidth={2.4} />
          다시 불러오기
        </button>
      </div>
    );
  }

  if (mode !== 'local') return null;

  return (
    <div className="mb-4 rounded-lg border border-hairline-strong bg-canvas px-4 py-3">
      <p className="flex items-center gap-2 text-[13px] font-semibold text-ink">
        <CloudOff size={14} className="text-steel" />
        예시 데이터로 보는 중
      </p>
      <p className="mt-1 text-[12.5px] leading-[1.6] text-steel">
        {what}가 아직 실제로 동작하지 않고, 새로고침하면 바뀐 내용이 사라집니다. Supabase에
        마이그레이션 {migration}을 적용하면 시작됩니다.
      </p>
    </div>
  );
}

/** One line on what became of queued 알림톡, in the owner's words. */
export function describeEnqueue(result: EnqueueResult, what: string): string {
  if (result.state === 'unavailable') return `${what} 알림톡은 보내지 못했습니다 — ${result.reason}`;
  if (result.queued === 0) return `${what} 알림톡은 이미 대기열에 있습니다.`;
  const n = result.queued > 1 ? ` ${result.queued}건` : '';
  switch (result.dispatch) {
    case 'sent':
      return `${what} 알림톡${n}을 보냈습니다.`;
    case 'dry_run':
      return `${what} 알림톡${n}을 드라이런으로 처리했습니다 — 발송 대행사 키를 넣으면 실제로 나갑니다.`;
    case 'partial':
      return `${what} 알림톡 발송에 문제가 있습니다 (${result.detail ?? ''}).`;
    case 'not_connected':
    default:
      return `${what} 알림톡${n}을 발송 대기열에 넣었습니다. 발송 서버가 연결되면 나갑니다.`;
  }
}

/** `tel:` without the dashes — some Android dialers choke on them. */
export const telHref = (phone: string): string => `tel:${phone.replace(/[^0-9+]/g, '')}`;
