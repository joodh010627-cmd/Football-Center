/**
 * Sign in / sign up.
 *
 * Three modes, and the split between them is the product decision, not a UI
 * one: an owner *creates* an academy, a coach *joins* one. There is no form on
 * this screen that lets someone declare themselves an owner of an existing
 * academy — the only way into an existing academy is a code the owner issued.
 */

import { useState, type FormEvent, type ReactNode } from 'react';
import { KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/store/AuthContext';
import { Crest } from '@/components/ui/Crest';
import { cn } from '@/lib/cn';

type Mode = 'signin' | 'owner' | 'coach';

const TABS: Array<{ key: Mode; label: string }> = [
  { key: 'signin', label: '로그인' },
  { key: 'owner', label: '대표 가입' },
  { key: 'coach', label: '코치 가입' },
];

export function AuthScreen() {
  const { signIn, signUpOwner, signUpCoach, busy, error, clearError } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [academyName, setAcademyName] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  const switchMode = (next: Mode) => {
    setMode(next);
    clearError();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;

    if (mode === 'signin') {
      await signIn(email, password);
    } else if (mode === 'owner') {
      await signUpOwner({ email, password, academyName, displayName });
    } else {
      await signUpCoach({ email, password, inviteCode, displayName });
    }
  };

  return (
    <AuthLayout>
      <div className="flex gap-1 rounded-full border border-white/12 bg-white/[0.06] p-1">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => switchMode(key)}
            className={cn(
              'flex-1 rounded-full py-2 text-[12.5px] font-semibold transition-colors duration-200',
              mode === key ? 'bg-gold text-pitch-deep' : 'text-white/60 hover:text-white',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="mt-6 space-y-3.5">
        {mode === 'owner' && (
          <Field
            label="아카데미 이름"
            value={academyName}
            onChange={setAcademyName}
            placeholder="FC 그로스 축구교실"
            autoFocus
            required
          />
        )}

        {mode !== 'signin' && (
          <Field
            label="이름"
            value={displayName}
            onChange={setDisplayName}
            placeholder={mode === 'owner' ? '홍길동' : '김도현'}
            required
          />
        )}

        {mode === 'coach' && (
          <Field
            label="초대 코드"
            value={inviteCode}
            onChange={(v) => setInviteCode(v.toUpperCase())}
            placeholder="ABCD2345"
            hint="대표님께 받은 8자리 코드입니다."
            className="font-mono tracking-[0.2em]"
            maxLength={8}
            required
          />
        )}

        <Field
          label="이메일"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="coach@example.com"
          autoFocus={mode === 'signin'}
          required
        />

        <Field
          label="비밀번호"
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="6자 이상"
          required
        />

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-accent-alert/40 bg-accent-alert/10 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-accent-alert"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-gold py-3 text-[14px] font-bold text-pitch-deep transition-opacity duration-200 disabled:opacity-60"
        >
          {busy && <Loader2 size={15} className="animate-spin" />}
          {mode === 'signin' ? '로그인' : '가입하고 시작하기'}
        </button>
      </form>

      {mode === 'coach' && (
        <p className="mt-5 flex items-start gap-2 text-[12px] leading-relaxed text-white/45">
          <KeyRound size={14} className="mt-0.5 shrink-0 text-gold/70" />
          코드가 없으면 가입할 수 없습니다. 코치 계정은 대표가 초대한 사람만 만들 수 있습니다.
        </p>
      )}

      {mode === 'owner' && (
        <p className="mt-5 flex items-start gap-2 text-[12px] leading-relaxed text-white/45">
          <ShieldCheck size={14} className="mt-0.5 shrink-0 text-gold/70" />
          매출·원가·코치 평가는 대표 계정에서만 열립니다. 코치는 자기 반의 기록만 봅니다.
        </p>
      )}
    </AuthLayout>
  );
}

// ---------------------------------------------------------------------------

export function AuthLayout({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="grain relative flex min-h-screen items-center justify-center overflow-hidden bg-pitch-deep px-5 py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(45%_38%_at_50%_30%,rgba(198,166,100,0.14)_0%,transparent_70%)]" />

      <div className={cn('relative w-full', wide ? 'max-w-[440px]' : 'max-w-[380px]')}>
        <div className="mb-8 flex flex-col items-center text-center text-white">
          <Crest className="h-11 w-11 text-gold" />
          <p className="mt-4 text-[20px] font-bold leading-none tracking-[0.22em]">FC GROWTH</p>
          <p className="mt-2.5 text-[11px] font-semibold uppercase tracking-label text-white/40">
            Football Center
          </p>
        </div>

        {children}
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  hint?: string;
  className?: string;
  autoFocus?: boolean;
  required?: boolean;
  maxLength?: number;
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  hint,
  className,
  autoFocus,
  required,
  maxLength,
}: FieldProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-label text-white/45">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        required={required}
        maxLength={maxLength}
        autoComplete={type === 'password' ? 'current-password' : 'on'}
        className={cn(
          'w-full rounded-lg border border-white/12 bg-white/[0.06] px-3.5 py-2.5 text-[14px] text-white outline-none transition-colors duration-200',
          'placeholder:text-white/25 focus:border-gold/60 focus:bg-white/[0.09]',
          className,
        )}
      />
      {hint && <span className="mt-1.5 block text-[11.5px] text-white/35">{hint}</span>}
    </label>
  );
}
