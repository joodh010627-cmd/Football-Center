/**
 * Parent notification (알림톡) — preview, then queue.
 *
 * The text shown is exactly what would be delivered: the approved template
 * with the coach's taps filled in (`lib/alimtalk/templates.ts`). 전체 발송 puts
 * one row per guardian into the database's outbox, and the outbox — not this
 * screen — is what eventually talks to Kakao. So the button's result is honest
 * about how far the message got: queued, dry-run, or sent.
 *
 * Re-opening this sheet for the same session and pressing again queues nothing
 * new; the dedupe key is the class, the date and the student.
 */

import { useState } from 'react';
import { Check, Loader2, MessageSquare, Send } from 'lucide-react';
import type { ID, ParentNotification } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { enqueue, type EnqueueResult } from '@/lib/alimtalk/outbox';
import { cn } from '@/lib/cn';

interface NotificationPreviewModalProps {
  open: boolean;
  notifications: ParentNotification[];
  academyId: ID;
  /** Class + date: what makes a report for one student unique. */
  dedupeScope: string;
  onClose: () => void;
}

type Phase =
  | { step: 'preview' }
  | { step: 'sending' }
  | { step: 'done'; result: EnqueueResult }
  | { step: 'error'; message: string };

export function NotificationPreviewModal({
  open,
  notifications,
  academyId,
  dedupeScope,
  onClose,
}: NotificationPreviewModalProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>({ step: 'preview' });

  const active = notifications[Math.min(activeIndex, notifications.length - 1)];

  const handleClose = () => {
    setActiveIndex(0);
    setPhase({ step: 'preview' });
    onClose();
  };

  const send = async () => {
    setPhase({ step: 'sending' });
    try {
      const result = await enqueue(
        academyId,
        notifications.map((n) => ({
          templateCode: n.templateCode,
          studentId: n.studentId,
          variables: n.variables,
          body: n.message,
          dedupeKey: `attendance:${dedupeScope}:${n.studentId}`,
        })),
      );
      setPhase({ step: 'done', result });
    } catch (error) {
      console.error('[alimtalk] enqueue', error);
      setPhase({
        step: 'error',
        message: '발송 대기열에 넣지 못했습니다. 출결 기록은 저장되었습니다.',
      });
    }
  };

  if (!active) return null;

  const missingPhone = notifications.filter((n) => n.parentPhone.replace(/\D/g, '').length < 9);

  return (
    <Modal
      open={open}
      onClose={handleClose}
      variant="sheet"
      className="max-h-[88%]"
      title={
        <span className="flex items-center gap-2">
          <MessageSquare size={18} className="text-primary" />
          학부모 알림톡
          <span className="rounded-full bg-tint-lavender px-2 py-0.5 text-[12px] font-semibold text-brand-purple-800">
            {notifications.length}건
          </span>
        </span>
      }
      footer={
        phase.step === 'done' || phase.step === 'error' ? (
          <div>
            <ResultLine phase={phase} total={notifications.length} />
            <button
              type="button"
              onClick={handleClose}
              className="btn-dark mt-3 w-full py-3 text-[15px]"
            >
              <Check size={16} strokeWidth={2.6} />
              닫기
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => void send()}
            disabled={phase.step === 'sending'}
            className="btn-primary w-full py-3 text-[15px]"
          >
            {phase.step === 'sending' ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Send size={15} strokeWidth={2.4} />
            )}
            {phase.step === 'sending' ? '대기열에 넣는 중…' : `${notifications.length}건 발송`}
          </button>
        )
      }
    >
      {/* Recipient rail */}
      <div className="no-scrollbar -mx-1 mb-4 flex gap-1.5 overflow-x-auto px-1">
        {notifications.map((n, i) => (
          <button
            key={n.studentId}
            type="button"
            onClick={() => setActiveIndex(i)}
            className={cn('pill-tab shrink-0', i === activeIndex && 'pill-tab-active')}
          >
            {n.studentName}
          </button>
        ))}
      </div>

      <div
        key={active.studentId}
        className="animate-swap-in rounded-lg border border-hairline bg-surface-soft p-4"
      >
        <div className="flex items-center justify-between gap-2 border-b border-hairline-soft pb-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">
              {active.parentName || '보호자'} 님
            </p>
            <p className="text-[12px] text-steel">{active.parentPhone || '연락처 없음'}</p>
          </div>
          <span className="shrink-0 rounded-sm bg-tint-yellow-bold px-2 py-1 text-[11px] font-semibold text-charcoal">
            카카오 알림톡
          </span>
        </div>

        <pre className="mt-3 whitespace-pre-wrap break-words font-sans text-[13px] leading-[1.6] text-charcoal">
          {active.message}
        </pre>
      </div>

      {missingPhone.length > 0 && (
        <p className="mt-3 rounded-md bg-tint-alert-soft px-3.5 py-2.5 text-[12.5px] leading-[1.55] text-error">
          {missingPhone.map((n) => n.studentName).join(', ')} 학생은 보호자 연락처가 없어 발송되지
          않습니다. 원생 정보에서 연락처를 채워 주세요.
        </p>
      )}

      <p className="mt-3 text-center text-[12px] leading-[1.5] text-stone">
        코치가 작성한 문장은 0자입니다. 심사받은 템플릿에 출결·태그가 자동으로 채워졌습니다.
      </p>
    </Modal>
  );
}

function ResultLine({
  phase,
  total,
}: {
  phase: Extract<Phase, { step: 'done' } | { step: 'error' }>;
  total: number;
}) {
  if (phase.step === 'error') {
    return <p className="text-center text-[13px] text-error">{phase.message}</p>;
  }

  const { result } = phase;
  if (result.state === 'unavailable') {
    return (
      <p className="text-center text-[13px] leading-[1.55] text-steel">
        {result.reason}. 지금은 미리보기만 가능합니다.
      </p>
    );
  }

  const skipped = total - result.queued;
  const head =
    result.dispatch === 'sent'
      ? `${result.queued}건 발송 완료`
      : result.dispatch === 'dry_run'
        ? `${result.queued}건 드라이런 완료`
        : `${result.queued}건 발송 대기열에 등록`;

  return (
    <p className="text-center text-[13px] leading-[1.55] text-charcoal">
      <span className="font-semibold">{head}</span>
      {skipped > 0 && <span className="text-steel"> · {skipped}건은 이미 대기열에 있음</span>}
      <br />
      <span className="text-steel">
        {result.dispatch === 'not_connected'
          ? '발송 서버가 연결되면 순서대로 나갑니다'
          : result.dispatch === 'dry_run'
            ? '실제 발송은 대행사 키를 넣은 뒤부터입니다'
            : (result.detail ?? '')}
      </span>
    </p>
  );
}
