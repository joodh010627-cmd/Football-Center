/**
 * 안내 만들기 — pick the moment, check who it goes to, send.
 *
 * The sheet is opened from one of the root's four doors, so it already knows
 * roughly what the owner wants: 참가 신청 opens straight on the 참가 조사,
 * 의견 듣기 offers only 재등록 의향 and 만족도. The setup screen arrives
 * filled in — title, questions, deadline — and the common case is choosing a
 * class and sending. Questions show as the parent will see them; the text
 * editor opens only when asked for, and it is the whole editor: one line per
 * question, three marks.
 *
 * Also used for the 등록 신청서 (`leadId`: one family, no class choice) and
 * for a public 체험 신청 link (`intake`), because to the person holding the
 * phone each is just "the form I need to send now".
 */

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Phone } from 'lucide-react';
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
import { OPTIONAL_FIELDS, CORE_FIELDS, defaultFields, formUrl, type FormKind } from '@/data/crm';
import { formatDateKo } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Modal } from '@/components/ui/Modal';
import { Swap } from '@/components/ui/Motion';
import { describeEnqueue } from './parts';
import { Field, Pills, PrimaryButton, TextLink, inputClass } from './ui';

type Step = 'pick' | 'survey' | 'intake';

interface NewFormSheetProps {
  open: boolean;
  onClose: () => void;
  /** A survey went out. `notice` is what happened to its 알림톡. */
  onSent: (surveyId: ID, notice: string | null) => void;
  /** A public link was made (and copied). */
  onLinkMade?: (message: string) => void;
  /** Only these situations. One kind skips the picker. */
  kinds?: SurveyKind[];
  /** One family that hasn't enrolled yet: the 등록 신청서. */
  leadId?: ID;
  /** Make a public 체험 신청 link instead of a survey. */
  intake?: boolean;
}

export function NewFormSheet({
  open,
  onClose,
  onSent,
  onLinkMade,
  kinds,
  leadId,
  intake = false,
}: NewFormSheetProps) {
  const { state } = useApp();
  const { sendSurvey, surveyMode, addFormLink, shareFormLink, getLead } = useWorkspace();

  const offered = (kinds ?? [...PICKER]).filter((k) => k !== 'enrollment');
  const first: SurveyKind | undefined = leadId
    ? 'enrollment'
    : offered.length === 1
      ? offered[0]
      : undefined;
  const start: Step = intake ? 'intake' : first ? 'survey' : 'pick';
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

  const pick = (k: SurveyKind) => {
    const s = SITUATIONS[k];
    setKind(k);
    setTitle(s.title);
    setText(s.questions);
    setDueDays(s.dueDays);
    setEditing(k === 'custom');
    setStep('survey');
  };

  const ready = title.trim().length > 0 && questions.length > 0 && families > 0 && !busy;

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
    setBusy(false);
    onSent(survey.id, result ? describeEnqueue(result, leadId ? '등록 신청서' : '안내') : null);
    onClose();
  };

  const makeLink = () => {
    const link = addFormLink({ title: linkTitle.trim(), kind: linkKind, fields });
    void navigator.clipboard?.writeText(formUrl(link.slug));
    shareFormLink(link.id);
    onLinkMade?.('링크를 만들고 복사했어요');
    onClose();
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
      '무엇을 물어볼까요?'
    ) : step === 'intake' ? (
      '체험 신청 링크'
    ) : (
      <span className="flex items-center gap-1">
        {!first && (
          <button
            type="button"
            onClick={() => setStep('pick')}
            aria-label="뒤로"
            className="-ml-2 rounded-full p-1 text-steel hover:text-ink"
          >
            <ChevronLeft size={20} />
          </button>
        )}
        {leadId ? `${lead?.childName ?? ''} 등록 신청서` : SITUATIONS[kind].label}
      </span>
    );

  const footer =
    step === 'survey' ? (
      <PrimaryButton disabled={!ready} onClick={() => void send()}>
        {busy
          ? '보내는 중…'
          : families === 0
            ? '받을 반을 골라 주세요'
            : surveyMode === 'db'
              ? `${families}가족에게 알림톡 보내기`
              : `${families}가족에게 보내기 (예시)`}
      </PrimaryButton>
    ) : step === 'intake' ? (
      <PrimaryButton disabled={linkTitle.trim().length === 0} onClick={makeLink}>
        링크 만들고 복사하기
      </PrimaryButton>
    ) : undefined;

  return (
    <Modal open={open} onClose={onClose} variant="sheet" title={heading} footer={footer}>
      <Swap k={step}>
        {step === 'pick' && (
          <div>
            <div className="divide-y divide-hairline-soft">
              {offered.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => pick(k)}
                  className="flex w-full items-center gap-3 py-4 text-left active:opacity-60"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[17px] font-bold text-ink">{SITUATIONS[k].label}</span>
                    <span className="mt-1 block text-[14px] text-steel">{SITUATIONS[k].when}</span>
                  </span>
                  <ChevronRight size={18} className="shrink-0 text-stone" />
                </button>
              ))}
            </div>
            <p className="mt-4 flex items-start gap-2 rounded-[14px] bg-[#F6F8F6] px-4 py-3.5 text-[13.5px] leading-[1.6] text-steel">
              <Phone size={14} className="mt-[3px] shrink-0" />
              <span>
                <strong className="font-semibold text-slate">이런 일은 전화로</strong> — {CALL_INSTEAD}
              </span>
            </p>
          </div>
        )}

        {step === 'survey' && (
          <div>
            {!leadId && (
              <Field label="받는 반" hint={families > 0 ? `${families}가족 · 휴원 제외` : undefined}>
                <Pills
                  options={[
                    ...(state.classes.length > 1 ? ([['__all', '전체']] as const) : []),
                    ...state.classes.map((c) => [c.id, c.title] as const),
                  ]}
                  pressed={allClasses ? ['__all'] : classIds}
                  onPick={(id) =>
                    id === '__all'
                      ? setClassIds(allClasses ? [] : state.classes.map((c) => c.id))
                      : setClassIds((ids) =>
                          allClasses
                            ? [id]
                            : ids.includes(id)
                              ? ids.filter((x) => x !== id)
                              : [...ids, id],
                        )
                  }
                />
              </Field>
            )}

            <Field label="제목" hint="알림톡 첫 줄">
              <input
                className={inputClass}
                value={title}
                maxLength={80}
                placeholder="예: 10월 리그 참가 신청"
                onChange={(e) => setTitle(e.target.value)}
              />
            </Field>

            <Field
              label="마감"
              hint={dueDays !== null ? formatDateKo(dueFromDays(dueDays)!) : '직접 마감할 때까지'}
            >
              <Pills
                options={DUE_CHOICES.map((d) => [String(d.days), d.label] as const)}
                pressed={String(dueDays)}
                onPick={(v) => setDueDays(v === 'null' ? null : Number(v))}
              />
            </Field>

            <Field label={`질문 ${questions.length}개`}>
              {editing ? (
                <QuestionEditor text={text} onChange={setText} />
              ) : (
                <QuestionPreview questions={questions} />
              )}
              <div className="mt-1">
                <TextLink onClick={() => setEditing((v) => !v)}>
                  {editing ? '미리보기로 돌아가기' : '질문 직접 고치기'}
                </TextLink>
              </div>
            </Field>
          </div>
        )}

        {step === 'intake' && (
          <div>
            <Field label="제목" hint="학부모에게 보이는 이름">
              <input
                className={inputClass}
                value={linkTitle}
                onChange={(e) => setLinkTitle(e.target.value)}
              />
            </Field>

            <Field label="받는 것">
              <Pills
                options={[
                  ['trial', '체험 신청'],
                  ['inquiry', '일반 문의'],
                ]}
                pressed={linkKind}
                onPick={(k) => {
                  setLinkKind(k);
                  setFields(defaultFields(k));
                }}
              />
            </Field>

            <Field label="물을 항목" hint="보호자 성함·연락처는 항상">
              <Pills
                options={OPTIONAL_FIELDS.map((f) => [f, f] as const)}
                pressed={fields}
                onPick={toggleField}
              />
            </Field>

            <p className="mt-5 text-[13.5px] leading-[1.6] text-steel">
              신청은 <strong className="font-semibold text-slate">문의</strong>로 바로 들어오고, 첫 연락은
              전화로 합니다. 하루를 넘기면 &lsquo;늦은 연락&rsquo;으로 표시됩니다.
            </p>
          </div>
        )}
      </Swap>
    </Modal>
  );
}

// ---------------------------------------------------------------------------

/** The questions as a parent will meet them, small. */
function QuestionPreview({ questions }: { questions: Question[] }) {
  if (questions.length === 0) {
    return (
      <p className="rounded-[14px] bg-[#F6F8F6] px-4 py-5 text-center text-[14px] text-steel">
        질문이 없어요. 직접 고치기에서 적어 주세요.
      </p>
    );
  }

  return (
    <ol className="space-y-4 rounded-[14px] bg-[#F6F8F6] px-4 py-4">
      {questions.map((q, i) => (
        <li key={q.label}>
          <p className="text-[15px] font-semibold text-ink">
            <span className="mr-1.5 tabular-nums text-stone">{i + 1}</span>
            {q.label}
            {q.multi && <span className="ml-1.5 text-[12.5px] font-normal text-steel">여러 개</span>}
          </p>
          {q.choices.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {q.choices.map((c) => (
                <span
                  key={c}
                  className={cn(
                    'flex items-center gap-1 rounded-full px-2.5 py-1 text-[13px]',
                    q.flagged.includes(c) ? 'bg-[#FAF3E5] text-[#946216]' : 'bg-canvas text-slate',
                  )}
                >
                  {q.flagged.includes(c) && <Phone size={10} strokeWidth={2.6} />}
                  {c}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-[13px] text-stone">자유롭게 쓰는 칸</p>
          )}
        </li>
      ))}
      {questions.some((q) => q.flagged.length > 0) && (
        <li className="flex items-center gap-1.5 border-t border-hairline-soft pt-3 text-[13px] text-steel">
          <Phone size={11} strokeWidth={2.6} className="text-[#946216]" />
          이 답을 고른 보호자는 &lsquo;상담 필요&rsquo;로 따로 모아 드려요
        </li>
      )}
    </ol>
  );
}

function QuestionEditor({ text, onChange }: { text: string; onChange: (t: string) => void }) {
  return (
    <div>
      <textarea
        className={cn(inputClass, 'min-h-[140px] resize-y leading-[1.75]')}
        value={text}
        spellCheck={false}
        placeholder={'참가하나요? : 참가 / 불참\n코치에게 전할 말'}
        onChange={(e) => onChange(e.target.value)}
      />
      <dl className="mt-2.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px] leading-[1.5] text-steel">
        <dt className="font-semibold text-slate">한 줄</dt>
        <dd>질문 하나 · 그냥 쓰면 서술형</dd>
        <dt className="font-semibold text-slate">: A / B</dt>
        <dd>고르는 질문</dd>
        <dt className="font-semibold text-slate">(복수)</dt>
        <dd>여러 개 고르기</dd>
        <dt className="font-semibold text-slate">B!</dt>
        <dd>이 답이면 &lsquo;상담 필요&rsquo;로 모으기</dd>
      </dl>
    </div>
  );
}
