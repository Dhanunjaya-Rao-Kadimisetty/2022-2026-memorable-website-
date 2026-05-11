'use client';

import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchProfiles, type YearbookProfile } from '@/lib/supabaseClient';
import Image from 'next/image';
import Link from 'next/link';

export default function BirthdayBanner() {
  const [profiles, setProfiles] = useState<YearbookProfile[]>([]);
  const [isVisible, setIsVisible] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfiles() {
      try {
        const data = await fetchProfiles();
        setProfiles(data);
      } catch (error) {
        console.error('Failed to fetch profiles for birthday banner:', error);
      } finally {
        setLoading(false);
      }
    }
    loadProfiles();
  }, []);

  const birthdayProfiles = useMemo(() => {
    if (!profiles.length) return [];
    const today = new Date();
    const day = today.getDate();
    const month = today.getMonth() + 1;

    return profiles.filter((p) => {
      if (!p.birthday) return false;
      const [pYear, pMonth, pDay] = p.birthday.split('-').map(Number);
      return pDay === day && pMonth === month;
    });
  }, [profiles]);

  if (loading || birthdayProfiles.length === 0 || !isVisible) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        className="relative z-[60] w-full overflow-hidden border-b border-emerald-500/20 bg-gradient-to-r from-emerald-600/20 via-cinematic-950 to-emerald-600/20 backdrop-blur-md"
      >
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5.8 11.3 2 22l10.7-3.8" />
                  <path d="M4 3h.01" />
                  <path d="M22 8h.01" />
                  <path d="M15 2h.01" />
                  <path d="M22 20h.01" />
                  <path d="m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12v0c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10" />
                  <path d="m22 13-.82-.33c-.86-.34-1.82.2-1.98 1.11v0c-.11.7-.72 1.22-1.43 1.22H17" />
                  <path d="m11 2 .33.82c.34.86-.2 1.82-1.11 1.98v0C9.52 4.9 9 5.52 9 6.23V7" />
                  <path d="M11 13c1.93 0 3.5-1.57 3.5-3.5S12.93 6 11 6s-3.5 1.57-3.5 3.5 1.57 3.5 3.5 3.5Z" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400">
                  Birthday Celebration
                </p>
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className="truncate text-sm font-medium text-white">
                    Today is{' '}
                    {birthdayProfiles.length === 1
                      ? birthdayProfiles[0].full_name
                      : `${birthdayProfiles.length} people's`}{' '}
                    birthday!
                  </span>
                  <div className="flex -space-x-2 overflow-hidden">
                    {birthdayProfiles.slice(0, 3).map((p) => (
                      <div
                        key={p.id}
                        className="relative h-6 w-6 overflow-hidden rounded-full border-2 border-cinematic-950"
                      >
                        <Image
                          src={p.photoUrl || '/placeholder-profile.svg'}
                          alt={p.full_name}
                          fill
                          className="object-cover"
                        />
                      </div>
                    ))}
                    {birthdayProfiles.length > 3 && (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-cinematic-950 bg-zinc-800 text-[8px] text-white">
                        +{birthdayProfiles.length - 3}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/yearbook"
                className="hidden whitespace-nowrap rounded-full bg-emerald-500 px-4 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-400 sm:block"
              >
                Wish Them
              </Link>
              <button
                onClick={() => setIsVisible(false)}
                className="rounded-full p-1 text-zinc-400 transition hover:bg-white/10 hover:text-white"
                aria-label="Close banner"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

