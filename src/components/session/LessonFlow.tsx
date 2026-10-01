/**
 * 지난 수업 → 오늘 — the last lessons and today on one line, oldest first, so
 * time runs down the screen into today and on into today's blocks.
 *
 * Each row is a date and a name, nothing more. The rail is grey; from the
 * lesson today's goal carries on from down to today it is green, and that
 * lesson carries the one skill it hands over. One colour change on one line is
 * the whole picture of "last time leads to today".
 */

import type { ReactNode } from 'react';
import { lessonTitle, shortDate, type Bead, type CarryOver, type PastLesson } from '@/data/lessonPrep';
import { cn } from '@/lib/cn';

/** Where a row's dot sits, from the row's top — on the first line of text. */
const DOT_Y = 9;

export function LessonFlow({
  recent,
  past,
  carry,
  today,
}: {
  /** Newest first, as `recentLessons` returns them. */
  recent: PastLesson[];
  past: Bead[];
  carry: CarryOver | null;
  /** Today's row: the goal, or what to do to get one. */
  today: { ready: boolean; body: ReactNode };
}) {
  const n = recent.length;
  // Oldest first. Row r is recent[n - 1 - r]; today is row n. The rail below
  // row r is green from the carried-over lesson's row onward.
  const greenFrom = carry ? n - 1 - carry.lesson : Infinity;

  return (
    <ol className="rounded-xl border border-hairline bg-canvas px-4 py-4">
      {[...recent].reverse().map((lesson, r) => {
        const i = n - 1 - r;
        const linked = carry?.lesson === i;
        const title = lessonTitle(lesson, past.filter((b) => b.lesson === i));
        return (
          <Row
            key={lesson.date}
            line={r >= greenFrom ? 'green' : 'grey'}
            dot={
              <span
                className={cn(
                  'block h-2.5 w-2.5 rounded-full transition-colors',
                  linked ? 'border-2 border-primary bg-canvas' : 'bg-hairline-strong',
                )}
              />
            }
          >
            <p className="flex items-center gap-2">
              <span className="w-9 shrink-0 text-[13px] tabular-nums text-stone">
                {shortDate(lesson.date)}
              </span>
              <span
                className={cn(
                  'min-w-0 truncate text-[15px]',
                  linked ? 'font-semibold text-ink' : 'text-steel',
                )}
              >
                {title}
              </span>
              {linked && carry?.thread && (
                <span className="ml-auto shrink-0 rounded-full bg-primary-wash px-2 py-0.5 text-[12px] font-bold text-primary">
                  {carry.thread}
                </span>
              )}
            </p>
          </Row>
        );
      })}

      <Row
        line={null}
        dot={
          <span
            className={cn(
              'block h-3.5 w-3.5 rounded-full transition-colors',
              today.ready
                ? 'bg-primary ring-4 ring-primary/15'
                : 'border-2 border-dashed border-stone bg-canvas',
            )}
          />
        }
      >
        {today.body}
      </Row>
    </ol>
  );
}

function Row({
  dot,
  line,
  children,
}: {
  dot: ReactNode;
  /** The rail down to the next row, or null on the last row. */
  line: 'green' | 'grey' | null;
  children: ReactNode;
}) {
  return (
    <li className={cn('relative pl-8', line && 'pb-4')}>
      {line && (
        <span
          aria-hidden
          className={cn(
            'absolute left-[8px] w-[2px] rounded-full transition-colors duration-300',
            line === 'green' ? 'bg-primary' : 'bg-hairline',
          )}
          style={{ top: DOT_Y, bottom: -DOT_Y }}
        />
      )}
      <span
        aria-hidden
        className="absolute left-[9px] flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"
        style={{ top: DOT_Y }}
      >
        {dot}
      </span>
      {children}
    </li>
  );
}
