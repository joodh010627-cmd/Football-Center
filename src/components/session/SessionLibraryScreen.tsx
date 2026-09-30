/**
 * 세션 라이브러리 — every session the centre can run, by ability.
 *
 * Same list, same rows as 세션 고르기, so there is one way to read a session
 * anywhere in the app. The owner writes the centre's own sessions here and
 * rules on coaches' proposals; a coach proposes. Both of those live behind a
 * button or 더 보기 — most visits are just reading.
 */

import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import type { Ability, SessionTemplate } from '@/types';
import { useApp } from '@/store/AppContext';
import { useSession } from '@/store/AuthContext';
import { can } from '@/lib/permissions';
import { buildProposalQueue, sessionsFor } from '@/data/selectors';
import { ApprovalQueuePanel } from '@/components/curriculum/ApprovalQueuePanel';
import { BlockProposalModal } from '@/components/curriculum/BlockProposalModal';
import { AbilityChips, DetailHeader, More, SessionRow } from './parts';
import { SessionEditorModal } from './SessionEditorModal';

export function SessionLibraryScreen({
  backLabel,
  onBack,
}: {
  backLabel: string;
  onBack: () => void;
}) {
  const { state, slice, dispatch } = useApp();
  const session = useSession();
  const canEdit = can(session, 'curriculum:manage');
  const canPropose = can(session, 'curriculum:propose');

  const [ability, setAbility] = useState<Ability | 'all'>('all');
  const [editing, setEditing] = useState<{
    template: SessionTemplate | null;
  } | null>(null);
  const [proposingBlock, setProposingBlock] = useState(false);

  const sessions = useMemo(
    () => sessionsFor(state.sessionTemplates, ability),
    [state.sessionTemplates, ability],
  );
  // A coach sees their own proposals in the list too, marked 승인 대기.
  const mine = state.sessionTemplates.filter(
    (t) =>
      t.status === 'pending' &&
      t.proposedBy === state.currentCoachId &&
      (ability === 'all' || t.ability === ability),
  );
  const queue = canEdit ? buildProposalQueue(slice) : [];

  return (
    <div>
      <DetailHeader
        backLabel={backLabel}
        onBack={onBack}
        title="수업 라이브러리"
        action={
          canPropose && (
            <button
              type="button"
              onClick={() => setEditing({ template: null })}
              className="flex items-center gap-1 rounded-full px-2 py-1 text-[14px] font-semibold text-primary hover:bg-primary-wash"
            >
              <Plus size={15} strokeWidth={2.6} />
              {canEdit ? '만들기' : '제안'}
            </button>
          )
        }
      />

      <div className="px-5 py-5 sm:px-7 lg:max-w-2xl lg:px-10">
        <AbilityChips value={ability} onChange={setAbility} />

        <ul className="mt-4 overflow-hidden rounded-lg border border-hairline bg-canvas">
          {[...mine, ...sessions].map((t) => (
            <SessionRow
              key={t.id}
              template={t}
              extra={
                t.source === 'center' &&
                (canEdit || (t.status === 'pending' && t.proposedBy === state.currentCoachId)) ? (
                  <div className="flex gap-4">
                    {/* A coach has insert and withdraw on their proposal, never
                        update — so they can take it back, not rewrite it. */}
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => setEditing({ template: t })}
                        className="text-[13.5px] font-semibold text-primary"
                      >
                        편집
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        dispatch({
                          type: 'template/withdraw',
                          templateId: t.id,
                        })
                      }
                      className="text-[13.5px] font-semibold text-error"
                    >
                      삭제
                    </button>
                  </div>
                ) : undefined
              }
            />
          ))}
        </ul>

        {canEdit && queue.length > 0 && (
          <More className="mt-6" label={`승인 대기 ${queue.length}`}>
            <ApprovalQueuePanel />
          </More>
        )}

        {canPropose && (
          <button
            type="button"
            onClick={() => setProposingBlock(true)}
            className="mt-6 w-full py-2 text-center text-[13.5px] font-semibold text-steel hover:text-ink"
          >
            {canEdit ? '새 훈련 블록 추가' : '새 훈련 블록 제안'}
          </button>
        )}
      </div>

      {editing && (
        <SessionEditorModal
          template={editing.template}
          defaultAbility={ability === 'all' ? 'technical' : ability}
          onClose={() => setEditing(null)}
        />
      )}
      <BlockProposalModal open={proposingBlock} onClose={() => setProposingBlock(false)} />
    </div>
  );
}
