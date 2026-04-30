import type { Metadata } from 'next';
import { createServerClient } from '@supabase/ssr';
import { Instrument_Sans, Playfair_Display } from 'next/font/google';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import Navbar from '@/components/Navbar';
import './globals.css';

const sans = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
});

const display = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-display',
});

export const metadata: Metadata = {
  title: 'Batch 2022-26 Yearbook',
  description: 'A cinematic digital yearbook for the Batch of 2022-2026.',
};

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  let showAdminLink = false;

  if (supabaseUrl && supabaseAnonKey) {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server components can read auth state even when cookie writes are unavailable.
          }
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    showAdminLink = Boolean(user?.email && user.email.toLowerCase() === ADMIN_EMAIL);
  }

  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body className="relative min-h-screen overflow-x-hidden">
        <div className="grain-overlay" />
        <Navbar showAdminLink={showAdminLink} />
        <main className="relative z-10">{children}</main>
      </body>
    </html>
  );
}
