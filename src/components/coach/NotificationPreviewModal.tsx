/**
 * Parent notification (알림톡) simulation.
 *
 * Nothing is actually sent — this previews the exact text that would go out,
 * assembled from the tags the coach just tapped.
 */

import { useState } from 'react';
import { Check, MessageSquare, Send } from 'lucide-react';
import type { ParentNotification } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/cn';

interface NotificationPreviewModalProps {
  open: boolean;
  notifications: ParentNotification[];
  onClose: () => void;
}

export function NotificationPreviewModal({
  open,
  notifications,
  onClose,
}: NotificationPreviewModalProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [sent, setSent] = useState(false);

  const active = notifications[Math.min(activeIndex, notifications.length - 1)];

  const handleClose = () => {
    setActiveIndex(0);
    setSent(false);
    onClose();
  };

  if (!active) return null;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      variant="sheet"
      className="max-h-[88%]"
      title={
        <span className="flex items-center gap-2">
          <MessageSquare size={18} className="text-primary" />
          학부모 알림톡 미리보기
          <span className="rounded-full bg-tint-lavender px-2 py-0.5 text-[12px] font-semibold text-brand-purple-800">
            {notifications.length}건
          </span>
        </span>
      }
      footer={
        <button
          type="button"
          onClick={sent ? handleClose : () => setSent(true)}
          className={cn('w-full py-3 text-[15px]', sent ? 'btn-dark' : 'btn-primary')}
        >
          {sent ? (
            <>
              <Check size={16} strokeWidth={2.6} />
              {notifications.length}건 발송 완료 — 닫기
            </>
          ) : (
            <>
              <Send size={15} strokeWidth={2.4} />
              전체 발송 (시뮬레이션)
            </>
          )}
        </button>
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

      <div className="rounded-lg border border-hairline bg-surface-soft p-4">
        <div className="flex items-center justify-between gap-2 border-b border-hairline-soft pb-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">
              {active.parentName} 학부모님
            </p>
            <p className="text-[12px] text-steel">{active.parentPhone}</p>
          </div>
          <span className="shrink-0 rounded-sm bg-tint-yellow-bold px-2 py-1 text-[11px] font-semibold text-charcoal">
            카카오 알림톡
          </span>
        </div>

        <pre className="mt-3 whitespace-pre-wrap break-words font-sans text-[13px] leading-[1.6] text-charcoal">
          {active.message}
        </pre>
      </div>

      <p className="mt-3 text-center text-[12px] leading-[1.5] text-stone">
        코치가 작성한 문장은 0자입니다. 위 리포트는 탭한 출결·태그 데이터로 자동 생성되었습니다.
      </p>
    </Modal>
  );
}
