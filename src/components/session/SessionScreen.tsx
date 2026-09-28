/**
 * 수업 — one class on one day.
 *
 * What the coach sees first is today's goal, lit, with where the lesson is in
 * its day (준비 → 수업 → 기록) under it. The 훈련 블록 are the lesson's running
 * order, so they are listed in full rather than folded away — on the pitch this
 * is the screen a coach glances at between drills. A day not yet prepared shows
 * the one button that fixes that.
 */

import { CheckCircle2, ChevronRight } from 'lucide-react';
import type { Class, ISODate } from '@/types';
import { useApp } from '@/store/AppContext';
import { TODAY } from '@/data/dates';
import { fromMinutes, minutesNow, stateOf } from '@/data/today';
import { planFor, sessionDuration } from '@/data/selectors';
import { formatDateKo } from '@/lib/format';
import { cn } from '@/lib/cn';
import { AbilityTag, BlockList, DetailHeader, LessonProgress, useSessionOf } from './parts';

interface SessionScreenProps {
  cls: Class;
  date: ISODate;
  backLabel: string;
  onBack: () => void;
  /** Open 수업 준비 — to prepare the day, or to change what was prepared. */
  onPrepare: () => void;
  onRecord: () => void;
  onOpenClass: () => void;
}

export function SessionScreen({
  cls,
  date,
  backLabel,
  onBack,
  onPrepare,
  onRecord,
  onOpenClass,
}: SessionScreenProps) {
  const { state, blockMap } = useApp();
  const plan = planFor(state.sessionPlans, cls.id, date);
  const goal = useSessionOf(plan?.templateId);
  const items = plan?.items.filter((i) => i.blockId) ?? [];
  const minutes = sessionDuration(items, blockMap);
  const planned = items.length > 0;

  const logs = state.attendanceLogs.filter((l) => l.classId === cls.id && l.date === date);
  const lesson = stateOf(cls, plan, state.attendanceLogs, date, TODAY, minutesNow());
  const done = lesson === 'done';
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
        <section className={cn('mesh rounded-2xl p-5', lesson === 'needs_log' && 'mesh-warm')}>
          {planned ? (
            <>
              <div className="flex items-center gap-2">
                {goal && <AbilityTag ability={goal.ability} className="bg-canvas/80" />}
                <span className="text-[13px] text-slate">오늘의 목표</span>
              </div>
              <h2 className="mt-2.5 text-[24px] font-bold leading-[1.25] tracking-[-0.02em] text-ink">
                {goal?.title ?? '직접 구성한 수업'}
              </h2>
              {goal && (
                <p className="mt-1.5 text-[15px] leading-[1.55] text-charcoal">{goal.goal}</p>
              )}
            </>
          ) : (
            <>
              <h2 className="text-[22px] font-bold leading-[1.3] text-ink">아직 준비 전이에요</h2>
              <p className="mt-1.5 text-[14.5px] text-charcoal">
                누가 오는지, 지난 수업에서 무엇을 했는지 보고 목표를 정해요.
              </p>
            </>
          )}
          <LessonProgress state={lesson} planned={planned} className="mt-5" />
          {!planned && (
            <button type="button" onClick={onPrepare} className="btn-primary mt-5 px-6 py-3 text-[15px]">
              수업 준비
            </button>
          )}
        </section>

        {planned && (
          <section className="mt-7">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-[19px] font-bold tracking-[-0.02em] text-ink">훈련 블록</h2>
              <button
                type="button"
                onClick={onPrepare}
                className="text-[13.5px] font-semibold text-primary"
              >
                수정
              </button>
            </div>
            <p className="mt-1 text-[13px] text-steel">
              {items.length}개 · {minutes}분
            </p>
            <div className="mt-3">
              <BlockList items={items} />
            </div>
          </section>
        )}

        <div className="mt-6 space-y-2">
          {done ? (
            <>
              <p className="flex items-center justify-center gap-1.5 py-2 text-[14px] font-semibold text-primary">
                <CheckCircle2 size={16} />
                기록 완료 · 출석 {present}/{logs.length}
              </p>
              <button type="button" onClick={onRecord} className="btn-secondary w-full py-3">
                기록 수정
              </button>
            </>
          ) : canRecord ? (
            // Before it is prepared, 수업 준비 is the primary action; recording
            // without a plan is still allowed, just not shouted.
            <button
              type="button"
              onClick={onRecord}
              className={
                planned ? 'btn-primary w-full py-3.5 text-[15px]' : 'btn-secondary w-full py-3'
              }
            >
              수업 기록
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
