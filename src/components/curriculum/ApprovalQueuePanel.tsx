/**
 * The owner's approval queue.
 *
 * Coaches' proposals and the owner's library live in the same tables, separated
 * only by `status` — so this panel is a filter, not a second inbox. Approving is
 * one write to one column, which is why the pending row can carry its full
 * detail: the owner rules on the actual session, not on a summary of it.
 */

import { useState } from 'react';
import { Check, Inbox, X } from 'lucide-react';
import type { Proposal } from '@/data/selectors';
import { useApp } from '@/store/AppContext';
import { buildProposalQueue } from '@/data/selectors';
import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { CATEGORY_META } from '@/components/coach/TrainingBlockCard';

export function ApprovalQueuePanel() {
  const { slice } = useApp();
  const queue = buildProposalQueue(slice);

  return (
    <section className="card p-6">
      <header className="mb-4">
        <h2 className="flex items-center gap-2 text-[18px] font-semibold leading-[1.4] text-ink">
          <Inbox size={17} className="text-primary" />
          코치 제안 승인 대기
          {queue.length > 0 && (
            <span className="ml-1 flex h-[21px] min-w-[21px] items-center justify-center rounded-full bg-error px-1.5 text-[12px] font-bold text-white">
              {queue.length}
            </span>
          )}
        </h2>
        <p className="mt-1 text-[13px] leading-[1.5] text-slate">
          승인하면 그 즉시 전 코치의 설계 화면에 등재됩니다. 반려하면 제안자에게만 남습니다.
        </p>
      </header>

      {queue.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="대기 중인 제안이 없습니다"
          description="코치가 새 세션이나 블록을 제안하면 여기에 쌓입니다."
        />
      ) : (
        <ul className="space-y-2.5">
          {queue.map((proposal) => (
            <ProposalRow key={`${proposal.kind}-${proposal.id}`} proposal={proposal} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ProposalRow({ proposal }: { proposal: Proposal }) {
  const { dispatch, getCoach, getCurriculum, blockMap } = useApp();
  const [note, setNote] = useState('');
  const [rejecting, setRejecting] = useState(false);

  const coachName = proposal.proposedBy ? getCoach(proposal.proposedBy)?.name : null;

  const approve = () => {
    if (proposal.kind === 'template') {
      dispatch({
        type: 'template/review',
        templateId: proposal.id,
        status: 'published',
        note: note.trim(),
      });
    } else {
      dispatch({ type: 'block/review', blockId: proposal.id, status: 'published' });
    }
  };

  const reject = () => {
    if (proposal.kind === 'template') {
      dispatch({
        type: 'template/review',
        templateId: proposal.id,
        status: 'rejected',
        note: note.trim(),
      });
    } else {
      dispatch({ type: 'block/review', blockId: proposal.id, status: 'rejected' });
    }
    setRejecting(false);
  };

  return (
    <li className="rounded-md border border-hairline bg-surface-soft p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={proposal.kind === 'template' ? 'purple' : 'orange'}>
              {proposal.kind === 'template' ? '표준 세션' : '훈련 블록'}
            </Badge>
            <h3 className="text-[15px] font-semibold text-ink">{proposal.title}</h3>
          </div>
          <p className="mt-1 text-[12.5px] text-steel">
            {coachName ? `${coachName} 코치 제안` : '제안자 미상'}
            {proposal.template && (
              <> · {getCurriculum(proposal.template.curriculumId)?.title ?? '삭제된 커리큘럼'}</>
            )}
          </p>
        </div>

        <div className="flex shrink-0 gap-1.5">
          <button
            type="button"
            onClick={approve}
            className="flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-primary-pressed"
          >
            <Check size={13} strokeWidth={2.8} />
            승인
          </button>
          <button
            type="button"
            onClick={() => setRejecting((v) => !v)}
            className={cn(
              'flex items-center gap-1 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition-colors',
              rejecting
                ? 'border-error bg-tint-alert text-error'
                : 'border-hairline-strong text-steel hover:border-error hover:text-error',
            )}
          >
            <X size={13} strokeWidth={2.8} />
            반려
          </button>
        </div>
      </div>

      {proposal.template && (
        <>
          {proposal.template.goal && (
            <p className="mt-2.5 text-[13px] leading-[1.6] text-slate">
              목표 — {proposal.template.goal}
            </p>
          )}
          <ol className="mt-2.5 flex flex-wrap gap-1.5">
            {proposal.template.blockIds.map((id, i) => {
              const block = blockMap.get(id);
              const meta = block ? CATEGORY_META[block.category] : null;
              return (
                <li
                  key={`${id}-${i}`}
                  className={cn(
                    'flex items-center gap-1.5 rounded-sm px-2 py-1 text-[12.5px] font-medium',
                    meta?.tint ?? 'bg-tint-gray',
                    meta?.accent ?? 'text-slate',
                  )}
                >
                  <span className="tabular-nums opacity-60">{i + 1}</span>
                  {block?.title ?? '삭제된 블록'}
                </li>
              );
            })}
          </ol>
        </>
      )}

      {proposal.block && (
        <div className="mt-2.5">
          <p className="text-[13px] leading-[1.6] text-slate">{proposal.block.description}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge tone="neutral">{CATEGORY_META[proposal.block.category].label}</Badge>
            <Badge tone="neutral">{proposal.block.durationMin}분</Badge>
            <Badge tone="neutral">{proposal.block.ageGroups.join(' · ')}</Badge>
            {proposal.block.equipment.map((item) => (
              <Badge key={item} tone="neutral">
                {item}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {rejecting && proposal.kind === 'template' && (
        <div className="mt-3 flex gap-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="반려 사유 — 제안한 코치에게 보입니다"
            className="input-field !py-2 !text-[13px]"
          />
          <button type="button" onClick={reject} className="btn-primary shrink-0 !px-4 !py-2">
            반려 확정
          </button>
        </div>
      )}

      {rejecting && proposal.kind === 'block' && (
        <div className="mt-3 flex justify-end">
          <button type="button" onClick={reject} className="btn-primary !px-4 !py-2">
            반려 확정
          </button>
        </div>
      )}
    </li>
  );
}
