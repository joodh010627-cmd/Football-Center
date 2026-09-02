/**
 * The boundary between "anyone" and "a known member of one academy".
 *
 * Nothing below this component renders without a resolved session, so no screen
 * inside the app ever has to handle a null user or an unknown role.
 */

import { useState, type FormEvent, type ReactNode } from 'react';
import { AlertTriangle, Loader2, LogOut } from 'lucide-react';
import { isConfigured } from '@/lib/supabase';
import { useAuth } from '@/store/AuthContext';
import { AuthLayout, AuthScreen } from './AuthScreen';

export function AuthGate({ children }: { children: ReactNode }) {
  const { status } = useAuth();

  // A missing .env is a developer mistake, not a user one. Saying so beats a
  // white screen and a console stack trace.
  if (!isConfigured) return <SetupNotice />;

  switch (status) {
    case 'loading':
      return <SessionLoading />;
    case 'signed-out':
      return <AuthScreen />;
    case 'no-membership':
      return <JoinAcademy />;
    case 'ready':
      return <>{children}</>;
  }
}

function SessionLoading() {
  return (
    <AuthLayout>
      <div className="flex items-center justify-center gap-2.5 text-[13px] text-white/50">
        <Loader2 size={16} className="animate-spin text-gold" />
        세션을 확인하는 중입니다…
      </div>
    </AuthLayout>
  );
}

function SetupNotice() {
  return (
    <AuthLayout wide>
      <div className="rounded-xl border border-white/12 bg-white/[0.06] p-6 text-white">
        <p className="flex items-center gap-2 text-[14px] font-bold text-gold">
          <AlertTriangle size={16} />
          Supabase 설정이 필요합니다
        </p>

        <p className="mt-3 text-[13px] leading-relaxed text-white/60">
          이 앱은 원생 개인정보를 다루므로 데이터가 브라우저가 아니라 데이터베이스에 있고,
          접근 제어도 거기서 이뤄집니다. 연결 정보 없이는 실행되지 않습니다.
        </p>

        <ol className="mt-5 space-y-2.5 text-[13px] leading-relaxed text-white/70">
          <li>
            <span className="mr-1.5 font-bold text-gold">1</span>
            supabase.com에서 프로젝트를 만듭니다.
          </li>
          <li>
            <span className="mr-1.5 font-bold text-gold">2</span>
            <code className="rounded bg-white/10 px-1.5 py-0.5 text-[12px]">
              supabase/migrations
            </code>
            의 SQL을 순서대로 실행합니다.
          </li>
          <li>
            <span className="mr-1.5 font-bold text-gold">3</span>
            <code className="rounded bg-white/10 px-1.5 py-0.5 text-[12px]">.env.example</code>을
            <code className="mx-1.5 rounded bg-white/10 px-1.5 py-0.5 text-[12px]">.env</code>로
            복사하고 URL과 anon key를 채웁니다.
          </li>
          <li>
            <span className="mr-1.5 font-bold text-gold">4</span>
            개발 서버를 다시 시작합니다.
          </li>
        </ol>

        <p className="mt-5 border-t border-white/10 pt-4 text-[12px] leading-relaxed text-white/40">
          자세한 절차는 <code className="text-white/60">docs/SETUP.md</code>에 있습니다.
        </p>
      </div>
    </AuthLayout>
  );
}

/**
 * A real account that belongs to no academy.
 *
 * Reachable when registration succeeded but the follow-up RPC didn't — most
 * likely because email confirmation is on, so the user came back later with a
 * session but no membership. Offering the code here is what keeps that from
 * being a dead end.
 */
function JoinAcademy() {
  const { joinWithCode, signOut, busy, error } = useAuth();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!busy) await joinWithCode(code, name);
  };

  return (
    <AuthLayout>
      <div className="rounded-xl border border-white/12 bg-white/[0.06] p-6 text-white">
        <p className="text-[14px] font-bold">아직 소속된 아카데미가 없습니다</p>
        <p className="mt-2.5 text-[13px] leading-relaxed text-white/55">
          대표님께 받은 초대 코드를 입력하면 합류됩니다.
        </p>

        <form onSubmit={submit} className="mt-5 space-y-3">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABCD2345"
            maxLength={8}
            required
            autoFocus
            className="w-full rounded-lg border border-white/12 bg-white/[0.06] px-3.5 py-2.5 font-mono text-[14px] tracking-[0.2em] text-white outline-none placeholder:text-white/25 focus:border-gold/60"
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="이름"
            required
            className="w-full rounded-lg border border-white/12 bg-white/[0.06] px-3.5 py-2.5 text-[14px] text-white outline-none placeholder:text-white/25 focus:border-gold/60"
          />

          {error && (
            <p role="alert" className="text-[12.5px] leading-relaxed text-accent-alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-gold py-3 text-[14px] font-bold text-pitch-deep disabled:opacity-60"
          >
            {busy && <Loader2 size={15} className="animate-spin" />}
            합류하기
          </button>
        </form>

        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-4 flex w-full items-center justify-center gap-1.5 text-[12.5px] text-white/45 transition-colors hover:text-white/70"
        >
          <LogOut size={13} />
          다른 계정으로 로그인
        </button>
      </div>
    </AuthLayout>
  );
}
