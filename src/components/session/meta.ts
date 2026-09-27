/**
 * Display vocabulary for sessions and blocks.
 *
 * Abilities reuse the growth pentagon's labels and colours (`lib/axes.ts`) on
 * purpose: the chip on a session and the axis on a child's chart are the same
 * word, so a parent reading "기술 세션" and "기술이 자랐어요" is reading one idea.
 */

import type { Ability, TrainingCategory } from '@/types';
import { AXES, AXIS_META } from '@/lib/axes';

export const ABILITY_ORDER: readonly Ability[] = AXES;

export const ABILITY_META: Record<Ability, { label: string; tone: string; wash: string }> =
  AXIS_META;

/** Where a block sits in the hour. Shown as a small word, never as a choice. */
export const CATEGORY_META: Record<
  TrainingCategory,
  { label: string; tint: string; accent: string; bar: string; defaultMin: number }
> = {
  warmup: { label: '준비', tint: 'bg-tint-peach', accent: 'text-brand-orange-deep', bar: 'bg-brand-orange', defaultMin: 10 },
  skill: { label: '훈련', tint: 'bg-tint-lavender', accent: 'text-brand-purple-800', bar: 'bg-primary', defaultMin: 15 },
  game: { label: '게임', tint: 'bg-tint-mint', accent: 'text-brand-green', bar: 'bg-brand-green', defaultMin: 20 },
};
