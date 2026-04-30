'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const links = [
  { href: '/', label: 'Home' },
  { href: '/yearbook', label: 'Yearbook' },
  { href: '/people', label: 'People' },
  { href: '/media-vault', label: 'Media Vault' },
  { href: '/the-wall', label: 'The Wall' },
];

export default function Navbar({ showAdminLink = false }: { showAdminLink?: boolean }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const navLinks = showAdminLink ? [...links, { href: '/admin', label: 'Admin' }] : links;

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.45 }}
      className="sticky top-0 z-50 border-b border-white/[0.08] bg-cinematic-950/80 backdrop-blur-xl"
    >
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="font-display text-lg tracking-wide text-white">
          Batch 2022-26
        </Link>

        <nav className="hidden items-center gap-2 md:flex">
          {navLinks.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'rounded-full px-4 py-2 text-sm transition-colors',
                  active
                    ? 'bg-white text-zinc-950'
                    : 'text-zinc-300 hover:bg-white/[0.08] hover:text-white',
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/the-wall"
            className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-100 transition hover:border-white/20 hover:bg-white/[0.08]"
          >
            Leave a Note
          </Link>

          <button
            type="button"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            aria-label="Toggle navigation menu"
            onClick={() => setMenuOpen((open) => !open)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 text-zinc-100 transition hover:border-white/20 hover:bg-white/[0.08] md:hidden"
          >
            <span className="relative block h-4 w-5">
              <span
                className={cn(
                  'absolute left-0 top-0 h-0.5 w-5 rounded-full bg-current transition-transform duration-200',
                  menuOpen ? 'translate-y-2 rotate-45' : '',
                )}
              />
              <span
                className={cn(
                  'absolute left-0 top-1.5 h-0.5 w-5 rounded-full bg-current transition-opacity duration-200',
                  menuOpen ? 'opacity-0' : 'opacity-100',
                )}
              />
              <span
                className={cn(
                  'absolute left-0 top-3 h-0.5 w-5 rounded-full bg-current transition-transform duration-200',
                  menuOpen ? '-translate-y-2 -rotate-45' : '',
                )}
              />
            </span>
          </button>
        </div>
      </div>

      <div
        id="mobile-nav"
        className={cn(
          'border-t border-white/[0.08] bg-cinematic-950/95 px-4 pb-4 pt-3 backdrop-blur-xl md:hidden',
          menuOpen ? 'block' : 'hidden',
        )}
      >
        <nav className="mx-auto flex max-w-7xl flex-col gap-2">
          {navLinks.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={cn(
                  'rounded-2xl px-4 py-3 text-sm transition-colors',
                  active
                    ? 'bg-white text-zinc-950'
                    : 'border border-white/[0.08] bg-white/[0.03] text-zinc-200 hover:bg-white/[0.08] hover:text-white',
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </motion.header>
  );
}
