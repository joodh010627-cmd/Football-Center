/**
 * 폼 — every question the centre asks a parent, and what came back.
 *
 * This tab used to be the enquiry pipeline and nothing else, with five boxes,
 * a hero card, a queue and a link manager on one screen. It now covers more
 * ground and shows less: three short blocks, each answering one question.
 *
 *   할 일      — what came back that needs a person, today. At most three rows.
 *                Empty means nothing is waiting, and then the block is gone.
 *   새 학부모   — one row. The pipeline behind it is a tap away, not spread
 *                across the root.
 *   설문       — what's out right now, as progress bars.
 *
 * Making anything is one button in the header, and it starts from a list of
 * real moments in a term (대회 참가, 재등록 의향, 촬영 동의 …), not from a blank
 * form. The survey that needs no thought takes two taps; the one that does
 * opens a text box.
 */

import { useMemo, useState } from 'react';
import { ChevronRight, Phone, Plus, UserPlus } from 'lucide-react';
import type { Class, ID } from '@/types';
import { useApp } from '@/store/AppContext';
import { useWorkspace } from '@/store/WorkspaceContext';
import { countLeads, isOverdue, triage, STAGE_META } from '@/data/crm';
import {
  dueLabel,
  isOpenSurvey,
  progressOf,
  SITUATIONS,
  type Survey,
  type SurveyKind,
  type SurveyRecipient,
} from '@/data/surveys';
import { cn } from '@/lib/cn';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ScreenBody, ScreenHeader, Section, Toast } from '@/components/shell/Shell';
import { NewFormSheet } from './NewFormSheet';
import { SyncBanner } from './parts';

interface FormsScreenProps {
  onOpenLead: (leadId: ID) => void;
  onOpenLeads: () => void;
  onOpenSurvey: (surveyId: ID, notice?: string | null) => void;
}

interface Todo {
  key: string;
  label: string;
  detail: string;
  tone: 'urgent' | 'call' | 'normal';
  onOpen: () => void;
}

/** Offered when nothing has been sent yet — the three a centre sends most. */
const QUICK_START: SurveyKind[] = ['rsvp', 'renewal', 'consent'];

export function FormsScreen({ onOpenLead, onOpenLeads, onOpenSurvey }: FormsScreenProps) {
  const { state } = useApp();
  const { leads, surveys, recipients, surveyMode, syncError, reload } = useWorkspace();
  const [sheet, setSheet] = useState<{ open: boolean; startKind?: SurveyKind; n: number }>({
    open: false,
    n: 0,
  });
  const [showPast, setShowPast] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const counts = useMemo(() => countLeads(leads), [leads]);

  // 등록 신청서 belong to a lead and are shown there, not in the class list.
  const classSurveys = surveys.filter((v) => v.kind !== 'enrollment');
  const current = classSurveys.filter((v) => isOpenSurvey(v));
  const past = classSurveys.filter((v) => !isOpenSurvey(v));

  const todos = useMemo<Todo[]>(() => {
    const out: Todo[] = [];

    if (counts.overdue > 0) {
      const late = triage(leads).filter((l) => isOverdue(l));
      out.push({
        key: 'leads',
        label: late.length === 1 ? `${late[0].childName} 문의 · 응대 지연` : `응대가 늦은 문의 ${late.length}건`,
        detail: late.length === 1 ? STAGE_META[late[0].stage].duty : `${late[0].childName} 외 · 오늘 안에 전화하세요`,
        tone: 'urgent',
        onOpen: late.length === 1 ? () => onOpenLead(late[0].id) : onOpenLeads,
      });
    }

    for (const v of surveys) {
      const p = progressOf(v, recipients);
      if (v.kind === 'enrollment') {
        const r = recipients.find((x) => x.surveyId === v.id && x.answeredAt);
        const lead = r && leads.find((l) => l.id === r.leadId);
        if (lead && lead.stage !== 'enrolled' && lead.stage !== 'lost') {
          out.push({
            key: `enroll-${v.id}`,
            label: `${lead.childName} 등록 신청서 도착`,
            detail: '읽어 보고 등록을 확정하세요',
            tone: 'normal',
            onOpen: () => onOpenLead(lead.id),
          });
        }
        continue;
      }
      if (p.toCall.length > 0) {
        out.push({
          key: `call-${v.id}`,
          label: `전화할 집 ${p.toCall.length}`,
          detail: v.title,
          tone: 'call',
          onOpen: () => onOpenSurvey(v.id),
        });
      }
      if (p.daysLeft !== null && p.daysLeft <= 1 && p.pending.length > 0) {
        out.push({
          key: `due-${v.id}`,
          label: `답이 없는 집 ${p.pending.length} · ${dueLabel(v)}`,
          detail: v.title,
          tone: 'normal',
          onOpen: () => onOpenSurvey(v.id),
        });
      }
    }

    return out.slice(0, 3);
  }, [counts.overdue, leads, surveys, recipients, onOpenLead, onOpenLeads, onOpenSurvey]);

  const openSheet = (startKind?: SurveyKind) =>
    setSheet((s) => ({ open: true, startKind, n: s.n + 1 }));

  const flash = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2600);
  };

  return (
    <>
      <ScreenHeader
        eyebrow="Forms"
        title="폼"
        action={
          <button
            type="button"
            onClick={() => openSheet()}
            className="btn-primary !px-4 !py-2.5 text-[14px]"
          >
            <Plus size={16} strokeWidth={2.6} />새 폼
          </button>
        }
      />

      <ScreenBody>
        <SyncBanner
          mode={surveyMode}
          error={syncError}
          onReload={reload}
          migration="0007"
          what="설문 링크"
        />

        {/* --- 할 일 ------------------------------------------------------ */}
        {todos.length > 0 && (
          <ul className="stagger space-y-2">
            {todos.map((t) => (
              <li key={t.key}>
                <button
                  type="button"
                  onClick={t.onOpen}
                  className={cn(
                    'pressable flex w-full items-center gap-3 rounded-lg px-4 py-3.5 text-left',
                    t.tone === 'urgent'
                      ? 'bg-gradient-to-br from-[#F8E8E2] to-[#FCF5F2]'
                      : 'bg-gradient-to-br from-[#DCEEE4] to-[#F1F7F3]',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                      t.tone === 'urgent' ? 'bg-error text-white' : 'bg-primary text-white',
                    )}
                  >
                    {t.tone === 'normal' ? (
                      <ChevronRight size={16} strokeWidth={2.6} />
                    ) : (
                      <Phone size={14} strokeWidth={2.6} />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-ink">
                      {t.label}
                    </span>
                    <span className="mt-0.5 block truncate text-[12.5px] text-slate">
                      {t.detail}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* --- 새 학부모 --------------------------------------------------- */}
        <button
          type="button"
          onClick={onOpenLeads}
          className={cn(
            'pressable flex w-full items-center gap-3 rounded-lg border border-hairline bg-canvas px-4 py-4 text-left hover:border-hairline-strong',
            todos.length > 0 && 'mt-5',
          )}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-wash text-primary">
            <UserPlus size={18} strokeWidth={2.2} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[16px] font-semibold text-ink">새 학부모</span>
            <span className="mt-0.5 block truncate text-[13px] tabular-nums text-steel">
              진행 중 {counts.open}
              {counts.upcomingTrials > 0 && ` · 체험 예정 ${counts.upcomingTrials}`}
            </span>
          </span>
          {counts.overdue > 0 && (
            <span className="shrink-0 rounded-full bg-tint-alert px-2.5 py-1 text-[11.5px] font-bold text-error">
              지연 {counts.overdue}
            </span>
          )}
          <ChevronRight size={18} className="shrink-0 text-stone" />
        </button>

        {/* --- 설문 ----------------------------------------------------------- */}
        <Section title="설문" meta={current.length > 0 ? `진행 중 ${current.length}` : undefined}>
          {current.length === 0 ? (
            <div className="rounded-lg border border-dashed border-hairline-strong bg-canvas px-4 py-5">
              <p className="text-[14px] font-semibold text-ink">지금 받고 있는 설문이 없습니다</p>
              <p className="mt-1 text-[12.5px] leading-[1.6] text-steel">
                반을 고르면 보호자마다 개인 링크가 알림톡으로 갑니다. 아이 이름은 이미 적혀 있어서
                보호자는 고르기만 하면 됩니다.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {QUICK_START.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => openSheet(k)}
                    className="pill-tab !py-1.5 !text-[13px]"
                  >
                    {SITUATIONS[k].label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <ul className="space-y-2">
              {current.map((v) => (
                <SurveyCard
                  key={v.id}
                  survey={v}
                  recipients={recipients}
                  classes={state.classes}
                  onOpen={() => onOpenSurvey(v.id)}
                />
              ))}
            </ul>
          )}

          {past.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setShowPast((x) => !x)}
                className="mt-3 w-full py-2 text-center text-[13px] font-semibold text-steel transition-colors hover:text-ink"
              >
                {showPast ? '지난 설문 접기' : `지난 설문 ${past.length}`}
              </button>
              {showPast && (
                <ul className="animate-swap-in space-y-2">
                  {past.map((v) => (
                    <SurveyCard
                      key={v.id}
                      survey={v}
                      recipients={recipients}
                      classes={state.classes}
                      onOpen={() => onOpenSurvey(v.id)}
                      muted
                    />
                  ))}
                </ul>
              )}
            </>
          )}
        </Section>
      </ScreenBody>

      {/* Keyed so each open starts clean — or on the quick-start it was opened with. */}
      <NewFormSheet
        key={sheet.n}
        open={sheet.open}
        startKind={sheet.startKind}
        onClose={() => setSheet((s) => ({ ...s, open: false }))}
        onSent={(surveyId, notice) => onOpenSurvey(surveyId, notice)}
        onLinkMade={flash}
      />

      {toast && <Toast>{toast}</Toast>}
    </>
  );
}

// ---------------------------------------------------------------------------

function SurveyCard({
  survey,
  recipients,
  classes,
  onOpen,
  muted = false,
}: {
  survey: Survey;
  recipients: SurveyRecipient[];
  classes: Class[];
  onOpen: () => void;
  muted?: boolean;
}) {
  const p = progressOf(survey, recipients);
  const classNames = survey.classIds
    .map((id) => classes.find((c) => c.id === id)?.title)
    .filter(Boolean)
    .join(' · ');

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          'pressable block w-full rounded-lg border border-hairline bg-canvas px-4 py-3.5 text-left hover:border-hairline-strong',
          muted && 'opacity-70',
        )}
      >
        <span className="flex items-start gap-2">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold text-ink">
              {survey.title}
            </span>
            <span className="mt-0.5 block truncate text-[12.5px] text-steel">
              {dueLabel(survey)}
              {classNames && ` · ${classNames}`}
            </span>
          </span>
          {p.toCall.length > 0 && (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary-wash px-2 py-1 text-[11.5px] font-bold text-primary">
              <Phone size={10} strokeWidth={2.8} />
              {p.toCall.length}
            </span>
          )}
        </span>
        <span className="mt-3 flex items-center gap-2.5">
          <ProgressBar value={p.total ? p.answered / p.total : 0} className="flex-1" />
          <span className="shrink-0 text-[12.5px] font-semibold tabular-nums text-slate">
            {p.answered}/{p.total}
          </span>
        </span>
      </button>
    </li>
  );
}
