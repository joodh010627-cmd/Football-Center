/**
 * The small decisions on the journey, each a sheet with its answer mostly
 * chosen already: the trial date defaults to two days out, the class to the
 * one the family asked about, the age group to the class's. Picking is the
 * default; typing is there for what the picks don't cover.
 */

import { useState } from 'react';
import type { AgeGroup, ID } from '@/types';
import { useApp } from '@/store/AppContext';
import { TODAY } from '@/data/dates';
import { SOURCE_LABEL, type Lead, type LeadSource } from '@/data/crm';
import { cn } from '@/lib/cn';
import { Modal } from '@/components/ui/Modal';
import { Field, Pills, PrimaryButton, inputClass } from './ui';

const AGE_GROUPS: AgeGroup[] = ['U7', 'U9', 'U11', 'U13', 'U15'];

// ---------------------------------------------------------------------------

export function TrialSheet({
  open,
  defaultDate,
  defaultClassId,
  onClose,
  onSubmit,
}: {
  open: boolean;
  defaultDate: string;
  defaultClassId: string;
  onClose: () => void;
  onSubmit: (date: string, classId: string) => void;
}) {
  const { state } = useApp();
  const [date, setDate] = useState(defaultDate);
  const [classId, setClassId] = useState(defaultClassId);

  return (
    <Modal
      open={open}
      onClose={onClose}
      variant="sheet"
      title="체험 날짜 잡기"
      footer={
        <PrimaryButton onClick={() => onSubmit(date, classId)}>예약하고 안내 보내기</PrimaryButton>
      }
    >
      <Field label="날짜">
        <input
          type="date"
          className={inputClass}
          value={date}
          min={TODAY}
          onChange={(e) => setDate(e.target.value)}
        />
      </Field>
      <Field label="참여할 반" hint="나중에 정해도 돼요">
        <Pills
          options={state.classes.map((c) => [c.id, c.title] as const)}
          pressed={classId}
          onPick={(id) => setClassId(id === classId ? '' : id)}
        />
      </Field>
      <p className="mt-5 text-[13.5px] leading-[1.6] text-steel">
        예약하면 보호자에게 체험 안내 알림톡이 가고, 일정 탭의 그날 수업 옆에 표시됩니다.
      </p>
    </Modal>
  );
}

// ---------------------------------------------------------------------------

export function EnrollSheet({
  open,
  lead,
  onClose,
  onSubmit,
}: {
  open: boolean;
  lead: Lead;
  onClose: () => void;
  onSubmit: (classId: ID, ageGroup: AgeGroup) => void;
}) {
  const { state } = useApp();
  const initialClass = lead.trialClassId ?? lead.interestClassId ?? '';
  const [classId, setClassId] = useState<ID>(initialClass);
  const cls = state.classes.find((c) => c.id === classId);
  const guess = AGE_GROUPS.find((g) => lead.ageLabel.toUpperCase().includes(g)) ?? cls?.ageGroup;
  const [ageGroup, setAgeGroup] = useState<AgeGroup | ''>(guess ?? '');

  return (
    <Modal
      open={open}
      onClose={onClose}
      variant="sheet"
      title={`${lead.childName || '새 원생'} 등록 확정`}
      footer={
        <PrimaryButton
          disabled={!classId || !ageGroup}
          onClick={() => onSubmit(classId, ageGroup as AgeGroup)}
        >
          {cls ? `${cls.title}에 등록하기` : '반을 골라 주세요'}
        </PrimaryButton>
      }
    >
      <Field label="반">
        <Pills
          options={state.classes.map((c) => [c.id, c.title] as const)}
          pressed={classId}
          onPick={(id) => {
            setClassId(id);
            const next = state.classes.find((c) => c.id === id);
            if (!ageGroup && next) setAgeGroup(next.ageGroup);
          }}
        />
      </Field>
      <Field label="연령대">
        <Pills
          options={AGE_GROUPS.map((g) => [g, g] as const)}
          pressed={ageGroup || null}
          onPick={(g) => setAgeGroup(g)}
        />
      </Field>
      <p className="mt-5 text-[13.5px] leading-[1.6] text-steel">
        확정하면 반 명단에 바로 들어가고, 첫 달 온보딩이 시작됩니다. 수업료는 클럽 → 세부 관리에서
        정합니다.
      </p>
    </Modal>
  );
}

// ---------------------------------------------------------------------------

/** Why families don't join — picked, so the reasons can be counted later. */
const LOST_REASONS = ['거리·시간이 맞지 않음', '비용', '아이가 원하지 않음', '다른 곳으로 결정', '연락이 닿지 않음'];

export function LostSheet({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  const [picked, setPicked] = useState('');
  const [note, setNote] = useState('');
  const reason = [picked, note.trim()].filter(Boolean).join(' — ');

  return (
    <Modal
      open={open}
      onClose={onClose}
      variant="sheet"
      title="이번엔 함께하지 않아요"
      footer={
        <PrimaryButton disabled={!reason} onClick={() => onSubmit(reason)}>
          정리하기
        </PrimaryButton>
      }
    >
      <p className="text-[14px] leading-[1.6] text-steel">
        기록은 지워지지 않아요. 이유가 쌓여야 다음 가족을 같은 이유로 놓치지 않습니다.
      </p>
      <Field label="이유">
        <Pills
          options={LOST_REASONS.map((r) => [r, r] as const)}
          pressed={picked}
          onPick={(r) => setPicked(r === picked ? '' : r)}
        />
      </Field>
      <Field label="덧붙일 말" hint="선택">
        <textarea
          className={cn(inputClass, 'min-h-[76px] resize-none')}
          placeholder="예: 내년 봄에 다시 연락 주기로 함"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>
    </Modal>
  );
}

// ---------------------------------------------------------------------------

const SOURCES: LeadSource[] = ['phone', 'walk_in', 'referral', 'social', 'form'];

/**
 * A phone or walk-in enquiry. Only the number is required — a parent who rang
 * off before giving the child's name is still a family to call back.
 */
export function LeadComposer({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (fields: Partial<Lead>) => void;
}) {
  const [phone, setPhone] = useState('');
  const [child, setChild] = useState('');
  const [age, setAge] = useState('');
  const [parent, setParent] = useState('');
  const [source, setSource] = useState<LeadSource>('phone');
  const [memo, setMemo] = useState('');

  const valid = phone.replace(/\D/g, '').length >= 9;

  return (
    <Modal
      open={open}
      onClose={onClose}
      variant="sheet"
      title="문의 직접 등록"
      footer={
        <PrimaryButton
          disabled={!valid}
          onClick={() => {
            onSubmit({
              parentPhone: phone.trim(),
              childName: child.trim() || '이름 미상',
              ageLabel: age.trim(),
              parentName: parent.trim(),
              source,
              memo: memo.trim(),
            });
            setPhone('');
            setChild('');
            setAge('');
            setParent('');
            setMemo('');
          }}
        >
          등록하기
        </PrimaryButton>
      }
    >
      <Field label="연락처" hint="이것만 있으면 저장돼요">
        <input
          className={inputClass}
          type="tel"
          inputMode="tel"
          placeholder="010-0000-0000"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </Field>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <input className={inputClass} placeholder="아이 이름" value={child} onChange={(e) => setChild(e.target.value)} />
        <input className={inputClass} placeholder="나이 (9살 / U9)" value={age} onChange={(e) => setAge(e.target.value)} />
      </div>
      <input
        className={cn(inputClass, 'mt-3')}
        placeholder="보호자 성함"
        value={parent}
        onChange={(e) => setParent(e.target.value)}
      />
      <Field label="어떻게 알고 왔나요">
        <Pills
          options={SOURCES.map((s) => [s, SOURCE_LABEL[s]] as const)}
          pressed={source}
          onPick={setSource}
        />
      </Field>
      <Field label="메모" hint="선택">
        <textarea
          className={cn(inputClass, 'min-h-[76px] resize-none')}
          placeholder="통화에서 들은 내용을 그대로"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
        />
      </Field>
    </Modal>
  );
}
