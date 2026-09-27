/**
 * 블록 편집 — the escape hatch under a session.
 *
 * Most days never come here: picking a session already gave the blocks. When
 * a coach does want to change the hour, the list is the plan in order, a tap on
 * a block opens its minutes and order, and [블록 추가] opens the library under
 * the same five ability chips as everywhere else.
 */

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Minus, Plus, X } from 'lucide-react';
import type { Ability, Class, ID, ISODate, SessionItem } from '@/types';
import { useApp } from '@/store/AppContext';
import { blocksFor, planFor, sessionDuration } from '@/data/selectors';
import { cn } from '@/lib/cn';
import { AbilityChips, AbilityTag, DetailHeader, useSessionOf } from './parts';

interface BlockEditorScreenProps {
  cls: Class;
  date: ISODate;
  backLabel: string;
  onBack: () => void;
  onSaved: () => void;
}

export function BlockEditorScreen({
  cls,
  date,
  backLabel,
  onBack,
  onSaved,
}: BlockEditorScreenProps) {
  const { state, dispatch, blockMap } = useApp();
  const plan = planFor(state.sessionPlans, cls.id, date);
  const session = useSessionOf(plan?.templateId);

  const [items, setItems] = useState<SessionItem[]>(() =>
    (plan?.items ?? []).filter((i) => i.blockId),
  );
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);

  const total = sessionDuration(items, blockMap);
  const over = total > cls.schedule.durationMin;

  const move = (i: number, delta: -1 | 1) => {
    const j = i + delta;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    setItems(next);
    setOpenIndex(j);
  };

  const setMinutes = (i: number, minutes: number) =>
    setItems(items.map((it, k) => (k === i ? { ...it, durationMin: Math.max(5, minutes) } : it)));

  const remove = (i: number) => {
    setItems(items.filter((_, k) => k !== i));
    setOpenIndex(null);
  };

  const add = (ids: ID[]) => {
    setItems([
      ...items,
      ...ids.flatMap((id) => {
        const b = blockMap.get(id);
        return b ? [{ category: b.category, blockId: id, durationMin: null }] : [];
      }),
    ]);
    setAdding(false);
  };

  const save = () => {
    dispatch({
      type: 'plan/save',
      classId: cls.id,
      date,
      items,
      // Changing the blocks doesn't change what the day is for.
      templateId: plan?.templateId ?? null,
    });
    onSaved();
  };

  return (
    <div>
      <DetailHeader
        backLabel={backLabel}
        onBack={onBack}
        title="블록 편집"
        meta={
          <span className={cn(over && 'text-brand-orange-deep')}>
            {session ? `${session.title} · ` : ''}
            {total}분 / 수업 {cls.schedule.durationMin}분
          </span>
        }
      />

      <div className="px-5 py-5 sm:px-7 lg:max-w-2xl lg:px-10">
        {items.length > 0 ? (
          <ol className="overflow-hidden rounded-lg border border-hairline bg-canvas">
            {items.map((item, i) => {
              const block = item.blockId ? blockMap.get(item.blockId) : undefined;
              const minutes = item.durationMin ?? block?.durationMin ?? 0;
              const open = openIndex === i;
              return (
                <li
                  key={`${item.blockId}-${i}`}
                  className="border-b border-hairline-soft last:border-b-0"
                >
                  <button
                    type="button"
                    onClick={() => setOpenIndex(open ? null : i)}
                    aria-expanded={open}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
                  >
                    <span className="w-5 shrink-0 text-[13px] font-semibold tabular-nums text-stone">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink">
                      {block?.title ?? '삭제된 블록'}
                    </span>
                    <span className="shrink-0 text-[13px] tabular-nums text-steel">
                      {minutes}분
                    </span>
                  </button>

                  {open && (
                    <div className="animate-fade-in flex flex-wrap items-center gap-2 px-4 pb-3.5 pl-12">
                      <Stepper
                        label="시간"
                        value={`${minutes}분`}
                        onMinus={() => setMinutes(i, minutes - 5)}
                        onPlus={() => setMinutes(i, minutes + 5)}
                      />
                      <IconButton label="위로" onClick={() => move(i, -1)} disabled={i === 0}>
                        <ArrowUp size={15} />
                      </IconButton>
                      <IconButton
                        label="아래로"
                        onClick={() => move(i, 1)}
                        disabled={i === items.length - 1}
                      >
                        <ArrowDown size={15} />
                      </IconButton>
                      <IconButton label="빼기" onClick={() => remove(i)}>
                        <X size={15} />
                      </IconButton>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="rounded-lg border border-dashed border-hairline-strong px-4 py-8 text-center text-[14px] text-steel">
            블록을 추가해 주세요
          </p>
        )}

        {adding ? (
          <BlockAdder ageGroup={cls.ageGroup} onAdd={add} onCancel={() => setAdding(false)} />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="btn-secondary mt-3 w-full py-3"
          >
            <Plus size={16} strokeWidth={2.4} />
            블록 추가
          </button>
        )}

        <button
          type="button"
          onClick={save}
          disabled={items.length === 0}
          className="btn-primary mt-6 w-full py-3.5 text-[15px]"
        >
          저장
        </button>
      </div>
    </div>
  );
}

/** The library, filtered by ability; tick any number, add them in one go. */
export function BlockAdder({
  ageGroup,
  onAdd,
  onCancel,
  addLabel = '추가',
}: {
  ageGroup?: Class['ageGroup'];
  onAdd: (ids: ID[]) => void;
  onCancel: () => void;
  addLabel?: string;
}) {
  const { state } = useApp();
  const [ability, setAbility] = useState<Ability | 'all'>('all');
  const [picked, setPicked] = useState<ID[]>([]);

  const blocks = useMemo(
    () => blocksFor(state.trainingBlocks, ability, ageGroup),
    [state.trainingBlocks, ability, ageGroup],
  );

  const toggle = (id: ID) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <div className="mt-3 rounded-lg border border-hairline bg-canvas p-4">
      <AbilityChips value={ability} onChange={setAbility} />
      <ul className="mt-3 max-h-[360px] overflow-y-auto">
        {blocks.map((b) => {
          const on = picked.includes(b.id);
          return (
            <li key={b.id}>
              <button
                type="button"
                onClick={() => toggle(b.id)}
                aria-pressed={on}
                className="flex w-full items-center gap-3 rounded-md px-1 py-2.5 text-left hover:bg-surface-soft"
              >
                <span
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                    on ? 'border-primary bg-primary text-white' : 'border-hairline-strong',
                  )}
                >
                  {on && <Check size={12} strokeWidth={3} />}
                </span>
                <span className="min-w-0 flex-1 truncate text-[14.5px] font-medium text-ink">
                  {b.title}
                </span>
                <AbilityTag ability={b.ability} />
                <span className="w-9 shrink-0 text-right text-[12.5px] tabular-nums text-steel">
                  {b.durationMin}분
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1 py-2.5">
          취소
        </button>
        <button
          type="button"
          onClick={() => onAdd(picked)}
          disabled={picked.length === 0}
          className="btn-primary flex-1 py-2.5"
        >
          {picked.length > 0 ? `${picked.length}개 ${addLabel}` : addLabel}
        </button>
      </div>
    </div>
  );
}

function Stepper({
  label,
  value,
  onMinus,
  onPlus,
}: {
  label: string;
  value: string;
  onMinus: () => void;
  onPlus: () => void;
}) {
  return (
    <span className="flex items-center gap-1 rounded-full border border-hairline px-1 py-0.5">
      <button
        type="button"
        onClick={onMinus}
        aria-label={`${label} 줄이기`}
        className="p-1.5 text-steel hover:text-ink"
      >
        <Minus size={14} />
      </button>
      <span className="min-w-[40px] text-center text-[13px] font-semibold tabular-nums text-ink">
        {value}
      </span>
      <button
        type="button"
        onClick={onPlus}
        aria-label={`${label} 늘리기`}
        className="p-1.5 text-steel hover:text-ink"
      >
        <Plus size={14} />
      </button>
    </span>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded-full border border-hairline text-steel transition-colors hover:text-ink disabled:opacity-30"
    >
      {children}
    </button>
  );
}
