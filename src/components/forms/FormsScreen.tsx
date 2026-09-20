/**
 * 폼 — 문의 → 체험 → 등록.
 *
 * This is the screen the business runs on. A football centre's roster turns over
 * fast enough that the intake pipeline, not the training, is what decides
 * whether it is bigger or smaller next term — and the thing that loses an
 * enquiry is almost never a bad answer, it is a slow one.
 *
 * So the screen is built around a clock rather than a list. Leads are ordered by
 * how long they have been waiting, overdue ones surface first and in red, and
 * the primary action is the one that moves the oldest one forward. A list sorted
 * newest-first — the obvious design, and the one every CRM ships — would bury
 * the four-day-old enquiry under this morning's three.
 */

import { useMemo, useState, type ReactNode } from 'react';
import { Check, Link2, Phone, Plus, Send } from 'lucide-react';
import type { ID } from '@/types';
import { useApp } from '@/store/AppContext';
import { useWorkspace } from '@/store/WorkspaceContext';
import { TODAY, dayOf } from '@/data/dates';
import {
  countLeads,
  daysWaiting,
  isOpen,
  isOverdue,
  nextStage,
  triage,
  FORM_KIND_LABEL,
  PIPELINE,
  SOURCE_LABEL,
  STAGE_META,
  type FormKind,
  type Lead,
  type LeadSource,
  type LeadStage,
} from '@/data/crm';
import { cn } from '@/lib/cn';
import { Modal } from '@/components/ui/Modal';
import { ScreenBody, ScreenHeader, Section } from '@/components/shell/Shell';

type Filter = 'open' | LeadStage;

export function FormsScreen({ onOpenLead }: { onOpenLead: (leadId: ID) => void }) {
  const { leads, formLinks, addLead, advanceLead, addFormLink, shareFormLink } = useWorkspace();
  const [filter, setFilter] = useState<Filter>('open');
  const [composing, setComposing] = useState(false);
  const [makingForm, setMakingForm] = useState(false);
  const [copied, setCopied] = useState<ID | null>(null);

  const counts = useMemo(() => countLeads(leads), [leads]);
  const queue = useMemo(() => {
    const pool = filter === 'open' ? leads.filter(isOpen) : leads.filter((l) => l.stage === filter);
    return triage(pool);
  }, [leads, filter]);

  // The CTA acts on the oldest thing still waiting, so the button is never a
  // guess about which lead the user meant.
  const oldest = queue.find((l) => isOverdue(l)) ?? queue[0] ?? null;

  const copy = (link: (typeof formLinks)[number]) => {
    const url = `${window.location.origin}/f/${link.slug}`;
    void navigator.clipboard?.writeText(url);
    shareFormLink(link.id);
    setCopied(link.id);
    window.setTimeout(() => setCopied(null), 1800);
  };

  return (
    <>
      <ScreenHeader
        eyebrow="Welcome to the team"
        title="새로운 만남"
        meta={
          <span className="tabular-nums">
            신규 문의 {counts.byStage.inquiry} · 체험 예정 {counts.upcomingTrials}
            {counts.conversionRate !== null && (
              <> · 등록 전환 {Math.round(counts.conversionRate * 100)}%</>
            )}
          </span>
        }
      />

      <ScreenBody>
        {/* --- Primary action ------------------------------------------- */}
        {oldest ? (
          <NextAction lead={oldest} onAdvance={advanceLead} onOpen={() => onOpenLead(oldest.id)} />
        ) : (
          <div className="rounded-xl bg-gradient-to-br from-[#DCEEE4] to-[#F1F7F3] px-5 py-7 text-center">
            <Check size={24} className="mx-auto text-primary" strokeWidth={2.4} />
            <p className="mt-2.5 text-[16px] font-semibold text-ink">대기 중인 문의가 없습니다</p>
            <p className="mt-1 text-[13.5px] text-slate">
              새 문의가 들어오면 여기에 가장 먼저 표시됩니다.
            </p>
          </div>
        )}

        {/* --- Pipeline ---------------------------------------------------
            Five counts, tappable. Reads left to right as the journey a parent
            actually walks, so a pile-up is visible as a shape rather than a
            number you have to compare against another number. */}
        <div className="mt-5 grid grid-cols-5 gap-1.5">
          {PIPELINE.map((stage) => {
            const meta = STAGE_META[stage];
            const active = filter === stage;
            const overdueHere = leads.filter((l) => l.stage === stage && isOverdue(l)).length;

            return (
              <button
                key={stage}
                type="button"
                onClick={() => setFilter(active ? 'open' : stage)}
                className={cn(
                  'relative rounded-lg border px-1.5 py-2.5 text-center transition-colors duration-200',
                  active
                    ? 'border-primary bg-primary-wash'
                    : 'border-hairline bg-canvas hover:border-hairline-strong',
                )}
              >
                <span
                  className={cn(
                    'block text-[19px] font-bold tabular-nums',
                    active ? 'text-primary' : 'text-ink',
                  )}
                >
                  {counts.byStage[stage]}
                </span>
                <span className="mt-0.5 block text-[10.5px] font-medium leading-tight text-steel">
                  {meta.label}
                </span>
                {overdueHere > 0 && (
                  <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-error" />
                )}
              </button>
            );
          })}
        </div>

        {/* --- Queue ------------------------------------------------------ */}
        <Section
          title={filter === 'open' ? '최근 문의' : STAGE_META[filter].label}
          meta={`${queue.length}건`}
        >
          {queue.length === 0 ? (
            <p className="rounded-lg border border-dashed border-hairline-strong bg-canvas px-4 py-8 text-center text-[13.5px] text-steel">
              해당하는 문의가 없습니다.
            </p>
          ) : (
            <ul className="overflow-hidden rounded-lg border border-hairline bg-canvas">
              {queue.map((lead) => (
                <LeadRow key={lead.id} lead={lead} onOpen={() => onOpenLead(lead.id)} />
              ))}
            </ul>
          )}

          <button
            type="button"
            onClick={() => setComposing(true)}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full border border-hairline py-3 text-[14px] font-semibold text-slate transition-colors duration-200 hover:border-hairline-strong hover:text-ink"
          >
            <Plus size={16} strokeWidth={2.4} />
            문의 직접 등록
          </button>
        </Section>

        {/* --- Form links -------------------------------------------------- */}
        <Section title="폼 링크" meta={`${formLinks.filter((f) => f.active).length}개 운영 중`}>
          <ul className="space-y-2">
            {formLinks.map((link) => (
              <li
                key={link.id}
                className={cn(
                  'flex items-center gap-3 rounded-lg border bg-canvas px-4 py-3',
                  link.active ? 'border-hairline' : 'border-hairline-soft opacity-60',
                )}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-wash text-primary">
                  <Link2 size={16} strokeWidth={2.2} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-ink">
                    {link.title}
                  </span>
                  <span className="mt-0.5 block truncate text-[12.5px] text-steel">
                    {FORM_KIND_LABEL[link.kind]} · 접수 {link.submissions}건
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => copy(link)}
                  className="shrink-0 rounded-full bg-surface px-3 py-1.5 text-[12px] font-bold text-slate transition-colors duration-200 hover:bg-hairline-soft"
                >
                  {copied === link.id ? '복사됨' : '링크 복사'}
                </button>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={() => setMakingForm(true)}
            className="mt-3 flex w-full items-center justify-between rounded-lg border border-dashed border-hairline-strong bg-canvas px-4 py-3.5 text-left transition-colors duration-200 hover:border-primary hover:bg-primary-wash"
          >
            <span className="text-[15px] font-semibold text-primary">폼 링크 만들기</span>
            <Plus size={18} strokeWidth={2.4} className="text-primary" />
          </button>
        </Section>
      </ScreenBody>

      <LeadComposer
        open={composing}
        onClose={() => setComposing(false)}
        onSubmit={(fields) => {
          addLead(fields);
          setComposing(false);
        }}
      />

      <FormComposer
        open={makingForm}
        onClose={() => setMakingForm(false)}
        onSubmit={(title, kind) => {
          addFormLink({ title, kind });
          setMakingForm(false);
        }}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// The one thing to do next
// ---------------------------------------------------------------------------

function NextAction({
  lead,
  onAdvance,
  onOpen,
}: {
  lead: Lead;
  onAdvance: (id: ID, stage: LeadStage, note?: string) => void;
  onOpen: () => void;
}) {
  const meta = STAGE_META[lead.stage];
  const next = nextStage(lead.stage);
  const late = isOverdue(lead);
  const waited = daysWaiting(lead);

  return (
    <article
      className={cn(
        'relative overflow-hidden rounded-xl p-5',
        late
          ? 'bg-gradient-to-br from-[#F8E8E2] to-[#FCF5F2]'
          : 'bg-gradient-to-br from-[#DCEEE4] to-[#F1F7F3]',
      )}
    >
      <p className={cn('micro-label', late ? 'text-error' : 'text-primary')}>
        {late ? `${waited}일째 대기 중` : meta.label}
      </p>

      <button
        type="button"
        onClick={onOpen}
        className="mt-2.5 block text-left text-[24px] font-bold leading-[1.15] tracking-tightest text-ink"
      >
        {lead.childName}
        <span className="ml-2 text-[16px] font-semibold text-slate">{lead.ageLabel}</span>
      </button>

      <p className="mt-1.5 text-[14px] leading-[1.55] text-charcoal">{meta.duty}</p>

      {lead.memo && (
        <p className="mt-2 line-clamp-2 text-[13px] leading-[1.5] text-slate">“{lead.memo}”</p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {next && (
          <button
            type="button"
            onClick={() => onAdvance(lead.id, next)}
            className="rounded-full bg-primary px-5 py-3 text-[14.5px] font-semibold text-white transition-colors duration-200 hover:bg-primary-pressed active:bg-primary-deep"
          >
            {meta.action}
          </button>
        )}
        <a
          href={`tel:${lead.parentPhone.replace(/-/g, '')}`}
          className="flex items-center gap-1.5 rounded-full border border-primary/25 bg-canvas/70 px-4 py-3 text-[14px] font-semibold text-primary transition-colors duration-200 hover:bg-canvas"
        >
          <Phone size={14} strokeWidth={2.4} />
          전화
        </a>
        <button
          type="button"
          onClick={onOpen}
          className="flex items-center gap-1.5 px-2 py-3 text-[14px] font-semibold text-slate"
        >
          <Send size={14} strokeWidth={2.2} />
          체험 절차 보내기
        </button>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

function LeadRow({ lead, onOpen }: { lead: Lead; onOpen: () => void }) {
  const meta = STAGE_META[lead.stage];
  const late = isOverdue(lead);
  const waited = daysWaiting(lead);

  const when = dayOf(lead.createdAt) === TODAY || waited === 0 ? '오늘' : `${waited}일 전`;

  return (
    <li className="border-b border-hairline-soft last:border-b-0">
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors duration-150 hover:bg-surface-soft"
      >
        <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', late ? 'bg-error' : meta.dot)} />

        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-1.5">
            <span className="truncate text-[15.5px] font-semibold text-ink">{lead.childName}</span>
            <span className="shrink-0 text-[13px] text-steel">· {lead.ageLabel}</span>
          </span>
          <span className="mt-0.5 block truncate text-[13px] text-steel">
            {SOURCE_LABEL[lead.source]} · {when}
            {lead.trialDate && ` · 체험 ${lead.trialDate.slice(5).replace('-', '/')}`}
          </span>
        </span>

        <span
          className={cn(
            'shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-bold',
            late ? 'bg-tint-alert text-error' : meta.pill,
          )}
        >
          {late ? '응대 지연' : meta.label}
        </span>
      </button>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Composers
// ---------------------------------------------------------------------------

const SOURCES: LeadSource[] = ['phone', 'form', 'walk_in', 'referral', 'social'];

function LeadComposer({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (fields: Partial<Lead>) => void;
}) {
  const { state } = useApp();
  const [childName, setChildName] = useState('');
  const [ageLabel, setAgeLabel] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [source, setSource] = useState<LeadSource>('phone');
  const [interestClassId, setInterestClassId] = useState('');
  const [memo, setMemo] = useState('');

  const reset = () => {
    setChildName('');
    setAgeLabel('');
    setParentName('');
    setParentPhone('');
    setSource('phone');
    setInterestClassId('');
    setMemo('');
  };

  // Only the phone number is required. A parent who rang off before giving
  // their child's name is still a lead, and a form that refuses to save them is
  // a form that turns into a sticky note on the desk.
  const valid = parentPhone.trim().length >= 9;

  return (
    <Modal
      open={open}
      onClose={onClose}
      variant="sheet"
      title="문의 등록"
      footer={
        <button
          type="button"
          disabled={!valid}
          onClick={() => {
            onSubmit({
              childName: childName.trim() || '이름 미상',
              ageLabel: ageLabel.trim() || '연령 미상',
              parentName: parentName.trim(),
              parentPhone: parentPhone.trim(),
              source,
              interestClassId: interestClassId || null,
              memo: memo.trim(),
            });
            reset();
          }}
          className="btn-primary w-full py-3 text-[15px]"
        >
          등록하기
        </button>
      }
    >
      <div className="space-y-4">
        <Field label="연락처" hint="이것만 있으면 저장됩니다">
          <input
            className="input-field"
            type="tel"
            inputMode="tel"
            placeholder="010-0000-0000"
            value={parentPhone}
            onChange={(e) => setParentPhone(e.target.value)}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="아이 이름">
            <input
              className="input-field"
              value={childName}
              onChange={(e) => setChildName(e.target.value)}
            />
          </Field>
          <Field label="연령">
            <input
              className="input-field"
              placeholder="U10 / 9살"
              value={ageLabel}
              onChange={(e) => setAgeLabel(e.target.value)}
            />
          </Field>
        </div>

        <Field label="학부모 성함">
          <input
            className="input-field"
            value={parentName}
            onChange={(e) => setParentName(e.target.value)}
          />
        </Field>

        <Field label="유입 경로">
          <div className="flex flex-wrap gap-1.5">
            {SOURCES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSource(s)}
                className={cn('pill-tab', source === s && 'pill-tab-active')}
              >
                {SOURCE_LABEL[s]}
              </button>
            ))}
          </div>
        </Field>

        <Field label="관심 클래스" hint="나중에 정해도 됩니다">
          <select
            className="input-field"
            value={interestClassId}
            onChange={(e) => setInterestClassId(e.target.value)}
          >
            <option value="">미정</option>
            {state.classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </Field>

        <Field label="메모">
          <textarea
            className="input-field min-h-[76px] resize-none"
            placeholder="통화에서 들은 내용을 그대로 적어두세요"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}

const KINDS: FormKind[] = ['inquiry', 'trial', 'enrollment', 'survey'];

function FormComposer({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (title: string, kind: FormKind) => void;
}) {
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<FormKind>('trial');

  return (
    <Modal
      open={open}
      onClose={onClose}
      variant="sheet"
      title="폼 링크 만들기"
      footer={
        <button
          type="button"
          disabled={title.trim().length === 0}
          onClick={() => {
            onSubmit(title.trim(), kind);
            setTitle('');
            setKind('trial');
          }}
          className="btn-primary w-full py-3 text-[15px]"
        >
          만들기
        </button>
      }
    >
      <div className="space-y-4">
        <Field label="폼 이름" hint="학부모에게 보이는 제목입니다">
          <input
            className="input-field"
            placeholder="가을학기 체험 신청"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>

        <Field label="종류">
          <div className="flex flex-wrap gap-1.5">
            {KINDS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={cn('pill-tab', kind === k && 'pill-tab-active')}
              >
                {FORM_KIND_LABEL[k]}
              </button>
            ))}
          </div>
        </Field>

        <p className="rounded-md bg-surface px-3.5 py-3 text-[12.5px] leading-[1.6] text-steel">
          링크로 접수된 내용은 <strong className="font-semibold text-slate">신규 문의</strong>로
          바로 들어오고, 하루 안에 응대하지 않으면 알림에 표시됩니다.
        </p>
      </div>
    </Modal>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline gap-2">
        <span className="text-[13px] font-semibold text-charcoal">{label}</span>
        {hint && <span className="text-[11.5px] text-stone">{hint}</span>}
      </span>
      <span className="mt-1.5 block">{children}</span>
    </label>
  );
}
