/**
 * FC GROWTH crest — a monoline shield with a sprout growing out of a football.
 *
 * Shared shape language with the public site. Everything is `currentColor`, so
 * the same component works on the green rail and on paper without a second asset.
 */
export function Crest({ className = 'h-9 w-9' }: { className?: string }) {
  const stroke = 'currentColor';

  return (
    <svg viewBox="0 0 48 56" fill="none" className={className} aria-hidden="true">
      <path
        d="M24 2.5 45 9.4v22.2c0 9.9-8.4 17.1-21 21.9-12.6-4.8-21-12-21-21.9V9.4L24 2.5Z"
        stroke={stroke}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="24" cy="31.5" r="9" stroke={stroke} strokeWidth="1.7" />
      <path d="m24 26.2 5 3.7-1.9 5.9h-6.2L19 29.9l5-3.7Z" fill={stroke} fillOpacity="0.9" />
      <path d="M24 22.5v-9" stroke={stroke} strokeWidth="1.9" strokeLinecap="round" />
      <path
        d="M24 15.6c-3.4.2-5.6-1.6-6-4.9 3.4-.4 5.7 1.4 6 4.9Z"
        fill={stroke}
        fillOpacity="0.9"
      />
      <path
        d="M24.4 17.6c3.3-.5 4.9-2.7 4.5-5.9-3.3.4-4.9 2.6-4.5 5.9Z"
        fill={stroke}
        fillOpacity="0.55"
      />
    </svg>
  );
}

/** Crest + wordmark lockup. `tone` picks the palette for the surface it sits on. */
export function Wordmark({
  className = '',
  crestClassName = 'h-8 w-8',
  subtitle,
}: {
  className?: string;
  crestClassName?: string;
  subtitle?: string;
}) {
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <Crest className={crestClassName} />
      <span className="min-w-0 leading-none">
        <span className="block text-[15px] font-bold tracking-[0.16em]">FC GROWTH</span>
        {subtitle && (
          <span className="mt-1.5 block text-[10px] font-semibold uppercase tracking-label opacity-60">
            {subtitle}
          </span>
        )}
      </span>
    </span>
  );
}
