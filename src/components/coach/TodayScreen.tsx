import type { ReactNode } from 'react';
import { AlertTriangle, CalendarDays, ChevronRight, MapPin, Users } from 'lucide-react';
import type { Class } from '@/types';
import { useApp } from '@/store/AppContext';
import { TODAY } from '@/data/dates';
import { classesForCoach, daysUntilNextSession, studentsInClass } from '@/data/selectors';
import { formatDateKo, formatSchedule } from '@/lib/format';
import { cn } from '@/lib/cn';

export function TodayScreen({ onPickClass }: { onPickClass: (cls: Class) => void }) {
  const { state, getCoach } = useApp();
  const coach = getCoach(state.currentCoachId ?? '');

  // Soonest-first. A class meeting today sorts to the front with offset 0.
  const myClasses = classesForCoach(state.classes, state.currentCoachId ?? '')
    .map((cls) => ({ cls, inDays: daysUntilNextSession(cls) ?? 99 }))
    .sort((a, b) => a.inDays - b.inDays);

  const todays = myClasses.filter((c) => c.inDays === 0);
  const upcoming = myClasses.filter((c) => c.inDays !== 0);

  const totalStudents = myClasses.reduce(
    (sum, { cls }) => sum + studentsInClass(state.students, cls.id).length,
    0,
  );

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
            {todays.length > 0
              ? `오늘 수업 ${todays.length}개가 예정되어 있습니다. 블록을 골라 15초 만에 설계하세요.`
              : '오늘은 예정된 수업이 없습니다. 다음 수업을 미리 설계해 두세요.'}
          </p>

          <div className="mt-6 flex gap-2">
            <span className="rounded-full border border-hairline bg-surface-soft px-4 py-2 text-[13px] font-semibold text-charcoal">
              담당 {myClasses.length}개 반
            </span>
            <span className="rounded-full border border-hairline bg-surface-soft px-4 py-2 text-[13px] font-semibold text-charcoal">
              원생 {totalStudents}명
            </span>
          </div>
        </div>
      </header>

      <div className="space-y-8 px-5 py-7 sm:px-8 lg:px-12 lg:py-10">
        {todays.length > 0 && (
          <Section label="오늘의 수업">
            {todays.map(({ cls, inDays }) => (
              <ClassCard key={cls.id} cls={cls} inDays={inDays} onPick={onPickClass} />
            ))}
          </Section>
        )}

        {upcoming.length > 0 && (
          <Section label={todays.length > 0 ? '담당 클래스' : '다가오는 수업'}>
            {upcoming.map(({ cls, inDays }) => (
              <ClassCard key={cls.id} cls={cls} inDays={inDays} onPick={onPickClass} />
            ))}
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="eyebrow-ink mb-3.5">{label}</h2>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
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
  const alreadyLogged =
    isToday && state.attendanceLogs.some((l) => l.classId === cls.id && l.date === TODAY);

  const whenLabel = isToday ? '오늘' : inDays === 1 ? '내일' : `${inDays}일 뒤`;

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
            {alreadyLogged && (
              <span className="shrink-0 rounded-full bg-tint-mint px-2 py-0.5 text-[11px] font-semibold text-brand-green">
                기록 완료
              </span>
            )}
          </div>
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

      <div className="mt-3 flex items-center gap-3 border-t border-hairline-soft pt-3">
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
        <span className="ml-auto text-[13px] font-semibold text-primary">
          {isToday ? '수업 설계 →' : '미리 설계 →'}
        </span>
      </div>
    </button>
  );
}
