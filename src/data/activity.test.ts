/**
 * The ledger's clock.
 *
 * `dates.ts` already carries the rule — read dates locally, never off a UTC
 * string — because attendance filed on the wrong day is a bug this codebase has
 * had before. The ledger reintroduced it in a new place: events were bucketed
 * with `at.slice(0, 10)`, which in KST files an 8pm session under tomorrow and
 * an 8am enquiry under yesterday.
 *
 * These tests pin the two directions. They are timezone-sensitive by design:
 * the assertions are written against whatever zone the suite runs in, so they
 * hold on a Korean laptop and in CI.
 */

import { describe, expect, it } from 'vitest';
import { dayOf, timeOf, toISODate } from './dates';
import { groupByDay, newEvent, type ActivityEvent } from './activity';

const event = (at: string, id = at): ActivityEvent =>
  newEvent('aca-1', {
    at,
    kind: 'attendance.recorded',
    subjectType: 'class',
    subjectId: `cls-${id}`,
    subjectLabel: 'U10 베이직',
    summary: '출결 기록',
  });

describe('dayOf', () => {
  it('reads a UTC instant as the local calendar day', () => {
    // 2026-09-14T11:00Z is the evening of the 14th in Seoul and the morning of
    // the 14th in London — the same day either way, which is the point: the
    // answer must come from the local calendar, not from the string.
    const at = '2026-09-14T11:00:00.000Z';
    expect(dayOf(at)).toBe(toISODate(new Date(at)));
  });

  it('agrees with the local clock for an instant near midnight', () => {
    // 15:00Z is the 15th in Seoul and still the 14th in London. Whichever zone
    // the suite runs in, `dayOf` must match what `Date` says locally.
    const at = '2026-09-14T15:00:00.000Z';
    expect(dayOf(at)).toBe(toISODate(new Date(at)));
  });

  it('treats a stamp with no zone as local wall-clock time', () => {
    // This is the shape the derived events use for sessions with no recorded
    // timestamp. It must not drift a day.
    expect(dayOf('2026-09-14T20:00:00')).toBe('2026-09-14');
    expect(dayOf('2026-09-14T21:00:00')).toBe('2026-09-14');
  });

  it('falls back to a slice rather than throwing on nonsense', () => {
    expect(dayOf('definitely not a timestamp')).toBe('definitely');
    expect(timeOf('definitely not a timestamp')).toBe('not a');
  });
});

describe('timeOf', () => {
  it('shows the wall-clock time of a zoneless stamp unchanged', () => {
    expect(timeOf('2026-09-14T20:00:00')).toBe('20:00');
    expect(timeOf('2026-09-14T09:05:00')).toBe('09:05');
  });

  it('converts a UTC instant into local time', () => {
    const at = '2026-09-14T11:00:00.000Z';
    const d = new Date(at);
    const expected = `${`${d.getHours()}`.padStart(2, '0')}:${`${d.getMinutes()}`.padStart(2, '0')}`;
    expect(timeOf(at)).toBe(expected);
  });
});

describe('groupByDay', () => {
  it('files an evening session under the day it was taught', () => {
    const days = groupByDay([event('2026-09-14T20:00:00')]);
    expect(days).toHaveLength(1);
    expect(days[0][0]).toBe('2026-09-14');
  });

  it('keeps one day per bucket and orders days newest first', () => {
    const days = groupByDay([
      event('2026-09-12T20:00:00', 'a'),
      event('2026-09-14T20:00:00', 'b'),
      event('2026-09-14T09:00:00', 'c'),
      event('2026-09-13T20:00:00', 'd'),
    ]);

    expect(days.map(([day]) => day)).toEqual(['2026-09-14', '2026-09-13', '2026-09-12']);
    expect(days[0][1]).toHaveLength(2);
  });

  it('returns nothing for nothing', () => {
    expect(groupByDay([])).toEqual([]);
  });
});
