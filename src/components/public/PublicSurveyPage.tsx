/**
 * The page a parent opens from a survey 알림톡. No login, no app.
 *
 * It already knows who they are — the link is theirs alone — so it opens with
 * the child's name and asks only the questions. No "보호자 성함", no phone
 * number, no picking your child from a list of thirty. Picks are big buttons a
 * thumb can't miss; a survey of one or two questions is answered in two taps
 * and 보내기.
 *
 * Answers stay editable until the deadline. A parent who tapped 참가 on Monday
 * and learned about a family wedding on Wednesday should fix it here, not have
 * to phone the coach to undo a form.
 *
 * Everything shown comes from `get_survey()` and everything sent goes through
 * `submit_survey()`, which re-checks it. The checks here are for the parent's
 * convenience, not the database's safety.
 */

import { useEffect, useState, type FormEvent } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { supabase, friendlyError, isConfigured } from '@/lib/supabase';
import { picksOf, type Question, type SurveyKind } from '@/data/surveys';
import { formatDateKo } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Frame } from './PublicFormPage';

interface PublicSurvey {
  title: string;
  kind: SurveyKind;
  questions: Question[];
  due_date: string | null;
  open: boolean;
  academy_name: string;
  child_name: string;
  answers: Record<string, string>;
  answered_at: string | null;
}

type Load =
  | { state: 'loading' }
  | { state: 'missing' }
  | { state: 'error'; message: string }
  | { state: 'ready'; survey: PublicSurvey };

export function PublicSurveyPage({ token }: { token: string }) {
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [values, setValues] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(true);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isConfigured) {
      setLoad({ state: 'error', message: '서비스 설정이 완료되지 않았습니다.' });
      return;
    }
    let alive = true;
    void supabase.rpc('get_survey', { p_token: token }).then(({ data, error: e }) => {
      if (!alive) return;
      if (e) {
        setLoad({ state: 'error', message: '설문을 불러오지 못했습니다. 잠시 후 다시 열어 주세요.' });
      } else if (!data) {
        setLoad({ state: 'missing' });
      } else {
        const survey = data as PublicSurvey;
        setValues(survey.answers ?? {});
        // Someone who already answered lands on what they said, not on a
        // blank form that looks like their answer was lost.
        setEditing(!survey.answered_at && survey.open);
        setAgreed(!!survey.answered_at);
        setLoad({ state: 'ready', survey });
      }
    });
    return () => {
      alive = false;
    };
  }, [token]);

  useEffect(() => {
    if (load.state === 'ready') {
      document.title = `${load.survey.title} · ${load.survey.academy_name}`;
    }
  }, [load]);

  if (load.state !== 'ready') {
    return (
      <Frame>
        <div className="py-20 text-center">
          {load.state === 'loading' ? (
            <Loader2 size={24} className="mx-auto animate-spin text-primary" />
          ) : (
            <>
              <p className="text-[18px] font-bold text-ink">
                {load.state === 'missing' ? '열 수 없는 링크입니다' : '잠시 문제가 생겼습니다'}
              </p>
              <p className="mt-2 text-[14px] leading-[1.6] text-steel">
                {load.state === 'missing'
                  ? '주소가 잘렸거나 올바르지 않습니다. 받으신 알림톡에서 다시 열어 주세요.'
                  : load.message}
              </p>
            </>
          )}
        </div>
      </Frame>
    );
  }

  const { survey } = load;
  const child = survey.child_name || '자녀';
  const sensitive = survey.kind === 'enrollment';
  const missing = survey.questions.filter(
    (q) => q.choices.length > 0 && picksOf(values[q.label]).length === 0,
  );
  const ready = missing.length === 0 && (!sensitive || agreed) && !busy;

  const pick = (q: Question, choice: string) =>
    setValues((v) => {
      const current = picksOf(v[q.label]);
      const next = q.multi
        ? current.includes(choice)
          ? current.filter((c) => c !== choice)
          : [...current, choice]
        : [choice];
      next.sort((a, b) => q.choices.indexOf(a) - q.choices.indexOf(b));
      return { ...v, [q.label]: next.join(', ') };
    });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);

    const answers: Record<string, string> = {};
    for (const q of survey.questions) {
      const v = (values[q.label] ?? '').trim();
      if (v) answers[q.label] = v;
    }

    const { error: e2 } = await supabase.rpc('submit_survey', { p_token: token, p_answers: answers });
    setBusy(false);
    if (e2) {
      setError(friendlyError(e2, '보내지 못했습니다. 잠시 후 다시 시도해 주세요.'));
      return;
    }
    setLoad({
      state: 'ready',
      survey: { ...survey, answers, answered_at: new Date().toISOString() },
    });
    setEditing(false);
    window.scrollTo({ top: 0 });
  };

  const header = (
    <header className="pb-6 pt-2">
      <p className="eyebrow-ink">{survey.academy_name}</p>
      <h1 className="mt-2.5 text-[26px] font-bold leading-[1.2] tracking-tightest text-ink">
        {survey.title}
      </h1>
      <p className="mt-2 text-[14.5px] leading-[1.6] text-slate">
        {child} 학생 보호자님,{' '}
        {survey.questions.length === 1 ? '한 가지만' : `${survey.questions.length}가지만`}{' '}
        여쭤볼게요.
      </p>
      {survey.due_date && survey.open && (
        <p className="mt-1 text-[13px] text-steel">{formatDateKo(survey.due_date)}까지</p>
      )}
    </header>
  );

  // --- Read-only: answered, or closed -----------------------------------
  if (!editing) {
    return (
      <Frame academy={survey.academy_name}>
        {header}

        {survey.answered_at ? (
          <div className="animate-pop-in rounded-xl bg-gradient-to-br from-[#DCEEE4] to-[#F1F7F3] px-5 py-5">
            <p className="flex items-center gap-2 text-[16px] font-bold text-ink">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-white">
                <Check size={15} strokeWidth={3} className="animate-check-pop" />
              </span>
              전달되었습니다
            </p>
            <dl className="mt-4 space-y-2.5">
              {survey.questions.map((q) =>
                survey.answers[q.label] ? (
                  <div key={q.label}>
                    <dt className="text-[12.5px] text-steel">{q.label}</dt>
                    <dd className="mt-0.5 whitespace-pre-wrap text-[15px] font-semibold text-ink">
                      {survey.answers[q.label]}
                    </dd>
                  </div>
                ) : null,
              )}
            </dl>
          </div>
        ) : (
          <p className="rounded-lg border border-hairline bg-canvas px-4 py-5 text-center text-[14.5px] text-slate">
            마감된 설문입니다.
          </p>
        )}

        {survey.open ? (
          <>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="btn-secondary mt-4 w-full !py-3.5 !text-[15px]"
            >
              답 고치기
            </button>
            <p className="mt-3 text-center text-[12.5px] text-steel">
              {survey.due_date ? `${formatDateKo(survey.due_date)}까지` : '마감 전까지'} 언제든
              고칠 수 있습니다.
            </p>
          </>
        ) : (
          survey.answered_at && (
            <p className="mt-4 text-center text-[12.5px] text-steel">
              마감되어 더 고칠 수 없습니다. 바꿀 내용이 있으면 코치에게 말씀해 주세요.
            </p>
          )
        )}
      </Frame>
    );
  }

  // --- The form --------------------------------------------------------------
  return (
    <Frame academy={survey.academy_name}>
      {header}

      <form onSubmit={submit} className="stagger space-y-6">
        {survey.questions.map((q, i) => {
          const picked = picksOf(values[q.label]);
          // Short labels (요일, 사이즈) sit in a grid; sentences stack full width.
          const compact = q.choices.length >= 4 && q.choices.every((c) => c.length <= 4);

          return (
            <fieldset key={q.label}>
              <legend className="text-[15px] font-semibold leading-[1.5] text-ink">
                <span className="mr-1.5 tabular-nums text-stone">{i + 1}</span>
                {q.label}
              </legend>
              {q.multi && <p className="mt-0.5 text-[12.5px] text-steel">여러 개 고를 수 있어요</p>}

              {q.choices.length > 0 ? (
                <div
                  className={cn(
                    'mt-2.5 gap-2',
                    compact
                      ? q.choices.length === 7
                        ? 'grid grid-cols-7'
                        : 'grid grid-cols-4'
                      : 'flex flex-col',
                  )}
                >
                  {q.choices.map((choice) => {
                    const on = picked.includes(choice);
                    return (
                      <button
                        key={choice}
                        type="button"
                        aria-pressed={on}
                        onClick={() => pick(q, choice)}
                        className={cn(
                          'pressable flex items-center gap-2.5 rounded-lg border text-[15px] font-semibold',
                          compact ? 'justify-center px-0 py-3' : 'px-4 py-3.5 text-left',
                          on
                            ? 'border-primary bg-primary-wash text-primary'
                            : 'border-hairline-strong bg-canvas text-ink',
                        )}
                      >
                        {!compact && (
                          <span
                            className={cn(
                              'flex h-5 w-5 shrink-0 items-center justify-center border',
                              q.multi ? 'rounded-[5px]' : 'rounded-full',
                              on ? 'border-primary bg-primary text-white' : 'border-hairline-strong',
                            )}
                          >
                            {on && <Check size={12} strokeWidth={3.2} />}
                          </span>
                        )}
                        {choice}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <textarea
                  rows={3}
                  maxLength={500}
                  // 16px keeps iOS from zooming the page on focus.
                  className="input-field mt-2.5 resize-none !py-3 !text-[16px]"
                  placeholder="없으면 비워 두셔도 됩니다"
                  value={values[q.label] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [q.label]: e.target.value }))}
                />
              )}
            </fieldset>
          );
        })}

        {sensitive && (
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-hairline bg-canvas px-4 py-3.5">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 accent-[#006039]"
            />
            <span className="text-[13.5px] leading-[1.6] text-slate">
              <strong className="font-semibold text-ink">
                적은 내용을 수업 운영에 쓰는 데 동의합니다 (필수)
              </strong>
              <br />
              건강 정보는 수업 중 안전을 위해서만 쓰고, 등록하지 않으시면 1년 뒤 파기합니다.
            </span>
          </label>
        )}

        {error && (
          <p role="alert" className="rounded-md bg-tint-alert-soft px-3.5 py-3 text-[13.5px] text-error">
            {error}
          </p>
        )}

        <button type="submit" disabled={!ready} className="btn-primary w-full !py-4 !text-[16px]">
          {busy && <Loader2 size={16} className="animate-spin" />}
          {busy ? '보내는 중…' : survey.answered_at ? '고친 답 보내기' : '보내기'}
        </button>
        {missing.length > 0 && (
          <p className="-mt-3 text-center text-[12.5px] text-steel">
            {missing.length === 1 ? `"${missing[0].label}"` : `${missing.length}개 질문`}에 답하면
            보낼 수 있어요
          </p>
        )}
      </form>
    </Frame>
  );
}
