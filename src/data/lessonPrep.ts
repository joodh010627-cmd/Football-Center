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
 * Where the goal list opens: the focus of the last lesson, so carrying a
 * theme on is the zero-tap path and switching is one tap away.
 */
export function suggestedAbility(recent: PastLesson[]): Ability {
  return recent.find((l) => l.template)?.template?.ability ?? 'technical';
}

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
