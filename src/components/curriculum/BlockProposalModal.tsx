/**
 * A coach proposes a new training block.
 *
 * This is the one place in the coach app that asks for typed text, and it is
 * deliberate: everything on the pitch is a tap because the coach is holding a
 * ball, but writing a drill up is desk work. The rest of the app stays keyboard
 * free.
 */

import { useState } from 'react';
import { Send } from 'lucide-react';
import type { AgeGroup, TrainingCategory } from '@/types';
import { useApp } from '@/store/AppContext';
import { cn } from '@/lib/cn';
import { Modal } from '@/components/ui/Modal';
import { CATEGORY_META } from '@/components/coach/TrainingBlockCard';
import { AGE_ORDER } from './curriculumMeta';

const CATEGORIES: TrainingCategory[] = ['warmup', 'skill', 'game'];

interface BlockProposalModalProps {
  open: boolean;
  onClose: () => void;
  /** Pre-ticked so a proposal from a U7 screen arrives rated for U7. */
  defaultAgeGroups?: AgeGroup[];
}

export function BlockProposalModal({
  open,
  onClose,
  defaultAgeGroups = [],
}: BlockProposalModalProps) {
  const { state, dispatch } = useApp();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<TrainingCategory>('skill');
  const [durationMin, setDurationMin] = useState(20);
  const [description, setDescription] = useState('');
  const [equipment, setEquipment] = useState('');
  const [ageGroups, setAgeGroups] = useState<AgeGroup[]>(defaultAgeGroups);

  const canSend = title.trim().length > 0 && description.trim().length > 0 && ageGroups.length > 0;

  const send = () => {
    if (!canSend) return;
    dispatch({
      type: 'block/propose',
      block: {
        id: crypto.randomUUID(),
        academyId: state.academyId,
        title: title.trim(),
        category,
        durationMin,
        description: description.trim(),
        ageGroups,
        equipment: equipment
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        usageCount: 0,
        // Whether a block is standard curriculum is the owner's call, and the
        // insert policy refuses a proposal that claims otherwise.
        isCoreCurriculum: false,
        status: 'pending',
        proposedBy: state.currentCoachId,
      },
    });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="새 훈련 블록 제안"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            취소
          </button>
          <button type="button" onClick={send} disabled={!canSend} className="btn-primary">
            <Send size={15} strokeWidth={2.4} />
            승인 요청
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-semibold text-charcoal">블록 이름</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 3인 삼각 패스 로테이션"
            className="input-field"
          />
        </label>

        <div>
          <span className="mb-1.5 block text-[12px] font-semibold text-charcoal">분류</span>
          <div className="flex gap-1.5">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setCategory(c);
                  setDurationMin(CATEGORY_META[c].defaultMin);
                }}
                className={cn(
                  'pill-tab flex-1 !py-1.5 !text-[13px]',
                  category === c && 'pill-tab-active',
                )}
              >
                {CATEGORY_META[c].label}
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-[12px] font-semibold text-charcoal">
            진행 시간 — {durationMin}분
          </span>
          <input
            type="range"
            min={5}
            max={40}
            step={1}
            value={durationMin}
            onChange={(e) => setDurationMin(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </label>

        <div>
          <span className="mb-1.5 block text-[12px] font-semibold text-charcoal">적용 연령대</span>
          <div className="flex flex-wrap gap-1.5">
            {AGE_ORDER.map((age) => {
              const on = ageGroups.includes(age);
              return (
                <button
                  key={age}
                  type="button"
                  onClick={() =>
                    setAgeGroups(
                      on ? ageGroups.filter((a) => a !== age) : [...ageGroups, age],
                    )
                  }
                  className={cn('pill-tab !px-3.5 !py-1.5 !text-[13px]', on && 'pill-tab-active')}
                >
                  {age}
                </button>
              );
            })}
          </div>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-[12px] font-semibold text-charcoal">
            진행 방법
          </span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="콘 배치, 인원 구성, 진행 순서와 강조점을 적어주세요."
            className="input-field resize-none leading-[1.6]"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[12px] font-semibold text-charcoal">
            준비물 <span className="font-normal text-stone">쉼표로 구분</span>
          </span>
          <input
            value={equipment}
            onChange={(e) => setEquipment(e.target.value)}
            placeholder="콘 8개, 조끼, 공 인원수"
            className="input-field"
          />
        </label>
      </div>
    </Modal>
  );
}
