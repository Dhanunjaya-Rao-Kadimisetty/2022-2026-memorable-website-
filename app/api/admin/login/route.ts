import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import {
  clearLoginLimit,
  checkLoginLimit,
  getLoginKey,
  recordLoginFailure,
} from '@/lib/admin-login-security';

export const runtime = 'nodejs';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();

function makeResponse(
  status: number,
  body: Record<string, unknown>,
  headers?: Record<string, string>,
) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      ...(headers ?? {}),
    },
  });
}

function normalizeNextPath(value: unknown) {
  return typeof value === 'string' && value.startsWith('/') ? value : '/admin';
}

async function signInPassword(email: string, password: string) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return supabase.auth.signInWithPassword({ email, password });
}

async function applySessionCookies(
  response: NextResponse,
  session: { access_token: string; refresh_token: string },
) {
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return [];
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set({ name, value, ...(options ?? {}) });
        });
      },
    },
  });

  await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
}

export async function POST(request: Request) {
  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return makeResponse(500, { error: 'Supabase environment variables are missing.' });
    }

    if (!ADMIN_EMAIL) {
      return makeResponse(500, { error: 'Admin email is not configured.' });
    }

    const payload = (await request.json().catch(() => ({}))) as {
      email?: string;
      password?: string;
      nextPath?: unknown;
      captchaToken?: string;
    };

    const step = 'password';
    const nextPath = normalizeNextPath(payload.nextPath);

    const email = String(payload.email ?? '').trim().toLowerCase();
    const password = String(payload.password ?? '');
    const captchaToken = String(payload.captchaToken ?? '').trim();

    if (!email || !password) {
      return makeResponse(400, { error: 'Email and password are required.' });
    }

    if (email !== ADMIN_EMAIL) {
      return makeResponse(403, { error: 'Invalid email or password.' });
    }

    const limitKey = getLoginKey(request, email);
    const rateCheck = checkLoginLimit(limitKey);
    if (!rateCheck.allowed) {
      return makeResponse(
        429,
        { error: 'Too many sign in attempts. Please wait a few minutes and try again.' },
        { 'Retry-After': String(Math.max(1, Math.ceil(rateCheck.retryAfterMs / 1000))) },
      );
    }

    const turnstileSecret = (process.env.TURNSTILE_SECRET_KEY ?? '').trim();
    const captchaRequired = Boolean(turnstileSecret);
    if (captchaRequired) {
      if (!captchaToken) {
        return makeResponse(400, { error: 'Please complete the captcha challenge.' });
      }

      const captchaResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          secret: turnstileSecret,
          response: captchaToken,
          remoteip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '',
        }),
      });

      const captchaPayload = (await captchaResponse.json().catch(() => ({}))) as {
        success?: boolean;
      };

      if (!captchaResponse.ok || !captchaPayload.success) {
        return makeResponse(400, { error: 'Captcha verification failed. Please try again.' });
      }
    }

    const { data, error } = await signInPassword(email, password);
    if (error || !data.session) {
      recordLoginFailure(limitKey);
      return makeResponse(401, { error: 'Invalid email or password.' });
    }

    const response = makeResponse(200, { ok: true, redirectTo: nextPath });
    await applySessionCookies(response, {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
    clearLoginLimit(limitKey);
    return response;
  } catch {
    return makeResponse(500, { error: 'Could not sign in right now.' });
  }
}
