/**
 * 수업 준비 — the order a coach actually plans a day in.
 *
 * Asked how they get ready, coaches describe the same questions: who is
 * coming, what did we do last time, and so what is today about. The first two
 * are facts the app already holds. The third is a 훈련 주제 — one textbook
 * football ability — and the app answers it with a lesson's worth of the
 * 훈련 블록 mapped to it, fitted to today's headcount, minutes and age group,
 * because a 4대4 게임 written for twelve children is a different drill with
 * seven. From there the coach edits the blocks. The five abilities are only
 * the coach's hashtags for the day and build nothing.
 */

import type {
  Ability,
  AgeGroup,
  AttendanceLog,
  Class,
  ID,
  ISODate,
  SessionItem,
  SessionPlan,
  SessionTemplate,
  TopicId,
  TrainingBlock,
} from '@/types';
import { pastSessions, publishedBlocks } from './selectors';
import { topicMeta } from './topics';

/** A block as it runs in one lesson — the library version with the coach's edit on top. */
export function blockAsRun(block: TrainingBlock, item: Pick<SessionItem, 'edit'>): TrainingBlock {
  const e = item.edit;
  if (!e) return block;
  return {
    ...block,
    title: e.title ?? block.title,
    description: e.description ?? block.description,
    coachingPoints: e.coachingPoints ?? block.coachingPoints,
  };
}

// ---------------------------------------------------------------------------
// What happened before
// ---------------------------------------------------------------------------

export interface PastLesson {
  date: ISODate;
  plan: SessionPlan | null;
  template: SessionTemplate | undefined;
  present: number;
  total: number;
  /** Tags the coach left that day, most frequent first. */
  tags: Array<[string, number]>;
}

/** The class's last few lessons before `date`, newest first. */
export function recentLessons(
  slice: {
    sessionPlans: SessionPlan[];
    attendanceLogs: AttendanceLog[];
    sessionTemplates: SessionTemplate[];
  },
  cls: Class,
  date: ISODate,
  limit = 3,
): PastLesson[] {
  const templates = new Map(slice.sessionTemplates.map((t) => [t.id, t]));
  return pastSessions(slice, cls, date, limit).map((past) => {
    const counts = new Map<string, number>();
    for (const log of slice.attendanceLogs) {
      if (log.classId !== cls.id || log.date !== past.date) continue;
      for (const tag of log.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return {
      ...past,
      template: past.plan?.templateId ? templates.get(past.plan.templateId) : undefined,
      tags: [...counts].sort((a, b) => b[1] - a[1]),
    };
  });
}

// ---------------------------------------------------------------------------
// Composing the blocks
// ---------------------------------------------------------------------------

/**
 * Players a block needs, read off its "N대M" — 0 when it names none.
 *
 * Deliberately a reading of the text rather than a new column: every block
 * that has a player count already says it in words, and a coach editing a
 * block edits the words.
 */
export function minPlayers(block: Pick<TrainingBlock, 'title' | 'description'>): number {
  const m = `${block.title} ${block.description}`.match(/(\d+)\s*(?:대|:|vs?)\s*(\d+)/i);
  return m ? Number(m[1]) + Number(m[2]) : 0;
}

export interface LessonConditions {
  ageGroup: AgeGroup;
  /** Expected players, trials included. 0 means unknown — no headcount rule. */
  headcount: number;
  /** The class's length. */
  minutes: number;
}

export interface Composition {
  items: SessionItem[];
  /** What was changed from the library version, in the coach's words. */
  notes: string[];
}

const suitsAge = (b: TrainingBlock, age: AgeGroup) =>
  b.ageGroups.length === 0 || b.ageGroups.includes(age);

const enoughPlayers = (b: TrainingBlock, headcount: number) =>
  headcount === 0 || minPlayers(b) <= headcount;

/** Shortest a block may be trimmed to; a game under ten minutes is not a game. */
const floorOf = (b: TrainingBlock) => (b.category === 'warmup' ? 5 : 10);
const CEILING = 30;

/**
 * Minutes for the chosen blocks, so the lesson fills the class.
 *
 * Nudged in fives: extra time goes to the game first (children came to play),
 * and cuts come off the longest drill so no single part is gutted and the
 * game is the last thing shortened.
 */
function fitMinutes(blocks: TrainingBlock[], when: LessonConditions, notes: string[]): SessionItem[] {
  const minutes = blocks.map((b) => b.durationMin);
  const sum = () => minutes.reduce((a, b) => a + b, 0);
  const before = sum();

  if (when.minutes > 0) {
    // Grow: the last game first, then the longest-running drills, in turn.
    const growOrder = [
      ...blocks.map((b, i) => (b.category === 'game' ? i : -1)).filter((i) => i >= 0).reverse(),
      ...blocks.map((b, i) => (b.category === 'skill' ? i : -1)).filter((i) => i >= 0),
    ];
    const lastPlayed = growOrder[0] ?? blocks.length - 1;
    let guard = 0;
    while (when.minutes - sum() >= 5 && growOrder.length > 0 && guard++ < 40) {
      const i = growOrder.find((k) => minutes[k] < CEILING);
      if (i === undefined) break;
      minutes[i] += 5;
      growOrder.push(growOrder.splice(growOrder.indexOf(i), 1)[0]);
    }
    // Shrink: off whichever drill is currently longest, and off the game
    // only once the drills are down to their floor.
    guard = 0;
    const longestOf = (game: boolean) => {
      let longest = -1;
      blocks.forEach((b, i) => {
        if ((b.category === 'game') !== game || minutes[i] - 5 < floorOf(b)) return;
        // On a tie the later drill gives way: the first is the lesson's main one.
        if (longest < 0 || minutes[i] >= minutes[longest]) longest = i;
      });
      return longest;
    };
    while (sum() > when.minutes && guard++ < 40) {
      const i = longestOf(false) >= 0 ? longestOf(false) : longestOf(true);
      if (i < 0) break;
      minutes[i] -= 5;
    }
    // Centre blocks run in odd minutes (18, 25…), so fives can leave a few
    // over. They go to the game rather than to an idle whistle at the end.
    const spare = when.minutes - sum();
    if (spare > 0 && spare < 5 && lastPlayed >= 0) minutes[lastPlayed] += spare;
    if (sum() !== before) notes.push(`${when.minutes}분에 맞춰 시간을 나눴어요`);
  }

  return blocks.map((b, i) => ({
    category: b.category,
    blockId: b.id,
    durationMin: minutes[i] === b.durationMin ? null : minutes[i],
  }));
}

// ---------------------------------------------------------------------------
// What the last lessons ran
// ---------------------------------------------------------------------------

/**
 * One block as it ran (or will run) in one lesson. `lesson` is the index into
 * `recentLessons` (0 = the last lesson); today is `TODAY`.
 */
export interface Bead {
  lesson: number;
  blockId: ID;
  title: string;
  category: TrainingBlock['category'];
  ability: Ability;
  minutes: number;
}

export const TODAY = -1;

/** A lesson's blocks as beads. Items whose block is gone are skipped. */
export function beadsOf(
  items: SessionItem[],
  blockMap: Map<ID, TrainingBlock>,
  lesson: number,
): Bead[] {
  return items.flatMap((item) => {
    const base = item.blockId ? blockMap.get(item.blockId) : undefined;
    if (!base) return [];
    const block = blockAsRun(base, item);
    return [
      {
        lesson,
        blockId: base.id,
        title: block.title,
        category: block.category,
        ability: block.ability,
        minutes: item.durationMin ?? block.durationMin,
      },
    ];
  });
}

export const pastBeads = (recent: PastLesson[], blockMap: Map<ID, TrainingBlock>): Bead[] =>
  recent.flatMap((l, i) => beadsOf(l.plan?.items ?? [], blockMap, i));

/**
 * The block that says what a lesson is: its first drill, or its game when
 * there is no drill, or whatever there is. The first rather than the longest,
 * because minutes get trimmed to fit the class — a lesson shouldn't be named
 * after its second drill because it kept five more minutes.
 */
export function mainBlock(beads: Bead[]): Bead | undefined {
  const first = (category: Bead['category']) => beads.find((b) => b.category === category);
  return first('skill') ?? first('game') ?? beads[0];
}

export interface LessonContext {
  cls: Pick<Class, 'ageGroup'>;
  /** `pastBeads(recentLessons(…), …)` — what the class ran lately. */
  past: Bead[];
  library: TrainingBlock[];
  when: LessonConditions;
}

// ---------------------------------------------------------------------------
// Today: 훈련 주제 → blocks
// ---------------------------------------------------------------------------

/** Drills in a lesson: one for a short class, two otherwise. */
const drillsFor = (minutes: number) => (minutes > 0 && minutes < 55 ? 1 : 2);

const usableFor = (ctx: Pick<LessonContext, 'library' | 'when'>) =>
  publishedBlocks(ctx.library).filter((b) => suitsAge(b, ctx.when.ageGroup));

/**
 * The topics this class can build a lesson on — those with at least one drill
 * suited to its age. The rest are shown but can't be chosen.
 */
export function runnableTopics(ctx: Pick<LessonContext, 'library' | 'when'>): Set<TopicId> {
  const out = new Set<TopicId>();
  for (const b of usableFor(ctx)) if (b.category === 'skill') b.topics.forEach((t) => out.add(t));
  return out;
}

/**
 * Today's blocks for one 훈련 주제: a warm-up, the topic's drills, a game.
 *
 * Drills come only from blocks mapped to the topic. The warm-up and the game
 * come from the topic first and from anything after that — a lesson always has
 * both. Within that the centre's own blocks come before the standard library
 * (they are the director's way of coaching), then what the class did not run
 * last time, then what is used most. A block needing more children than are
 * coming is used only when nothing else fills the slot, and the coach is told.
 *
 * Empty when the topic has no drill for the class's age.
 */
export function composeForTopic(topic: TopicId, ctx: LessonContext): Composition {
  const { when } = ctx;
  const notes: string[] = [];
  const ranLast = new Set(ctx.past.filter((b) => b.lesson === 0).map((b) => b.blockId));
  const pool = usableFor(ctx);
  const onTopic = (b: TrainingBlock) => b.topics.includes(topic);
  if (!pool.some((b) => b.category === 'skill' && onTopic(b))) return { items: [], notes };

  const rank = (a: TrainingBlock, b: TrainingBlock) =>
    Number(a.source === 'standard') - Number(b.source === 'standard') ||
    Number(ranLast.has(a.id)) - Number(ranLast.has(b.id)) ||
    // A block whose main topic this is beats one that only touches on it.
    Number(b.topics[0] === topic) - Number(a.topics[0] === topic) ||
    b.usageCount - a.usageCount;
  const taken = new Set<ID>();
  const any = () => true;

  const fill = (
    category: TrainingBlock['category'],
    tiers: Array<(b: TrainingBlock) => boolean>,
    count: number,
  ): TrainingBlock[] => {
    const out: TrainingBlock[] = [];
    const take = (strict: boolean) => {
      for (const tier of tiers) {
        const options = pool
          .filter(
            (b) =>
              b.category === category &&
              !taken.has(b.id) &&
              tier(b) &&
              (!strict || enoughPlayers(b, when.headcount)),
          )
          .sort(rank);
        for (const b of options) {
          if (out.length >= count) return;
          out.push(b);
          taken.add(b.id);
          if (!strict) notes.push(`'${b.title}'은 ${when.headcount}명에 맞춰 인원을 줄여 진행`);
        }
      }
    };
    take(true);
    if (out.length === 0) take(false);
    return out;
  };

  const blocks = [
    ...fill('warmup', [onTopic, any], 1),
    ...fill('skill', [onTopic], drillsFor(when.minutes)),
    ...fill('game', [onTopic, any], 1),
  ];
  return { items: fitMinutes(blocks, when, notes), notes };
}

/**
 * What a saved lesson is called: the 훈련 주제 it was built from, or — for a
 * plan made before topics, or put together by hand — its main drill's name.
 */
export function lessonName(
  plan: Pick<SessionPlan, 'items' | 'topic'> | null | undefined,
  blockMap: Map<ID, TrainingBlock>,
): string | undefined {
  if (!plan) return undefined;
  if (plan.topic) return topicMeta(plan.topic).label;
  return mainBlock(beadsOf(plan.items, blockMap, TODAY))?.title;
}
