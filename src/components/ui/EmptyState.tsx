import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-hairline-strong bg-surface-soft px-6 py-12 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-tint-gray text-steel">
        <Icon size={20} />
      </span>
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      {description && <p className="max-w-xs text-sm leading-[1.5] text-slate">{description}</p>}
      {action}
    </div>
  );
}
