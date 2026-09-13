/**
 * The session, on one page.
 *
 * This screen exists for the half-second between finishing a design and
 * committing it. The old flow went straight from the last block tap into
 * attendance, which is why the app never felt like planning: there was no moment
 * where the coach saw *a session* rather than three slots they had just filled.
 *
 * So: one sheet, whole thing legible at arm's length, and three ways out —
 * register it to the calendar, go back and change it, or throw it away. Nothing
 * is written until [달력에 등록].
 */

import { CalendarCheck, Clock, MapPin, PencilLine, Target, Trash2, Users } from 'lucide-react';
import type { Class, ISODate } from '@/types';
import { useApp } from '@/store/AppContext';
import { TODAY } from '@/data/dates';
import {
  curriculumForClass,
  sessionDuration,
  studentsInClass,
} from '@/data/selectors';
import { formatDateKo, formatSchedule } from '@/lib/format';
import { cn } from '@/lib/cn';
import { TRACK_META } from '@/components/curriculum/curriculumMeta';
import { CATEGORY_META } from './TrainingBlockCard';

interface SessionSheetScreenProps {
  cls: Class;
  date: ISODate;
  onRegister: () => void;
  onEdit: () => void;
  onDiscard: () => void;
}

export function SessionSheetScreen({
  cls,
  date,
  onRegister,
  onEdit,
  onDiscard,
}: SessionSheetScreenProps) {
  const { state, blockMap, getCoach, getTemplate } = useApp();
  const draft = state.draft;

  if (!draft) {
    return (
      <div className="px-5 py-20 text-center text-sm text-slate">
        표시할 설계가 없습니다.
      </div>
    );
  }

  const items = draft.items.filter((i) => i.blockId);
  const totalMin = sessionDuration(items, blockMap);
  const overrun = totalMin - cls.schedule.durationMin;
  const curriculum = curriculumForClass(state.curricula, cls);
  const template = draft.templateId ? getTemplate(draft.templateId) : undefined;
  const coach = getCoach(state.currentCoachId ?? '');
  const roster = studentsInClass(state.students, cls.id);

  const already = state.sessionPlans.some((p) => p.classId === cls.id && p.date === date);

  return (
    <div className="px-5 py-7 sm:px-8 lg:px-12 lg:py-10">
      <div className="mx-auto max-w-3xl animate-pop-in">
        {/* --- The sheet ------------------------------------------------ */}
        <article className="overflow-hidden rounded-lg border border-hairline bg-canvas shadow-card">
          {/* Statement band — the only dark surface on the coach's side, used
              once, so this screen reads as a document rather than a form. */}
          <header className="relative overflow-hidden bg-pitch-deep px-6 py-7 text-white sm:px-8">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_160%_at_88%_-20%,rgba(198,166,100,0.22)_0%,transparent_62%)]" />

            <div className="relative">
              <p className="text-[11px] font-semibold uppercase tracking-label text-gold">
                Session plan · {cls.title}
              </p>
              <h1 className="mt-3 text-[28px] font-semibold leading-[1.15] tracking-tightest sm:text-[36px]">
                {formatDateKo(date)}
              </h1>

              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] text-white/70">
                <span className="flex items-center gap-1.5">
                  <Clock size={12} />
                  {formatSchedule(cls.schedule.days, cls.schedule.startTime)}
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin size={12} />
                  {cls.venue}
                </span>
                <span className="flex items-center gap-1.5">
                  <Users size={12} />
                  원생 {roster.length}명
                </span>
                <span>{coach?.name} 코치</span>
              </div>

              <div className="mt-6 flex items-end gap-6">
                <span>
                  <span className="block text-[10.5px] font-semibold uppercase tracking-label text-white/40">
                    총 진행
                  </span>
                  <span className="mt-1 block text-[32px] font-semibold leading-none tracking-tightest text-gold">
                    {totalMin}
                    <span className="ml-1 text-[14px] font-medium text-white/60">분</span>
                  </span>
                </span>
                <span>
                  <span className="block text-[10.5px] font-semibold uppercase tracking-label text-white/40">
                    블록
                  </span>
                  <span className="mt-1 block text-[32px] font-semibold leading-none tracking-tightest">
                    {items.length}
                    <span className="ml-1 text-[14px] font-medium text-white/60">개</span>
                  </span>
                </span>
              </div>
            </div>
          </header>

          {/* --- Curriculum lineage ----------------------------------- */}
          {curriculum && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-hairline bg-surface-soft px-6 py-3 text-[12.5px] sm:px-8">
              <span
                className={cn('h-2 w-2 shrink-0 rounded-full', TRACK_META[curriculum.track].bar)}
              />
              <span className="font-semibold text-ink">{curriculum.title}</span>
              {template ? (
                <>
                  <span className="text-stone">›</span>
                  <span className="font-medium text-charcoal">
                    {template.week}주차 · {template.title}
                  </span>
                  <span className="ml-auto rounded-sm bg-tint-lavender px-2 py-[2px] text-[11.5px] font-semibold text-brand-purple-800">
                    표준 세션 준수
                  </span>
                </>
              ) : (
                <>
                  <span className="text-stone">›</span>
                  <span className="text-steel">코치 직접 구성</span>
                </>
              )}
            </div>
          )}

          {/* --- Proportion bar --------------------------------------- */}
          <div className="border-b border-hairline px-6 pt-5 sm:px-8">
            <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
              {items.map((item, i) => {
                const min = item.durationMin ?? blockMap.get(item.blockId!)?.durationMin ?? 0;
                return (
                  <span
                    key={i}
                    className={cn('block', CATEGORY_META[item.category].bar)}
                    style={{ flex: min || 1 }}
                  />
                );
              })}
            </div>
            <p
              className={cn(
                'mt-2 pb-4 text-[12.5px] font-medium',
                overrun > 5 ? 'text-brand-orange-deep' : 'text-steel',
              )}
            >
              {overrun > 5
                ? `수업 시간보다 ${overrun}분 깁니다 — 정리·이동 시간을 감안하세요.`
                : overrun < -10
                  ? `수업 시간보다 ${-overrun}분 짧습니다 — 블록을 하나 더 담을 수 있습니다.`
                  : `수업 ${cls.schedule.durationMin}분에 맞는 구성입니다.`}
            </p>
          </div>

          {/* --- The table -------------------------------------------- */}
          <ol className="divide-y divide-hairline-soft">
            {items.map((item, index) => {
              const block = blockMap.get(item.blockId!);
              const meta = CATEGORY_META[item.category];
              const min = item.durationMin ?? block?.durationMin ?? 0;
              const start = items
                .slice(0, index)
                .reduce(
                  (sum, prev) =>
                    sum + (prev.durationMin ?? blockMap.get(prev.blockId!)?.durationMin ?? 0),
                  0,
                );

              return (
                <li key={index} className="flex gap-4 px-6 py-4 sm:px-8">
                  <div className="w-[54px] shrink-0 text-right">
                    <span className="block text-[15px] font-semibold tabular-nums text-ink">
                      {offsetClock(cls.schedule.startTime, start)}
                    </span>
                    <span className="mt-0.5 block text-[11.5px] font-medium tabular-nums text-stone">
                      {min}분
                    </span>
                  </div>

                  <span className={cn('w-[3px] shrink-0 rounded-full', meta.bar)} />

                  <div className="min-w-0 flex-1">
                    <span
                      className={cn(
                        'text-[10.5px] font-semibold uppercase tracking-label',
                        meta.accent,
                      )}
                    >
                      {index + 1} · {meta.label}
                    </span>
                    <h3 className="mt-1 text-[16px] font-semibold leading-[1.35] text-ink">
                      {block?.title ?? '삭제된 블록'}
                    </h3>
                    {block && (
                      <p className="mt-1 text-[13px] leading-[1.6] text-slate">
                        {block.description}
                      </p>
                    )}
                    {block && block.equipment.length > 0 && (
                      <p className="mt-1.5 text-[12px] text-stone">
                        준비물 — {block.equipment.join(', ')}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>

          {/* Everything the coach must carry onto the pitch, in one line. */}
          <footer className="border-t border-hairline bg-surface-soft px-6 py-4 sm:px-8">
            <p className="flex items-start gap-2 text-[12.5px] leading-[1.6] text-charcoal">
              <Target size={13} className="mt-[3px] shrink-0 text-primary" />
              <span>
                <span className="font-semibold">전체 준비물</span> —{' '}
                {allEquipment().length > 0 ? allEquipment().join(', ') : '별도 준비물 없음'}
              </span>
            </p>
          </footer>
        </article>

        {/* --- Commit -------------------------------------------------- */}
        <div className="mt-5 rounded-lg border border-hairline bg-canvas p-4 sm:p-5">
          <p className="text-[13px] leading-[1.6] text-slate">
            {already
              ? '이미 등록된 날짜입니다. 등록하면 기존 설계를 이 구성으로 덮어씁니다.'
              : '등록하면 달력의 해당일이 활성화되고, 수업 당일 여기서 출결 기록을 시작할 수 있습니다.'}
            {date > TODAY && ' 아직 오지 않은 수업이므로 출결은 수업일부터 기록됩니다.'}
          </p>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onRegister}
              disabled={items.length === 0}
              className="btn-primary flex-1 py-3.5 text-[15px]"
            >
              <CalendarCheck size={16} strokeWidth={2.5} />
              달력에 등록
            </button>
            <button type="button" onClick={onEdit} className="btn-secondary py-3.5 sm:px-6">
              <PencilLine size={15} />
              수정
            </button>
            <button
              type="button"
              onClick={onDiscard}
              className="flex items-center justify-center gap-1.5 rounded-full px-5 py-3.5 text-sm font-semibold text-steel transition-colors hover:text-error"
            >
              <Trash2 size={15} />
              취소
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  function allEquipment(): string[] {
    const seen = new Set<string>();
    for (const item of items) {
      const block = item.blockId ? blockMap.get(item.blockId) : undefined;
      for (const piece of block?.equipment ?? []) seen.add(piece);
    }
    return [...seen];
  }
}

/** `16:00` + 30 → `16:30`. Session sheets read as a run of clock times, not as
 *  a list of durations the coach has to add up on the pitch. */
function offsetClock(startTime: string, offsetMin: number): string {
  const [h, m] = startTime.split(':').map(Number);
  const total = h * 60 + m + offsetMin;
  const hh = `${Math.floor(total / 60) % 24}`.padStart(2, '0');
  const mm = `${total % 60}`.padStart(2, '0');
  return `${hh}:${mm}`;
}
