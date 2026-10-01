/**
 * 수업 준비 — the order a coach actually plans a day in.
 *
 * Asked how they get ready, coaches describe the same three questions: who is
 * coming, what did we do last time, and so what is today about. The first two
 * are facts the app already holds; the third is the coach's call, offered as a
 * short list rather than a blank page. Once it is made the 훈련 블록 follow —
 * fitted to today's headcount, minutes and age group instead of copied
 * verbatim from the library, because a 4대4 게임 written for twelve children
 * is a different drill with seven.
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
  TrainingBlock,
} from '@/types';
import { pastSessions, publishedBlocks, sessionsFor } from './selectors';

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
// Today's goal
// ---------------------------------------------------------------------------

/**
 * The goals on offer for one focus.
 *
 * The class's own curriculum comes first — it is what the centre decided this
 * class is for — then everything else suited to the age. Within that, goals
 * run recently sink below ones that haven't, so the top of the list is always
 * a next step rather than a repeat.
 */
export function goalOptions(
  templates: SessionTemplate[],
  cls: Pick<Class, 'ageGroup' | 'curriculumId'>,
  ability: Ability,
  recentIds: readonly (ID | null | undefined)[],
): SessionTemplate[] {
  const own = (t: SessionTemplate) => Boolean(cls.curriculumId) && t.curriculumId === cls.curriculumId;
  const ran = (t: SessionTemplate) => recentIds.includes(t.id);
  // `sessionsFor` already orders by source and usage; the sort is stable.
  return [...sessionsFor(templates, ability, cls.ageGroup)].sort(
    (a, b) => Number(own(b)) - Number(own(a)) || Number(ran(a)) - Number(ran(b)),
  );
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
 * A goal's blocks, made to fit today.
 *
 * Two passes. First, any block the class can't run — wrong age, more players
 * than are coming — is swapped for one that trains the same ability in the
 * same slot of the hour. Then minutes are nudged in fives until the lesson fills
 * the class: extra time goes to the game first (children came to play), and
 * cuts come off the longest drill so no single part is gutted and the game is
 * the last thing shortened.
 */
export function composeLesson(
  template: SessionTemplate,
  library: TrainingBlock[],
  when: LessonConditions,
): Composition {
  const notes: string[] = [];
  const byId = new Map(library.map((b) => [b.id, b]));
  const pool = publishedBlocks(library);
  const taken = new Set(template.blockIds);

  const blocks = template.blockIds.flatMap((id) => {
    const block = byId.get(id);
    if (!block) return [];

    const ageOk = suitsAge(block, when.ageGroup);
    const countOk = enoughPlayers(block, when.headcount);
    if (ageOk && countOk) return [block];

    const fits = (b: TrainingBlock) =>
      !taken.has(b.id) &&
      b.category === block.category &&
      suitsAge(b, when.ageGroup) &&
      enoughPlayers(b, when.headcount);
    const alt =
      pool.find((b) => fits(b) && b.ability === block.ability) ??
      pool.find((b) => fits(b) && b.ability === template.ability) ??
      pool.find(fits);

    const why = ageOk ? `${when.headcount}명` : when.ageGroup;
    if (alt) {
      taken.add(alt.id);
      notes.push(`${why}에 맞춰 '${block.title}' 대신 '${alt.title}'`);
      return [alt];
    }
    // Nothing to swap in: keep it and say what to change on the pitch.
    if (!countOk) notes.push(`'${block.title}'은 ${when.headcount}명에 맞춰 인원을 줄여 진행`);
    return [block];
  });

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
        if (longest < 0 || minutes[i] > minutes[longest]) longest = i;
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

  return {
    items: blocks.map((b, i) => ({
      category: b.category,
      blockId: b.id,
      durationMin: minutes[i] === b.durationMin ? null : minutes[i],
    })),
    notes,
  };
}

// ---------------------------------------------------------------------------
// From the last lessons to today's goal
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
  /** The skills this block works on, in the coach's words (see `THREADS`). */
  threads: string[];
}

export const TODAY = -1;

/**
 * The skills a goal can carry over from one lesson to the next.
 *
 * Abilities are too coarse to say "today follows on from last time" — every
 * 기술 lesson would follow every other. These are the words coaches use for
 * what a drill is *about*, each with the phrasings the library uses for it.
 * A lesson on 패스 정확도 and one on 패스 후 움직임 share 패스; that shared
 * word is the link the coach sees.
 */
// prettier-ignore
const THREADS: Array<[thread: string, words: string[]]> = [
  ['패스', ['패스']],
  ['첫 터치', ['터치', '받고', '받아', '받기']],
  ['드리블', ['드리블', '돌파', '제치']],
  ['슈팅', ['슈팅', '마무리']],
  ['1대1', ['1대1']],
  ['공간', ['공간', '빈 곳', '빈 모서리']],
  ['압박', ['압박', '되찾']],
  ['수비', ['수비', '커버']],
  ['방향 전환', ['방향', '민첩', '지그재그']],
  ['스피드', ['스피드', '출발', '가속', '세 걸음']],
  ['몸싸움', ['밸런스', '지키', '몸싸움']],
  ['체력', ['체력', '인터벌', '강도']],
  ['재도전', ['도전', '실패', '실수']],
  ['집중', ['집중', '신호']],
  ['소통', ['이름', '부르', '소통']],
  ['협력', ['협력', '함께', '미션']],
  ['역할', ['역할', '책임']],
];

/** The threads a piece of text mentions, in `THREADS` order. */
export function threadsIn(text: string): string[] {
  return THREADS.filter(([, words]) => words.some((w) => text.includes(w))).map(([t]) => t);
}

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
        threads: threadsIn(`${block.title} ${block.description}`),
      },
    ];
  });
}

export const pastBeads = (recent: PastLesson[], blockMap: Map<ID, TrainingBlock>): Bead[] =>
  recent.flatMap((l, i) => beadsOf(l.plan?.items ?? [], blockMap, i));

/** Minutes each ability got across the beads. */
export function minutesByAbility(beads: Bead[]): Record<Ability, number> {
  const out: Record<Ability, number> = { technical: 0, tactical: 0, physical: 0, mental: 0, attitude: 0 };
  for (const b of beads) out[b.ability] += b.minutes;
  return out;
}

/**
 * What a past lesson was, in a few words.
 *
 * A lesson run from a goal is that goal. One the coach put together by hand has
 * no title, and "직접 구성한 수업" three times in a row tells the coach
 * nothing — so it is named after its main drill: the longest 훈련 block, or the
 * game only when there is none, since every lesson ends in one.
 */
export function lessonTitle(lesson: PastLesson, beads: Bead[]): string {
  if (lesson.template) return lesson.template.title;
  const longest = (category: Bead['category']) =>
    beads.filter((b) => b.category === category).sort((a, b) => b.minutes - a.minutes)[0];
  return (longest('skill') ?? longest('game') ?? beads[0])?.title ?? '계획 없이 진행';
}

/** Threads a goal is *about* — its name and sentence, not every drill in it. */
const goalThreads = (t: Pick<SessionTemplate, 'title' | 'goal'>) => threadsIn(`${t.title} ${t.goal}`);

export interface GoalContext {
  cls: Pick<Class, 'ageGroup' | 'curriculumId'>;
  recent: PastLesson[];
  /** `pastBeads(recent, …)`. */
  past: Bead[];
  library: TrainingBlock[];
  when: LessonConditions;
}

/** Threads each past lesson worked on — its goal, and everything its blocks did. */
const threadsByLesson = (ctx: GoalContext): Array<Set<string>> =>
  ctx.recent.map((lesson, i) => {
    const out = new Set(lesson.template ? goalThreads(lesson.template) : []);
    for (const b of ctx.past) if (b.lesson === i) b.threads.forEach((t) => out.add(t));
    return out;
  });

/** Where today's goal picks up from: a past lesson, and the skill it shares. */
export interface CarryOver {
  lesson: number;
  /** The shared skill. Absent when it is simply the same goal again. */
  thread?: string;
}

/** The most recent past lesson the goal follows on from, if any. */
export function carryOver(goal: SessionTemplate, ctx: GoalContext): CarryOver | null {
  if (ctx.recent[0]?.plan?.templateId === goal.id) return { lesson: 0 };
  const threads = threadsByLesson(ctx);
  const focus = goalThreads(goal);
  const lesson = threads.findIndex((set) => focus.some((t) => set.has(t)));
  if (lesson < 0) return null;
  return { lesson, thread: focus.find((t) => threads[lesson].has(t)) };
}

/** Last lesson's tags that name one of the goal's skills, most frequent first. */
function tagsFor(goal: SessionTemplate, ctx: GoalContext): Array<[string, number]> {
  const focus = goalThreads(goal);
  return (ctx.recent[0]?.tags ?? []).filter(([tag]) => threadsIn(tag).some((t) => focus.includes(t)));
}

/** Blocks the composer had to swap out for today's headcount or age. */
const swapsFor = (goal: SessionTemplate, ctx: GoalContext) =>
  composeLesson(goal, ctx.library, ctx.when).items.filter(
    (i) => i.blockId && !goal.blockIds.includes(i.blockId),
  ).length;

/**
 * How well a goal follows on from the last lessons and fits today.
 *
 * In order of weight: don't repeat last lesson's goal; carry a skill on from
 * the last lesson (from the ones before, a little less); the class's own
 * curriculum; something the coach tagged last time; and a goal whose blocks
 * run as written with today's children beats one that has to be patched.
 */
export function scoreGoal(
  goal: SessionTemplate,
  ctx: GoalContext,
  threads = threadsByLesson(ctx),
): number {
  const focus = goalThreads(goal);
  const shared = (i: number) => focus.filter((t) => threads[i]?.has(t)).length;
  const ranLast = ctx.recent[0]?.plan?.templateId === goal.id;
  const ranLately = ctx.recent.some((l, i) => i > 0 && l.plan?.templateId === goal.id);
  const older = threads.some((_, i) => i > 0 && shared(i) > 0);
  const own = Boolean(ctx.cls.curriculumId) && goal.curriculumId === ctx.cls.curriculumId;
  return (
    (ranLast ? -6 : 0) +
    (ranLately ? -3 : 0) +
    2 * Math.min(shared(0), 2) +
    (older ? 1 : 0) +
    (own ? 2 : 0) +
    (tagsFor(goal, ctx).length > 0 ? 1 : 0) -
    swapsFor(goal, ctx)
  );
}

/**
 * The goal to put in front of the coach for one focus.
 *
 * `options` is `goalOptions`' list; ties keep its order, so with no history at
 * all this is simply the class's own curriculum first.
 */
export function recommendGoal(
  options: SessionTemplate[],
  ctx: GoalContext,
): SessionTemplate | undefined {
  const threads = threadsByLesson(ctx);
  let best: SessionTemplate | undefined;
  let bestScore = -Infinity;
  for (const goal of options) {
    const score = scoreGoal(goal, ctx, threads);
    if (score > bestScore) {
      best = goal;
      bestScore = score;
    }
  }
  return best;
}

export const shortDate = (d: ISODate) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
