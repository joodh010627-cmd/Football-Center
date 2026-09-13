/**
 * 수업 — the coach app's front door.
 *
 * This used to be 오늘, and the screen was honest about what the app could do:
 * design the session in front of you and run it. But a coach who can only ever
 * act on today has no plan, just a queue — and an owner asking "what are you
 * doing with U9 next month" had nothing to look at.
 *
 * So the entry point is the list of classes, and every class opens a month. What
 * each card carries is therefore not "is this today" but "how much of this class
 * is planned" — the question a list of classes should answer.
 */

import { AlertTriangle, CalendarDays, ChevronRight, MapPin, Users } from 'lucide-react';
import type { Class } from '@/types';
import { useApp } from '@/store/AppContext';
import { THIS_MONTH, TODAY } from '@/data/dates';
import {
  buildCalendar,
  classesForCoach,
  curriculumForClass,
  daysUntilNextSession,
  monthSummary,
  studentsInClass,
} from '@/data/selectors';
import { formatDateKo, formatSchedule } from '@/lib/format';
import { cn } from '@/lib/cn';
import { TRACK_META } from '@/components/curriculum/curriculumMeta';

export function ClassListScreen({ onPickClass }: { onPickClass: (cls: Class) => void }) {
  const { state, getCoach } = useApp();
  const coach = getCoach(state.currentCoachId ?? '');

  // Soonest-first. A class meeting today sorts to the front with offset 0.
  const myClasses = classesForCoach(state.classes, state.currentCoachId ?? '')
    .map((cls) => ({ cls, inDays: daysUntilNextSession(cls) ?? 99 }))
    .sort((a, b) => a.inDays - b.inDays);

  const totalStudents = myClasses.reduce(
    (sum, { cls }) => sum + studentsInClass(state.students, cls.id).length,
    0,
  );

  // One number for the whole month across every class: how many sessions still
  // have nobody's plan on them.
  const unplanned = myClasses.reduce((sum, { cls }) => {
    const counts = monthSummary(buildCalendar(cls, state, THIS_MONTH));
    return sum + counts.unplanned;
  }, 0);

  return (
    <div>
      <header className="relative overflow-hidden border-b border-hairline bg-canvas px-5 pb-8 pt-10 sm:px-8 lg:px-12 lg:pb-9 lg:pt-14">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(115%_150%_at_92%_-10%,#EDF2EE_0%,transparent_60%)]" />

        <div className="relative">
          <p className="eyebrow-ink">{formatDateKo(TODAY)}</p>
          <h1 className="mt-3 text-[27px] font-semibold leading-[1.16] tracking-tightest text-ink lg:text-[38px]">
            안녕하세요, {coach?.name ?? ''} 코치님
          </h1>
          <p className="mt-3 max-w-lg text-sm leading-[1.7] text-slate lg:text-[15px]">
            {unplanned > 0
              ? `이번 달 아직 설계되지 않은 수업이 ${unplanned}회 남았습니다. 클래스를 열어 달력에서 채워 넣으세요.`
              : '이번 달 수업이 모두 설계되어 있습니다. 클래스를 열면 달력에서 확인할 수 있습니다.'}
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            <span className="rounded-full border border-hairline bg-surface-soft px-4 py-2 text-[13px] font-semibold text-charcoal">
              담당 {myClasses.length}개 반
            </span>
            <span className="rounded-full border border-hairline bg-surface-soft px-4 py-2 text-[13px] font-semibold text-charcoal">
              원생 {totalStudents}명
            </span>
            {unplanned > 0 && (
              <span className="rounded-full bg-tint-peach px-4 py-2 text-[13px] font-semibold text-brand-orange-deep">
                미설계 {unplanned}회
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="px-5 py-7 sm:px-8 lg:px-12 lg:py-10">
        <h2 className="eyebrow-ink mb-3.5">담당 클래스</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {myClasses.map(({ cls, inDays }) => (
            <ClassCard key={cls.id} cls={cls} inDays={inDays} onPick={onPickClass} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ClassCard({
  cls,
  inDays,
  onPick,
}: {
  cls: Class;
  inDays: number;
  onPick: (cls: Class) => void;
}) {
  const { state } = useApp();
  const roster = studentsInClass(state.students, cls.id);
  const atRisk = roster.filter((s) => s.status === 'at_risk').length;
  const isToday = inDays === 0;

  const curriculum = curriculumForClass(state.curricula, cls);
  const counts = monthSummary(buildCalendar(cls, state, THIS_MONTH));
  const sessions = counts.unplanned + counts.scheduled + counts.completed;

  const whenLabel = isToday ? '오늘 수업' : inDays === 1 ? '내일' : `${inDays}일 뒤`;

  return (
    <button
      type="button"
      onClick={() => onPick(cls)}
      className={cn(
        'w-full rounded-lg border bg-canvas p-4 text-left transition-all duration-150 hover:-translate-y-0.5 hover:shadow-card active:translate-y-0',
        isToday ? 'border-primary/40 shadow-card' : 'border-hairline',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="truncate text-[16px] font-semibold text-ink">{cls.title}</h3>
            <span
              className={cn(
                'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                isToday ? 'bg-primary text-white' : 'bg-surface text-steel',
              )}
            >
              {whenLabel}
            </span>
          </div>

          {curriculum && (
            <p className="mt-1.5 flex items-center gap-1.5 text-[12.5px]">
              <span
                className={cn('h-1.5 w-1.5 shrink-0 rounded-full', TRACK_META[curriculum.track].bar)}
              />
              <span className="truncate font-medium text-charcoal">{curriculum.title}</span>
            </p>
          )}

          <p className="mt-1 flex items-center gap-1 text-[13px] text-slate">
            <CalendarDays size={12} />
            {formatSchedule(cls.schedule.days, cls.schedule.startTime)} · {cls.schedule.durationMin}분
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-[13px] text-steel">
            <MapPin size={12} />
            {cls.venue}
          </p>
        </div>
        <ChevronRight size={18} className="mt-1 shrink-0 text-stone" />
      </div>

      {/* This month at a glance — the reason to open the calendar. */}
      <div className="mt-3 border-t border-hairline-soft pt-3">
        <div className="flex items-center justify-between gap-2 text-[12px] font-medium">
          <span className="text-steel">이번 달 {sessions}회</span>
          <span className="flex items-center gap-2.5">
            <Legend tone="completed" count={counts.completed} label="완료" />
            <Legend tone="scheduled" count={counts.scheduled} label="등록" />
            <Legend tone="unplanned" count={counts.unplanned} label="미등록" />
          </span>
        </div>

        {sessions > 0 && (
          <div className="mt-2 flex h-1.5 gap-0.5 overflow-hidden rounded-full">
            <Bar count={counts.completed} total={sessions} className="bg-primary" />
            <Bar count={counts.scheduled} total={sessions} className="bg-primary-soft" />
            <Bar count={counts.unplanned} total={sessions} className="bg-hairline" />
          </div>
        )}

        <div className="mt-3 flex items-center gap-3">
          <span className="flex items-center gap-1 text-[13px] font-medium text-charcoal">
            <Users size={13} />
            {roster.length}명
          </span>
          {atRisk > 0 && (
            <span className="flex items-center gap-1 text-[13px] font-semibold text-error">
              <AlertTriangle size={13} />
              관리 필요 {atRisk}명
            </span>
          )}
          <span className="ml-auto text-[13px] font-semibold text-primary">달력 열기 →</span>
        </div>
      </div>
    </button>
  );
}

const LEGEND_DOT = {
  completed: 'bg-primary',
  scheduled: 'bg-primary-soft',
  unplanned: 'bg-hairline-strong',
} as const;

function Legend({
  tone,
  count,
  label,
}: {
  tone: keyof typeof LEGEND_DOT;
  count: number;
  label: string;
}) {
  return (
    <span className={cn('flex items-center gap-1', count === 0 && 'opacity-40')}>
      <span className={cn('h-1.5 w-1.5 rounded-full', LEGEND_DOT[tone])} />
      <span className="tabular-nums text-charcoal">{count}</span>
      <span className="hidden text-stone sm:inline">{label}</span>
    </span>
  );
}

function Bar({
  count,
  total,
  className,
}: {
  count: number;
  total: number;
  className: string;
}) {
  if (count === 0) return null;
  return <span className={cn('block', className)} style={{ flex: count / total }} />;
}
