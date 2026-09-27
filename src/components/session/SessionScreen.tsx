/**
 * One class on one day.
 *
 * What the coach sees first is the session's name — the thing today is about —
 * and one button for whatever comes next. The blocks, the goal sentence and
 * the way to edit them sit behind 더 보기. A day with no session yet shows the
 * one button that fixes that.
 */

import { CheckCircle2, ChevronRight } from 'lucide-react';
import type { Class, ISODate } from '@/types';
import { useApp } from '@/store/AppContext';
import { TODAY } from '@/data/dates';
import { fromMinutes } from '@/data/today';
import { planFor, sessionDuration } from '@/data/selectors';
import { formatDateKo } from '@/lib/format';
import { AbilityTag, BlockList, DetailHeader, More, useSessionOf } from './parts';

interface SessionScreenProps {
  cls: Class;
  date: ISODate;
  backLabel: string;
  onBack: () => void;
  onPick: () => void;
  onEditBlocks: () => void;
  onRecord: () => void;
  onOpenClass: () => void;
}

export function SessionScreen({
  cls,
  date,
  backLabel,
  onBack,
  onPick,
  onEditBlocks,
  onRecord,
  onOpenClass,
}: SessionScreenProps) {
  const { state, blockMap } = useApp();
  const plan = planFor(state.sessionPlans, cls.id, date);
  const session = useSessionOf(plan?.templateId);
  const items = plan?.items.filter((i) => i.blockId) ?? [];
  const minutes = sessionDuration(items, blockMap);

  const logs = state.attendanceLogs.filter((l) => l.classId === cls.id && l.date === date);
  const done = plan?.status === 'completed' || logs.length > 0;
  const present = logs.filter((l) => l.status === 'present').length;
  const canRecord = date <= TODAY;

  const [h, m] = cls.schedule.startTime.split(':').map(Number);
  const end = fromMinutes((h || 0) * 60 + (m || 0) + cls.schedule.durationMin);

  return (
    <div>
      <DetailHeader
        backLabel={backLabel}
        onBack={onBack}
        // The class name leads to the class page — its other days and details.
        title={
          <button type="button" onClick={onOpenClass} className="flex items-center gap-1 text-left">
            {cls.title}
            <ChevronRight size={22} strokeWidth={2.4} className="shrink-0 text-stone" />
          </button>
        }
        meta={`${formatDateKo(date)} · ${cls.schedule.startTime}–${end}`}
      />

      <div className="px-5 py-5 sm:px-7 lg:max-w-2xl lg:px-10">
        <section className="rounded-xl bg-gradient-to-br from-[#DCEEE4] to-[#F1F7F3] p-5">
          {items.length > 0 ? (
            <>
              <div className="flex items-center gap-2">
                {session && <AbilityTag ability={session.ability} className="bg-canvas/80" />}
                <span className="text-[13px] text-slate">
                  블록 {items.length}개 · {minutes}분
                </span>
              </div>
              <h2 className="mt-2.5 text-[23px] font-bold leading-[1.25] tracking-[-0.02em] text-ink">
                {session?.title ?? '직접 구성한 수업'}
              </h2>

              <More className="mt-4">
                {session && (
                  <p className="mb-3 text-[14px] leading-[1.6] text-charcoal">{session.goal}</p>
                )}
                <BlockList items={items} />
                <div className="mt-3 flex gap-4">
                  <button
                    type="button"
                    onClick={onEditBlocks}
                    className="text-[13.5px] font-semibold text-primary"
                  >
                    블록 편집
                  </button>
                  <button
                    type="button"
                    onClick={onPick}
                    className="text-[13.5px] font-semibold text-primary"
                  >
                    세션 바꾸기
                  </button>
                </div>
              </More>
            </>
          ) : (
            <>
              <h2 className="text-[21px] font-bold text-ink">아직 세션이 없어요</h2>
              <button type="button" onClick={onPick} className="btn-primary mt-4 px-6 py-3">
                세션 고르기
              </button>
            </>
          )}
        </section>

        <div className="mt-5 space-y-2">
          {done ? (
            <>
              <p className="flex items-center justify-center gap-1.5 py-2 text-[14px] font-semibold text-primary">
                <CheckCircle2 size={16} />
                완료 · 출석 {present}/{logs.length}
              </p>
              <button type="button" onClick={onRecord} className="btn-secondary w-full py-3">
                기록 수정
              </button>
            </>
          ) : canRecord ? (
            // With no session yet, 세션 고르기 is the primary action; wrapping
            // up without one is still allowed, just not shouted.
            <button
              type="button"
              onClick={onRecord}
              className={
                items.length > 0
                  ? 'btn-primary w-full py-3.5 text-[15px]'
                  : 'btn-secondary w-full py-3'
              }
            >
              수업 마무리
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
