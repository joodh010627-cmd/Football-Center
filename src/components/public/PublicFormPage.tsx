/**
 * The page a parent opens from a form link. No login, no app chrome.
 *
 * This is the first thing a stranger sees of the centre, usually on a phone,
 * usually from a KakaoTalk chat — so it is one column, big targets, and as few
 * questions as the owner chose. Everything it can learn about the form comes
 * from `get_public_form()`, which returns the title, the questions and the
 * centre's name and nothing else; everything it sends goes through
 * `submit_public_form()`, which re-checks all of it. The checks here are for
 * the parent's convenience, not the database's safety.
 *
 * Consent is a real checkbox with the real notice next to it, not a line of
 * grey text under the button. The child is a minor and the person typing is
 * their guardian; the notice says what is collected, why, and for how long.
 */

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Check, ChevronDown, Loader2 } from 'lucide-react';
import { supabase, friendlyError, isConfigured } from '@/lib/supabase';
import { FIELD_CHOICES, LONG_FIELDS, MAPPED_FIELDS, type FormKind } from '@/data/crm';
import { Crest } from '@/components/ui/Crest';
import { cn } from '@/lib/cn';

interface PublicForm {
  title: string;
  kind: FormKind;
  fields: string[];
  academy_name: string;
}

type Load =
  | { state: 'loading' }
  | { state: 'missing' }
  | { state: 'error'; message: string }
  | { state: 'ready'; form: PublicForm };

const KIND_INTRO: Record<FormKind, string> = {
  inquiry: '궁금한 점을 남겨 주시면 담당 코치가 연락드립니다.',
  trial: '체험 수업을 신청해 주시면 가능한 일정을 안내해 드립니다.',
  enrollment: '등록 신청을 남겨 주시면 반 배정과 수강 안내를 드립니다.',
  survey: '잠깐의 시간을 내어 의견을 들려주세요.',
};

const PLACEHOLDER: Record<string, string> = {
  '학부모 성함': '홍길동',
  연락처: '010-1234-5678',
  '아이 이름': '김하준',
  나이: '8살 / 초1',
  '문의 내용': '궁금하신 점을 자유롭게 적어 주세요',
};

export function PublicFormPage({ slug }: { slug: string }) {
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [values, setValues] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState(false);
  const [showNotice, setShowNotice] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!isConfigured) {
      setLoad({ state: 'error', message: '서비스 설정이 완료되지 않았습니다.' });
      return;
    }
    let alive = true;
    void supabase.rpc('get_public_form', { p_slug: slug }).then(({ data, error: e }) => {
      if (!alive) return;
      if (e)
        setLoad({ state: 'error', message: '폼을 불러오지 못했습니다. 잠시 후 다시 열어 주세요.' });
      else if (!data) setLoad({ state: 'missing' });
      else setLoad({ state: 'ready', form: data as PublicForm });
    });
    return () => {
      alive = false;
    };
  }, [slug]);

  useEffect(() => {
    if (load.state === 'ready') document.title = `${load.form.title} · ${load.form.academy_name}`;
  }, [load]);

  const set = (field: string, value: string) => setValues((v) => ({ ...v, [field]: value }));

  // Functional update: two quick taps must not read the same stale value.
  const toggleChoice = (field: string, choice: string, multi: boolean) =>
    setValues((v) => {
      const current = (v[field] ?? '').split(', ').filter(Boolean);
      const next = multi
        ? current.includes(choice)
          ? current.filter((c) => c !== choice)
          : [...current, choice]
        : current[0] === choice
          ? []
          : [choice];
      // Keep the week in week order however the parent tapped it.
      const order = FIELD_CHOICES[field] ?? [];
      return { ...v, [field]: next.sort((a, b) => order.indexOf(a) - order.indexOf(b)).join(', ') };
    });

  if (load.state !== 'ready') {
    return (
      <Frame>
        <div className="py-20 text-center">
          {load.state === 'loading' ? (
            <Loader2 size={24} className="mx-auto animate-spin text-primary" />
          ) : (
            <>
              <p className="text-[18px] font-bold text-ink">
                {load.state === 'missing' ? '접수가 마감된 링크입니다' : '잠시 문제가 생겼습니다'}
              </p>
              <p className="mt-2 text-[14px] leading-[1.6] text-steel">
                {load.state === 'missing'
                  ? '링크가 중단되었거나 주소가 올바르지 않습니다. 받으신 곳에 다시 문의해 주세요.'
                  : load.message}
              </p>
            </>
          )}
        </div>
      </Frame>
    );
  }

  const { form } = load;
  const phoneDigits = (values['연락처'] ?? '').replace(/\D/g, '');
  const ready =
    (values['학부모 성함'] ?? '').trim().length > 0 &&
    phoneDigits.length >= 9 &&
    phoneDigits.length <= 11 &&
    consent;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError(null);

    const answers: Record<string, string> = {};
    for (const field of form.fields) {
      if ((MAPPED_FIELDS as readonly string[]).includes(field)) continue;
      const v = (values[field] ?? '').trim();
      if (v) answers[field] = v;
    }

    const { error: e2 } = await supabase.rpc('submit_public_form', {
      p_slug: slug,
      p_parent_name: (values['학부모 성함'] ?? '').trim(),
      p_parent_phone: phoneDigits,
      p_child_name: (values['아이 이름'] ?? '').trim(),
      p_age_label: (values['나이'] ?? '').trim(),
      p_answers: answers,
      p_consent: consent,
    });

    setBusy(false);
    if (e2) setError(friendlyError(e2, '접수하지 못했습니다. 잠시 후 다시 시도해 주세요.'));
    else setDone(true);
  };

  if (done) {
    return (
      <Frame academy={form.academy_name}>
        <div className="animate-pop-in py-16 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white">
            <Check size={26} strokeWidth={2.8} className="animate-check-pop" />
          </span>
          <h1 className="mt-5 text-[23px] font-bold tracking-tightest text-ink">
            접수가 완료되었습니다
          </h1>
          <p className="mt-2.5 text-[14.5px] leading-[1.7] text-slate">
            {values['학부모 성함']} 님, 감사합니다.
            <br />
            담당 코치가 확인 후 영업일 기준 1일 안에 연락드리겠습니다.
          </p>
        </div>
      </Frame>
    );
  }

  return (
    <Frame academy={form.academy_name}>
      <header className="pb-6 pt-2">
        <p className="eyebrow-ink">{form.academy_name}</p>
        <h1 className="mt-2.5 text-[27px] font-bold leading-[1.2] tracking-tightest text-ink">
          {form.title}
        </h1>
        <p className="mt-2 text-[14.5px] leading-[1.6] text-steel">{KIND_INTRO[form.kind]}</p>
      </header>

      <form onSubmit={submit} className="stagger space-y-5">
        {form.fields.map((field) => {
          const choices = FIELD_CHOICES[field];
          const required = field === '학부모 성함' || field === '연락처';

          return (
            <div key={field}>
              <label htmlFor={`f-${field}`} className="flex items-baseline gap-1.5">
                <span className="text-[14px] font-semibold text-charcoal">{field}</span>
                {required ? (
                  <span className="text-[12px] font-semibold text-primary">필수</span>
                ) : (
                  <span className="text-[12px] text-stone">선택</span>
                )}
              </label>

              {choices ? (
                <div
                  className={cn(
                    'mt-2 gap-1.5',
                    field === '희망 요일' ? 'grid grid-cols-7' : 'flex flex-wrap',
                  )}
                >
                  {choices.map((choice) => {
                    const on = (values[field] ?? '').split(', ').includes(choice);
                    return (
                      <button
                        key={choice}
                        type="button"
                        onClick={() => toggleChoice(field, choice, field === '희망 요일')}
                        aria-pressed={on}
                        className={cn(
                          'pill-tab !py-2.5',
                          field === '희망 요일' && '!px-0',
                          on && 'pill-tab-active',
                        )}
                      >
                        {choice}
                      </button>
                    );
                  })}
                </div>
              ) : LONG_FIELDS.includes(field) ? (
                <textarea
                  id={`f-${field}`}
                  rows={4}
                  maxLength={500}
                  className="input-field mt-2 resize-none !py-3 !text-[16px]"
                  placeholder={PLACEHOLDER[field]}
                  value={values[field] ?? ''}
                  onChange={(e) => set(field, e.target.value)}
                />
              ) : (
                <input
                  id={`f-${field}`}
                  // 16px keeps iOS from zooming the page on focus.
                  className="input-field mt-2 !py-3 !text-[16px]"
                  placeholder={PLACEHOLDER[field]}
                  maxLength={field === '나이' ? 20 : 40}
                  inputMode={field === '연락처' ? 'tel' : undefined}
                  autoComplete={
                    field === '연락처' ? 'tel' : field === '학부모 성함' ? 'name' : 'off'
                  }
                  value={values[field] ?? ''}
                  onChange={(e) => set(field, e.target.value)}
                />
              )}
            </div>
          );
        })}

        {/* --- Consent ------------------------------------------------------ */}
        <div className="rounded-lg border border-hairline bg-canvas">
          <label className="flex cursor-pointer items-start gap-3 px-4 py-3.5">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 accent-[#006039]"
            />
            <span className="text-[14px] font-semibold leading-[1.5] text-ink">
              개인정보 수집·이용에 동의합니다 <span className="text-primary">(필수)</span>
            </span>
          </label>
          <button
            type="button"
            onClick={() => setShowNotice((v) => !v)}
            className="flex w-full items-center justify-between border-t border-hairline-soft px-4 py-2.5 text-[12.5px] font-medium text-steel"
          >
            수집 항목과 보관 기간 보기
            <ChevronDown
              size={15}
              className={cn('transition-transform duration-200', showNotice && 'rotate-180')}
            />
          </button>
          {showNotice && (
            <dl className="animate-swap-in space-y-2 border-t border-hairline-soft px-4 py-3 text-[12.5px] leading-[1.6] text-slate">
              <Notice term="수집하는 곳">{form.academy_name}</Notice>
              <Notice term="수집 항목">{form.fields.join(', ')}</Notice>
              <Notice term="이용 목적">
                문의 응대, 수업·체험 일정 안내, 접수 확인 메시지(카카오 알림톡) 발송
              </Notice>
              <Notice term="보관 기간">
                상담이 끝난 뒤 1년. 등록하지 않으시면 그 뒤 지체 없이 파기합니다.
              </Notice>
              <p className="pt-1 text-stone">
                동의하지 않으실 수 있으며, 이 경우 온라인 접수 대신 전화로 문의해 주세요.
              </p>
            </dl>
          )}
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-md bg-tint-alert-soft px-3.5 py-3 text-[13.5px] text-error"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!ready || busy}
          className="btn-primary w-full !py-4 !text-[16px]"
        >
          {busy && <Loader2 size={16} className="animate-spin" />}
          {busy ? '접수 중…' : '접수하기'}
        </button>
      </form>
    </Frame>
  );
}

function Notice({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-[68px] shrink-0 font-semibold text-charcoal">{term}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

function Frame({ academy, children }: { academy?: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-surface-soft">
      <div className="glass sticky top-0 z-10 flex h-14 items-center gap-2 border-b border-hairline px-5">
        <Crest className="h-6 w-6 text-primary" />
        <span className="truncate text-[15px] font-bold tracking-[-0.02em] text-ink">
          {academy ?? 'FC GROWTH'}
        </span>
      </div>
      <main className="mx-auto w-full max-w-[520px] px-5 pb-16 pt-6">{children}</main>
    </div>
  );
}
