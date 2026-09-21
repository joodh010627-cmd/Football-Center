/**
 * Presentation vocabulary for the curriculum layer.
 *
 * The labels live here rather than in the database because they are the
 * centre's language, not its data: `track` is a stable enum the RLS policies and
 * the ranking function depend on, while "킨더 · 놀이" is a phrase the owner may
 * want to reword on a Tuesday. Renaming a chip should never be a migration.
 */

import type { AgeGroup, CurriculumTrack } from '@/types';

export const AGE_ORDER: AgeGroup[] = ['U7', 'U9', 'U11', 'U13', 'U15'];

/* `AGE_CAPTION` ("만 7~9세" …) lived here to head the old matrix's columns.
   Nothing renders it now: the list shows `U9` alone, and a coach reading it
   already knows what U9 means. */

export interface TrackMeta {
  /** One word where possible. It sits in a list row next to the age group, and
   *  a label that wraps turns an eight-row list into a sixteen-line one. */
  label: string;
  /** What this track is for, in the owner's words — a phrase, not a sentence. */
  purpose: string;
  tint: string;
  accent: string;
  bar: string;
}

export const TRACK_META: Record<CurriculumTrack, TrackMeta> = {
  kinder: {
    label: '킨더',
    purpose: '기술보다 재미',
    tint: 'bg-tint-rose',
    accent: 'text-brand-pink-deep',
    bar: 'bg-brand-pink',
  },
  foundation: {
    label: '기초',
    purpose: '두 발과 첫 터치',
    tint: 'bg-tint-peach',
    accent: 'text-brand-orange-deep',
    bar: 'bg-brand-orange',
  },
  skill: {
    label: '기술',
    purpose: '1:1 돌파와 볼 소유',
    tint: 'bg-tint-lavender',
    accent: 'text-brand-purple-800',
    bar: 'bg-primary',
  },
  tactical: {
    label: '전술',
    purpose: '역할과 전환',
    tint: 'bg-tint-sky',
    accent: 'text-link-pressed',
    bar: 'bg-link',
  },
  elite: {
    label: '엘리트',
    purpose: '경기력과 진학',
    tint: 'bg-tint-mint',
    accent: 'text-brand-green',
    bar: 'bg-brand-green',
  },
  physical: {
    label: '피지컬',
    purpose: '몸과 골문',
    tint: 'bg-tint-gray',
    accent: 'text-charcoal',
    bar: 'bg-steel',
  },
  club: {
    label: '주말',
    purpose: '주 1회로 즐기는 축구',
    tint: 'bg-tint-yellow',
    accent: 'text-charcoal',
    bar: 'bg-brand-yellow',
  },
};

export const TRACK_ORDER: CurriculumTrack[] = [
  'kinder',
  'foundation',
  'skill',
  'tactical',
  'elite',
  'physical',
  'club',
];

export const APPROVAL_LABEL = {
  published: '등재',
  pending: '승인 대기',
  rejected: '반려',
} as const;
