/**
 * 폼 — 새로운 만남.
 *
 * What a coach or owner needs from this tab, between classes, is two lists of
 * names — not a count:
 *
 *   오늘 수업에 오는 새 아이 — trials and first classes in today's sessions.
 *     The first session decides more than any call does, and it is the one
 *     thing the coach on the pitch can act on: learn the name, watch for the
 *     child, send the first report after class.
 *   할 일 — who to call or what to send today, with the reason, and a call
 *     button on the row itself.
 *
 * Coaches see only their own classes; the owner sees the centre. Below that,
 * the four stages as counts, and the doors for sending something new.
 */

import { useMemo, useState } from 'react';
import { ArrowUpRight, ClipboardCheck, MessageCircleHeart, Phone, Trophy } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Class, ID } from '@/types';
import { useApp } from '@/store/AppContext';
import { useWorkspace } from '@/store/WorkspaceContext';
import { TODAY } from '@/data/dates';
import { PHASES, isDue, phaseList, todayQueue, type Family, type Phase } from '@/data/onboarding';
import { isOpenSurvey, progressOf, type SurveyKind } from '@/data/surveys';
import { cn } from '@/lib/cn';
import { NewFormSheet } from './NewFormSheet';
import { telHref } from './parts';
import { DemoNote, Page, Row, Rows, Section, Tag, TextLink, Title } from './ui';

interface FormsScreenProps {
  onOpenFamily: (key: string, queue?: boolean) => void;
  onOpenPhase: (phase: Phase) => void;
  onOpenInvite: () => void;
  onOpenSent: () => void;
  onOpenSurvey: (surveyId: ID, notice?: string | null) => void;
}

const DOORS: Array<{ key: string; icon: LucideIcon; label: string; sub: string; kinds?: SurveyKind[] }> = [
  { key: 'invite', icon: ArrowUpRight, label: '체험 초대', sub: '신청 링크 공유' },
  { key: 'join', icon: Trophy, label: '참가 신청', sub: '대회 · 캠프 · 행사', kinds: ['rsvp'] },
  {
    key: 'check',
    icon: ClipboardCheck,
    label: '동의 · 조사',
    sub: '촬영 동의 · 일정 조사',
    kinds: ['consent', 'schedule', 'order', 'custom'],
  },
  { key: 'listen', icon: MessageCircleHeart, label: '의견 듣기', sub: '재등록 · 만족도', kinds: ['renewal', 'satisfaction'] },
];

/** How many of today's tasks show before "더 보기". */
const TODO_LIMIT = 6;

interface Arrival {
  family: Family;
  cls: Class;
  what: '체험' | '첫 수업';
}

export function FormsScreen({ onOpenFamily, onOpenPhase, onOpenInvite, onOpenSent, onOpenSurvey }: FormsScreenProps) {
  const { state } = useApp();
  const { families, surveys, recipients, mode, surveyMode, touchMode } = useWorkspace();
  const [sheet, setSheet] = useState<{ open: boolean; kinds?: SurveyKind[]; n: number }>({ open: false, n: 0 });
  const [showAll, setShowAll] = useState(false);

  // A coach sees their own classes; an owner (no coach row) sees them all.
  const coachId = state.currentCoachId;
  const mine = (cls: Class | undefined): cls is Class => !!cls && (!coachId || cls.coachId === coachId);
  const classOf = (id: ID | null | undefined) => state.classes.find((c) => c.id === id);

  const arrivals = useMemo<Arrival[]>(() => {
    const out: Arrival[] = [];
    for (const f of families) {
      if (f.lead && f.phase === 'trial' && f.lead.trialDate === TODAY) {
        const cls = classOf(f.lead.trialClassId ?? f.lead.interestClassId);
        if (mine(cls)) out.push({ family: f, cls, what: '체험' });
      }
      if (f.student && f.firstClass === TODAY) {
        const cls = classOf(f.student.classId);
        if (mine(cls)) out.push({ family: f, cls, what: '첫 수업' });
      }
    }
    return out.sort((a, b) => a.cls.schedule.startTime.localeCompare(b.cls.schedule.startTime));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [families, state.classes, coachId]);

  // Today's arrivals are already on the list above; their "결과 기록" waits for class.
  const todo = useMemo(() => {
    const here = new Set(arrivals.map((a) => a.family.key));
    return todayQueue(families).filter((f) => !here.has(f.key));
  }, [families, arrivals]);
  const shown = showAll ? todo : todo.slice(0, TODO_LIMIT);

  const sent = surveys.filter((v) => v.kind !== 'enrollment');
  const live = sent.filter((v) => isOpenSurvey(v)).length;
  const toTalk = sent.reduce((n, v) => n + progressOf(v, recipients).toCall.length, 0);
  const demo = mode === 'local' || surveyMode === 'local' || touchMode === 'local';

  return (
    <Page>
      <Title eyebrow="Forms" title="새로운 만남" />

      {/* --- Arrivals ------------------------------------------------------- */}
      {arrivals.length > 0 && (
        <Section title="오늘 수업에 오는 새 아이" aside={`${arrivals.length}명`} className="mt-7">
          <Rows>
            {arrivals.map(({ family, cls, what }) => (
              <Row
                key={family.key}
                lead={<span className="text-[15px] font-semibold text-slate">{cls.schedule.startTime}</span>}
                title={
                  <>
                    {family.name}
                    {family.ageLabel && <span className="ml-1.5 text-[14px] font-medium text-steel">{family.ageLabel}</span>}
                  </>
                }
                sub={cls.title}
                tag={<Tag>{what}</Tag>}
                onClick={() => onOpenFamily(family.key)}
              />
            ))}
          </Rows>
        </Section>
      )}

      {/* --- To do ------------------------------------------------------------ */}
      <Section title="할 일" aside={todo.length > 0 ? `${todo.length}` : undefined} className={arrivals.length ? undefined : 'mt-7'}>
        {todo.length === 0 ? (
          <p className="py-3 text-[15px] text-steel">오늘 할 일 없음</p>
        ) : (
          <div className="divide-y divide-hairline-soft">
            {shown.map((f) => (
              <TodoRow key={f.key} family={f} onOpen={() => onOpenFamily(f.key, true)} />
            ))}
          </div>
        )}
        {todo.length > TODO_LIMIT && (
          <div className="mt-1">
            <TextLink tone="gray" onClick={() => setShowAll((v) => !v)}>
              {showAll ? '접기' : `${todo.length - TODO_LIMIT}개 더 보기`}
            </TextLink>
          </div>
        )}
      </Section>

      {/* --- Stages ---------------------------------------------------------- */}
      <Section title="단계별 현황">
        <Rows>
          {PHASES.map((p) => {
            const list = phaseList(families, p.key);
            const due = list.filter((f) => isDue(f)).length;
            return (
              <Row
                key={p.key}
                lead={list.length}
                title={p.label}
                sub={due > 0 ? `${p.blurb} · 오늘 할 일 ${due}` : p.blurb}
                onClick={() => onOpenPhase(p.key)}
              />
            );
          })}
        </Rows>
      </Section>

      {/* --- Doors ------------------------------------------------------------ */}
      <Section title="어떤 안내가 필요한가요?">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-hairline-soft bg-hairline-soft">
          {DOORS.map((d) => {
            const Icon = d.icon;
            return (
              <button
                key={d.key}
                type="button"
                onClick={() =>
                  d.key === 'invite' ? onOpenInvite() : setSheet((s) => ({ open: true, kinds: d.kinds, n: s.n + 1 }))
                }
                className="flex min-h-[104px] flex-col items-start bg-canvas px-4 py-4 text-left transition-colors hover:bg-[#FAFBFA] active:bg-surface-soft"
              >
                <Icon size={20} strokeWidth={2} className="text-primary" />
                <span className="mt-3 text-[16px] font-bold text-ink">{d.label}</span>
                <span className="mt-1 text-[13px] leading-[1.45] text-steel">{d.sub}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-3">
          <Rows>
            <Row
              title="보낸 안내"
              sub={sent.length === 0 ? '없음' : `진행 중 ${live} · 전체 ${sent.length}`}
              tag={toTalk > 0 ? <Tag tone="amber">상담 필요 {toTalk}</Tag> : undefined}
              onClick={onOpenSent}
            />
          </Rows>
        </div>
      </Section>

      <DemoNote show={demo}>
        예시 데이터 · 새로고침 시 초기화
        <br />
        Supabase에 마이그레이션 0006~0009를 적용하면 실제 데이터로 바뀝니다.
      </DemoNote>

      <NewFormSheet
        key={sheet.n}
        open={sheet.open}
        kinds={sheet.kinds}
        onClose={() => setSheet((s) => ({ ...s, open: false }))}
        onSent={(surveyId, notice) => onOpenSurvey(surveyId, notice)}
      />
    </Page>
  );
}

/** Name, why, what — and the call button on the row, for calls. */
function TodoRow({ family, onOpen }: { family: Family; onOpen: () => void }) {
  const n = family.next!;
  return (
    <div className="flex items-center gap-3 py-4">
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left active:opacity-60">
        <span className="block text-[17px] font-bold leading-[1.4] text-ink">
          {family.name}
          {family.ageLabel && <span className="ml-1.5 text-[14px] font-medium text-steel">{family.ageLabel}</span>}
        </span>
        <span className="mt-1 block text-[14px] leading-[1.5] text-steel">{n.reason}</span>
        <span className="mt-2 block">
          <Tag tone={n.late ? 'amber' : 'green'}>{n.label}</Tag>
        </span>
      </button>
      {n.channel === 'call' && family.phone && (
        <a
          href={telHref(family.phone)}
          aria-label={`${family.name} 보호자에게 전화`}
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-full',
            n.late ? 'bg-[#946216] text-white' : 'bg-primary text-white',
          )}
        >
          <Phone size={17} strokeWidth={2.4} />
        </a>
      )}
    </div>
  );
}
