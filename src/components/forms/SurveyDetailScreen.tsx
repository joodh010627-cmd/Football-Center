/**
 * One survey: who to call, what they said, who hasn't answered.
 *
 * In that order, because that is the order of what the coach should do about
 * it. The call list opens the screen when there is one — a flagged answer is
 * the reason the survey was worth sending. The counts come next, as bars you
 * can open to see names (the 참가 list is what goes on the tournament entry).
 * The silent families are last, with one button: remind them, once.
 *
 * Nothing on this screen is an editor. A survey that is already in thirty
 * KakaoTalk chats does not get its questions changed under it.
 */

import { useMemo, useState } from 'react';
import { ArrowLeft, Bell, Check, Copy, MessageSquare, Phone } from 'lucide-react';
import type { ID } from '@/types';
import { useApp } from '@/store/AppContext';
import { useWorkspace } from '@/store/WorkspaceContext';
import {
  dueLabel,
  flaggedAnswers,
  isOpenSurvey,
  progressOf,
  summaryText,
  tallyOf,
  SITUATIONS,
  type SurveyRecipient,
} from '@/data/surveys';
import { formatDateKo } from '@/lib/format';
import { cn } from '@/lib/cn';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ScreenBody, Section, Toast } from '@/components/shell/Shell';
import { describeEnqueue, telHref } from './parts';

interface SurveyDetailScreenProps {
  surveyId: ID;
  onBack: () => void;
  backLabel: string;
  /** What happened to the 알림톡 when this survey was just sent. */
  notice?: string | null;
}

export function SurveyDetailScreen({
  surveyId,
  onBack,
  backLabel,
  notice: initialNotice = null,
}: SurveyDetailScreenProps) {
  const { state } = useApp();
  const { surveys, recipients, remindSurvey, closeSurvey, markCalled, leads, surveyMode } =
    useWorkspace();
  const [notice, setNotice] = useState<string | null>(initialNotice);
  const [openChoice, setOpenChoice] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);

  const survey = surveys.find((v) => v.id === surveyId);
  const mine = useMemo(
    () => recipients.filter((r) => r.surveyId === surveyId),
    [recipients, surveyId],
  );

  const who = useMemo(() => {
    const students = new Map(state.students.map((s) => [s.id, s]));
    const leadMap = new Map(leads.map((l) => [l.id, l]));
    return (r: SurveyRecipient) => {
      if (r.studentId) {
        const s = students.get(r.studentId);
        return { name: s?.name ?? '원생', phone: s?.parentPhone ?? '', parent: s?.parentName ?? '' };
      }
      const l = r.leadId ? leadMap.get(r.leadId) : undefined;
      return { name: l?.childName ?? '문의', phone: l?.parentPhone ?? '', parent: l?.parentName ?? '' };
    };
  }, [state.students, leads]);

  if (!survey) {
    return (
      <ScreenBody>
        <BackLink onBack={onBack} label={backLabel} />
        <p className="py-10 text-center text-[14px] text-steel">설문을 찾을 수 없습니다.</p>
      </ScreenBody>
    );
  }

  const p = progressOf(survey, recipients);
  const open = isOpenSurvey(survey);
  const unreminded = p.pending.filter((r) => !r.remindedAt).length;
  const answered = mine.filter((r) => r.answeredAt);
  const texts = survey.questions.filter((q) => q.choices.length === 0);
  const picks = survey.questions.filter((q) => q.choices.length > 0);
  const classNames = survey.classIds
    .map((id) => state.classes.find((c) => c.id === id)?.title)
    .filter(Boolean)
    .join(' · ');

  const flash = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2200);
  };

  const remind = async () => {
    const result = await remindSurvey(survey.id);
    if (result) setNotice(describeEnqueue(result, '마감 전'));
    else flash(surveyMode === 'db' ? '보낼 곳이 없습니다' : '예시 데이터에서는 보내지 않습니다');
  };

  const copy = () => {
    void navigator.clipboard?.writeText(summaryText(survey, recipients, (r) => who(r).name));
    flash('결과를 복사했습니다');
  };

  return (
    <>
      <header className="px-5 pb-1 pt-5 sm:px-7 lg:px-10 lg:pt-8">
        <BackLink onBack={onBack} label={backLabel} />
        <p className="mt-4 eyebrow-ink">{SITUATIONS[survey.kind].label}</p>
        <h1 className="mt-2 text-[25px] font-bold leading-[1.2] tracking-tightest text-ink">
          {survey.title}
        </h1>
        <p className="mt-1.5 text-[13.5px] text-steel">
          {classNames || '개별 발송'} ·{' '}
          {survey.dueDate && open ? `${formatDateKo(survey.dueDate)}까지` : dueLabel(survey)}
        </p>

        <div className="mt-4 flex items-center gap-3">
          <ProgressBar value={p.total ? p.answered / p.total : 0} className="h-2 flex-1" />
          <span className="shrink-0 text-[14px] font-bold tabular-nums text-ink">
            {p.answered}
            <span className="font-medium text-steel">/{p.total} 응답</span>
          </span>
        </div>
      </header>

      <ScreenBody>
        {notice && (
          <p className="mb-4 flex items-start gap-2 rounded-lg bg-primary-wash px-4 py-3 text-[13px] leading-[1.55] text-charcoal">
            <MessageSquare size={15} className="mt-0.5 shrink-0 text-primary" />
            {notice}
          </p>
        )}

        {/* --- Call list ------------------------------------------------ */}
        {p.toCall.length > 0 && (
          <section className="rounded-xl bg-gradient-to-br from-[#DCEEE4] to-[#F1F7F3] p-4">
            <p className="micro-label text-primary">전화할 집 {p.toCall.length}</p>
            <ul className="mt-2.5 space-y-2">
              {p.toCall.map((r) => {
                const w = who(r);
                const note = texts.map((q) => r.answers[q.label]).filter(Boolean)[0];
                return (
                  <li key={r.id} className="rounded-lg bg-canvas px-3.5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-semibold text-ink">{w.name}</span>
                        <span className="mt-0.5 block text-[12.5px] font-semibold text-primary">
                          {flaggedAnswers(survey, r).join(' · ')}
                        </span>
                      </span>
                      <a
                        href={telHref(w.phone)}
                        aria-label={`${w.name} 보호자에게 전화`}
                        className="pressable flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white"
                      >
                        <Phone size={16} strokeWidth={2.4} />
                      </a>
                      <button
                        type="button"
                        onClick={() => markCalled(r.id)}
                        className="pressable rounded-full border border-hairline-strong px-3 py-2 text-[12.5px] font-semibold text-slate"
                      >
                        통화함
                      </button>
                    </div>
                    {note && (
                      <p className="mt-2 text-[13px] leading-[1.55] text-slate">“{note}”</p>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* --- Counts ----------------------------------------------------- */}
        {picks.map((q) => {
          const tally = tallyOf(q, mine);
          const max = Math.max(1, ...tally.map((t) => t.recipientIds.length));
          return (
            <Section key={q.label} title={q.label}>
              <ul className="space-y-1.5">
                {tally.map((t) => {
                  const key = `${q.label}|${t.choice}`;
                  const shown = openChoice === key;
                  const n = t.recipientIds.length;
                  return (
                    <li key={t.choice}>
                      <button
                        type="button"
                        disabled={n === 0}
                        onClick={() => setOpenChoice(shown ? null : key)}
                        className="w-full text-left"
                      >
                        <span className="flex items-baseline justify-between text-[14px]">
                          <span className={cn('font-medium', t.flagged ? 'text-primary' : 'text-ink')}>
                            {t.choice}
                          </span>
                          <span className="tabular-nums font-bold text-ink">{n}</span>
                        </span>
                        <ProgressBar
                          value={n / max}
                          className="mt-1"
                          barClassName={t.flagged ? 'bg-brand-orange' : 'bg-primary'}
                        />
                      </button>
                      {shown && (
                        <p className="animate-swap-in mt-1.5 text-[12.5px] leading-[1.6] text-slate">
                          {t.recipientIds
                            .map((id) => who(mine.find((r) => r.id === id)!).name)
                            .join(', ')}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Section>
          );
        })}

        {/* --- Sentences ---------------------------------------------------- */}
        {texts.map((q) => {
          // Families on the call list already show what they wrote, up there.
          const calling = new Set(p.toCall.map((r) => r.id));
          const said = answered.filter((r) => r.answers[q.label] && !calling.has(r.id));
          if (said.length === 0) return null;
          return (
            <Section key={q.label} title={q.label} meta={`${said.length}`}>
              <ul className="space-y-2">
                {said.map((r) => (
                  <li key={r.id} className="rounded-lg border border-hairline bg-canvas px-3.5 py-2.5">
                    <p className="whitespace-pre-wrap text-[13.5px] leading-[1.6] text-ink">
                      {r.answers[q.label]}
                    </p>
                    <p className="mt-1 text-[12px] text-stone">{who(r).name}</p>
                  </li>
                ))}
              </ul>
            </Section>
          );
        })}

        {/* --- Silent families ------------------------------------------------ */}
        {p.pending.length > 0 && (
          <Section title="아직 답이 없는 집" meta={`${p.pending.length}`}>
            <p className="text-[13.5px] leading-[1.7] text-slate">
              {p.pending.map((r) => who(r).name).join(', ')}
            </p>
            {open && (
              <button
                type="button"
                disabled={unreminded === 0}
                onClick={() => void remind()}
                className="btn-secondary mt-3 w-full py-2.5 text-[13.5px] disabled:opacity-50"
              >
                <Bell size={14} strokeWidth={2.4} />
                {unreminded > 0 ? `${unreminded}가정에 한 번 더 알리기` : '다시 알림을 보냈습니다'}
              </button>
            )}
          </Section>
        )}

        {/* --- Footer actions ------------------------------------------------- */}
        <div className="mt-8 flex gap-2">
          <button
            type="button"
            onClick={copy}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-hairline py-2.5 text-[13.5px] font-semibold text-slate transition-colors hover:border-hairline-strong hover:text-ink"
          >
            <Copy size={14} strokeWidth={2.2} />
            결과 복사
          </button>
          {open && !survey.closed && (
            <button
              type="button"
              onClick={() => (confirmClose ? closeSurvey(survey.id) : setConfirmClose(true))}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-full border py-2.5 text-[13.5px] font-semibold transition-colors',
                confirmClose
                  ? 'border-error bg-tint-alert-soft text-error'
                  : 'border-hairline text-slate hover:border-hairline-strong hover:text-ink',
              )}
            >
              <Check size={14} strokeWidth={2.4} />
              {confirmClose ? '한 번 더 누르면 마감' : '지금 마감'}
            </button>
          )}
        </div>
      </ScreenBody>

      {toast && <Toast>{toast}</Toast>}
    </>
  );
}

function BackLink({ onBack, label }: { onBack: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="flex items-center gap-1 text-[13.5px] font-medium text-steel transition-colors hover:text-ink"
    >
      <ArrowLeft size={15} strokeWidth={2.2} />
      {label}
    </button>
  );
}
