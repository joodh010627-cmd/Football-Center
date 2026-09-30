/**
 * The pieces every session screen is built from.
 *
 * One rule runs through all of them: a screen shows the one thing you came for,
 * and everything else is one tap away behind 더 보기. A session row shows its
 * name; its goal sentence and its blocks unfold. A block shows its name and
 * minutes; how to run it unfolds.
 */

import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronLeft } from 'lucide-react';
import type { Ability, ID, SessionItem, SessionTemplate, TrainingBlock } from '@/types';
import { useApp } from '@/store/AppContext';
import { sessionDuration } from '@/data/selectors';
import type { SessionState } from '@/data/today';
import { blockAsRun } from '@/data/lessonPrep';
import { cn } from '@/lib/cn';
import { ABILITY_META, ABILITY_ORDER, CATEGORY_META } from './meta';

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

/** 뒤로 + title + one line of context. The header of every drill-down. */
export function DetailHeader({
  backLabel,
  onBack,
  title,
  meta,
  action,
}: {
  backLabel: string;
  onBack: () => void;
  title: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="px-5 pb-1 pt-5 sm:px-7 lg:px-10 lg:pt-8">
      <button
        type="button"
        onClick={onBack}
        className="-ml-1 flex items-center gap-0.5 text-[13.5px] font-medium text-steel transition-colors hover:text-ink"
      >
        <ChevronLeft size={16} strokeWidth={2.4} />
        {backLabel}
      </button>
      <div className="mt-3 flex items-start justify-between gap-3">
        <h1 className="min-w-0 text-[27px] font-bold leading-[1.15] tracking-tightest text-ink sm:text-[30px]">
          {title}
        </h1>
        {action && <div className="shrink-0 pt-1">{action}</div>}
      </div>
      {meta && <p className="mt-2 text-[14px] text-steel">{meta}</p>}
    </header>
  );
}

// ---------------------------------------------------------------------------
// 더 보기
// ---------------------------------------------------------------------------

export function More({
  label = '더 보기',
  children,
  className,
}: {
  label?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-1 text-[13.5px] font-semibold text-steel transition-colors hover:text-ink"
      >
        {open ? '접기' : label}
        <ChevronDown
          size={15}
          strokeWidth={2.4}
          className={cn('transition-transform duration-200', open && 'rotate-180')}
        />
      </button>
      {open && <div className="animate-fade-in mt-3">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ability
// ---------------------------------------------------------------------------

export function AbilityTag({ ability, className }: { ability: Ability; className?: string }) {
  const meta = ABILITY_META[ability];
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11.5px] font-bold',
        meta.wash,
        meta.tone,
        className,
      )}
    >
      {meta.label}
    </span>
  );
}

export function AbilityChips({
  value,
  onChange,
}: {
  value: Ability | 'all';
  onChange: (next: Ability | 'all') => void;
}) {
  const options: Array<[Ability | 'all', string]> = [
    ['all', '전체'],
    ...ABILITY_ORDER.map((a) => [a, ABILITY_META[a].label] as [Ability, string]),
  ];
  return (
    <div className="no-scrollbar -mx-5 flex gap-1.5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
      {options.map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          aria-pressed={value === key}
          className={cn(
            'shrink-0 rounded-full border px-3.5 py-1.5 text-[13.5px] font-semibold transition-colors duration-150',
            value === key
              ? 'border-ink bg-ink text-white'
              : 'border-hairline bg-canvas text-charcoal hover:border-hairline-strong',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

/** One block, name and minutes; tap to see how to run it. */
export function BlockRow({
  index,
  block,
  minutes,
  edited = false,
  trailing,
}: {
  index?: number;
  block: TrainingBlock | undefined;
  minutes: number;
  /** The coach rewrote this block for the lesson. */
  edited?: boolean;
  trailing?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  if (!block) {
    return <li className="px-4 py-3 text-[14px] text-stone">삭제된 블록</li>;
  }
  return (
    <li className="border-b border-hairline-soft last:border-b-0">
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          {index !== undefined && (
            <span className="w-5 shrink-0 text-[13px] font-semibold tabular-nums text-stone">
              {index + 1}
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold text-ink">{block.title}</span>
            <span className="mt-0.5 block text-[12.5px] text-steel">
              {CATEGORY_META[block.category].label} · {minutes}분
              {edited && <span className="font-semibold text-primary"> · 수정함</span>}
            </span>
          </span>
          <ChevronDown
            size={15}
            className={cn('shrink-0 text-stone transition-transform', open && 'rotate-180')}
          />
        </button>
        {trailing}
      </div>
      {open && (
        <div className="animate-fade-in space-y-2 px-4 pb-4 pl-12 text-[13.5px] leading-[1.6] text-charcoal">
          <p>{block.description}</p>
          {block.coachingPoints.length > 0 && (
            <ul className="space-y-0.5 text-slate">
              {block.coachingPoints.map((p) => (
                <li key={p}>· {p}</li>
              ))}
            </ul>
          )}
          {block.equipment.length > 0 && (
            <p className="text-[12.5px] text-steel">준비물 {block.equipment.join(', ')}</p>
          )}
        </div>
      )}
    </li>
  );
}

/** A plan's or session's blocks, in order. */
export function BlockList({ items }: { items: SessionItem[] }) {
  const { blockMap } = useApp();
  return (
    <ol className="overflow-hidden rounded-lg border border-hairline bg-canvas">
      {items.map((item, i) => {
        const base = item.blockId ? blockMap.get(item.blockId) : undefined;
        const block = base && blockAsRun(base, item);
        return (
          <BlockRow
            key={`${item.blockId}-${i}`}
            index={i}
            block={block}
            minutes={item.durationMin ?? block?.durationMin ?? 0}
            edited={Boolean(item.edit)}
          />
        );
      })}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export const templateItems = (t: SessionTemplate): SessionItem[] =>
  t.blockIds.map((blockId) => ({
    category: 'skill',
    blockId,
    durationMin: null,
  }));

/** Minutes a session takes at its blocks' defaults. */
export function useTemplateMinutes(): (t: SessionTemplate) => number {
  const { blockMap } = useApp();
  return (t) => sessionDuration(templateItems(t), blockMap);
}

/**
 * A session in a list: name first. Tapping unfolds the goal sentence and the
 * blocks, and only then offers the action — so choosing is deliberate, and the
 * list stays one line per session until you ask for more.
 */
export function SessionRow({
  template,
  current = false,
  actionLabel,
  onAction,
  extra,
}: {
  template: SessionTemplate;
  current?: boolean;
  actionLabel?: string;
  onAction?: () => void;
  /** More controls under the blocks — edit, delete. */
  extra?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const minutes = useTemplateMinutes()(template);

  return (
    <li className="border-b border-hairline-soft last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-soft"
      >
        <AbilityTag ability={template.ability} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[15.5px] font-semibold text-ink">{template.title}</span>
            {current && (
              <span className="shrink-0 text-[12px] font-semibold text-primary">현재</span>
            )}
            {template.status === 'pending' && (
              <span className="shrink-0 text-[12px] font-semibold text-brand-orange-deep">
                승인 대기
              </span>
            )}
          </span>
        </span>
        <span className="shrink-0 text-[12.5px] tabular-nums text-steel">{minutes}분</span>
        <ChevronDown
          size={15}
          className={cn('shrink-0 text-stone transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="animate-fade-in space-y-3 px-4 pb-4">
          <p className="text-[14px] leading-[1.6] text-charcoal">{template.goal}</p>
          <BlockList items={templateItems(template)} />
          {extra}
          {onAction && actionLabel && (
            <button type="button" onClick={onAction} className="btn-primary w-full py-3">
              {actionLabel}
            </button>
          )}
        </div>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// 진행 — where one lesson is in its day
// ---------------------------------------------------------------------------

type Step = 'done' | 'current' | 'live' | 'todo';

/**
 * 준비 → 수업 → 기록, as three bars.
 *
 * A lesson's day has exactly three things a coach does to it, in order, and the
 * old counters ("수업 1개 · 마무리 필요 1") made them do arithmetic to find out
 * which one was next.
 *
 * One hue, three brightnesses: deep green is done, bright green is the step in
 * front of the coach (pulsing while the lesson is running), and a pale wash is
 * still to come. A lesson waiting on its 기록 used to turn gold; it doesn't
 * need a second colour when the bright bar already sits on 기록.
 */
export function LessonProgress({
  state,
  planned,
  className,
}: {
  state: SessionState;
  planned: boolean;
  className?: string;
}) {
  const over = state === 'needs_log' || state === 'done';
  const steps: Array<[string, Step]> = [
    ['준비', planned ? 'done' : over ? 'todo' : 'current'],
    ['수업', over ? 'done' : state === 'now' ? 'live' : planned ? 'current' : 'todo'],
    ['기록', state === 'done' ? 'done' : state === 'needs_log' ? 'current' : 'todo'],
  ];
  return (
    <ol className={cn('grid grid-cols-3 gap-1.5', className)} aria-label="수업 진행">
      {steps.map(([label, step]) => (
        <li key={label} aria-current={step === 'current' || step === 'live' ? 'step' : undefined}>
          <span
            className={cn(
              'block h-[5px] rounded-full',
              step === 'done' && 'bg-primary',
              step === 'live' && 'animate-pulse bg-primary-soft',
              step === 'current' && 'bg-primary-soft',
              step === 'todo' && 'bg-primary/15',
            )}
          />
          <span
            className={cn(
              'mt-1.5 block text-[12.5px]',
              step === 'done' && 'text-primary',
              step === 'todo' && 'text-stone',
              (step === 'current' || step === 'live') && 'font-bold text-ink',
            )}
          >
            {label}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** The session a plan runs, if it names one that still exists. */
export function useSessionOf(templateId: ID | null | undefined): SessionTemplate | undefined {
  const { getTemplate } = useApp();
  return templateId ? getTemplate(templateId) : undefined;
}
