/**
 * 클럽 — the people and the standards.
 *
 * Everything that isn't "what am I doing right now" lives behind this tab: the
 * roster, the coaches, the curriculum, the ledger. It is a hub of destinations
 * rather than a screen of content, which is what lets the other four tabs stay
 * single-purpose.
 *
 * It is also where the owner's extra lives. `대표 상세 보기` opens the P&L, the
 * churn queue and the coach evaluations — one entry point, clearly labelled,
 * rather than a second application. A coach never sees the card because
 * `finance:read` is false for them, and even if this branch were edited in the
 * browser the queries behind it return nothing: the guarantee is RLS, the card
 * is just the door.
 */

import { useMemo } from 'react';
import { Activity, BookOpenCheck, ChevronRight, ClipboardList, Crown, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Student } from '@/types';
import { useApp } from '@/store/AppContext';
import { useWorkspace } from '@/store/WorkspaceContext';
import { useSession } from '@/store/AuthContext';
import { can } from '@/lib/permissions';
import { buildAlertQueue, buildProposalQueue, classesForCoach } from '@/data/selectors';
import { formatWonCompact } from '@/lib/format';
import { cn } from '@/lib/cn';
import { ScreenBody, ScreenHeader, Section } from '@/components/shell/Shell';
import type { Route } from '@/components/FootballApp';

interface ClubScreenProps {
  owner: boolean;
  onOpen: (route: Route) => void;
  onOpenStudent: (student: Student) => void;
}

export function ClubScreen({ owner, onOpen, onOpenStudent }: ClubScreenProps) {
  const { state, slice, churnSignals, getFee } = useApp();
  const { activity } = useWorkspace();
  const session = useSession();

  const coachId = state.currentCoachId;
  const myClasses = coachId ? classesForCoach(state.classes, coachId) : state.classes;

  const queue = useMemo(() => buildAlertQueue(slice, churnSignals), [slice, churnSignals]);
  const proposals = useMemo(() => buildProposalQueue(slice), [slice]);
  const revenueAtRisk = queue.reduce((sum, { student }) => sum + getFee(student.id), 0);

  const atRisk = state.students.filter((s) => s.status === 'at_risk');

  return (
    <>
      <ScreenHeader
        eyebrow={owner ? 'Owner' : 'Coach'}
        title={session.academy.name}
        meta={
          <span className="tabular-nums">
            원생 {state.students.length}명 · 코치 {state.coaches.length}명 · 클래스{' '}
            {state.classes.length}개
          </span>
        }
      />

      <ScreenBody>
        {/* --- Owner-only console ---------------------------------------- */}
        {can(session, 'finance:read') && (
          <button
            type="button"
            onClick={() => onOpen({ name: 'owner' })}
            className="flex w-full items-center gap-3.5 rounded-xl bg-gradient-to-br from-pitch-deep to-primary-deep px-5 py-5 text-left transition-opacity duration-200 hover:opacity-95"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white">
              <Crown size={20} strokeWidth={2} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[16.5px] font-bold text-white">대표 상세 보기</span>
              <span className="mt-1 block text-[13px] leading-[1.5] text-white/60">
                매출·공헌이익 · 이탈 위험 {queue.length}명 · 코치 평가
                {revenueAtRisk > 0 && ` · 위험 매출 ${formatWonCompact(revenueAtRisk)}원`}
              </span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-white/40" />
          </button>
        )}

        {/* --- Destinations ------------------------------------------------ */}
        <Section title="관리">
          <ul className="overflow-hidden rounded-lg border border-hairline bg-canvas">
            <HubRow
              icon={Users}
              label="원생 명단"
              meta={`${state.students.length}명`}
              badge={atRisk.length > 0 ? `위험 ${atRisk.length}` : undefined}
              onClick={() => onOpen({ name: 'roster' })}
            />
            <HubRow
              icon={BookOpenCheck}
              label="커리큘럼"
              meta={`${state.curricula.length}개 트랙`}
              badge={
                proposals.length > 0 && owner ? `승인 대기 ${proposals.length}` : undefined
              }
              onClick={() => onOpen({ name: 'curriculum' })}
            />
            {!owner && (
              <HubRow
                icon={ClipboardList}
                label="내 기록"
                meta={`담당 ${myClasses.length}개 반`}
                onClick={() => onOpen({ name: 'portfolio' })}
              />
            )}
            <HubRow
              icon={Activity}
              label="활동 기록"
              meta={`${activity.length}건`}
              onClick={() => onOpen({ name: 'activity' })}
            />
          </ul>
        </Section>

        {/* --- Coaches ------------------------------------------------------ */}
        <Section title="코치" meta={`${state.coaches.length}명`}>
          <ul className="overflow-hidden rounded-lg border border-hairline bg-canvas">
            {state.coaches.map((coach) => {
              const classes = classesForCoach(state.classes, coach.id);
              const isMe = coach.id === coachId;

              return (
                <li
                  key={coach.id}
                  className="flex items-center gap-3 border-b border-hairline-soft px-4 py-3.5 last:border-b-0"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-wash text-[13px] font-bold text-primary">
                    {coach.name.slice(-2)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[15px] font-semibold text-ink">
                        {coach.name}
                      </span>
                      {isMe && (
                        <span className="shrink-0 rounded-full bg-tint-mint px-2 py-0.5 text-[10.5px] font-bold text-brand-green">
                          나
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-[12.5px] text-steel">
                      {classes.length}개 반
                      {coach.certifications.length > 0 &&
                        ` · ${coach.certifications.join(', ')}`}
                    </span>
                  </span>
                  {owner && (
                    <button
                      type="button"
                      onClick={() => onOpen({ name: 'owner' })}
                      className="shrink-0 rounded-full bg-surface px-3 py-1.5 text-[12px] font-bold text-slate transition-colors hover:bg-hairline-soft"
                    >
                      평가
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </Section>

        {/* --- At-risk shortcut ---------------------------------------------
            Coaches see this too. The score itself is derived from attendance
            they already logged, and hiding it would mean the one person who
            sees the child every week is the last to know. */}
        {queue.length > 0 && (
          <Section title="이탈 위험" meta={`${queue.length}명`}>
            <ul className="overflow-hidden rounded-lg border border-hairline bg-canvas">
              {queue.slice(0, 5).map(({ student, signal, className }) => (
                <li key={student.id} className="border-b border-hairline-soft last:border-b-0">
                  <button
                    type="button"
                    onClick={() => onOpenStudent(student)}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-soft"
                  >
                    <span
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold tabular-nums',
                        signal.severity === 'critical'
                          ? 'bg-error text-white'
                          : 'bg-tint-alert text-error',
                      )}
                    >
                      {signal.computable ? signal.score : '—'}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold text-ink">
                        {student.name}
                        <span className="ml-2 text-[12.5px] font-normal text-steel">
                          {className}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-[13px] text-slate">
                        {signal.reasons[0] ?? '출결 기록이 없어 계산할 수 없습니다'}
                      </span>
                    </span>
                    <ChevronRight size={16} className="shrink-0 text-stone" />
                  </button>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </ScreenBody>
    </>
  );
}

function HubRow({
  icon: Icon,
  label,
  meta,
  badge,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  meta: string;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <li className="border-b border-hairline-soft last:border-b-0">
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors duration-150 hover:bg-surface-soft"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface text-slate">
          <Icon size={17} strokeWidth={2.1} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15.5px] font-semibold text-ink">{label}</span>
          <span className="mt-0.5 block truncate text-[12.5px] text-steel">{meta}</span>
        </span>
        {badge && (
          <span className="shrink-0 rounded-full bg-tint-yellow-bold px-2.5 py-1 text-[11px] font-bold text-charcoal">
            {badge}
          </span>
        )}
        <ChevronRight size={16} className="shrink-0 text-stone" />
      </button>
    </li>
  );
}
