/**
 * Who is signed in, and which academy they belong to.
 *
 * This sits *above* `AppProvider`: no academy data is fetched until a session
 * with a membership exists, because until then there is no tenant to fetch for.
 *
 * The role here is read from `academy_members`, never from component state.
 * That is the whole point of the change — the old prototype had a toggle, so
 * "역할" was a UI preference. Now it is a database row, and the same row is what
 * the RLS policies read via `auth.uid()`. There is no client-side way to
 * become an owner.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session as AuthSession } from '@supabase/supabase-js';
import type { Membership, Session } from '@/types';
import { friendlyError, supabase } from '@/lib/supabase';

type Status = 'loading' | 'signed-out' | 'no-membership' | 'ready';

interface AuthContextValue {
  status: Status;
  session: Session | null;
  /** Set when the last auth attempt failed. Cleared on the next attempt. */
  error: string | null;
  busy: boolean;

  signIn: (email: string, password: string) => Promise<boolean>;
  /** Registers the user *and* creates their academy. Owner path only. */
  signUpOwner: (input: {
    email: string;
    password: string;
    academyName: string;
    displayName: string;
  }) => Promise<boolean>;
  /** Registers the user and joins an existing academy via an invite code. */
  signUpCoach: (input: {
    email: string;
    password: string;
    inviteCode: string;
    displayName: string;
  }) => Promise<boolean>;
  /** For an account that exists but has no academy yet. */
  joinWithCode: (code: string, displayName: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /**
   * Turn a Supabase auth session into an app session by looking up membership.
   *
   * A user with no membership row is a real, authenticated account that belongs
   * to no academy — the state you land in if you register and then abandon the
   * invite step. It is not an error, so it gets its own status and its own
   * screen rather than a failed login.
   */
  const resolve = useCallback(async (authSession: AuthSession | null) => {
    if (!authSession) {
      setSession(null);
      setStatus('signed-out');
      return;
    }

    const { data, error: queryError } = await supabase
      .from('academy_members')
      .select('user_id, academy_id, role, coach_id, display_name, academies(id, name, plan)')
      .eq('user_id', authSession.user.id)
      .limit(1)
      .maybeSingle();

    if (queryError) {
      setError(friendlyError(queryError, '소속 정보를 불러오지 못했습니다'));
      setSession(null);
      setStatus('no-membership');
      return;
    }

    const academy = data?.academies as unknown as
      | { id: string; name: string; plan: 'pilot' | 'standard' }
      | null
      | undefined;

    if (!data || !academy) {
      setSession(null);
      setStatus('no-membership');
      return;
    }

    const membership: Membership = {
      userId: data.user_id,
      academyId: data.academy_id,
      role: data.role,
      coachId: data.coach_id,
      displayName: data.display_name,
    };

    setSession({
      userId: authSession.user.id,
      email: authSession.user.email ?? '',
      academy: { id: academy.id, name: academy.name, plan: academy.plan },
      membership,
    });
    setStatus('ready');
  }, []);

  useEffect(() => {
    let alive = true;

    supabase.auth.getSession().then(({ data }) => {
      if (alive) void resolve(data.session);
    });

    // Covers token refresh and sign-out in another tab, so two tabs can't end
    // up rendering different roles.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (alive) void resolve(next);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [resolve]);

  /** Every auth action shares this shape: clear error, run, report. */
  const attempt = useCallback(async (fn: () => Promise<void>, fallback: string) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      return true;
    } catch (e) {
      setError(friendlyError(e, fallback));
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const signIn = useCallback(
    (email: string, password: string) =>
      attempt(async () => {
        const { error: e } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (e) throw e;
      }, '로그인에 실패했습니다'),
    [attempt],
  );

  /**
   * Registration and academy creation are two calls, and the second can fail
   * after the first succeeds — leaving an account with no academy. That is
   * exactly the `no-membership` state, which has a screen offering the invite
   * code, so the user is never stranded.
   */
  const signUpOwner = useCallback(
    (input: { email: string; password: string; academyName: string; displayName: string }) =>
      attempt(async () => {
        const { error: signUpError } = await supabase.auth.signUp({
          email: input.email.trim(),
          password: input.password,
        });
        if (signUpError) throw signUpError;

        // With email confirmation on, there is no session yet and the RPC would
        // run unauthenticated. Say so rather than failing cryptically.
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) {
          throw new Error('가입 확인 메일을 보냈습니다. 인증 후 로그인해 주세요');
        }

        const { error: rpcError } = await supabase.rpc('create_academy', {
          p_name: input.academyName,
          p_display_name: input.displayName,
        });
        if (rpcError) throw rpcError;

        await resolve(sessionData.session);
      }, '가입에 실패했습니다'),
    [attempt, resolve],
  );

  const signUpCoach = useCallback(
    (input: { email: string; password: string; inviteCode: string; displayName: string }) =>
      attempt(async () => {
        const { error: signUpError } = await supabase.auth.signUp({
          email: input.email.trim(),
          password: input.password,
        });
        if (signUpError) throw signUpError;

        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) {
          throw new Error('가입 확인 메일을 보냈습니다. 인증 후 로그인해 주세요');
        }

        const { error: rpcError } = await supabase.rpc('redeem_invite', {
          p_code: input.inviteCode,
          p_display_name: input.displayName,
        });
        if (rpcError) throw rpcError;

        await resolve(sessionData.session);
      }, '가입에 실패했습니다'),
    [attempt, resolve],
  );

  const joinWithCode = useCallback(
    (code: string, displayName: string) =>
      attempt(async () => {
        const { error: rpcError } = await supabase.rpc('redeem_invite', {
          p_code: code,
          p_display_name: displayName,
        });
        if (rpcError) throw rpcError;

        const { data } = await supabase.auth.getSession();
        await resolve(data.session);
      }, '합류에 실패했습니다'),
    [attempt, resolve],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setStatus('signed-out');
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      error,
      busy,
      signIn,
      signUpOwner,
      signUpCoach,
      joinWithCode,
      signOut,
      clearError,
    }),
    [status, session, error, busy, signIn, signUpOwner, signUpCoach, joinWithCode, signOut, clearError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/**
 * For components below the auth gate, where a session is guaranteed. Saves
 * every consumer a null check that can never be true.
 */
export function useSession(): Session {
  const { session } = useAuth();
  if (!session) throw new Error('useSession used outside an authenticated tree');
  return session;
}
