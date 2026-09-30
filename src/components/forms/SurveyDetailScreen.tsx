/**
 * One survey's results, in the order of what to do about them.
 *
 *   상담 필요 — families whose answer asked, in effect, for a conversation
 *               (a choice marked `!`, like "고민 중이에요"). Call, then 통화 완료.
 *   결과      — each pick as a bar; tap to see who.
 *   미응답    — who hasn't answered, and one reminder per family.
 *
 * Nothing here edits the survey: it's already in every family's KakaoTalk.
 */

import { useMemo, useState } from 'react';
import { Phone } from 'lucide-react';
import type { ID } from '@/types';
import { useApp } from '@/store/AppContext';
import { useWorkspace } from '@/store/WorkspaceContext';
import {
  SITUATIONS,
  dueLabel,
  flaggedAnswers,
  isOpenSurvey,
  progressOf,
  summaryText,
  tallyOf,
  type SurveyRecipient,
} from '@/data/surveys';
import { formatDateKo } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Toast } from '@/components/shell/Shell';
import { describeEnqueue, telHref } from './parts';
import {
  DemoNote,
  Eyebrow,
  Page,
  Section,
  SecondaryButton,
  Surface,
  TextLink,
  Title,
} from './ui';

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
  const mine = useMemo(() => recipients.filter((r) => r.surveyId === surveyId), [recipients, surveyId]);

  const who = useMemo(() => {
    const students = new Map(state.students.map((s) => [s.id, s]));
    const leadMap = new Map(leads.map((l) => [l.id, l]));
    return (r: SurveyRecipient) => {
      if (r.studentId) {
        const s = students.get(r.studentId);
        return { name: s?.name ?? '원생', phone: s?.parentPhone ?? '' };
      }
      const l = r.leadId ? leadMap.get(r.leadId) : undefined;
      return { name: l?.childName ?? '문의', phone: l?.parentPhone ?? '' };
    };
  }, [state.students, leads]);

  if (!survey) {
    return (
      <Page>
        <Title back={{ label: backLabel, onBack }} eyebrow="Sent" title="안내 없음" />
      </Page>
    );
  }

  const p = progressOf(survey, recipients);
  const open = isOpenSurvey(survey);
  const unreminded = p.pending.filter((r) => !r.remindedAt).length;
  const texts = survey.questions.filter((q) => q.choices.length === 0);
  const picks = survey.questions.filter((q) => q.choices.length > 0);
  const calling = new Set(p.toCall.map((r) => r.id));
  const classNames = survey.classIds
    .map((id) => state.classes.find((c) => c.id === id)?.title)
    .filter(Boolean)
    .join(' · ');

  const flash = (m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(null), 2200);
  };

  return (
    <Page>
      <Title
        back={{ label: backLabel, onBack }}
        eyebrow={SITUATIONS[survey.kind].label}
        title={survey.title}
        sub={`${classNames || '개별 발송'} · ${
          survey.dueDate && open ? `${formatDateKo(survey.dueDate)}까지` : dueLabel(survey)
        }`}
      />

      {/* --- Progress --------------------------------------------------------- */}
      <div className="mt-6 flex items-baseline gap-2">
        <strong className="text-[40px] font-bold leading-none tracking-[-0.05em] text-ink">
          {p.answered}
        </strong>
        <span className="text-[17px] font-semibold text-steel">/ {p.total} 응답</span>
      </div>
      <div className="mt-3 h-[5px] overflow-hidden rounded-full bg-hairline-soft">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${p.total ? (p.answered / p.total) * 100 : 0}%` }}
        />
      </div>

      {notice && <p className="mt-4 text-[14px] leading-[1.6] text-slate">{notice}</p>}

      {/* --- 상담 필요 --------------------------------------------------------- */}
      {p.toCall.length > 0 && (
        <Surface tone="alert" className="mt-7">
          <Eyebrow tone="alert">상담 필요 {p.toCall.length}</Eyebrow>
          <ul className="mt-3 divide-y divide-black/5">
            {p.toCall.map((r) => {
              const w = who(r);
              const said = texts.map((q) => r.answers[q.label]).filter(Boolean)[0];
              return (
                <li key={r.id} className="py-3.5 first:pt-1">
                  <div className="flex items-center gap-3">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[17px] font-bold text-ink">{w.name}</span>
                      <span className="mt-0.5 block text-[14px] font-semibold text-[#946216]">
                        {flaggedAnswers(survey, r).join(' · ')}
                      </span>
                    </span>
                    <a
                      href={telHref(w.phone)}
                      aria-label={`${w.name} 보호자에게 전화`}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-white"
                    >
                      <Phone size={17} strokeWidth={2.4} />
                    </a>
                  </div>
                  {said && <p className="mt-2 text-[14.5px] leading-[1.6] text-slate">“{said}”</p>}
                  <div className="mt-1">
                    <TextLink onClick={() => markCalled(r.id)}>통화 완료</TextLink>
                  </div>
                </li>
              );
            })}
          </ul>
        </Surface>
      )}

      {/* --- 결과 ------------------------------------------------------------- */}
      {picks.map((q) => {
        const tally = tallyOf(q, mine);
        const max = Math.max(1, ...tally.map((t) => t.recipientIds.length));
        return (
          <Section key={q.label} title={q.label}>
            <ul className="space-y-3">
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
                      <span className="flex items-baseline justify-between text-[15.5px]">
                        <span className={cn(t.flagged ? 'text-[#946216]' : 'text-ink')}>{t.choice}</span>
                        <span className="font-bold tabular-nums text-ink">{n}</span>
                      </span>
                      <span className="mt-1.5 block h-[5px] overflow-hidden rounded-full bg-hairline-soft">
                        <span
                          className={cn('block h-full rounded-full', t.flagged ? 'bg-[#D9A441]' : 'bg-primary')}
                          style={{ width: `${(n / max) * 100}%` }}
                        />
                      </span>
                    </button>
                    {shown && (
                      <p className="animate-swap-in mt-2 text-[14px] leading-[1.6] text-slate">
                        {t.recipientIds.map((id) => who(mine.find((r) => r.id === id)!).name).join(', ')}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </Section>
        );
      })}

      {texts.map((q) => {
        const said = mine.filter((r) => r.answeredAt && r.answers[q.label] && !calling.has(r.id));
        if (said.length === 0) return null;
        return (
          <Section key={q.label} title={q.label} aside={`${said.length}`}>
            <div className="divide-y divide-hairline-soft">
              {said.map((r) => (
                <div key={r.id} className="py-3">
                  <p className="whitespace-pre-wrap text-[15px] leading-[1.6] text-ink">{r.answers[q.label]}</p>
                  <p className="mt-1 text-[13px] text-stone">{who(r).name}</p>
                </div>
              ))}
            </div>
          </Section>
        );
      })}

      {/* --- 미응답 ----------------------------------------------------------- */}
      {p.pending.length > 0 && (
        <Section title="미응답" aside={`${p.pending.length}`}>
          <p className="text-[15px] leading-[1.7] text-slate">{p.pending.map((r) => who(r).name).join(', ')}</p>
          {open && (
            <div className="mt-4">
              <SecondaryButton
                disabled={unreminded === 0}
                onClick={() =>
                  void remindSurvey(survey.id).then((result) =>
                    result
                      ? setNotice(describeEnqueue(result, '마감 전'))
                      : flash(surveyMode === 'db' ? '보낼 대상 없음' : '예시 데이터: 실제 발송 없음'),
                  )
                }
              >
                {unreminded > 0 ? `미응답 ${unreminded}명에게 재알림` : '재알림 발송됨'}
              </SecondaryButton>
            </div>
          )}
        </Section>
      )}

      {/* --- Footer --------------------------------------------------------- */}
      <div className="mt-10 flex justify-center gap-6">
        <TextLink
          onClick={() => {
            void navigator.clipboard?.writeText(summaryText(survey, recipients, (r) => who(r).name));
            flash('복사됨');
          }}
        >
          결과 복사
        </TextLink>
        {open && (
          <TextLink tone="gray" onClick={() => (confirmClose ? closeSurvey(survey.id) : setConfirmClose(true))}>
            {confirmClose ? '한 번 더 누르면 마감' : '지금 마감'}
          </TextLink>
        )}
      </div>

      <DemoNote show={surveyMode === 'local'}>예시 데이터 · 새로고침 시 초기화</DemoNote>
      {toast && <Toast>{toast}</Toast>}
    </Page>
  );
}
