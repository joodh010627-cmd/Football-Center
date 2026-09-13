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

export const AGE_CAPTION: Record<AgeGroup, string> = {
  U7: '만 5~7세',
  U9: '만 7~9세',
  U11: '만 9~11세',
  U13: '만 11~13세',
  U15: '만 13~15세',
};

export interface TrackMeta {
  label: string;
  /** What this track is for, in the owner's words. */
  purpose: string;
  tint: string;
  accent: string;
  bar: string;
}

export const TRACK_META: Record<CurriculumTrack, TrackMeta> = {
  kinder: {
    label: '킨더 · 놀이',
    purpose: '공을 무서워하지 않게 만드는 단계. 기술보다 재미가 목표다.',
    tint: 'bg-tint-rose',
    accent: 'text-brand-pink-deep',
    bar: 'bg-brand-pink',
  },
  foundation: {
    label: '기초 정착',
    purpose: '두 발과 첫 터치. 여기서 만든 습관이 이후 전부를 결정한다.',
    tint: 'bg-tint-peach',
    accent: 'text-brand-orange-deep',
    bar: 'bg-brand-orange',
  },
  skill: {
    label: '개인 기술',
    purpose: '1:1 돌파와 볼 소유. 스스로 해결하는 선수를 만든다.',
    tint: 'bg-tint-lavender',
    accent: 'text-brand-purple-800',
    bar: 'bg-primary',
  },
  tactical: {
    label: '전술 이해',
    purpose: '역할과 전환. 개인 기술을 팀의 약속으로 옮긴다.',
    tint: 'bg-tint-sky',
    accent: 'text-link-pressed',
    bar: 'bg-link',
  },
  elite: {
    label: '엘리트 · 진학',
    purpose: '경기력 자체가 목표. 기록이 진학 자료가 된다.',
    tint: 'bg-tint-mint',
    accent: 'text-brand-green',
    bar: 'bg-brand-green',
  },
  physical: {
    label: '피지컬 · GK',
    purpose: '몸과 골문. 전문 포지션과 부상 예방을 따로 다룬다.',
    tint: 'bg-tint-gray',
    accent: 'text-charcoal',
    bar: 'bg-steel',
  },
  club: {
    label: '주말 클럽',
    purpose: '주 1회로 즐기는 축구. 진도보다 출석 동기가 먼저다.',
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
