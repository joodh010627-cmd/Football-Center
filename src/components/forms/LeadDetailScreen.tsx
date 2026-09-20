/**
 * One enquiry, end to end.
 *
 * The checklist is the spine, not the stage pill. A lead's stage says where the
 * *conversation* is; the checklist says what is actually outstanding, and those
 * two genuinely come apart — a parent can pay before the trial, the uniform
 * order goes in whenever it goes in, and a centre that only tracks the stage
 * loses the child on the step nobody owns.
 *
 * Everything on this screen writes to the ledger. Six weeks later, when a parent
 * asks why nobody called them back, the answer is on the 활동 timeline at the
 * bottom rather than in somebody's memory of a Tuesday.
 */

import { useMemo, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  CalendarPlus,
  Check,
  MessageSquare,
  Phone,
  UserMinus,
  UserPlus,
} from 'lucide-react';
import type { Class, ID } from '@/types';
import { useApp } from '@/store/AppContext';
import { useWorkspace } from '@/store/WorkspaceContext';
import { TODAY, addDays } from '@/data/dates';
import {
  daysWaiting,
  isOverdue,
  nextStage,
  onboardingSteps,
  SOURCE_LABEL,
  STAGE_META,
  type LeadStage,
} from '@/data/crm';
import { ACTIVITY_META } from '@/data/activity';
import { dayOf, timeOf } from '@/data/dates';
import { formatDateKo } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Modal } from '@/components/ui/Modal';
import { ScreenBody, Section } from '@/components/shell/Shell';

interface LeadDetailScreenProps {
  leadId: ID;
  onBack: () => void;
  onOpenClass: (cls: Class) => void;
}

export function LeadDetailScreen({ leadId, onBack, onOpenClass }: LeadDetailScreenProps) {
  const { state } = useApp();
  const { getLead, activity, advanceLead, bookTrial, updateLead } = useWorkspace();
  const [booking, setBooking] = useState(false);
  const [closing, setClosing] = useState(false);
  const [memo, setMemo] = useState('');

  const lead = getLead(leadId);

  const timeline = useMemo(
    () => activity.filter((e) => e.subjectId === leadId),
    [activity, leadId],
  );

  if (!lead) {
    return (
      <ScreenBody>
        <BackLink onBack={onBack} />
        <p className="py-10 text-center text-[14px] text-steel">문의를 찾을 수 없습니다.</p>
      </ScreenBody>
    );
  }

  const meta = STAGE_META[lead.stage];
  const next = nextStage(lead.stage);
  const late = isOverdue(lead);
  const steps = onboardingSteps(lead);
  const done = steps.filter((s) => s.done).length;
  const interestClass = lead.interestClassId
    ? (state.classes.find((c) => c.id === lead.interestClassId) ?? null)
    : null;

  return (
    <>
      <header className="px-5 pb-1 pt-5 sm:px-7 lg:px-10 lg:pt-8">
        <BackLink onBack={onBack} />

        <div className="mt-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[27px] font-bold leading-[1.15] tracking-tightest text-ink">
              {lead.childName}
              <span className="ml-2 text-[17px] font-semibold text-slate">{lead.ageLabel}</span>
            </h1>
            <p className="mt-1.5 text-[13.5px] text-steel">
              {lead.parentName ? `${lead.parentName} 학부모 · ` : ''}
              {SOURCE_LABEL[lead.source]} · {daysWaiting(lead)}일째 {meta.label}
            </p>
          </div>
          <span
            className={cn(
              'shrink-0 rounded-full px-3 py-1.5 text-[12px] font-bold',
              late ? 'bg-tint-alert text-error' : meta.pill,
            )}
          >
            {late ? '응대 지연' : meta.label}
          </span>
        </div>
      </header>

      <ScreenBody>
        {/* --- Contact rail ---------------------------------------------- */}
        <div className="flex gap-2">
          <a
            href={`tel:${lead.parentPhone.replace(/-/g, '')}`}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-primary py-3 text-[14.5px] font-semibold text-white transition-colors duration-200 hover:bg-primary-pressed"
          >
            <Phone size={15} strokeWidth={2.4} />
            {lead.parentPhone || '번호 없음'}
          </a>
          <a
            href={`sms:${lead.parentPhone.replace(/-/g, '')}`}
            className="flex items-center justify-center gap-1.5 rounded-full border border-hairline-strong px-5 py-3 text-[14.5px] font-semibold text-slate transition-colors duration-200 hover:border-primary hover:text-primary"
          >
            <MessageSquare size={15} strokeWidth={2.2} />
            문자
          </a>
        </div>

        {/* --- Stage actions ---------------------------------------------- */}
        <div className="mt-3 rounded-lg border border-hairline bg-canvas px-4 py-4">
          <p className="text-[13.5px] leading-[1.55] text-charcoal">{meta.duty}</p>

          <div className="mt-3.5 flex flex-wrap gap-2">
            {lead.stage === 'contacted' || lead.stage === 'inquiry' ? (
              <button
                type="button"
                onClick={() => setBooking(true)}
                className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-[13.5px] font-semibold text-white transition-colors duration-200 hover:bg-primary-pressed"
              >
                <CalendarPlus size={14} strokeWidth={2.4} />
                체험 예약
              </button>
            ) : null}

            {next && (
              <button
                type="button"
                onClick={() => advanceLead(lead.id, next)}
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[13.5px] font-semibold transition-colors duration-200',
                  lead.stage === 'inquiry' || lead.stage === 'contacted'
                    ? 'border border-hairline-strong text-slate hover:border-primary hover:text-primary'
                    : 'bg-primary text-white hover:bg-primary-pressed',
                )}
              >
                {next === 'enrolled' ? (
                  <UserPlus size={14} strokeWidth={2.4} />
                ) : (
                  <Check size={14} strokeWidth={2.6} />
                )}
                {meta.action}
              </button>
            )}

            {lead.stage !== 'lost' && lead.stage !== 'enrolled' && (
              <button
                type="button"
                onClick={() => setClosing(true)}
                className="flex items-center gap-1.5 rounded-full px-3 py-2.5 text-[13.5px] font-medium text-steel transition-colors duration-200 hover:text-error"
              >
                <UserMinus size={14} strokeWidth={2.2} />
                미등록 처리
              </button>
            )}
          </div>

          {lead.stage === 'lost' && lead.lostReason && (
            <p className="mt-3 rounded-md bg-surface px-3.5 py-2.5 text-[13px] leading-[1.6] text-slate">
              미등록 사유 — {lead.lostReason}
            </p>
          )}
        </div>

        {/* --- Onboarding checklist ---------------------------------------- */}
        <Section title="온보딩 진행" meta={`${done}/${steps.length}`}>
          <ul className="overflow-hidden rounded-lg border border-hairline bg-canvas">
            {steps.map((step) => (
              <li
                key={step.key}
                className="flex items-start gap-3 border-b border-hairline-soft px-4 py-3 last:border-b-0"
              >
                <span
                  className={cn(
                    'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                    step.done ? 'bg-primary text-white' : 'border border-hairline-strong',
                  )}
                >
                  {step.done && <Check size={12} strokeWidth={3} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      'block text-[14.5px] font-semibold',
                      step.done ? 'text-steel line-through decoration-hairline-strong' : 'text-ink',
                    )}
                  >
                    {step.label}
                  </span>
                  {!step.done && (
                    <span className="mt-0.5 block text-[12.5px] text-stone">{step.hint}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Section>

        {/* --- Details ------------------------------------------------------ */}
        <Section title="상세">
          <dl className="overflow-hidden rounded-lg border border-hairline bg-canvas">
            <Row label="체험 일정">
              {lead.trialDate ? (
                <button
                  type="button"
                  onClick={() => setBooking(true)}
                  className="font-semibold text-primary"
                >
                  {formatDateKo(lead.trialDate)}
                </button>
              ) : (
                <button type="button" onClick={() => setBooking(true)} className="text-primary">
                  날짜 잡기
                </button>
              )}
            </Row>
            <Row label="관심 클래스">
              {interestClass ? (
                <button
                  type="button"
                  onClick={() => onOpenClass(interestClass)}
                  className="font-semibold text-primary"
                >
                  {interestClass.title}
                </button>
              ) : (
                <span className="text-stone">미정</span>
              )}
            </Row>
            <Row label="접수일">{formatDateKo(dayOf(lead.createdAt))}</Row>
            <Row label="유입 경로">{SOURCE_LABEL[lead.source]}</Row>
          </dl>

          <div className="mt-3 rounded-lg border border-hairline bg-canvas p-4">
            <p className="text-[13px] font-semibold text-charcoal">상담 메모</p>
            {lead.memo && (
              <p className="mt-2 rounded-md bg-surface px-3.5 py-2.5 text-[13.5px] leading-[1.65] text-slate">
                {lead.memo}
              </p>
            )}
            <textarea
              className="input-field mt-2 min-h-[64px] resize-none"
              placeholder="통화 내용을 덧붙이세요"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
            />
            <button
              type="button"
              disabled={memo.trim().length === 0}
              onClick={() => {
                updateLead(
                  lead.id,
                  { memo: lead.memo ? `${lead.memo}\n${memo.trim()}` : memo.trim() },
                  '상담 메모 추가',
                );
                setMemo('');
              }}
              className="btn-secondary mt-2 w-full py-2.5 text-[13.5px] disabled:opacity-40"
            >
              메모 저장
            </button>
          </div>
        </Section>

        {/* --- Ledger -------------------------------------------------------- */}
        <Section title="활동 기록" meta={`${timeline.length}건`}>
          {timeline.length === 0 ? (
            <p className="rounded-lg border border-dashed border-hairline-strong bg-canvas px-4 py-7 text-center text-[13px] text-steel">
              이 문의로 기록된 활동이 아직 없습니다.
            </p>
          ) : (
            <ol className="relative space-y-4 border-l border-hairline-soft pl-4">
              {timeline.map((event) => (
                <li key={event.id} className="relative">
                  <span
                    className={cn(
                      'absolute -left-[21px] top-1.5 h-2 w-2 rounded-full ring-2 ring-surface-soft',
                      ACTIVITY_META[event.kind].dot,
                    )}
                  />
                  <p className="text-[14px] font-semibold text-ink">{event.summary}</p>
                  {event.detail && (
                    <p className="mt-0.5 text-[13px] leading-[1.55] text-slate">{event.detail}</p>
                  )}
                  <p className="mt-0.5 text-[12px] text-stone">
                    {dayOf(event.at).slice(5).replace('-', '/')} {timeOf(event.at)}
                    {event.actorName && ` · ${event.actorName}`}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </Section>
      </ScreenBody>

      {/* Keyed on its defaults so reopening after a change starts from the
          lead's current trial date rather than the one it mounted with. */}
      <TrialBooker
        key={`${lead.trialDate ?? ''}-${lead.trialClassId ?? ''}`}
        open={booking}
        defaultDate={lead.trialDate ?? addDays(TODAY, 2)}
        defaultClassId={lead.trialClassId ?? lead.interestClassId ?? ''}
        onClose={() => setBooking(false)}
        onSubmit={(date, classId) => {
          bookTrial(lead.id, date, classId || null);
          setBooking(false);
        }}
      />

      <Modal
        open={closing}
        onClose={() => setClosing(false)}
        variant="sheet"
        title="미등록으로 정리"
        footer={
          <button
            type="button"
            onClick={() => {
              advanceLead(lead.id, 'lost' as LeadStage, memo.trim());
              setMemo('');
              setClosing(false);
            }}
            className="btn-primary w-full py-3 text-[15px]"
          >
            미등록 처리
          </button>
        }
      >
        <p className="text-[13.5px] leading-[1.65] text-slate">
          기록은 지워지지 않습니다. 등록으로 이어지지 않은 이유가 쌓여야 다음 문의에서 같은 이유로
          놓치지 않습니다.
        </p>
        <textarea
          className="input-field mt-3 min-h-[80px] resize-none"
          placeholder="예: 거리가 멀어 통원이 어렵다고 함"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
        />
      </Modal>
    </>
  );
}

// ---------------------------------------------------------------------------

function TrialBooker({
  open,
  defaultDate,
  defaultClassId,
  onClose,
  onSubmit,
}: {
  open: boolean;
  defaultDate: string;
  defaultClassId: string;
  onClose: () => void;
  onSubmit: (date: string, classId: string) => void;
}) {
  const { state } = useApp();
  const [date, setDate] = useState(defaultDate);
  const [classId, setClassId] = useState(defaultClassId);

  return (
    <Modal
      open={open}
      onClose={onClose}
      variant="sheet"
      title="체험 수업 예약"
      footer={
        <button
          type="button"
          onClick={() => onSubmit(date, classId)}
          className="btn-primary w-full py-3 text-[15px]"
        >
          예약하고 일정에 추가
        </button>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className="text-[13px] font-semibold text-charcoal">체험 날짜</span>
          <input
            type="date"
            className="input-field mt-1.5"
            value={date}
            min={TODAY}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>

        <label className="block">
          <span className="text-[13px] font-semibold text-charcoal">참여할 클래스</span>
          <select
            className="input-field mt-1.5"
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
          >
            <option value="">미정</option>
            {state.classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </label>

        <p className="rounded-md bg-surface px-3.5 py-3 text-[12.5px] leading-[1.6] text-steel">
          예약한 체험은 <strong className="font-semibold text-slate">일정</strong> 탭의 해당 날짜에
          수업과 나란히 표시됩니다. 담당 코치가 모르는 체험이 생기지 않도록.
        </p>
      </div>
    </Modal>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-hairline-soft px-4 py-3 last:border-b-0">
      <dt className="shrink-0 text-[13.5px] text-steel">{label}</dt>
      <dd className="min-w-0 truncate text-right text-[14px] text-ink">{children}</dd>
    </div>
  );
}

function BackLink({ onBack }: { onBack: () => void }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="flex items-center gap-1 text-[13.5px] font-medium text-steel transition-colors hover:text-ink"
    >
      <ArrowLeft size={15} strokeWidth={2.2} />
      문의 목록
    </button>
  );
}
