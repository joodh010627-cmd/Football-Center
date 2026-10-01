/**
 * 폼 — 신규 문의. Built the way the 수업 tab is built.
 *
 * Today's work is a rail of cards, one family per card, with a row of chips
 * above it that is both the list and the way to move through it — the same
 * as the lesson cards and their start times. A child coming to a lesson today
 * (체험 or 첫 수업) comes first, chip labelled by the lesson time; then the
 * calls and messages due, chip labelled by name. Each card says who, what to
 * do and why, shows where the family is as a four-step bar, and offers one
 * button. Everything else is a tap into the family.
 *
 * Coaches see only their own classes' arrivals; the owner sees the centre.
 * Under the rail: the four stages as counts, and the forms to send.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, ClipboardCheck, MessageCircleHeart, Phone, Trophy } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Class, ID } from '@/types';
import { useApp } from '@/store/AppContext';
import { useWorkspace } from '@/store/WorkspaceContext';
import { TODAY } from '@/data/dates';
import {
  PHASES,
  PHASE_LABEL,
  isDue,
  phaseList,
  phaseSteps,
  todayQueue,
  type Family,
  type Phase,
} from '@/data/onboarding';
import { isOpenSurvey, progressOf, type SurveyKind } from '@/data/surveys';
import { cn } from '@/lib/cn';
import { NewFormSheet } from './NewFormSheet';
import { telHref } from './parts';
import { DemoNote, Page, PrimaryButton, Row, Rows, Section, StepBar, Tag, Title } from './ui';

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

/** One card on the rail. */
interface Item {
  family: Family;
  /** Coming to a lesson today — the chip shows the time. */
  arrival?: { cls: Class; what: '체험' | '첫 수업' };
}

export function FormsScreen({ onOpenFamily, onOpenPhase, onOpenInvite, onOpenSent, onOpenSurvey }: FormsScreenProps) {
  const { state } = useApp();
  const { families, surveys, recipients, mode, surveyMode, touchMode } = useWorkspace();
  const [sheet, setSheet] = useState<{ open: boolean; kinds?: SurveyKind[]; n: number }>({ open: false, n: 0 });

  const coachId = state.currentCoachId;

  const items = useMemo<Item[]>(() => {
    const classOf = (id: ID | null | undefined) => state.classes.find((c) => c.id === id);
    const mine = (cls: Class | undefined): cls is Class => !!cls && (!coachId || cls.coachId === coachId);

    const arrivals: Item[] = [];
    for (const f of families) {
      if (f.lead && f.phase === 'trial' && f.lead.trialDate === TODAY) {
        const cls = classOf(f.lead.trialClassId ?? f.lead.interestClassId);
        if (mine(cls)) arrivals.push({ family: f, arrival: { cls, what: '체험' } });
      }
      if (f.student && f.firstClass === TODAY) {
        const cls = classOf(f.student.classId);
        if (mine(cls)) arrivals.push({ family: f, arrival: { cls, what: '첫 수업' } });
      }
    }
    arrivals.sort((a, b) => a.arrival!.cls.schedule.startTime.localeCompare(b.arrival!.cls.schedule.startTime));

    const here = new Set(arrivals.map((a) => a.family.key));
    const due = todayQueue(families)
      .filter((f) => !here.has(f.key))
      .map((family) => ({ family }));
    return [...arrivals, ...due];
  }, [families, state.classes, coachId]);

  const sent = surveys.filter((v) => v.kind !== 'enrollment');
  const live = sent.filter((v) => isOpenSurvey(v)).length;
  const toTalk = sent.reduce((n, v) => n + progressOf(v, recipients).toCall.length, 0);
  const demo = mode === 'local' || surveyMode === 'local' || touchMode === 'local';

  return (
    <Page>
      <Title eyebrow="폼" title="신규 문의" />

      <div className="mt-5">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-hairline-strong bg-canvas px-5 py-10 text-center">
            <p className="text-[16px] font-semibold text-ink">오늘 할 일이 없어요</p>
          </div>
        ) : (
          <Rail items={items} onOpen={(i) => onOpenFamily(i.family.key, !i.arrival)} />
        )}
      </div>

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
                sub={p.blurb}
                tag={due > 0 ? <Tag>오늘 {due}</Tag> : undefined}
                onClick={() => onOpenPhase(p.key)}
              />
            );
          })}
        </Rows>
      </Section>

      {/* --- Forms to send -------------------------------------------------- */}
      <Section title="안내 보내기">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-hairline bg-hairline-soft">
          {DOORS.map((d) => {
            const Icon = d.icon;
            return (
              <button
                key={d.key}
                type="button"
                onClick={() =>
                  d.key === 'invite' ? onOpenInvite() : setSheet((s) => ({ open: true, kinds: d.kinds, n: s.n + 1 }))
                }
                className="flex min-h-[96px] flex-col items-start bg-canvas p-4 text-left transition-colors hover:bg-surface-soft/60"
              >
                <Icon size={19} strokeWidth={2.2} className="text-primary" />
                <span className="mt-2.5 text-[15.5px] font-semibold text-ink">{d.label}</span>
                <span className="mt-0.5 text-[12.5px] text-steel">{d.sub}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-2">
          <Rows>
            <Row
              title="보낸 안내"
              sub={sent.length === 0 ? '없음' : `진행 중 ${live} · 전체 ${sent.length}`}
              tag={toTalk > 0 ? <Tag tone="strong">상담 필요 {toTalk}</Tag> : undefined}
              onClick={onOpenSent}
            />
          </Rows>
        </div>
      </Section>

      <DemoNote show={demo}>
        예시 데이터 · 새로고침 시 초기화 · 마이그레이션 0006~0009 적용 시 실제 데이터
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

// ---------------------------------------------------------------------------
// The rail — the lesson rail's mechanics, one family per card
// ---------------------------------------------------------------------------

function Rail({ items, onOpen }: { items: Item[]; onOpen: (item: Item) => void }) {
  const [index, setIndex] = useState(0);
  const rail = useRef<HTMLDivElement>(null);
  const chips = useRef<HTMLDivElement>(null);
  const many = items.length > 1;

  const step = () => ((rail.current?.firstElementChild as HTMLElement | null)?.offsetWidth ?? 0) + 12;

  const go = (i: number) => {
    rail.current?.scrollTo({ left: i * step(), behavior: 'smooth' });
    setIndex(i);
  };

  const onScroll = () => {
    const el = rail.current;
    if (!el || step() <= 12) return;
    setIndex(Math.min(items.length - 1, Math.max(0, Math.round(el.scrollLeft / step()))));
  };

  // Keep the selected chip in view as the cards are swiped.
  useEffect(() => {
    const chip = chips.current?.children[index] as HTMLElement | undefined;
    chip?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [index]);

  return (
    <div className="stagger">
      {many && (
        <div ref={chips} className="no-scrollbar -mx-5 mb-3 flex gap-1.5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
          {items.map((it, i) => {
            const late = !it.arrival && it.family.next?.late;
            return (
              <button
                key={it.family.key}
                type="button"
                onClick={() => go(i)}
                aria-pressed={i === index}
                className={cn(
                  'pressable flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[14px] font-semibold',
                  i === index ? 'bg-primary text-white' : 'bg-canvas text-charcoal',
                )}
              >
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    i === index ? 'bg-white' : late ? 'bg-primary' : it.arrival ? 'bg-primary-soft' : 'bg-primary/25',
                  )}
                />
                {it.arrival && <span className="tabular-nums">{it.arrival.cls.schedule.startTime}</span>}
                {it.family.name}
              </button>
            );
          })}
        </div>
      )}

      <div
        ref={rail}
        onScroll={many ? onScroll : undefined}
        className={cn(
          'flex gap-3',
          many && 'no-scrollbar -mx-5 snap-x snap-mandatory scroll-px-5 overflow-x-auto px-5 sm:mx-0 sm:px-0',
        )}
      >
        {items.map((it) => (
          <FamilyCard
            key={it.family.key}
            item={it}
            className={many ? 'w-[calc(100%-28px)] shrink-0 snap-start' : 'w-full'}
            onOpen={() => onOpen(it)}
          />
        ))}
      </div>
    </div>
  );
}

/** One family, lit — the lesson card's layout. */
function FamilyCard({ item, className, onOpen }: { item: Item; className?: string; onOpen: () => void }) {
  const { family, arrival } = item;
  const next = family.next!;
  const call = !arrival && next.channel === 'call' && family.phone;

  const label = arrival ? `오늘 ${arrival.what}` : next.late ? '기한 지남' : '할 일';
  const corner = arrival ? arrival.cls.schedule.startTime : PHASE_LABEL[family.phase];

  return (
    <article className={cn('mesh rounded-2xl p-5', className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-bold text-primary">{label}</p>
        <p className="shrink-0 text-[15px] font-semibold tabular-nums text-charcoal">{corner}</p>
      </div>

      <button type="button" onClick={onOpen} className="mt-6 block w-full text-left">
        <span className="block text-[26px] font-bold leading-[1.15] tracking-tightest text-ink">
          {family.name}
          {family.ageLabel && <span className="ml-2 text-[17px] font-semibold text-slate">{family.ageLabel}</span>}
        </span>
        <span className="mt-2 block truncate text-[17px] text-charcoal">
          {arrival ? arrival.cls.title : next.label}
        </span>
      </button>

      <p className="mt-1.5 truncate text-[13.5px] text-slate">
        {arrival ? (arrival.what === '체험' ? '체험 수업 · 수업 뒤 결과 기록' : '첫 정규 수업') : next.reason}
        {family.parentName && ` · 보호자 ${family.parentName}`}
      </p>

      <StepBar steps={phaseSteps(family.phase)} className="mt-5" />

      <div className="mt-5 flex items-center justify-between gap-3">
        {call ? (
          <PrimaryButton href={telHref(family.phone)}>
            <Phone size={15} strokeWidth={2.4} />
            전화
          </PrimaryButton>
        ) : (
          <PrimaryButton onClick={onOpen}>{arrival ? '보기' : next.label}</PrimaryButton>
        )}
        {call && (
          <button type="button" onClick={onOpen} className="shrink-0 text-[13.5px] font-semibold text-steel">
            결과 기록
          </button>
        )}
      </div>
    </article>
  );
}
