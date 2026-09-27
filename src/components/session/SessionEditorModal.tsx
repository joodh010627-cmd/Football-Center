/**
 * Write a session: a name, one ability, a goal sentence, and its blocks.
 *
 * The owner's save publishes it; a coach's save is a proposal the owner rules
 * on in the library's 승인 대기. Same form either way — the difference is one
 * column, which is also how the database tells them apart.
 */

import { useState } from 'react';
import { X } from 'lucide-react';
import type { Ability, ID, SessionTemplate } from '@/types';
import { useApp } from '@/store/AppContext';
import { useSession } from '@/store/AuthContext';
import { can } from '@/lib/permissions';
import { cn } from '@/lib/cn';
import { Modal } from '@/components/ui/Modal';
import { ABILITY_META, ABILITY_ORDER } from './meta';
import { BlockAdder } from './BlockEditorScreen';

interface SessionEditorModalProps {
  /** `null` = a new session. */
  template: SessionTemplate | null;
  defaultAbility: Ability;
  onClose: () => void;
}

export function SessionEditorModal({ template, defaultAbility, onClose }: SessionEditorModalProps) {
  const { state, dispatch, blockMap } = useApp();
  const session = useSession();
  const owner = can(session, 'curriculum:manage');

  const [title, setTitle] = useState(template?.title ?? '');
  const [goal, setGoal] = useState(template?.goal ?? '');
  const [ability, setAbility] = useState<Ability>(template?.ability ?? defaultAbility);
  const [blockIds, setBlockIds] = useState<ID[]>(template?.blockIds ?? []);
  const [adding, setAdding] = useState(false);

  const canSave = title.trim() && goal.trim() && blockIds.length > 0;

  const save = () => {
    if (!canSave) return;
    dispatch({
      type: 'template/save',
      template: {
        id: template?.id ?? crypto.randomUUID(),
        academyId: state.academyId,
        source: 'center',
        ability,
        title: title.trim(),
        goal: goal.trim(),
        blockIds,
        ageGroups: template?.ageGroups ?? [],
        status: owner ? 'published' : 'pending',
        proposedBy: owner ? (template?.proposedBy ?? null) : state.currentCoachId,
        reviewNote: template?.reviewNote ?? '',
        usageCount: template?.usageCount ?? 0,
        createdAt: template?.createdAt ?? new Date().toISOString(),
        curriculumId: template?.curriculumId ?? null,
      },
    });
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={template ? '세션 편집' : owner ? '세션 만들기' : '세션 제안'}
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            취소
          </button>
          <button type="button" onClick={save} disabled={!canSave} className="btn-primary">
            {owner ? '저장' : '승인 요청'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-[12.5px] font-semibold text-charcoal">세션 이름</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 패스 정확도"
            className="input-field"
          />
        </label>

        <div>
          <span className="mb-1.5 block text-[12.5px] font-semibold text-charcoal">능력</span>
          <div className="flex flex-wrap gap-1.5">
            {ABILITY_ORDER.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAbility(a)}
                aria-pressed={ability === a}
                className={cn(
                  'pill-tab !px-3.5 !py-1.5 !text-[13px]',
                  ability === a && 'pill-tab-active',
                )}
              >
                {ABILITY_META[a].label}
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-[12.5px] font-semibold text-charcoal">목표 한 줄</span>
          <input
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="예: 짧은 패스를 동료 발 앞에 정확히 보낸다"
            className="input-field"
          />
        </label>

        <div>
          <span className="mb-1.5 block text-[12.5px] font-semibold text-charcoal">
            훈련 블록 {blockIds.length > 0 && `${blockIds.length}개`}
          </span>
          {blockIds.length > 0 && (
            <ol className="mb-2 overflow-hidden rounded-md border border-hairline">
              {blockIds.map((id, i) => (
                <li
                  key={`${id}-${i}`}
                  className="flex items-center gap-2.5 border-b border-hairline-soft px-3 py-2 last:border-b-0"
                >
                  <span className="w-4 text-[12.5px] tabular-nums text-stone">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-[14px] text-ink">
                    {blockMap.get(id)?.title ?? '삭제된 블록'}
                  </span>
                  <button
                    type="button"
                    aria-label="빼기"
                    onClick={() => setBlockIds(blockIds.filter((_, k) => k !== i))}
                    className="p-1 text-stone hover:text-ink"
                  >
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ol>
          )}
          {adding ? (
            <BlockAdder
              onAdd={(ids) => {
                setBlockIds([...blockIds, ...ids]);
                setAdding(false);
              }}
              onCancel={() => setAdding(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="btn-secondary w-full py-2.5"
            >
              블록 추가
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
