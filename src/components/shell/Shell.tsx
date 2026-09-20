/**
 * Application shell — one structure for both roles.
 *
 * The old shell gave the owner a BI dashboard and the coach a session tool, and
 * they shared nothing but a colour. That was wrong about what an owner does all
 * day: they teach. So the five destinations below are the same five for
 * everybody, and 대표 gets *more inside them* — a 상세 보기 on the 클럽 tab —
 * rather than a different app. Role is a depth, not a fork.
 *
 * Mobile is the design target, not the fallback. A coach opens this one-handed
 * on a pitch, so: a fixed bottom bar with five thumb-sized targets, 클래스 in the
 * middle where the thumb rests, and no horizontal scrolling anywhere. Desktop
 * gets the same five as a light left rail.
 */

import { useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Bell, ChevronLeft, LogOut, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Crest } from '@/components/ui/Crest';
import { useAuth, useSession } from '@/store/AuthContext';

export interface TabItem {
  key: string;
  label: string;
  icon: LucideIcon;
  /** Red count on the icon. Falsy values render nothing. */
  badge?: number;
  /** Renders the tab but refuses the tap, with a reason on the long-press. */
  disabled?: boolean;
}

/** One actionable thing behind the bell. */
export interface Alert {
  id: string;
  label: string;
  detail: string;
  tone: 'urgent' | 'normal';
  onOpen: () => void;
}

interface ShellProps {
  tabs: TabItem[];
  active: string;
  onSelect: (key: string) => void;
  alerts: Alert[];
  children: ReactNode;
}

export function Shell({ tabs, active, onSelect, alerts, children }: ShellProps) {
  const session = useSession();
  const { signOut } = useAuth();
  const [bellOpen, setBellOpen] = useState(false);

  const urgent = alerts.some((a) => a.tone === 'urgent');

  const select = (key: string, disabled?: boolean) => {
    if (disabled) return;
    onSelect(key);
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="min-h-screen bg-surface-soft">
      {/* --- Mobile top bar ---------------------------------------------
          White, not the old pitch-green band. On a phone the green bar ate
          48px of a 780px viewport to say something the user already knew. */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-hairline-soft bg-canvas px-4 lg:hidden">
        <span className="flex min-w-0 items-center gap-2">
          <Crest className="h-6 w-6 shrink-0 text-primary" />
          <span className="truncate text-[17px] font-bold tracking-[-0.02em] text-ink">
            {session.academy.name}
          </span>
        </span>
        <BellButton count={alerts.length} urgent={urgent} onClick={() => setBellOpen(true)} />
      </header>

      <div className="mx-auto flex w-full max-w-[1320px]">
        {/* --- Desktop rail ---------------------------------------------- */}
        <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col border-r border-hairline-soft bg-canvas px-3 py-6 lg:flex">
          <div className="flex items-center gap-2.5 px-3">
            <Crest className="h-7 w-7 shrink-0 text-primary" />
            <span className="min-w-0 leading-none">
              <span className="block truncate text-[16px] font-bold tracking-[-0.02em] text-ink">
                {session.academy.name}
              </span>
              <span className="mt-1.5 block truncate text-[11.5px] text-steel">
                {session.membership.displayName || session.email}
              </span>
            </span>
          </div>

          <nav className="mt-7 space-y-1">
            {tabs.map((tab) => (
              <RailTab
                key={tab.key}
                tab={tab}
                active={active === tab.key}
                onSelect={() => select(tab.key, tab.disabled)}
              />
            ))}
          </nav>

          <div className="mt-6 border-t border-hairline-soft pt-5">
            <AlertList alerts={alerts} onOpen={() => undefined} compact />
          </div>

          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-auto flex w-full items-center justify-center gap-1.5 rounded-full border border-hairline px-3 py-2 text-[13px] font-semibold text-steel transition-colors duration-200 hover:border-hairline-strong hover:text-ink"
          >
            <LogOut size={13} strokeWidth={2.4} />
            로그아웃
          </button>
        </aside>

        {/* Bottom padding clears the fixed bar; `lg` drops it with the bar. */}
        <main className="min-w-0 flex-1 pb-[calc(4.75rem+env(safe-area-inset-bottom))] lg:pb-0">
          {children}
        </main>
      </div>

      {/* --- Mobile bottom bar ------------------------------------------- */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-hairline bg-canvas/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {tabs.map((tab) => (
          <BottomTab
            key={tab.key}
            tab={tab}
            active={active === tab.key}
            onSelect={() => select(tab.key, tab.disabled)}
          />
        ))}
      </nav>

      {bellOpen && (
        <AlertSheet
          alerts={alerts}
          onClose={() => setBellOpen(false)}
          onSignOut={() => void signOut()}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

function BottomTab({
  tab,
  active,
  onSelect,
}: {
  tab: TabItem;
  active: boolean;
  onSelect: () => void;
}) {
  const Icon = tab.icon;

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={tab.disabled}
      aria-current={active ? 'page' : undefined}
      className={cn(
        // 60px, not the old 56: with the label under the icon this is the
        // smallest height that still gives the icon a 44px touch box.
        'relative flex h-[60px] flex-1 flex-col items-center justify-center gap-[5px] transition-colors duration-200',
        active ? 'text-primary' : 'text-stone',
        tab.disabled && 'opacity-40',
      )}
    >
      <span
        className={cn(
          'relative flex h-6 w-11 items-center justify-center rounded-full transition-colors duration-200',
          active && 'bg-primary-wash',
        )}
      >
        <Icon size={19} strokeWidth={active ? 2.4 : 2} />
        <Badge count={tab.badge} />
      </span>
      <span className={cn('text-[10.5px] leading-none', active ? 'font-bold' : 'font-medium')}>
        {tab.label}
      </span>
    </button>
  );
}

function RailTab({
  tab,
  active,
  onSelect,
}: {
  tab: TabItem;
  active: boolean;
  onSelect: () => void;
}) {
  const Icon = tab.icon;

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={tab.disabled}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-full px-3.5 py-2.5 text-[14.5px] transition-colors duration-200',
        active
          ? 'bg-primary-wash font-semibold text-primary'
          : 'font-medium text-slate hover:bg-surface hover:text-ink',
        tab.disabled && 'cursor-not-allowed opacity-40 hover:bg-transparent',
      )}
    >
      <Icon size={18} strokeWidth={active ? 2.4 : 2} />
      <span className="min-w-0 truncate">{tab.label}</span>
      {!!tab.badge && tab.badge > 0 && (
        <span className="ml-auto flex h-[19px] min-w-[19px] items-center justify-center rounded-full bg-error px-1.5 text-[11px] font-bold text-white">
          {tab.badge > 99 ? '99+' : tab.badge}
        </span>
      )}
    </button>
  );
}

function Badge({ count }: { count?: number }) {
  if (!count || count <= 0) return null;
  return (
    <span className="absolute -right-0.5 -top-1 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-error px-1 text-[9px] font-bold text-white">
      {count > 99 ? '99+' : count}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

function BellButton({
  count,
  urgent,
  onClick,
}: {
  count: number;
  urgent: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`알림 ${count}건`}
      className="relative -mr-2 flex h-10 w-10 items-center justify-center rounded-full text-charcoal transition-colors duration-200 hover:bg-surface"
    >
      <Bell size={20} strokeWidth={2} />
      {count > 0 && (
        <span
          className={cn(
            'absolute right-1.5 top-1.5 h-2 w-2 rounded-full ring-2 ring-canvas',
            urgent ? 'bg-error' : 'bg-gold',
          )}
        />
      )}
    </button>
  );
}

function AlertSheet({
  alerts,
  onClose,
  onSignOut,
}: {
  alerts: Alert[];
  onClose: () => void;
  onSignOut: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="닫기"
        onClick={onClose}
        className="absolute inset-0 bg-ink/35 animate-fade-in"
      />
      <div className="absolute inset-x-0 bottom-0 max-h-[78vh] animate-slide-up overflow-y-auto rounded-t-2xl bg-canvas pb-[env(safe-area-inset-bottom)]">
        <header className="sticky top-0 flex items-center justify-between border-b border-hairline-soft bg-canvas px-5 py-4">
          <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-ink">
            오늘 확인할 것 {alerts.length}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="-mr-2 flex h-9 w-9 items-center justify-center rounded-full text-steel hover:bg-surface"
          >
            <X size={19} />
          </button>
        </header>

        <div className="px-5 py-4">
          <AlertList alerts={alerts} onOpen={onClose} />
        </div>

        <div className="border-t border-hairline-soft px-5 py-4">
          <button
            type="button"
            onClick={onSignOut}
            className="flex w-full items-center justify-center gap-1.5 rounded-full border border-hairline py-2.5 text-[13.5px] font-semibold text-steel"
          >
            <LogOut size={14} strokeWidth={2.4} />
            로그아웃
          </button>
        </div>
      </div>
    </div>
  );
}

function AlertList({
  alerts,
  onOpen,
  compact = false,
}: {
  alerts: Alert[];
  onOpen: () => void;
  compact?: boolean;
}) {
  if (alerts.length === 0) {
    return (
      <p className={cn('text-steel', compact ? 'px-3 text-[12.5px]' : 'py-6 text-center text-[14px]')}>
        {compact ? '확인할 항목 없음' : '지금 확인할 항목이 없습니다.'}
      </p>
    );
  }

  return (
    <ul className={compact ? 'space-y-0.5' : 'space-y-2'}>
      {alerts.map((alert) => (
        <li key={alert.id}>
          <button
            type="button"
            onClick={() => {
              alert.onOpen();
              onOpen();
              window.scrollTo({ top: 0 });
            }}
            className={cn(
              'flex w-full items-start gap-2.5 text-left transition-colors duration-150',
              compact
                ? 'rounded-md px-3 py-2 hover:bg-surface'
                : 'rounded-lg border border-hairline px-4 py-3 hover:border-hairline-strong',
            )}
          >
            <span
              className={cn(
                'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full',
                alert.tone === 'urgent' ? 'bg-error' : 'bg-gold',
              )}
            />
            <span className="min-w-0">
              <span
                className={cn(
                  'block font-semibold text-ink',
                  compact ? 'text-[12.5px]' : 'text-[14.5px]',
                )}
              >
                {alert.label}
              </span>
              <span
                className={cn(
                  'mt-0.5 block text-steel',
                  compact ? 'text-[11.5px]' : 'text-[13px]',
                )}
              >
                {alert.detail}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Screen chrome
// ---------------------------------------------------------------------------

/**
 * The header every screen opens with.
 *
 * One component rather than a pattern each screen re-types, because the spacing
 * above the fold is the single thing that makes five unrelated screens feel like
 * one app. `eyebrow` is the small tracked line, `title` is the statement.
 */
export function ScreenHeader({
  eyebrow,
  title,
  meta,
  action,
}: {
  eyebrow?: string;
  title: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="px-5 pb-1 pt-6 sm:px-7 lg:px-10 lg:pt-10">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && <p className="eyebrow-ink">{eyebrow}</p>}
          <h1 className="mt-2.5 text-[27px] font-bold leading-[1.15] tracking-tightest text-ink sm:text-[32px]">
            {title}
          </h1>
        </div>
        {action && <div className="shrink-0 pt-1">{action}</div>}
      </div>
      {meta && <p className="mt-3 text-[14px] leading-[1.6] text-steel">{meta}</p>}
    </header>
  );
}

/**
 * The 뒤로 affordance, on the same gutter as everything else.
 *
 * Separate from `ScreenHeader` because the screens reached by a drill-down are
 * not always ones this app wrote — `CurriculumScreen` and `PortfolioScreen`
 * carry their own headers from before the restructure, and they need a way back
 * without being rewritten.
 */
export function BackBar({ label, onBack }: { label: string; onBack: () => void }) {
  return (
    <div className="px-5 pt-5 sm:px-7 lg:px-10 lg:pt-8">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 text-[13.5px] font-medium text-steel transition-colors hover:text-ink"
      >
        <ChevronLeft size={15} strokeWidth={2.4} />
        {label}
      </button>
    </div>
  );
}

/** Standard horizontal gutters. Every screen body uses this, nothing else. */
export function ScreenBody({ children }: { children: ReactNode }) {
  return <div className="px-5 py-5 sm:px-7 lg:px-10">{children}</div>;
}

/** A titled block inside a screen body. */
export function Section({
  title,
  meta,
  action,
  children,
}: {
  title: string;
  meta?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mt-7 first:mt-0">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[19px] font-bold tracking-[-0.02em] text-ink">{title}</h2>
        {meta && <span className="shrink-0 text-[13px] text-steel">{meta}</span>}
        {action}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}
