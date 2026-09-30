/**
 * 새 학부모 — 문의 → 체험 → 등록.
 *
 * Formerly the whole 폼 tab. It moved one level down when the tab became
 * "every question the centre asks a parent", but it kept the rule that made
 * it worth building: this is a clock, not a list. Leads are ordered by how
 * long they have been waiting and the late ones come first, in red — a list
 * sorted newest-first buries the four-day-old enquiry under this morning's
 * three, and that is how enquiries go cold.
 *
 * What it shed is the second and third way of saying the same thing. The
 * five-box pipeline and the big "next action" card both restated what the
 * sorted list already shows in its first row. One row of filter chips
 * replaces them, and the first row of the list *is* the next action.
 *
 * The first contact is a phone call, on purpose. A parent who filled in a
 * form on Saturday is comparing centres by Sunday; the one who rang back is
 * the one that gets the trial. Forms come back at the other end — the 등록
 * 신청서 — where the information is long, structured, and worth keeping.
 */

import { useMemo, useState } from 'react';
import { Link2, Plus } from 'lucide-react';
import type { ID } from '@/types';
import { useApp } from '@/store/AppContext';
import { useWorkspace } from '@/store/WorkspaceContext';
import { TODAY, dayOf } from '@/data/dates';
import {
  countLeads,
  daysWaiting,
  formUrl,
  isOpen,
  isOverdue,
  triage,
  SOURCE_LABEL,
  STAGE_META,
  type Lead,
  type LeadSource,
  type LeadStage,
} from '@/data/crm';
import { cn } from '@/lib/cn';
import { Modal } from '@/components/ui/Modal';
import { Swap } from '@/components/ui/Motion';
import { BackBar, ScreenBody, ScreenHeader, Section, Toast } from '@/components/shell/Shell';
import { Field, SyncBanner } from './parts';

type Filter = 'open' | LeadStage;

const FILTERS: Filter[] = ['open', 'inquiry', 'contacted', 'trial_booked', 'trial_done', 'enrolled', 'lost'];

export function LeadsScreen({
  onOpenLead,
  onBack,
  backLabel,
}: {
  onOpenLead: (leadId: ID) => void;
  onBack: () => void;
  backLabel: string;
}) {
  const { mode, syncError, reload, leads, formLinks, addLead, toggleFormLink, shareFormLink } =
    useWorkspace();
  const [filter, setFilter] = useState<Filter>('open');
  const [composing, setComposing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const counts = useMemo(() => countLeads(leads), [leads]);
  const queue = useMemo(() => {
    const pool = filter === 'open' ? leads.filter(isOpen) : leads.filter((l) => l.stage === filter);
    return triage(pool);
  }, [leads, filter]);

  const flash = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2000);
  };

  const copy = (link: (typeof formLinks)[number]) => {
    void navigator.clipboard?.writeText(formUrl(link.slug));
    shareFormLink(link.id);
    flash('링크를 복사했습니다');
  };

  return (
    <>
      <BackBar label={backLabel} onBack={onBack} />
      <ScreenHeader
        title="새 학부모"
        meta={
          <span className="tabular-nums">
            진행 중 {counts.open}
            {counts.overdue > 0 && <span className="text-error"> · 응대 지연 {counts.overdue}</span>}
            {counts.conversionRate !== null && (
              <> · 등록 전환 {Math.round(counts.conversionRate * 100)}%</>
            )}
          </span>
        }
      />

      <ScreenBody>
        <SyncBanner
          mode={mode}
          error={syncError}
          onReload={reload}
          migration="0006"
          what="신청 링크"
        />

        {/* One row of chips instead of a five-box grid: the same filter, a
            third of the height, and it scrolls instead of shrinking labels. */}
        <div className="no-scrollbar -mx-5 flex gap-1.5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
          {FILTERS.map((f) => {
            const n = f === 'open' ? counts.open : counts.byStage[f];
            const late = f !== 'open' && leads.some((l) => l.stage === f && isOverdue(l));
            return (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={cn(
                  'pill-tab relative shrink-0 !py-1.5 !text-[13px]',
                  filter === f && 'pill-tab-active',
                )}
              >
                {f === 'open' ? '진행 중' : STAGE_META[f].label}
                <span className="ml-1 tabular-nums opacity-70">{n}</span>
                {late && filter !== f && (
                  <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-error ring-2 ring-surface-soft" />
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-3">
          <Swap k={filter}>
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
          </Swap>
        </div>

        <button
          type="button"
          onClick={() => setComposing(true)}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full border border-hairline py-3 text-[14px] font-semibold text-slate transition-colors duration-200 hover:border-hairline-strong hover:text-ink"
        >
          <Plus size={16} strokeWidth={2.4} />
          전화·방문 문의 등록
        </button>

        {/* --- Public links ------------------------------------------------
            Made from 새 폼 on the tab root; listed here because this is where
            what they collect lands. */}
        {formLinks.length > 0 && (
          <Section title="신청 링크">
            <ul className="overflow-hidden rounded-lg border border-hairline bg-canvas">
              {formLinks.map((link) => (
                <li
                  key={link.id}
                  className={cn(
                    'flex items-center gap-3 border-b border-hairline-soft px-4 py-3 last:border-b-0',
                    !link.active && 'opacity-60',
                  )}
                >
                  <Link2 size={15} className="shrink-0 text-primary" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-semibold text-ink">
                      {link.title}
                    </span>
                    <span className="mt-0.5 block text-[12px] text-steel">
                      접수 {link.submissions}건 ·{' '}
                      <button
                        type="button"
                        onClick={() => toggleFormLink(link.id)}
                        className="font-semibold underline-offset-2 hover:underline"
                      >
                        {link.active ? '받는 중' : '중단됨'}
                      </button>
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => copy(link)}
                    disabled={!link.active}
                    className="pressable shrink-0 rounded-full bg-surface px-3 py-1.5 text-[12px] font-bold text-slate hover:bg-hairline-soft disabled:opacity-50"
                  >
                    복사
                  </button>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </ScreenBody>

      <LeadComposer
        open={composing}
        onClose={() => setComposing(false)}
        onSubmit={(fields) => {
          addLead(fields);
          setComposing(false);
        }}
      />

      {toast && <Toast>{toast}</Toast>}
    </>
  );
}

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
            {late ? meta.duty : `${SOURCE_LABEL[lead.source]} · ${when}`}
            {lead.trialDate && ` · 체험 ${lead.trialDate.slice(5).replace('-', '/')}`}
          </span>
        </span>

        <span
          className={cn(
            'shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-bold',
            late ? 'bg-tint-alert text-error' : meta.pill,
          )}
        >
          {late ? `${waited}일째` : meta.label}
        </span>
      </button>
    </li>
  );
}

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

        <Field group label="유입 경로">
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

