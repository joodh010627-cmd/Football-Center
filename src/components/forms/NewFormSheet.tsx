/**
 * 새 폼 — pick the moment, check who it goes to, send.
 *
 * Two screens inside one sheet, and the second is already filled in. The
 * owner picks "참가 조사" and gets a title, the question, a three-day deadline
 * and their class ticked; the common case is 보내기 without typing a word.
 * The questions show as the parent will see them, not as an editor — the
 * text box only opens when asked for, and when it does it is the whole
 * editor: one line per question, three marks, nothing to learn first.
 *
 * A public 체험·상담 link lives here too, as one more thing to pick, because
 * to the person holding the phone it is one more form. Everything else about
 * it (the lead pipeline it feeds) stays on the 새 학부모 screen.
 */

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Link2, Phone, PencilLine } from 'lucide-react';
import type { ID } from '@/types';
import { useApp } from '@/store/AppContext';
import { useWorkspace } from '@/store/WorkspaceContext';
import {
  CALL_INSTEAD,
  DUE_CHOICES,
  PICKER,
  SITUATIONS,
  dueFromDays,
  parseQuestions,
  type Question,
  type SurveyKind,
} from '@/data/surveys';
import { CORE_FIELDS, OPTIONAL_FIELDS, defaultFields, formUrl, type FormKind } from '@/data/crm';
import { formatDateKo } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Modal } from '@/components/ui/Modal';
import { Swap } from '@/components/ui/Motion';
import { Field, describeEnqueue } from './parts';

type Step = 'pick' | 'survey' | 'intake';

interface NewFormSheetProps {
  open: boolean;
  onClose: () => void;
  /** A survey went out. `notice` is what happened to its 알림톡. */
  onSent: (surveyId: ID, notice: string | null) => void;
  /** A public link was made (and copied). */
  onLinkMade?: (message: string) => void;
  /**
   * Send to one family that hasn't enrolled yet. Skips the picker and the
   * class choice and starts on the 등록 신청서.
   */
  leadId?: ID;
  /** Open straight on this situation's setup, skipping the picker. */
  startKind?: SurveyKind;
}

export function NewFormSheet({
  open,
  onClose,
  onSent,
  onLinkMade,
  leadId,
  startKind,
}: NewFormSheetProps) {
  const { state } = useApp();
  const { sendSurvey, surveyMode, addFormLink, shareFormLink, getLead } = useWorkspace();

  const first: SurveyKind | undefined = leadId ? 'enrollment' : startKind;
  const start: Step = first ? 'survey' : 'pick';
  const preset = SITUATIONS[first ?? 'rsvp'];
  const [step, setStep] = useState<Step>(start);
  const [kind, setKind] = useState<SurveyKind>(preset.kind);
  const [title, setTitle] = useState(preset.title);
  const [text, setText] = useState(preset.questions);
  const [dueDays, setDueDays] = useState<number | null>(preset.dueDays);
  const [classIds, setClassIds] = useState<ID[]>(
    state.classes.length === 1 ? [state.classes[0].id] : [],
  );
  const [editing, setEditing] = useState(first === 'custom');
  const [busy, setBusy] = useState(false);

  // Public link state.
  const [linkTitle, setLinkTitle] = useState('체험 수업 신청');
  const [linkKind, setLinkKind] = useState<FormKind>('trial');
  const [fields, setFields] = useState<string[]>(defaultFields('trial'));

  const questions = useMemo(() => parseQuestions(text), [text]);
  const lead = leadId ? getLead(leadId) : undefined;

  const reachable = useMemo(
    () =>
      state.students.filter((s) => classIds.includes(s.classId) && s.status !== 'inactive').length,
    [state.students, classIds],
  );
  const families = leadId ? 1 : reachable;
  const allClasses = state.classes.length > 1 && classIds.length === state.classes.length;

  const reset = () => {
    setStep(start);
    setEditing(false);
    setBusy(false);
  };

  const close = () => {
    onClose();
    // After the exit animation, so the sheet doesn't visibly snap back.
    window.setTimeout(reset, 220);
  };

  const pick = (k: SurveyKind) => {
    const s = SITUATIONS[k];
    setKind(k);
    setTitle(s.title);
    setText(s.questions);
    setDueDays(s.dueDays);
    // 직접 만들기 has nothing to show but the editor, so open it.
    setEditing(k === 'custom');
    setStep('survey');
  };

  const ready =
    title.trim().length > 0 && questions.length > 0 && families > 0 && !busy;

  const send = async () => {
    if (!ready) return;
    setBusy(true);
    const { survey, result } = await sendSurvey({
      kind,
      title: title.trim().slice(0, 80),
      questions,
      dueDate: dueFromDays(dueDays),
      ...(leadId ? { leadId } : { classIds }),
    });
    onSent(survey.id, result ? describeEnqueue(result, '설문') : null);
    close();
  };

  const makeLink = () => {
    const link = addFormLink({ title: linkTitle.trim(), kind: linkKind, fields });
    void navigator.clipboard?.writeText(formUrl(link.slug));
    shareFormLink(link.id);
    onLinkMade?.('링크를 만들고 복사했습니다. 카카오톡이나 인스타그램에 붙여 넣으세요.');
    close();
  };

  const toggleField = (field: string) =>
    setFields((current) => {
      const next = current.includes(field)
        ? current.filter((f) => f !== field)
        : [...current, field];
      const order = [...CORE_FIELDS, ...OPTIONAL_FIELDS] as string[];
      return next.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    });

  const heading =
    step === 'pick' ? (
      '무엇을 물을까요?'
    ) : (
      <span className="flex items-center gap-1">
        {!leadId && (
          <button
            type="button"
            onClick={() => setStep('pick')}
            aria-label="뒤로"
            className="-ml-2 rounded-full p-1 text-steel transition-colors hover:bg-surface hover:text-ink"
          >
            <ChevronLeft size={20} />
          </button>
        )}
        {step === 'intake' ? '체험·상담 신청 링크' : leadId ? `${lead?.childName ?? ''} 등록 신청서` : SITUATIONS[kind].label}
      </span>
    );

  const footer =
    step === 'survey' ? (
      <button
        type="button"
        disabled={!ready}
        onClick={() => void send()}
        className="btn-primary w-full py-3 text-[15px]"
      >
        {busy
          ? '보내는 중…'
          : families === 0
            ? '받을 반을 골라 주세요'
            : surveyMode === 'db'
              ? `${families}가정에 알림톡으로 보내기`
              : `${families}가정 설문 만들기 (예시 데이터)`}
      </button>
    ) : step === 'intake' ? (
      <button
        type="button"
        disabled={linkTitle.trim().length === 0}
        onClick={makeLink}
        className="btn-primary w-full py-3 text-[15px]"
      >
        링크 만들고 복사하기
      </button>
    ) : undefined;

  return (
    <Modal open={open} onClose={close} variant="sheet" title={heading} footer={footer}>
      <Swap k={step}>
        {step === 'pick' && (
          <Picker onPick={pick} onIntake={() => setStep('intake')} />
        )}

        {step === 'survey' && (
          <div className="space-y-5">
            {!leadId && (
              <Field group label="받는 반" hint={families > 0 ? `${families}가정 · 휴원 제외` : undefined}>
                <div className="flex flex-wrap gap-1">
                  {state.classes.length > 1 && (
                    <button
                      type="button"
                      aria-pressed={allClasses}
                      onClick={() =>
                        setClassIds(allClasses ? [] : state.classes.map((c) => c.id))
                      }
                      className={cn(
                        'pill-tab !px-3 !py-1 !text-[12.5px]',
                        allClasses && 'pill-tab-active',
                      )}
                    >
                      전체
                    </button>
                  )}
                  {state.classes.map((c) => {
                    const on = classIds.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          setClassIds((ids) =>
                            on ? ids.filter((x) => x !== c.id) : [...ids, c.id],
                          )
                        }
                        className={cn(
                          'pill-tab !px-3 !py-1 !text-[12.5px]',
                          on && !allClasses && 'pill-tab-active',
                        )}
                      >
                        {c.title}
                      </button>
                    );
                  })}
                </div>
              </Field>
            )}

            <Field label="제목" hint="알림톡 첫 줄에 들어갑니다">
              <input
                className="input-field"
                value={title}
                maxLength={80}
                placeholder="예: 10월 리그 참가 조사"
                onChange={(e) => setTitle(e.target.value)}
              />
            </Field>

            <Field
              group
              label="마감"
              hint={dueDays !== null ? formatDateKo(dueFromDays(dueDays)!) : '직접 마감할 때까지'}
            >
              <div className="flex gap-1.5">
                {DUE_CHOICES.map((d) => (
                  <button
                    key={d.label}
                    type="button"
                    onClick={() => setDueDays(d.days)}
                    className={cn(
                      'pill-tab flex-1 !px-0 !py-1.5 !text-[13px]',
                      dueDays === d.days && 'pill-tab-active',
                    )}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </Field>

            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-[13px] font-semibold text-charcoal">
                  질문 {questions.length > 0 && questions.length}
                </span>
                <button
                  type="button"
                  onClick={() => setEditing((v) => !v)}
                  className="flex items-center gap-1 text-[12.5px] font-semibold text-primary"
                >
                  <PencilLine size={13} strokeWidth={2.4} />
                  {editing ? '미리보기' : '텍스트로 고치기'}
                </button>
              </div>

              {editing ? (
                <QuestionEditor text={text} onChange={setText} />
              ) : (
                <QuestionPreview questions={questions} />
              )}
            </div>
          </div>
        )}

        {step === 'intake' && (
          <div className="space-y-5">
            <Field label="제목" hint="학부모에게 보이는 이름">
              <input
                className="input-field"
                value={linkTitle}
                onChange={(e) => setLinkTitle(e.target.value)}
              />
            </Field>

            <Field group label="받는 것">
              <div className="flex gap-1.5">
                {(['trial', 'inquiry'] as FormKind[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => {
                      setLinkKind(k);
                      setFields(defaultFields(k));
                    }}
                    className={cn('pill-tab flex-1 !py-1.5 !text-[13px]', linkKind === k && 'pill-tab-active')}
                  >
                    {k === 'trial' ? '체험 신청' : '일반 문의'}
                  </button>
                ))}
              </div>
            </Field>

            <Field group label="물을 항목" hint="보호자 성함·연락처는 항상">
              <div className="flex flex-wrap gap-1.5">
                {OPTIONAL_FIELDS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => toggleField(f)}
                    aria-pressed={fields.includes(f)}
                    className={cn('pill-tab !py-1.5 !text-[13px]', fields.includes(f) && 'pill-tab-active')}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </Field>

            <p className="text-[12.5px] leading-[1.6] text-steel">
              접수된 내용은 <strong className="font-semibold text-slate">새 학부모</strong>에 바로
              들어옵니다. 첫 연락은 전화로 — 하루를 넘기면 알림이 뜹니다.
            </p>
          </div>
        )}
      </Swap>
    </Modal>
  );
}

// ---------------------------------------------------------------------------

function Picker({ onPick, onIntake }: { onPick: (k: SurveyKind) => void; onIntake: () => void }) {
  return (
    <div>
      <p className="text-[12.5px] font-semibold text-steel">재원생 보호자에게</p>
      <ul className="mt-2 overflow-hidden rounded-lg border border-hairline">
        {PICKER.map((k) => (
          <li key={k} className="border-b border-hairline-soft last:border-b-0">
            <button
              type="button"
              onClick={() => onPick(k)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-surface-soft"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-ink">
                  {SITUATIONS[k].label}
                </span>
                <span className="mt-0.5 block truncate text-[12.5px] text-steel">
                  {SITUATIONS[k].when}
                </span>
              </span>
              <ChevronRight size={16} className="shrink-0 text-stone" />
            </button>
          </li>
        ))}
      </ul>

      <p className="mt-5 text-[12.5px] font-semibold text-steel">처음 오는 학부모에게</p>
      <button
        type="button"
        onClick={onIntake}
        className="mt-2 flex w-full items-center gap-3 rounded-lg border border-hairline px-4 py-3 text-left transition-colors duration-150 hover:bg-surface-soft"
      >
        <Link2 size={16} className="shrink-0 text-primary" />
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-ink">체험·상담 신청 링크</span>
          <span className="mt-0.5 block truncate text-[12.5px] text-steel">
            누구나 여는 링크 · SNS·전단에
          </span>
        </span>
        <ChevronRight size={16} className="shrink-0 text-stone" />
      </button>

      <p className="mt-5 flex items-start gap-2 rounded-md bg-surface px-3.5 py-3 text-[12.5px] leading-[1.6] text-steel">
        <Phone size={13} className="mt-[3px] shrink-0" />
        <span>
          <strong className="font-semibold text-slate">전화가 나은 일</strong> — {CALL_INSTEAD}.
          폼으로 물으면 대화를 피하는 것처럼 읽힙니다.
        </span>
      </p>
    </div>
  );
}

/** The questions as a parent will meet them, small. */
function QuestionPreview({ questions }: { questions: Question[] }) {
  if (questions.length === 0) {
    return (
      <p className="mt-2 rounded-lg border border-dashed border-hairline-strong px-4 py-5 text-center text-[13px] text-steel">
        질문이 없습니다. 텍스트로 고치기를 눌러 적어 주세요.
      </p>
    );
  }

  return (
    <ol className="mt-2 space-y-3 rounded-lg bg-surface-soft px-4 py-3.5">
      {questions.map((q, i) => (
        <li key={q.label}>
          <p className="text-[13.5px] font-semibold text-ink">
            <span className="mr-1.5 tabular-nums text-stone">{i + 1}</span>
            {q.label}
            {q.multi && <span className="ml-1.5 text-[11.5px] font-medium text-steel">여러 개</span>}
          </p>
          {q.choices.length > 0 ? (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {q.choices.map((c) => (
                <span
                  key={c}
                  className={cn(
                    'flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px]',
                    q.flagged.includes(c)
                      ? 'border-primary/30 bg-primary-wash text-primary'
                      : 'border-hairline bg-canvas text-slate',
                  )}
                >
                  {q.flagged.includes(c) && <Phone size={10} strokeWidth={2.6} />}
                  {c}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-[12px] text-stone">자유롭게 쓰는 칸</p>
          )}
        </li>
      ))}
      {questions.some((q) => q.flagged.length > 0) && (
        <li className="flex items-center gap-1.5 border-t border-hairline-soft pt-2.5 text-[12px] text-steel">
          <Phone size={11} strokeWidth={2.6} className="text-primary" />이 답을 고른 집은 전화 목록에
          올라옵니다
        </li>
      )}
    </ol>
  );
}

function QuestionEditor({ text, onChange }: { text: string; onChange: (t: string) => void }) {
  return (
    <div className="mt-2">
      <textarea
        className="input-field min-h-[132px] resize-y !text-[14px] leading-[1.75]"
        value={text}
        spellCheck={false}
        placeholder={'참가하나요? : 참가 / 불참\n코치에게 전할 말'}
        onChange={(e) => onChange(e.target.value)}
      />
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12px] leading-[1.5] text-steel">
        <dt className="font-semibold text-slate">한 줄</dt>
        <dd>질문 하나. 그냥 쓰면 서술형</dd>
        <dt className="font-semibold text-slate">: A / B</dt>
        <dd>고르는 질문</dd>
        <dt className="font-semibold text-slate">(복수)</dt>
        <dd>질문에 붙이면 여러 개 고르기</dd>
        <dt className="font-semibold text-slate">B!</dt>
        <dd>이 답을 고르면 전화 목록에</dd>
      </dl>
    </div>
  );
}
