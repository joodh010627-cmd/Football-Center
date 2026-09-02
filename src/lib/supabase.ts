/**
 * Supabase client.
 *
 * The anon key is public by design — it identifies the project, not the user.
 * What protects the data is RLS (`supabase/migrations/0002_rls.sql`), which is
 * why the policies, not this file, are where security review belongs.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * Whether the app has somewhere to talk to. Checked before render so a missing
 * `.env` produces a readable setup screen instead of a white page and a
 * console stack trace.
 */
export const isConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient = createClient(
  url ?? 'http://localhost:54321',
  anonKey ?? 'anon-key-not-configured',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // A coach on a shared academy tablet shouldn't have the session restored
      // from a URL fragment someone else left behind.
      detectSessionInUrl: false,
    },
  },
);

/**
 * Postgres errors are not user-facing text. `raise exception '초대 코드…'` from
 * our own RPCs is, so those pass through; anything else gets a generic line and
 * is logged for us rather than shown to a coach mid-session.
 */
export function friendlyError(error: unknown, fallback = '문제가 발생했습니다'): string {
  if (!error) return fallback;
  const message = (error as { message?: string }).message ?? '';

  if (message.includes('Invalid login credentials')) return '이메일 또는 비밀번호가 올바르지 않습니다';
  if (message.includes('User already registered')) return '이미 가입된 이메일입니다';
  if (message.includes('Password should be at least')) return '비밀번호는 6자 이상이어야 합니다';
  if (message.includes('Email not confirmed')) return '이메일 인증을 먼저 완료해 주세요';

  // Our RPCs raise Korean messages on purpose — show them verbatim.
  if (/[가-힣]/.test(message)) return message;

  console.error('[supabase]', error);
  return fallback;
}
