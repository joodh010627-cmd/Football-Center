/**
 * 세션 고르기.
 *
 * Five ability chips and a list of session names. Opening one shows its goal
 * and blocks; [이 세션으로] saves it and goes back. That is the whole of
 * planning a day — the blocks come along as the default.
 */

import { useMemo, useState } from 'react';
import type { Ability, Class, ISODate } from '@/types';
import { itemsForSession, useApp } from '@/store/AppContext';
import { planFor, sessionsFor } from '@/data/selectors';
import { formatDateKo } from '@/lib/format';
import { AbilityChips, DetailHeader, SessionRow } from './parts';

interface SessionPickerScreenProps {
  cls: Class;
  date: ISODate;
  backLabel: string;
  onBack: () => void;
  /** Called after the choice is saved. */
  onChosen: () => void;
  onBuildOwn: () => void;
}

export function SessionPickerScreen({
  cls,
  date,
  backLabel,
  onBack,
  onChosen,
  onBuildOwn,
}: SessionPickerScreenProps) {
  const { state, dispatch, blockMap } = useApp();
  const current = planFor(state.sessionPlans, cls.id, date)?.templateId ?? null;
  const [ability, setAbility] = useState<Ability | 'all'>('all');

  const sessions = useMemo(
    () => sessionsFor(state.sessionTemplates, ability, cls.ageGroup),
    [state.sessionTemplates, ability, cls.ageGroup],
  );

  return (
    <div>
      <DetailHeader
        backLabel={backLabel}
        onBack={onBack}
        title="세션 고르기"
        meta={`${cls.title} · ${formatDateKo(date)}`}
      />

      <div className="px-5 py-5 sm:px-7 lg:max-w-2xl lg:px-10">
        <AbilityChips value={ability} onChange={setAbility} />

        <ul className="mt-4 overflow-hidden rounded-lg border border-hairline bg-canvas">
          {sessions.map((t) => (
            <SessionRow
              key={t.id}
              template={t}
              current={t.id === current}
              actionLabel={t.id === current ? '이 세션 유지' : '이 세션으로'}
              onAction={() => {
                dispatch({
                  type: 'plan/save',
                  classId: cls.id,
                  date,
                  items: itemsForSession(t, blockMap),
                  templateId: t.id,
                });
                onChosen();
              }}
            />
          ))}
          {sessions.length === 0 && (
            <li className="px-4 py-8 text-center text-[14px] text-steel">
              이 연령에 맞는 세션이 없어요
            </li>
          )}
        </ul>

        <button
          type="button"
          onClick={onBuildOwn}
          className="mt-4 w-full py-2 text-center text-[13.5px] font-semibold text-steel hover:text-ink"
        >
          블록으로 직접 구성하기
        </button>
      </div>
    </div>
  );
}
