/**
 * The five development axes — 기술 / 전술 / 피지컬 / 멘탈 / 태도.
 *
 * This is the app's one vocabulary for "what a player is made of", and it is
 * deliberately used in *both* directions:
 *
 *   훈련 — a training block says which axis it moves.
 *   평가 — a student's pentagon says how far each axis has moved.
 *
 * They used to be two unrelated enums (`TrainingCategory` = warmup/skill/game,
 * `BehaviorTag.dimension` = skill/attitude/teamwork/physical/caution), so a
 * coach could run eight weeks of 전술 work and the student's report had nowhere
 * to show it. One axis list is what lets the session plan and the growth report
 * be read as the same sentence.
 *
 * Note this does *not* replace `TrainingCategory`. That enum is the *shape* of a
 * session — warmup, then the main work, then a game — which is a question of
 * time, not of competence. A 웜업 block can absolutely be 피지컬 work. Phase and
 * axis are orthogonal, and collapsing them would lose one of them.
 */

import type { AttendanceLog, BehaviorTag, ID, TrainingBlock } from '@/types';

export type DevelopmentAxis = 'technical' | 'tactical' | 'physical' | 'mental' | 'attitude';

/** Clockwise from the top — the order the pentagon is drawn in. */
export const AXES: readonly DevelopmentAxis[] = [
  'technical',
  'tactical',
  'physical',
  'mental',
  'attitude',
] as const;

export interface AxisMeta {
  label: string;
  /** What this axis means, in the owner's own words. */
  meaning: string;
  /** The sub-competences it owns. Also the keyword list `axisFor` matches on. */
  items: readonly string[];
  /** Tailwind text colour for chips and the radar stroke. */
  tone: string;
  /** Tailwind background for the axis chip. */
  wash: string;
}

export const AXIS_META: Record<DevelopmentAxis, AxisMeta> = {
  technical: {
    label: '기술',
    meaning: '공을 다루는 능력',
    items: ['패스', '퍼스트터치', '드리블', '슈팅', '볼 컨트롤'],
    tone: 'text-primary',
    wash: 'bg-primary-wash',
  },
  tactical: {
    label: '전술',
    meaning: '상황을 읽고 선택하는 능력',
    items: ['위치선정', '공간이해', '판단', '압박대응', '전환'],
    tone: 'text-brand-teal',
    wash: 'bg-tint-sky',
  },
  physical: {
    label: '피지컬',
    meaning: '신체적 수행',
    items: ['스피드', '민첩성', '밸런스', '지구력', '힘'],
    tone: 'text-brand-orange-deep',
    wash: 'bg-tint-peach',
  },
  mental: {
    label: '멘탈',
    meaning: '경기·훈련에서의 심리 상태',
    items: ['집중', '자신감', '도전성', '회복력', '침착함'],
    tone: 'text-charcoal',
    wash: 'bg-tint-yellow',
  },
  attitude: {
    label: '태도',
    meaning: '팀과 훈련에 임하는 방식',
    items: ['적극성', '소통', '협력', '책임감', '학습태도'],
    tone: 'text-brand-green',
    wash: 'bg-tint-mint',
  },
};

export const axisLabel = (axis: DevelopmentAxis): string => AXIS_META[axis].label;

/** Scores on all five axes, 0–100. */
export type AxisScores = Record<DevelopmentAxis, number>;

export const emptyScores = (fill = 0): AxisScores => ({
  technical: fill,
  tactical: fill,
  physical: fill,
  mental: fill,
  attitude: fill,
});

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

/**
 * Every sub-competence, pointing back at its axis. Built once so `axisFor` is a
 * scan over ~25 short strings rather than a nested loop per call.
 */
const KEYWORDS: Array<[string, DevelopmentAxis]> = AXES.flatMap((axis) =>
  AXIS_META[axis].items.map((item) => [item, axis] as [string, DevelopmentAxis]),
);

/**
 * Extra vocabulary that isn't a sub-competence but reliably names one.
 *
 * These come from the tag labels academies actually type — "수비" is tactical
 * work even though the pentagon never says the word, and "체력" is what people
 * write when they mean 지구력.
 *
 * The 주의 vocabulary is over-represented here on purpose. Watch tags are
 * phrased as symptoms ("통증호소", "소극적참여") rather than as competences, so
 * without them every negative observation in the academy falls through to the
 * `caution` fallback and piles onto one axis. That is not a cosmetic problem:
 * it makes 멘탈 a bin for everything that went wrong and reads, on a real
 * student, as a child with a psychological difficulty they do not have.
 */
const SYNONYMS: Array<[string, DevelopmentAxis]> = [
  ['킥', 'technical'],
  ['트래핑', 'technical'],
  ['리프팅', 'technical'],
  ['크로스', 'technical'],
  ['수비', 'tactical'],
  ['공격', 'tactical'],
  ['전개', 'tactical'],
  ['빌드업', 'tactical'],
  ['시야', 'tactical'],
  ['움직임', 'tactical'],
  // 압박 on its own, as well as the 압박대응 competence: a block called
  // "3 대 1 압박 탈출" is tactical work and nothing else in its title says so.
  ['압박', 'tactical'],
  ['침투', 'tactical'],
  ['마킹', 'tactical'],
  ['체력', 'physical'],
  ['컨디션', 'physical'],
  ['통증', 'physical'],
  ['부상', 'physical'],
  ['스프린트', 'physical'],
  ['코어', 'physical'],
  ['순발력', 'physical'],
  ['집중력', 'mental'],
  ['멘탈', 'mental'],
  ['긴장', 'mental'],
  ['위축', 'mental'],
  ['실수', 'mental'],
  ['적극', 'attitude'],
  ['소극', 'attitude'],
  ['참여', 'attitude'],
  ['인사', 'attitude'],
  ['경청', 'attitude'],
  ['배려', 'attitude'],
  ['팀워크', 'attitude'],
  ['지각', 'attitude'],
  ['결석', 'attitude'],
];

/**
 * The legacy `BehaviorTag.dimension` values, as a last resort.
 *
 * `caution` is not a competence — it is a polarity that ended up in the
 * dimension column — so there is no honest axis to map it to. Physical is the
 * least wrong default (most unmatched watch tags are about the body: tired,
 * sore, unwell) and the synonym table above is what keeps this branch rare.
 */
const DIMENSION_FALLBACK: Record<BehaviorTag['dimension'], DevelopmentAxis> = {
  skill: 'technical',
  teamwork: 'attitude',
  physical: 'physical',
  attitude: 'attitude',
  caution: 'physical',
};

/**
 * Which axis a free-text label belongs to, or `null` when nothing matches.
 *
 * Matching on the label rather than on a stored column is what makes this work
 * today: the axis is not a database column yet, and an academy's tags were
 * typed long before this vocabulary existed. When the column lands, this
 * function becomes the backfill.
 */
export function axisFor(label: string): DevelopmentAxis | null {
  const text = label.replace(/[#\s]/g, '');
  for (const [word, axis] of KEYWORDS) if (text.includes(word)) return axis;
  for (const [word, axis] of SYNONYMS) if (text.includes(word)) return axis;
  return null;
}

export const axisForTag = (tag: BehaviorTag): DevelopmentAxis =>
  axisFor(tag.label) ?? DIMENSION_FALLBACK[tag.dimension];

/**
 * Which axis a training block moves.
 *
 * Title first, then the description — a block called "3 대 1 압박 탈출" is
 * tactical no matter which slot of the session it sits in. Only when neither
 * says anything does the phase decide, and it decides conservatively: a warmup
 * with no other signal is physical, a game is tactical, anything else technical.
 */
export function axisForBlock(block: Pick<TrainingBlock, 'title' | 'description' | 'category'>): DevelopmentAxis {
  return (
    axisFor(block.title) ??
    axisFor(block.description) ??
    (block.category === 'warmup' ? 'physical' : block.category === 'game' ? 'tactical' : 'technical')
  );
}

// ---------------------------------------------------------------------------
// The pentagon
// ---------------------------------------------------------------------------

/** One axis of a student's profile, with the evidence behind it. */
export interface AxisReading {
  axis: DevelopmentAxis;
  /** 0–100. 50 is "no signal either way", not "average student". */
  score: number;
  /** Positive observations logged on this axis. */
  hits: number;
  /** 주의 observations logged on this axis. */
  watches: number;
  /** The tag labels that produced the score, most frequent first. */
  evidence: Array<[string, number]>;
}

export type AxisProfile = Record<DevelopmentAxis, AxisReading>;

/**
 * Where the needle sits with no observations at all.
 *
 * Not zero. A pentagon collapsed to a point reads as "this child is bad at
 * everything" when it actually means "nobody has written anything down yet" —
 * the same mistake `ChurnSignal.computable` exists to prevent on the dashboard.
 */
export const NEUTRAL_SCORE = 50;

/**
 * How many net observations it takes to move the needle most of the way.
 *
 * The score saturates rather than accumulating linearly: `tanh` means the
 * first few tags move the axis a lot and the twentieth barely moves it at all.
 *
 * A linear step was tried first and was wrong in a way that mattered. Six watch
 * tags on one axis drove it to the floor, so the pentagon of a child who had a
 * rough month collapsed to a spike — and the screen a parent might one day see
 * would be saying something far stronger than the coach who tapped those tags
 * ever meant. Tags are observations, not a verdict, and the curve has to say so.
 */
const SCALE = 4;

/** How far from neutral a fully-saturated axis can get. */
const SPREAD = 42;

/**
 * A student's pentagon, read off the behaviour tags their coaches have tapped.
 *
 * Derived, never stored. The coach's input is the tag they tapped at the end of
 * a session — a number they were asked to type would be a number they invented,
 * and five of them per student per month is a form nobody fills in. The profile
 * is the arithmetic on top of taps that were already happening.
 */
export function buildAxisProfile(
  logs: AttendanceLog[],
  studentId: ID,
  tags: BehaviorTag[],
): AxisProfile {
  const tagMap = new Map(tags.map((t) => [t.label, t]));
  const profile = {} as AxisProfile;
  const evidence = {} as Record<DevelopmentAxis, Map<string, number>>;

  for (const axis of AXES) {
    profile[axis] = { axis, score: NEUTRAL_SCORE, hits: 0, watches: 0, evidence: [] };
    evidence[axis] = new Map();
  }

  for (const log of logs) {
    if (log.studentId !== studentId) continue;
    for (const label of log.tags) {
      const tag = tagMap.get(label);
      const axis = tag ? axisForTag(tag) : axisFor(label);
      if (!axis) continue;

      const reading = profile[axis];
      if (tag?.polarity === 'watch') reading.watches += 1;
      else reading.hits += 1;
      evidence[axis].set(label, (evidence[axis].get(label) ?? 0) + 1);
    }
  }

  for (const axis of AXES) {
    const reading = profile[axis];
    // Watch tags weigh slightly more than positive ones — a coach who bothers
    // to flag a concern is saying more than one who taps a compliment — but
    // not so much more that one bad week erases a term.
    const net = reading.hits - reading.watches * 1.25;
    reading.score = Math.round(NEUTRAL_SCORE + SPREAD * Math.tanh(net / SCALE));
    reading.evidence = [...evidence[axis].entries()].sort((a, b) => b[1] - a[1]);
  }

  return profile;
}

export const scoresOf = (profile: AxisProfile): AxisScores => ({
  technical: profile.technical.score,
  tactical: profile.tactical.score,
  physical: profile.physical.score,
  mental: profile.mental.score,
  attitude: profile.attitude.score,
});

/** True when no coach has tagged this student at all — the pentagon is a guess. */
export const isUnobserved = (profile: AxisProfile): boolean =>
  AXES.every((a) => profile[a].hits === 0 && profile[a].watches === 0);

/** The axis with the most room to grow. What the next session should target. */
export function weakestAxis(profile: AxisProfile): DevelopmentAxis {
  return AXES.reduce((low, axis) => (profile[axis].score < profile[low].score ? axis : low), AXES[0]);
}

export function strongestAxis(profile: AxisProfile): DevelopmentAxis {
  return AXES.reduce((top, axis) => (profile[axis].score > profile[top].score ? axis : top), AXES[0]);
}
