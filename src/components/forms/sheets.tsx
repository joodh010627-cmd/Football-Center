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
        <PrimaryButton className="w-full" onClick={() => onSubmit(date, classId)}>예약하고 안내 보내기</PrimaryButton>
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
      <Field label="반" hint="선택">
        <Pills
          options={state.classes.map((c) => [c.id, c.title] as const)}
          pressed={classId}
          onPick={(id) => setClassId(id === classId ? '' : id)}
        />
      </Field>
      <p className="mt-5 text-[13.5px] leading-[1.6] text-steel">
        예약 시 보호자에게 체험 안내 알림톡 발송 · 일정 탭에 표시
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
        <PrimaryButton className="w-full"
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
        확정 시 반 명단에 추가됩니다. 수업료는 클럽 → 세부 관리에서 설정합니다.
      </p>
    </Modal>
  );
}

// ---------------------------------------------------------------------------

/** Why families don't join — picked, so the reasons can be counted later. */
const LOST_REASONS = ['거리·시간', '비용', '아이가 원하지 않음', '다른 곳 등록', '연락 두절'];

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
      title="미등록 처리"
      footer={
        <PrimaryButton className="w-full" disabled={!reason} onClick={() => onSubmit(reason)}>
          저장
        </PrimaryButton>
      }
    >
      <p className="text-[14px] leading-[1.6] text-steel">
        기록은 남습니다. 사유는 미등록 통계에 쓰입니다.
      </p>
      <Field label="사유">
        <Pills
          options={LOST_REASONS.map((r) => [r, r] as const)}
          pressed={picked}
          onPick={(r) => setPicked(r === picked ? '' : r)}
        />
      </Field>
      <Field label="메모" hint="선택">
        <textarea
          className={cn(inputClass, 'min-h-[76px] resize-none')}
          placeholder="예: 내년 봄 재연락"
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
        <PrimaryButton className="w-full"
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
      <Field label="연락처" hint="필수">
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
      <Field label="유입 경로">
        <Pills
          options={SOURCES.map((s) => [s, SOURCE_LABEL[s]] as const)}
          pressed={source}
          onPick={setSource}
        />
      </Field>
      <Field label="메모" hint="선택">
        <textarea
          className={cn(inputClass, 'min-h-[76px] resize-none')}
          placeholder="통화 내용"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
        />
      </Field>
    </Modal>
  );
}
