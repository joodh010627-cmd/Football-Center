/**
 * What each role may see and do.
 *
 * This module is the app's *statement* of the permission model; it is not the
 * enforcement. Enforcement is `supabase/migrations/0002_rls.sql`, where the
 * database refuses the query no matter what the client asks for.
 *
 * Both exist on purpose, and the difference matters:
 *
 *   RLS decides what data the session can obtain.
 *   This file decides what the app bothers to render and offer.
 *
 * Without RLS, this file would be theatre — anyone can edit the JS. Without
 * this file, a coach would get an owner's dashboard full of empty tables and
 * zeroes and reasonably conclude the app is broken. So a rule here should
 * always have a policy behind it; if you add a capability with no policy, you
 * have added a UI affordance, not a permission.
 */

import type { MemberRole, Session } from '@/types';

export type Capability =
  /** Revenue, margin, cost, retention — the owner's P&L. */
  | 'finance:read'
  /** The owner's 0–5 rating of each coach. Never visible to coaches. */
  | 'coach-evaluation:read'
  /** Per-student tuition. */
  | 'billing:read'
  /** The churn queue and the "CS 조치 완료" action. */
  | 'churn:manage'
  /** Every student in the academy, not just one coach's classes. */
  | 'roster:read-all'
  /** Add coaches, issue invite codes. */
  | 'members:manage'
  /** Author curricula and standard sessions, and rule on coaches' proposals. */
  | 'curriculum:manage'
  /**
   * Submit a new standard session or training block for the owner's approval.
   *
   * Separate from `curriculum:manage` because it is the one curriculum write a
   * coach has, and it is not a weaker version of authoring — the row it creates
   * is `pending` and invisible in the builder until the owner rules on it.
   */
  | 'curriculum:propose'
  /** Plan sessions and record attendance for one's own classes. */
  | 'session:record';

const CAPABILITIES: Record<MemberRole, readonly Capability[]> = {
  owner: [
    'finance:read',
    'coach-evaluation:read',
    'billing:read',
    'churn:manage',
    'roster:read-all',
    'members:manage',
    'curriculum:manage',
    'curriculum:propose',
    'session:record',
  ],
  // A coach records their own sessions and may *propose* into the curriculum.
  // Everything the owner uses to *evaluate* coaches is absent — including, most
  // importantly, the coach's own score.
  coach: ['session:record', 'curriculum:propose'],
};

export function can(session: Session | null, capability: Capability): boolean {
  if (!session) return false;
  return CAPABILITIES[session.membership.role].includes(capability);
}

export const isOwner = (session: Session | null): boolean =>
  session?.membership.role === 'owner';

export const isCoach = (session: Session | null): boolean =>
  session?.membership.role === 'coach';

export const ROLE_LABEL: Record<MemberRole, string> = {
  owner: '대표 대시보드',
  coach: '코치 앱',
};
