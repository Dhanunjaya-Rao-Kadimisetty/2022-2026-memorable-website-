'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, type FormEvent } from 'react';
import TurnstileWidget from '@/components/TurnstileWidget';

export default function AdminLoginClient({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const safeNextPath = useMemo(
    () => (typeof nextPath === 'string' && nextPath.startsWith('/') ? nextPath : '/admin'),
    [nextPath],
  );
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? '';
  const captchaEnabled = Boolean(turnstileSiteKey);

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          nextPath: safeNextPath,
          captchaToken,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        redirectTo?: string;
      };

      if (!response.ok) {
        setError(payload.error || 'Unable to sign in.');
        setLoading(false);
        return;
      }

      router.replace(payload.redirectTo || safeNextPath);
      router.refresh();
    } catch {
      setError('Unable to sign in right now. Please try again.');
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-2xl items-center px-4 py-10 sm:px-6 lg:px-8">
      <form onSubmit={handlePasswordSubmit} className="panel w-full space-y-5 p-6 sm:p-8">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-zinc-400">Admin Login</p>
          <h1 className="mt-3 font-display text-4xl text-white">Protected Entry</h1>
          <p className="mt-3 text-sm leading-7 text-zinc-300">
            Sign in with your admin email and password. A captcha may appear to stop automated attacks.
          </p>
        </div>

        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          type="email"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          inputMode="email"
          placeholder="Email"
          className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500"
        />
        <input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          autoComplete="current-password"
          autoCapitalize="none"
          autoCorrect="off"
          placeholder="Password"
          minLength={8}
          className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500"
        />

        {captchaEnabled ? (
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/10 p-4">
            <TurnstileWidget
              siteKey={turnstileSiteKey}
              onToken={setCaptchaToken}
              onReset={() => setCaptchaToken('')}
            />
          </div>
        ) : (
          <p className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
            CAPTCHA is not configured. Add `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`
            to enable it.
          </p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="submit"
            disabled={loading || (captchaEnabled && !captchaToken)}
            className="rounded-full bg-white px-6 py-3 text-sm font-medium text-zinc-950 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? 'Working...' : 'Continue'}
          </button>
        </div>

        {error ? <p className="text-sm text-red-400">{error}</p> : null}
      </form>
    </section>
  );
}
