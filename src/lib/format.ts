import type { AttendanceStatus, ISODate } from '@/types';

const WON = new Intl.NumberFormat('ko-KR');

export const formatWon = (n: number): string => `${WON.format(Math.round(n))}원`;

/** Compact KRW for dashboard tiles: 3,520,000 → "352만". */
export function formatWonCompact(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 100_000_000) return `${sign}${(abs / 100_000_000).toFixed(1)}억`;
  if (abs >= 10_000) return `${sign}${Math.round(abs / 10_000).toLocaleString('ko-KR')}만`;
  return `${sign}${WON.format(abs)}`;
}

export const formatPercent = (ratio: number, digits = 0): string =>
  `${(ratio * 100).toFixed(digits)}%`;

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'] as const;

export function formatDateKo(iso: ISODate): string {
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAY_KO[d.getDay()]})`;
}

/**
 * `null` renders as a dash. A freshly imported roster has no attendance dates
 * yet, so this is a routine state rather than an edge case — and a blank is far
 * safer than "Invalid Date" or a fabricated-looking 1/1 in that column.
 */
export function formatDateShort(iso: ISODate | null): string {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export const weekdayLabel = (day: number): string => WEEKDAY_KO[day] ?? '';

export const formatSchedule = (days: number[], startTime: string): string =>
  `${days.map(weekdayLabel).join('·')} ${startTime}`;

export const ATTENDANCE_LABEL: Record<AttendanceStatus, string> = {
  present: '출석',
  absent: '결석',
  injured: '부상',
};

/** Traffic-light tokens for the coach's attendance toggle. */
export const ATTENDANCE_STYLE: Record<
  AttendanceStatus,
  { chip: string; ring: string; dot: string; text: string }
> = {
  present: {
    chip: 'bg-tint-mint text-brand-green',
    ring: 'border-brand-green bg-tint-mint',
    dot: 'bg-brand-green',
    text: 'text-brand-green',
  },
  absent: {
    chip: 'bg-tint-alert text-error',
    ring: 'border-error bg-tint-alert',
    dot: 'bg-error',
    text: 'text-error',
  },
  injured: {
    chip: 'bg-tint-peach text-brand-orange-deep',
    ring: 'border-brand-orange bg-tint-peach',
    dot: 'bg-brand-orange',
    text: 'text-brand-orange-deep',
  },
};
