/**
 * 폼 — 새로운 만남. 문의부터 첫 달까지, 한 가족씩.
 *
 * The tab is built on one idea: a centre with constant turnover lives or dies
 * on how it treats families in their first weeks, from the first reply to the
 * first month's review. So the screen answers, top to bottom:
 *
 *   1. How many families do I owe a contact today?  — one number, one button.
 *   2. Where is everyone on the journey?             — four rows, 문의 → 첫 달.
 *   3. What do I want to send?                        — four doors, chosen by
 *                                                       purpose, not by form type.
 *
 * Everything else — the individual family, the survey results, the links —
 * is one tap down. Nothing on this screen asks to be read twice.
 */

import { useMemo, useState } from 'react';
import { ArrowUpRight, ClipboardCheck, MessageCircleHeart, Trophy } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ID } from '@/types';
import { useWorkspace } from '@/store/WorkspaceContext';
import { TODAY } from '@/data/dates';
import {
  PHASES,
  isDue,
  phaseList,
  queueBreakdown,
  todayQueue,
  type Phase,
} from '@/data/onboarding';
import { isOpenSurvey, progressOf, type SurveyKind } from '@/data/surveys';
import { NewFormSheet } from './NewFormSheet';
import {
  DemoNote,
  Eyebrow,
  Page,
  Row,
  Rows,
  Section,
  Surface,
  Tag,
  TextLink,
  Title,
} from './ui';

interface FormsScreenProps {
  onOpenFamily: (key: string, queue?: boolean) => void;
  onOpenPhase: (phase: Phase) => void;
  onOpenInvite: () => void;
  onOpenSent: () => void;
  onOpenSurvey: (surveyId: ID, notice?: string | null) => void;
}

/** The four doors. Grouped by what the owner is trying to do. */
const DOORS: Array<{
  key: string;
  icon: LucideIcon;
  label: string;
  sub: string;
  kinds?: SurveyKind[];
}> = [
  { key: 'invite', icon: ArrowUpRight, label: '체험 초대', sub: '신청 링크 · SNS 공유' },
  { key: 'join', icon: Trophy, label: '참가 신청', sub: '대회 · 캠프 · 행사', kinds: ['rsvp'] },
  {
    key: 'check',
    icon: ClipboardCheck,
    label: '동의 · 조사',
    sub: '촬영 동의 · 일정 조사',
    kinds: ['consent', 'schedule', 'order', 'custom'],
  },
  {
    key: 'listen',
    icon: MessageCircleHeart,
    label: '의견 듣기',
    sub: '재등록 의향 · 만족도',
    kinds: ['renewal', 'satisfaction'],
  },
];

export function FormsScreen({
  onOpenFamily,
  onOpenPhase,
  onOpenInvite,
  onOpenSent,
  onOpenSurvey,
}: FormsScreenProps) {
  const { families, surveys, recipients, mode, surveyMode, touchMode } = useWorkspace();
  const [sheet, setSheet] = useState<{ open: boolean; kinds?: SurveyKind[]; n: number }>({
    open: false,
    n: 0,
  });

  const queue = useMemo(() => todayQueue(families), [families]);
  const late = queue.filter((f) => f.next!.late).length;

  // The next thing on the horizon, for the day there's nothing due.
  const upcoming = useMemo(
    () =>
      families
        .filter((f) => f.next && !isDue(f) && f.next.due >= TODAY)
        .sort((a, b) => a.next!.due.localeCompare(b.next!.due))[0],
    [families],
  );

  const sent = surveys.filter((v) => v.kind !== 'enrollment');
  const live = sent.filter((v) => isOpenSurvey(v)).length;
  const toTalk = sent.reduce((n, v) => n + progressOf(v, recipients).toCall.length, 0);

  const demo = mode === 'local' || surveyMode === 'local' || touchMode === 'local';

  return (
    <Page>
      <Title eyebrow="Welcome to the team" title="새로운 만남" sub="문의부터 첫 달까지, 한 가족씩." />

      {/* --- Today ---------------------------------------------------------- */}
      <Surface tone={late > 0 ? 'alert' : 'calm'} className="mt-6">
        <Eyebrow tone={late > 0 ? 'alert' : 'calm'}>{late > 0 ? `늦은 연락 ${late}` : 'Today'}</Eyebrow>
        <p className="mt-2.5 flex items-baseline gap-2.5">
          <strong className="text-[46px] font-bold leading-none tracking-[-0.05em] text-ink">
            {queue.length}
          </strong>
          <span className="text-[18px] font-semibold text-ink">
            {queue.length > 0 ? '가족에게 연락할 차례' : '오늘 연락은 모두 마쳤어요'}
          </span>
        </p>
        <p className="mt-2 text-[14.5px] leading-[1.55] text-steel">
          {queue.length > 0
            ? queueBreakdown(queue)
            : upcoming
              ? `다음 · ${upcoming.name} ${upcoming.next!.reason}`
              : '새 문의가 들어오면 여기에 먼저 나타납니다.'}
        </p>
        {queue.length > 0 && (
          <div className="mt-2">
            <TextLink onClick={() => onOpenFamily(queue[0].key, true)}>
              {queue[0].name}부터 시작하기 →
            </TextLink>
          </div>
        )}
      </Surface>

      {/* --- Journey --------------------------------------------------------- */}
      <Section title="문의에서 정착까지">
        <Rows>
          {PHASES.map((p) => {
            const list = phaseList(families, p.key);
            const due = list.filter((f) => isDue(f)).length;
            const lateHere = list.filter((f) => isDue(f) && f.next!.late).length;
            return (
              <Row
                key={p.key}
                lead={list.length}
                title={p.label}
                sub={due > 0 ? `오늘 연락 ${due} · ${p.blurb}` : p.blurb}
                tag={lateHere > 0 ? <Tag tone="amber">늦음 {lateHere}</Tag> : undefined}
                onClick={() => onOpenPhase(p.key)}
              />
            );
          })}
        </Rows>
      </Section>

      {/* --- Doors ---------------------------------------------------------- */}
      <Section title="어떤 안내가 필요한가요?">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-hairline-soft bg-hairline-soft">
          {DOORS.map((d) => {
            const Icon = d.icon;
            return (
              <button
                key={d.key}
                type="button"
                onClick={() =>
                  d.key === 'invite'
                    ? onOpenInvite()
                    : setSheet((s) => ({ open: true, kinds: d.kinds, n: s.n + 1 }))
                }
                className="flex min-h-[112px] flex-col items-start bg-canvas px-4 py-4 text-left transition-colors hover:bg-[#FAFBFA] active:bg-surface-soft"
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
              sub={
                sent.length === 0
                  ? '아직 보낸 안내가 없어요'
                  : `진행 중 ${live} · 전체 ${sent.length}`
              }
              tag={toTalk > 0 ? <Tag>상담 필요 {toTalk}</Tag> : undefined}
              onClick={onOpenSent}
            />
          </Rows>
        </div>
      </Section>

      <DemoNote show={demo}>
        예시 데이터로 보는 중 · 새로고침하면 초기화됩니다.
        <br />
        Supabase에 마이그레이션 0006~0009을 적용하면 실제로 동작합니다.
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
