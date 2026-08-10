/**
 * Shared application shell for both roles.
 *
 * PC-first: a persistent dark-green rail on `lg` and up (the brand's only large
 * dark surface), collapsing to a fixed bottom bar on tablet/phone. Both roles
 * render through this so the content column is *exactly* the same width in
 * every screen — combined with `scrollbar-gutter: stable` in index.css, nothing
 * shifts horizontally when you move between a short screen and a tall one.
 */

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { LayoutDashboard, Smartphone } from 'lucide-react';
import type { Role } from '@/types';
import { cn } from '@/lib/cn';
import { Crest } from '@/components/ui/Crest';

export interface ShellNavItem {
  key: string;
  label: string;
  /** Falls back to `label`; used where the bottom bar is too narrow. */
  shortLabel?: string;
  icon: LucideIcon;
  badge?: number;
  disabled?: boolean;
}

interface AppShellProps {
  /** Sits under the wordmark in the rail, e.g. "대표 대시보드". */
  role: Role;
  onRoleChange: (role: Role) => void;
  roleLabel: string;
  /** Who is signed in — name + one line of context. */
  identity?: { name: string; meta: string };
  nav: ShellNavItem[];
  active: string;
  onSelect: (key: string) => void;
  /** Optional card pinned below the rail nav (desktop only). */
  railFooter?: ReactNode;
  children: ReactNode;
}

const ROLE_OPTIONS: Array<{ key: Role; label: string; icon: LucideIcon }> = [
  { key: 'admin', label: '대표', icon: LayoutDashboard },
  { key: 'coach', label: '코치', icon: Smartphone },
];

export function AppShell({
  role,
  onRoleChange,
  roleLabel,
  identity,
  nav,
  active,
  onSelect,
  railFooter,
  children,
}: AppShellProps) {
  const roleSwitch = (compact = false) => (
    <div className="flex gap-1 rounded-full border border-white/12 bg-white/[0.06] p-1">
      {ROLE_OPTIONS.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          type="button"
          onClick={() => onRoleChange(key)}
          className={cn(
            'flex items-center justify-center gap-1.5 rounded-full font-semibold transition-colors duration-200',
            compact ? 'px-3 py-1.5 text-[12px]' : 'flex-1 py-2 text-[12.5px]',
            role === key ? 'bg-gold text-pitch-deep' : 'text-white/60 hover:text-white',
          )}
        >
          <Icon size={13} strokeWidth={2.4} />
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-surface-soft">
      {/* --- Mobile top bar ------------------------------------------
          Stands in for the rail below `lg`: it carries the brand and the role
          switch, and keeps both out of the page header's way. */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-3 bg-pitch-deep px-4 text-white lg:hidden">
        <span className="flex min-w-0 items-center gap-2">
          <Crest className="h-6 w-6 shrink-0 text-gold" />
          <span className="truncate text-[13px] font-bold tracking-[0.16em]">FC GROWTH</span>
          <span className="hidden shrink-0 text-[10px] font-semibold uppercase tracking-label text-white/40 min-[400px]:inline">
            {roleLabel}
          </span>
        </span>
        {roleSwitch(true)}
      </header>

      <div className="mx-auto flex w-full max-w-[1440px]">
        {/* --- Desktop rail ------------------------------------------- */}
        <aside className="grain sticky top-0 hidden h-screen w-[264px] shrink-0 flex-col overflow-hidden bg-pitch-deep px-4 py-7 text-white lg:flex">
          <div className="relative flex items-center gap-2.5 px-2">
            <Crest className="h-8 w-8 shrink-0 text-gold" />
            <span className="min-w-0 leading-none">
              <span className="block text-[14px] font-bold tracking-[0.16em]">FC GROWTH</span>
              <span className="mt-1.5 block text-[10px] font-semibold uppercase tracking-label text-white/45">
                {roleLabel}
              </span>
            </span>
          </div>

          {identity && (
            <div className="relative mt-6 rounded-lg border border-white/10 bg-white/[0.06] px-3.5 py-3">
              <p className="truncate text-[14px] font-semibold">{identity.name}</p>
              <p className="mt-0.5 truncate text-[12px] text-white/50">{identity.meta}</p>
            </div>
          )}

          <nav className="relative mt-6 space-y-1">
            {nav.map((item) => (
              <RailButton
                key={item.key}
                item={item}
                active={active === item.key}
                onSelect={onSelect}
              />
            ))}
          </nav>

          {railFooter && <div className="relative mt-6">{railFooter}</div>}

          {/* Prototype-only role jump. In production the role comes from the
              session and each user only ever sees one of these. */}
          <div className="relative mt-auto pt-6">{roleSwitch()}</div>
        </aside>

        {/* --- Content ------------------------------------------------- */}
        <main className="min-w-0 flex-1 pb-24 lg:pb-0">{children}</main>
      </div>

      {/* --- Mobile bottom nav ---------------------------------------- */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-white/10 bg-pitch-deep pb-[env(safe-area-inset-bottom)] lg:hidden">
        {nav.map((item) => {
          const isActive = active === item.key;
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelect(item.key)}
              disabled={item.disabled}
              className={cn(
                // Fixed 56px so the coach screens' sticky CTAs can sit on
                // `bottom-14` without guessing at the bar's height.
                'relative flex h-14 flex-1 flex-col items-center justify-center gap-1 transition-colors duration-200',
                isActive ? 'text-gold' : 'text-white/50',
                item.disabled && 'opacity-35',
              )}
            >
              <span className="relative">
                <Icon size={19} strokeWidth={isActive ? 2.5 : 2} />
                {!!item.badge && item.badge > 0 && (
                  <span className="absolute -right-2.5 -top-1.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-error px-1 text-[9px] font-bold text-white">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </span>
              <span className="text-[10.5px] font-semibold leading-none">
                {item.shortLabel ?? item.label}
              </span>
              {isActive && (
                <span className="absolute inset-x-[22%] top-0 h-[2px] rounded-full bg-gold" />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

function RailButton({
  item,
  active,
  onSelect,
}: {
  item: ShellNavItem;
  active: boolean;
  onSelect: (key: string) => void;
}) {
  const Icon = item.icon;

  return (
    <button
      type="button"
      onClick={() => onSelect(item.key)}
      disabled={item.disabled}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-full px-3.5 py-2.5 text-[14px] font-medium transition-colors duration-200',
        active ? 'bg-white text-pitch-deep' : 'text-white/65 hover:bg-white/10 hover:text-white',
        item.disabled && 'cursor-not-allowed opacity-35 hover:bg-transparent',
      )}
    >
      <Icon size={17} strokeWidth={active ? 2.4 : 2} />
      <span className="min-w-0 truncate">{item.label}</span>
      {!!item.badge && item.badge > 0 && (
        <span
          className={cn(
            'ml-auto flex h-[19px] min-w-[19px] items-center justify-center rounded-full px-1.5 text-[11px] font-bold',
            active ? 'bg-error text-white' : 'bg-error/85 text-white',
          )}
        >
          {item.badge}
        </span>
      )}
    </button>
  );
}
