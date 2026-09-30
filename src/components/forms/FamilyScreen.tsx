/**
 * One family, from first enquiry to the end of their first month.
 *
 * The screen is one card and a footnote. The card is the next thing to do —
 * who to call and why, what the call is for, and the three or four ways a
 * call can end, each one tap. Tapping a result writes it down and, when the
 * next step is obvious, opens it (a good first call opens the trial booker; a
 * family saying yes opens the 등록 신청서). The journey bar shows where they
 * are; everything else (answers, notes, history) is folded underneath.
 *
 * Opened from "…부터 시작하기", the screen also offers the next family on
 * today's list once this one is dealt with, so a round of calls is a straight
 * line rather than a trip back to the list each time.
 */

import { useMemo, useState, type ReactNode } from 'react';
import { Check, ChevronDown, MessageSquare, Phone } from 'lucide-react';
import type { ID } from '@/types';
import { useApp } from '@/store/AppContext';
import { useWorkspace } from '@/store/WorkspaceContext';
import { TODAY, addDays, dayOf, diffDays, timeOf } from '@/data/dates';
import { SOURCE_LABEL, formatPhone } from '@/data/crm';
import {
  OUTCOME_LABEL,
  PHASES,
  PHASE_LABEL,
  STEP_LABEL,
  firstClassOn,
  isDue,
  todayQueue,
  type Family,
  type NextAction,
  type TouchOutcome,
} from '@/data/onboarding';
import { formatDateKo } from '@/lib/format';
import { cn } from '@/lib/cn';
import { EnrollSheet, LostSheet, TrialSheet } from './sheets';
import { NewFormSheet } from './NewFormSheet';
import { describeEnqueue, telHref } from './parts';
import {
  Eyebrow,
  Facts,
  Page,
  PrimaryButton,
  SecondaryButton,
  Surface,
  Tag,
  TextLink,
  Title,
  inputClass,
} from './ui';

interface FamilyScreenProps {
  familyKey: string;
  /** Opened as part of working through today's list. */
  queue?: boolean;
  backLabel: string;
  onBack: () => void;
  /** Move on to another family, replacing this screen. */
  onNext: (key: string) => void;
}

type CallKind = 'first_call' | 'trial_followup' | 'form_check' | 'week1' | 'month1';

/** How a call can end, in the words someone would use to describe it. */
const CALL_RESULTS: Record<CallKind, Array<{ label: string; outcome: TouchOutcome | 'lost' | 'enroll' }>> = {
  first_call: [
    { label: '통화했어요', outcome: 'done' },
    { label: '안 받아요', outcome: 'no_answer' },
    { label: '관심 없대요', outcome: 'lost' },
  ],
  trial_followup: [
    { label: '등록할게요', outcome: 'done' },
    { label: '고민 중이래요', outcome: 'concern' },
    { label: '안 받아요', outcome: 'no_answer' },
    { label: '이번엔 안 해요', outcome: 'lost' },
  ],
  form_check: [
    { label: '바로 등록할게요', outcome: 'enroll' },
    { label: '고민 중이래요', outcome: 'concern' },
    { label: '안 받아요', outcome: 'no_answer' },
    { label: '이번엔 안 해요', outcome: 'lost' },
  ],
  week1: [
    { label: '잘 지내요', outcome: 'done' },
    { label: '걱정이 있어요', outcome: 'concern' },
    { label: '안 받아요', outcome: 'no_answer' },
  ],
  month1: [
    { label: '계속 다녀요', outcome: 'done' },
    { label: '걱정이 있어요', outcome: 'concern' },
    { label: '안 받아요', outcome: 'no_answer' },
  ],
};

export function FamilyScreen({ familyKey, queue = false, backLabel, onBack, onNext }: FamilyScreenProps) {
  const { state } = useApp();
  const ws = useWorkspace();
  const { families, getFamily, getLead, touches, activity, recipients, surveys } = ws;

  const [sheet, setSheet] = useState<null | 'trial' | 'enroll' | 'lost' | 'form'>(null);
  const [concernFor, setConcernFor] = useState<null | CallKind>(null);
  const [note, setNote] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [acted, setActed] = useState(false);

  // A lead that enrolled is now its student; follow it there.
  const family: Family | undefined = useMemo(() => {
    const direct = getFamily(familyKey);
    if (direct) return direct;
    if (familyKey.startsWith('lead:')) {
      const lead = getLead(familyKey.slice(5));
      if (lead?.enrolledStudentId) return getFamily(`student:${lead.enrolledStudentId}`);
    }
    return undefined;
  }, [familyKey, getFamily, getLead]);

  const nextInLine = useMemo(
    () => todayQueue(families).find((f) => f.key !== family?.key && f.key !== familyKey),
    [families, family?.key, familyKey],
  );

  if (!family) {
    const lead = familyKey.startsWith('lead:') ? getLead(familyKey.slice(5)) : undefined;
    return (
      <Page>
        <Title
          back={{ label: backLabel, onBack }}
          eyebrow={lead?.stage === 'lost' ? '함께하지 않기로 함' : '여정 완료'}
          title={lead?.childName ?? '가족'}
          sub={
            lead?.stage === 'lost'
              ? lead.lostReason || '이유가 남아 있지 않아요'
              : '첫 달 점검까지 마치고 클럽의 원생이 되었어요.'
          }
        />
        {lead?.stage === 'lost' && (
          <div className="mt-8">
            <SecondaryButton onClick={() => ws.advanceLead(lead.id, 'inquiry')}>다시 열기</SecondaryButton>
          </div>
        )}
      </Page>
    );
  }

  const { lead, student, next } = family;
  const who = lead ? { leadId: lead.id } : { studentId: student!.id };
  const cls = state.classes.find((c) => c.id === (student?.classId ?? lead?.trialClassId ?? lead?.interestClassId));
  const doneNow = !isDue(family);

  const after = (message?: string) => {
    setActed(true);
    setConcernFor(null);
    setNote('');
    if (message) setNotice(message);
  };

  const logCall = (kind: CallKind, outcome: TouchOutcome | 'lost' | 'enroll') => {
    if (outcome === 'lost') return setSheet('lost');
    if (outcome === 'enroll') return setSheet('enroll');
    if (outcome === 'concern') return setConcernFor(kind);

    const step = next!.touch!;
    ws.logTouch(who, step, outcome);

    if (outcome === 'no_answer') return after('기록했어요. 내일 다시 알려 드릴게요.');
    if (kind === 'first_call' && lead) {
      ws.advanceLead(lead.id, 'contacted');
      after();
      return setSheet('trial'); // the call's purpose was a trial date
    }
    if (kind === 'trial_followup') {
      after();
      return setSheet('form'); // a yes is the moment to send the form
    }
    after('기록했어요.');
  };

  const saveConcern = () => {
    ws.logTouch(who, next!.touch!, 'concern', note);
    after('기록했어요. 사흘 뒤에 다시 알려 드릴게요.');
  };

  return (
    <Page>
      <Title
        back={{ label: backLabel, onBack }}
        eyebrow={
          student
            ? `첫 달 · ${diffDays(TODAY, family.enrolledAt ?? TODAY) + 1}일째`
            : PHASE_LABEL[family.phase]
        }
        title={
          <>
            {family.name}
            {family.ageLabel && (
              <span className="ml-2 text-[18px] font-semibold text-steel">{family.ageLabel}</span>
            )}
          </>
        }
        sub={[
          family.parentName && `보호자 ${family.parentName}`,
          student ? cls?.title : lead && SOURCE_LABEL[lead.source],
        ]
          .filter(Boolean)
          .join(' · ')}
      />

      {/* --- Next ----------------------------------------------------------- */}
      {next && (
        <Surface tone={isDue(family) && next.late ? 'alert' : 'calm'} className="mt-6">
          <div className="flex items-center justify-between gap-3">
            <Eyebrow tone={isDue(family) && next.late ? 'alert' : 'calm'}>
              {next.channel === 'wait' ? '다음 예정' : isDue(family) ? (next.late ? '늦었어요' : '지금 할 일') : '다음'}
            </Eyebrow>
            {next.channel === 'wait' && <Tag tone="gray">{md(next.due)}</Tag>}
          </div>
          <h2 className="mt-2 text-[23px] font-bold leading-[1.35] tracking-[-0.03em] text-ink">
            {next.label}
          </h2>
          <p className="mt-1 text-[15px] leading-[1.55] text-slate">{next.reason}</p>
          {next.script && next.channel === 'call' && (
            <p className="mt-3 border-l-2 border-primary/30 pl-3 text-[14px] leading-[1.6] text-steel">
              {next.script}
            </p>
          )}

          <div className="mt-5">
            <NextControls
              family={family}
              next={next}
              cls={cls}
              concernFor={concernFor}
              note={note}
              setNote={setNote}
              onCall={logCall}
              onConcernSave={saveConcern}
              onConcernCancel={() => setConcernFor(null)}
              onOpen={setSheet}
              onMarkTrial={(came) => {
                if (!lead) return;
                ws.advanceLead(lead.id, came ? 'trial_done' : 'contacted');
                after(came ? '체험 완료로 기록했어요. 내일 소감을 여쭤보세요.' : '다시 날짜를 잡아 주세요.');
              }}
              onWelcome={async (sendIt) => {
                if (!student) return;
                if (sendIt) {
                  const result = await ws.sendWelcome(student.id);
                  after(result ? describeEnqueue(result, '환영 안내') : '환영 안내를 기록했어요. (예시 데이터라 실제로 보내지 않아요)');
                } else {
                  ws.logTouch({ studentId: student.id }, 'welcome', 'done', '직접 안내');
                  after('직접 안내한 것으로 기록했어요.');
                }
              }}
            />
          </div>

          {notice && (
            <p className="mt-4 flex items-start gap-2 text-[13.5px] leading-[1.55] text-slate">
              <Check size={15} strokeWidth={2.6} className="mt-0.5 shrink-0 text-primary" />
              {notice}
            </p>
          )}
        </Surface>
      )}

      {queue && (acted || doneNow) && nextInLine && (
        <button
          type="button"
          onClick={() => onNext(nextInLine.key)}
          className="mt-3 flex w-full items-center justify-between rounded-[14px] border border-hairline px-5 py-4 text-left transition-colors hover:border-hairline-strong"
        >
          <span>
            <span className="block text-[13px] text-steel">다음 가족</span>
            <span className="mt-0.5 block text-[16px] font-bold text-ink">
              {nextInLine.name} · {nextInLine.next!.label}
            </span>
          </span>
          <span className="text-[20px] text-primary">→</span>
        </button>
      )}

      {/* --- Journey ------------------------------------------------------- */}
      <Journey family={family} />

      {/* --- Facts --------------------------------------------------------- */}
      <div className="mt-8">
        <Facts
          items={[
            [
              '연락처',
              family.phone ? (
                <span className="flex items-center justify-end gap-3">
                  <a href={telHref(family.phone)} className="font-semibold text-primary">
                    {formatPhone(family.phone)}
                  </a>
                  <a href={`sms:${family.phone.replace(/\D/g, '')}`} aria-label="문자" className="text-steel">
                    <MessageSquare size={16} />
                  </a>
                </span>
              ) : (
                '없음'
              ),
            ],
            [student ? '반' : '관심 반', cls?.title ?? '미정'],
            ...(lead?.trialDate ? [['체험', formatDateKo(lead.trialDate)] as [string, ReactNode]] : []),
            ...(student
              ? [['출석', `첫 4주 ${family.attendance?.present ?? 0}/${family.attendance?.held ?? 0}회`] as [string, ReactNode]]
              : []),
            [student ? '등록일' : '문의일', formatDateKo(student ? (family.enrolledAt ?? TODAY) : dayOf(lead!.createdAt))],
          ]}
        />
      </div>

      {/* --- Folded -------------------------------------------------------- */}
      <Answers family={family} surveys={surveys} recipients={recipients} />
      {lead && !student && <Memo leadId={lead.id} memo={lead.memo} onSave={ws.updateLead} />}
      <History
        subjectIds={[lead?.id, student?.id].filter(Boolean) as ID[]}
        activity={activity}
        touches={touches.filter((t) => t.leadId === lead?.id || (student && t.studentId === student.id))}
      />

      {lead && !student && (
        <div className="mt-8 text-center">
          <TextLink tone="gray" onClick={() => setSheet('lost')}>
            이번엔 함께하지 않아요
          </TextLink>
        </div>
      )}

      {/* --- Sheets -------------------------------------------------------- */}
      {lead && (
        <>
          <TrialSheet
            key={`trial-${lead.trialDate ?? ''}`}
            open={sheet === 'trial'}
            defaultDate={lead.trialDate ?? addDays(TODAY, 2)}
            defaultClassId={lead.trialClassId ?? lead.interestClassId ?? ''}
            onClose={() => setSheet(null)}
            onSubmit={(date, classId) => {
              setSheet(null);
              void ws.bookTrial(lead.id, date, classId || null).then((result) =>
                after(result ? describeEnqueue(result, '체험 안내') : `${formatDateKo(date)} 체험을 잡았어요.`),
              );
            }}
          />
          <EnrollSheet
            open={sheet === 'enroll'}
            lead={lead}
            onClose={() => setSheet(null)}
            onSubmit={(classId, ageGroup) => {
              setSheet(null);
              void ws.enrollLead(lead.id, classId, ageGroup).then((s) => {
                if (s) after(`${s.name} 등록을 확정했어요. 이제 환영 안내를 보낼 차례예요.`);
              });
            }}
          />
          <LostSheet
            open={sheet === 'lost'}
            onClose={() => setSheet(null)}
            onSubmit={(reason) => {
              setSheet(null);
              ws.advanceLead(lead.id, 'lost', reason);
              after('정리했어요.');
            }}
          />
          <NewFormSheet
            key={`form-${sheet === 'form'}`}
            open={sheet === 'form'}
            leadId={lead.id}
            onClose={() => setSheet(null)}
            onSent={(_, message) =>
              after(message ?? '등록 신청서를 만들었어요. (예시 데이터라 실제로 보내지 않아요)')
            }
          />
        </>
      )}
    </Page>
  );
}

// ---------------------------------------------------------------------------

const md = (iso: string) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;

function NextControls({
  family,
  next,
  cls,
  concernFor,
  note,
  setNote,
  onCall,
  onConcernSave,
  onConcernCancel,
  onOpen,
  onMarkTrial,
  onWelcome,
}: {
  family: Family;
  next: NextAction;
  cls: { title: string; venue: string; schedule: { startTime: string; days: number[] } } | undefined;
  concernFor: CallKind | null;
  note: string;
  setNote: (v: string) => void;
  onCall: (kind: CallKind, outcome: TouchOutcome | 'lost' | 'enroll') => void;
  onConcernSave: () => void;
  onConcernCancel: () => void;
  onOpen: (sheet: 'trial' | 'enroll' | 'lost' | 'form') => void;
  onMarkTrial: (came: boolean) => void;
  onWelcome: (send: boolean) => void;
}) {
  const call = next.kind as CallKind;

  if (concernFor) {
    return (
      <div>
        <textarea
          autoFocus
          className={cn(inputClass, 'min-h-[84px] resize-none bg-canvas')}
          placeholder="무엇이 마음에 걸리는지 한 줄로"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="mt-3 flex gap-2">
          <PrimaryButton onClick={onConcernSave} className="flex-1">
            기록하기
          </PrimaryButton>
          <button type="button" onClick={onConcernCancel} className="px-4 text-[15px] text-steel">
            취소
          </button>
        </div>
      </div>
    );
  }

  if (next.channel === 'call' && CALL_RESULTS[call]) {
    return (
      <div>
        <PrimaryButton href={telHref(family.phone)}>
          <Phone size={17} strokeWidth={2.4} />
          전화 걸기
        </PrimaryButton>
        <p className="mb-2 mt-4 text-[13px] font-semibold text-steel">통화가 끝나면</p>
        <div className="grid grid-cols-2 gap-2">
          {CALL_RESULTS[call].map((r) => (
            <button
              key={r.label}
              type="button"
              onClick={() => onCall(call, r.outcome)}
              className="min-h-[46px] rounded-[12px] bg-canvas px-3 text-[14.5px] font-semibold text-ink shadow-[0_0_0_1px_rgba(0,0,0,0.06)] transition-colors hover:bg-[#FAFBFA] active:bg-surface-soft"
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  switch (next.kind) {
    case 'book_trial':
      return <PrimaryButton onClick={() => onOpen('trial')}>체험 날짜 잡기</PrimaryButton>;

    case 'mark_trial':
      return (
        <div className="grid grid-cols-2 gap-2">
          <PrimaryButton onClick={() => onMarkTrial(true)}>왔어요</PrimaryButton>
          <SecondaryButton onClick={() => onMarkTrial(false)} className="min-h-[52px]">
            오지 않았어요
          </SecondaryButton>
        </div>
      );

    case 'send_form':
      return (
        <div className="space-y-2">
          <PrimaryButton onClick={() => onOpen('form')}>등록 신청서 보내기</PrimaryButton>
          <SecondaryButton onClick={() => onOpen('enroll')}>신청서 없이 바로 등록</SecondaryButton>
        </div>
      );

    case 'enroll':
      return <PrimaryButton onClick={() => onOpen('enroll')}>등록 확정</PrimaryButton>;

    case 'welcome': {
      const enrolled = family.enrolledAt ?? TODAY;
      const first = firstClassOn(cls as never, addDays(enrolled, 1));
      return (
        <div>
          <div className="mb-4 rounded-[12px] bg-canvas px-4 py-1">
            <Facts
              items={[
                ['첫 수업', first ? `${formatDateKo(first)} ${cls?.schedule.startTime ?? ''}` : '코치가 안내'],
                ['장소', cls?.venue || '센터'],
                ['준비물', '운동복 · 축구화 · 물'],
              ]}
            />
          </div>
          <PrimaryButton onClick={() => onWelcome(true)}>환영 안내 보내기</PrimaryButton>
          <div className="mt-2 text-center">
            <TextLink tone="gray" onClick={() => onWelcome(false)}>
              직접 전했어요
            </TextLink>
          </div>
        </div>
      );
    }

    case 'wait':
    default:
      if (family.lead && family.phase === 'trial') {
        return (
          <SecondaryButton onClick={() => onOpen('trial')}>날짜 바꾸기</SecondaryButton>
        );
      }
      // Waiting on the 등록 신청서 — but a family that says yes on the phone
      // shouldn't have to wait for a form to be let in.
      if (family.lead && family.phase === 'decision') {
        return <SecondaryButton onClick={() => onOpen('enroll')}>신청서 없이 바로 등록</SecondaryButton>;
      }
      return family.phone ? (
        <a href={telHref(family.phone)} className="text-[14.5px] font-semibold text-primary">
          미리 전화해도 괜찮아요 →
        </a>
      ) : null;
  }
}

/** Four segments, 문의 → 첫 달, and the current phase's steps under them. */
function Journey({ family }: { family: Family }) {
  const current = PHASES.findIndex((p) => p.key === family.phase);
  const steps = family.steps.filter((s) => s.phase === family.phase);

  return (
    <section className="mt-9">
      <div className="grid grid-cols-4 gap-2">
        {PHASES.map((p, i) => (
          <div key={p.key}>
            <div
              className={cn(
                'h-[3px] rounded-full',
                i < current ? 'bg-primary' : i === current ? 'bg-primary/40' : 'bg-hairline',
              )}
            />
            <p
              className={cn(
                'mt-2 text-[13.5px] font-bold',
                i <= current ? 'text-primary' : 'text-stone',
              )}
            >
              {i + 1} {p.label}
            </p>
          </div>
        ))}
      </div>

      <ul className="mt-4 space-y-2.5">
        {steps.map((s) => (
          <li key={s.key} className="flex items-center gap-3 text-[15px]">
            <span
              className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                s.done ? 'bg-primary text-white' : 'border-[1.5px] border-hairline-strong',
              )}
            >
              {s.done && <Check size={12} strokeWidth={3} />}
            </span>
            <span className={cn('flex-1', s.done ? 'text-steel' : 'font-semibold text-ink')}>{s.label}</span>
            {s.detail && <span className="text-[13.5px] text-steel">{s.detail}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** A folded block, like the mockup's "질문·디자인 맞춤 설정 +". */
function Fold({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-hairline-soft">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between py-4 text-left"
      >
        <span className="text-[16px] text-ink">
          {title}
          {count !== undefined && <span className="ml-1.5 text-steel">{count}</span>}
        </span>
        <ChevronDown size={18} className={cn('text-steel transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="animate-swap-in pb-5">{children}</div>}
    </div>
  );
}

function Answers({
  family,
  surveys,
  recipients,
}: {
  family: Family;
  surveys: ReturnType<typeof useWorkspace>['surveys'];
  recipients: ReturnType<typeof useWorkspace>['recipients'];
}) {
  const lead = family.lead;
  const enrollmentIds = new Set(surveys.filter((v) => v.kind === 'enrollment').map((v) => v.id));
  const form = lead ? recipients.find((r) => r.leadId === lead.id && enrollmentIds.has(r.surveyId) && r.answeredAt) : undefined;
  const entries: Array<[string, string]> = [
    ...Object.entries(lead?.answers ?? {}),
    ...Object.entries(form?.answers ?? {}),
  ];
  if (entries.length === 0) return null;

  return (
    <Fold title="보호자가 적은 내용" count={entries.length}>
      <Facts items={entries.map(([q, a]) => [q, <span className="whitespace-pre-wrap">{a}</span>])} />
    </Fold>
  );
}

function Memo({
  leadId,
  memo,
  onSave,
}: {
  leadId: ID;
  memo: string;
  onSave: (id: ID, patch: { memo: string }, summary: string) => void;
}) {
  const [text, setText] = useState('');
  return (
    <Fold title="상담 메모">
      {memo && <p className="whitespace-pre-wrap text-[15px] leading-[1.65] text-slate">{memo}</p>}
      <textarea
        className={cn(inputClass, 'mt-3 min-h-[72px] resize-none')}
        placeholder="통화에서 들은 내용을 덧붙이세요"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="mt-2">
        <SecondaryButton
          disabled={!text.trim()}
          onClick={() => {
            onSave(leadId, { memo: memo ? `${memo}\n${text.trim()}` : text.trim() }, '상담 메모 추가');
            setText('');
          }}
        >
          메모 저장
        </SecondaryButton>
      </div>
    </Fold>
  );
}

function History({
  subjectIds,
  activity,
  touches,
}: {
  subjectIds: ID[];
  activity: ReturnType<typeof useWorkspace>['activity'];
  touches: ReturnType<typeof useWorkspace>['touches'];
}) {
  // Touches are already in the activity ledger when made here; the table rows
  // loaded from the database are not, so both are merged by time.
  const events = activity
    .filter((e) => subjectIds.includes(e.subjectId) && e.kind !== 'onboarding.touched')
    .map((e) => ({ at: e.at, title: e.summary, detail: e.detail, who: e.actorName }));
  const calls = touches.map((t) => ({
    at: t.at,
    title: `${STEP_LABEL[t.step]} · ${OUTCOME_LABEL[t.outcome]}`,
    detail: t.note || undefined,
    who: t.actorName,
  }));
  const all = [...events, ...calls].sort((a, b) => b.at.localeCompare(a.at));
  if (all.length === 0) return null;

  return (
    <Fold title="기록" count={all.length}>
      <ol className="space-y-3.5">
        {all.map((e, i) => (
          <li key={i}>
            <p className="text-[15px] font-semibold text-ink">{e.title}</p>
            {e.detail && <p className="mt-0.5 text-[14px] text-slate">{e.detail}</p>}
            <p className="mt-0.5 text-[12.5px] text-stone">
              {md(dayOf(e.at))} {timeOf(e.at)}
              {e.who && ` · ${e.who}`}
            </p>
          </li>
        ))}
      </ol>
    </Fold>
  );
}
