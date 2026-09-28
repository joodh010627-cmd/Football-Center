/**
 * One class.
 *
 * The next session and the last few, as rows you can open. The month grid that
 * used to live here — four cell states and a legend — moved to 일정, where a
 * calendar answers the question people bring to it. Who teaches, where, and
 * how many is 더 보기.
 */

import { ChevronRight } from 'lucide-react';
import type { Class, ISODate } from '@/types';
import { useApp } from '@/store/AppContext';
import { nextMeeting, pastSessions, planFor, studentsInClass } from '@/data/selectors';
import { formatDateKo, formatSchedule } from '@/lib/format';
import { Section } from '@/components/shell/Shell';
import { AbilityTag, DetailHeader, More } from './parts';

interface ClassDetailScreenProps {
  cls: Class;
  backLabel: string;
  onBack: () => void;
  onOpenSession: (date: ISODate) => void;
}

export function ClassDetailScreen({
  cls,
  backLabel,
  onBack,
  onOpenSession,
}: ClassDetailScreenProps) {
  const { state, slice, getCoach } = useApp();
  const next = nextMeeting(cls);
  const past = pastSessions(slice, cls);
  const roster = studentsInClass(state.students, cls.id).filter((s) => s.status !== 'inactive');

  return (
    <div>
      <DetailHeader
        backLabel={backLabel}
        onBack={onBack}
        title={cls.title}
        meta={`${formatSchedule(cls.schedule.days, cls.schedule.startTime)} · ${cls.schedule.durationMin}분`}
      />

      <div className="px-5 py-5 sm:px-7 lg:max-w-2xl lg:px-10">
        {next && (
          <Section title="다음 수업">
            <ul className="overflow-hidden rounded-lg border border-hairline bg-canvas">
              <SessionDayRow cls={cls} date={next} onOpen={() => onOpenSession(next)} />
            </ul>
          </Section>
        )}

        <Section title="지난 수업">
          {past.length > 0 ? (
            <ul className="overflow-hidden rounded-lg border border-hairline bg-canvas">
              {past.map((p) => (
                <SessionDayRow
                  key={p.date}
                  cls={cls}
                  date={p.date}
                  attendance={p.total > 0 ? `${p.present}/${p.total}` : '기록 없음'}
                  onOpen={() => onOpenSession(p.date)}
                />
              ))}
            </ul>
          ) : (
            <p className="text-[14px] text-steel">아직 지난 수업이 없어요</p>
          )}
        </Section>

        <More className="mt-7" label="클래스 정보">
          <dl className="grid grid-cols-[72px_1fr] gap-y-2 text-[14px]">
            <dt className="text-steel">코치</dt>
            <dd className="text-ink">{getCoach(cls.coachId)?.name ?? '미배정'}</dd>
            <dt className="text-steel">장소</dt>
            <dd className="text-ink">{cls.venue}</dd>
            <dt className="text-steel">연령</dt>
            <dd className="text-ink">{cls.ageGroup}</dd>
            <dt className="text-steel">원생</dt>
            <dd className="text-ink">
              {roster.length}명 / 정원 {cls.capacity}명
            </dd>
          </dl>
        </More>
      </div>
    </div>
  );
}

function SessionDayRow({
  cls,
  date,
  attendance,
  onOpen,
}: {
  cls: Class;
  date: ISODate;
  attendance?: string;
  onOpen: () => void;
}) {
  const { state, getTemplate } = useApp();
  const plan = planFor(state.sessionPlans, cls.id, date);
  const session = plan?.templateId ? getTemplate(plan.templateId) : undefined;
  const planned = Boolean(plan?.items.some((i) => i.blockId));

  return (
    <li className="border-b border-hairline-soft last:border-b-0">
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-soft"
      >
        <span className="w-[92px] shrink-0 text-[14px] font-semibold tabular-nums text-charcoal">
          {formatDateKo(date)}
        </span>
        <span className="flex min-w-0 flex-1 items-center gap-2">
          {session && <AbilityTag ability={session.ability} />}
          <span className="truncate text-[14.5px] text-ink">
            {session?.title ?? (planned ? '직접 구성' : '목표 미정')}
          </span>
        </span>
        {attendance && (
          <span className="shrink-0 text-[12.5px] tabular-nums text-steel">{attendance}</span>
        )}
        <ChevronRight size={15} className="shrink-0 text-stone" />
      </button>
    </li>
  );
}
