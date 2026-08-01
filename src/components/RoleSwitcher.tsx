import { LayoutDashboard, Smartphone } from 'lucide-react';
import { cn } from '@/lib/cn';

export type Role = 'admin' | 'coach';

const OPTIONS: Array<{ key: Role; label: string; icon: typeof Smartphone }> = [
  { key: 'admin', label: '대표', icon: LayoutDashboard },
  { key: 'coach', label: '코치', icon: Smartphone },
];

/**
 * Prototype-only affordance for jumping between the two interfaces. In
 * production the role comes from the session, and each user sees exactly one.
 */
export function RoleSwitcher({ role, onChange }: { role: Role; onChange: (r: Role) => void }) {
  return (
    <div className="fixed right-4 top-4 z-[60] flex items-center gap-1 rounded-full border border-hairline bg-canvas/90 p-1 shadow-card backdrop-blur">
      {OPTIONS.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={cn(
            'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors duration-150',
            role === key ? 'bg-ink-deep text-white' : 'text-steel hover:text-ink',
          )}
        >
          <Icon size={14} strokeWidth={2.3} />
          {label}
        </button>
      ))}
    </div>
  );
}
