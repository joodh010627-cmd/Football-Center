/**
 * Author (owner) or propose (coach) one standard session.
 *
 * The same form serves both because the difference is not what gets filled in —
 * it is what `status` the row is born with, and that is one line. Giving coaches
 * a cut-down form would have meant a proposal the owner has to finish writing.
 */

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Clock, Plus, Send, X } from 'lucide-react';
import type { Curriculum, ID, SessionTemplate, TrainingCategory } from '@/types';
import { useApp } from '@/store/AppContext';
import { publishedBlocks } from '@/data/selectors';
import { cn } from '@/lib/cn';
import { Modal } from '@/components/ui/Modal';
import { CATEGORY_META } from '@/components/coach/TrainingBlockCard';

const CATEGORIES: TrainingCategory[] = ['warmup', 'skill', 'game'];

interface SessionTemplateEditorProps {
  open: boolean;
  onClose: () => void;
  curriculum: Curriculum;
  /** `null` creates a new standard session. */
  template: SessionTemplate | null;
  /** `author` publishes immediately; `propose` files it for the owner. */
  mode: 'author' | 'propose';
}

export function SessionTemplateEditor({
  open,
  onClose,
  curriculum,
  template,
  mode,
}: SessionTemplateEditorProps) {
  const { state, dispatch, blockMap } = useApp();

  const nextWeek =
    state.sessionTemplates.filter((t) => t.curriculumId === curriculum.id).length + 1;

  const [title, setTitle] = useState(template?.title ?? '');
  const [week, setWeek] = useState(template?.week ?? Math.min(nextWeek, curriculum.cycleWeeks));
  const [goal, setGoal] = useState(template?.goal ?? '');
  const [blockIds, setBlockIds] = useState<ID[]>(template?.blockIds ?? []);
  const [picking, setPicking] = useState<TrainingCategory>('warmup');

  const library = useMemo(
    () =>
      publishedBlocks(state.trainingBlocks)
        .filter((b) => b.category === picking)
        .sort((a, b) => {
          // Age fit first — a U7 curriculum should not open on a heading drill.
          const fit = Number(b.ageGroups.includes(curriculum.ageGroup)) -
            Number(a.ageGroups.includes(curriculum.ageGroup));
          return fit || b.usageCount - a.usageCount;
        }),
    [state.trainingBlocks, picking, curriculum.ageGroup],
  );

  const totalMin = blockIds.reduce((sum, id) => sum + (blockMap.get(id)?.durationMin ?? 0), 0);
  const canSave = title.trim().length > 0 && blockIds.length > 0;

  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= blockIds.length) return;
    const next = [...blockIds];
    [next[index], next[target]] = [next[target], next[index]];
    setBlockIds(next);
  };

  const save = () => {
    if (!canSave) return;
    dispatch({
      type: 'template/save',
      template: {
        id: template?.id ?? crypto.randomUUID(),
        academyId: state.academyId,
        curriculumId: curriculum.id,
        title: title.trim(),
        week,
        goal: goal.trim(),
        blockIds,
        status: mode === 'author' ? 'published' : 'pending',
        // An owner's own row has no proposer. A coach's must have one, or the
        // pending row has nobody to notify and no author to credit.
        proposedBy: mode === 'author' ? null : state.currentCoachId,
        reviewNote: '',
        usageCount: template?.usageCount ?? 0,
        createdAt: template?.createdAt ?? new Date().toISOString(),
      },
    });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      className="max-w-2xl"
      title={
        <span>
          {template ? '표준 세션 수정' : mode === 'author' ? '표준 세션 추가' : '표준 세션 제안'}
          <span className="mt-0.5 block text-[13px] font-normal text-steel">
            {curriculum.title}
          </span>
        </span>
      }
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] text-steel">
            {blockIds.length}블록 · {totalMin}분
          </span>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn-secondary">
              취소
            </button>
            <button type="button" onClick={save} disabled={!canSave} className="btn-primary">
              {mode === 'author' ? (
                <>
                  <Check size={15} strokeWidth={2.6} />
                  커리큘럼에 등재
                </>
              ) : (
                <>
                  <Send size={15} strokeWidth={2.4} />
                  대표에게 승인 요청
                </>
              )}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {mode === 'propose' && (
          <p className="rounded-md bg-tint-yellow px-3.5 py-3 text-[13px] leading-[1.6] text-charcoal">
            제안한 세션은 대표가 승인할 때 커리큘럼에 등재됩니다. 승인 전까지는 다른 코치의 설계
            화면에 나타나지 않습니다.
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-[1fr_110px]">
          <Field label="세션 이름">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 첫 터치와 멈추기"
              className="input-field"
            />
          </Field>
          <Field label="주차">
            <input
              type="number"
              min={1}
              max={curriculum.cycleWeeks}
              value={week}
              onChange={(e) => setWeek(Math.max(1, Number(e.target.value) || 1))}
              className="input-field tabular-nums"
            />
          </Field>
        </div>

        <Field label="이 세션의 목표">
          <input
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="예: 굴러오는 공을 한 번에 멈춰 세운다"
            className="input-field"
          />
        </Field>

        {/* --- Composition --------------------------------------------- */}
        <div>
          <p className="eyebrow-ink mb-2">세션 구성 — 순서대로</p>

          {blockIds.length === 0 ? (
            <p className="rounded-md border border-dashed border-hairline-strong px-4 py-6 text-center text-[13px] text-slate">
              아래 라이브러리에서 블록을 담으세요. 개수와 순서는 자유입니다.
            </p>
          ) : (
            <ol className="space-y-1.5">
              {blockIds.map((id, index) => {
                const block = blockMap.get(id);
                const meta = block ? CATEGORY_META[block.category] : null;
                return (
                  <li
                    key={`${id}-${index}`}
                    className="flex items-center gap-2.5 rounded-md border border-hairline bg-canvas px-3 py-2.5"
                  >
                    <span className="w-4 shrink-0 text-[12px] font-semibold tabular-nums text-stone">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          'text-[11px] font-semibold uppercase tracking-label',
                          meta?.accent,
                        )}
                      >
                        {meta?.label ?? '삭제된 블록'}
                      </span>
                      <span className="block truncate text-[14px] font-semibold text-ink">
                        {block?.title ?? id}
                      </span>
                    </span>
                    <span className="shrink-0 text-[12px] font-medium tabular-nums text-steel">
                      {block?.durationMin ?? 0}분
                    </span>
                    <span className="flex shrink-0 items-center">
                      <IconBtn label="위로" onClick={() => move(index, -1)} disabled={index === 0}>
                        <ArrowUp size={14} />
                      </IconBtn>
                      <IconBtn
                        label="아래로"
                        onClick={() => move(index, 1)}
                        disabled={index === blockIds.length - 1}
                      >
                        <ArrowDown size={14} />
                      </IconBtn>
                      <IconBtn
                        label="제거"
                        danger
                        onClick={() => setBlockIds(blockIds.filter((_, i) => i !== index))}
                      >
                        <X size={14} />
                      </IconBtn>
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        {/* --- Library ------------------------------------------------- */}
        <div>
          <div className="mb-2 flex gap-1.5">
            {CATEGORIES.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setPicking(category)}
                className={cn(
                  'pill-tab flex-1 !py-1.5 !text-[13px]',
                  picking === category && 'pill-tab-active',
                )}
              >
                {CATEGORY_META[category].label}
              </button>
            ))}
          </div>

          <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-hairline-soft bg-surface-soft p-1.5">
            {library.map((block) => {
              const offAge = !block.ageGroups.includes(curriculum.ageGroup);
              return (
                <button
                  key={block.id}
                  type="button"
                  onClick={() => setBlockIds([...blockIds, block.id])}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-sm px-2.5 py-2 text-left transition-colors hover:bg-canvas',
                    offAge && 'opacity-55',
                  )}
                >
                  <Plus size={13} strokeWidth={2.6} className="shrink-0 text-primary" />
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-ink">
                    {block.title}
                  </span>
                  {offAge && (
                    <span className="shrink-0 text-[11px] font-medium text-brand-orange-deep">
                      연령 밖
                    </span>
                  )}
                  <span className="flex shrink-0 items-center gap-0.5 text-[12px] tabular-nums text-steel">
                    <Clock size={10} />
                    {block.durationMin}분
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-semibold text-charcoal">{label}</span>
      {children}
    </label>
  );
}

function IconBtn({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'rounded-sm p-1.5 text-stone transition-colors hover:bg-surface hover:text-charcoal disabled:opacity-30 disabled:hover:bg-transparent',
        danger && 'hover:text-error',
      )}
    >
      {children}
    </button>
  );
}
