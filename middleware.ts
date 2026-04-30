import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();

export async function middleware(request: NextRequest) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return NextResponse.next();
  }

  const response = NextResponse.next({ request: { headers: request.headers } });
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set({ name, value, ...(options ?? {}) });
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAdminUser = Boolean(user?.email && user.email.toLowerCase() === ADMIN_EMAIL);

  const { pathname } = request.nextUrl;
  const isAdminPage = pathname.startsWith('/admin');
  const isAdminApi = pathname.startsWith('/api/admin');
  const isConfigApi = pathname === '/api/admin/config';
  const isLoginApi = pathname === '/api/admin/login';
  const isLoginPage = pathname === '/admin/login';

  if (isConfigApi || isLoginApi) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return response;
  }

  if ((isAdminPage || isAdminApi) && !user && !isLoginPage) {
    if (isAdminApi) {
      const jsonResponse = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      jsonResponse.headers.set('X-Robots-Tag', 'noindex, nofollow');
      return jsonResponse;
    }

    const url = request.nextUrl.clone();
    url.pathname = '/admin/login';
    url.searchParams.set('next', pathname);
    const redirectResponse = NextResponse.redirect(url);
    redirectResponse.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return redirectResponse;
  }

  if ((isAdminPage || isAdminApi) && user && !isAdminUser && !isLoginPage) {
    if (isAdminApi) {
      const jsonResponse = NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      jsonResponse.headers.set('X-Robots-Tag', 'noindex, nofollow');
      return jsonResponse;
    }

    const url = request.nextUrl.clone();
    url.pathname = '/';
    const redirectResponse = NextResponse.redirect(url);
    redirectResponse.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return redirectResponse;
  }

  if (isLoginPage && isAdminUser) {
    const url = request.nextUrl.clone();
    url.pathname = '/admin';
    const redirectResponse = NextResponse.redirect(url);
    redirectResponse.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return redirectResponse;
  }

  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return response;
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
