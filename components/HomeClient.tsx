'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { fetchHomeCounts, type HomeCounts } from '@/lib/supabaseClient';

type Props = {
  counts: HomeCounts | null;
};

export default function HomeClient({ counts }: Props) {
  const [liveCounts, setLiveCounts] = useState<HomeCounts | null>(counts);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const data = await fetchHomeCounts();
        if (!active) return;
        setLiveCounts(data);
      } catch {
        if (!active) return;
        setLiveCounts(counts);
      }
    })();

    return () => {
      active = false;
    };
  }, [counts]);

  const stats = [
    { number: liveCounts?.profiles, label: 'Profiles' },
    { number: liveCounts?.memories, label: 'Memories' },
    { number: liveCounts?.messages, label: 'Messages' },
  ];

  return (
    <section className="relative flex min-h-[calc(100vh-81px)] items-center justify-center overflow-hidden px-4 py-16 sm:px-6 lg:px-8">
      <div className="absolute inset-0 bg-cinematic-glow opacity-80" />
      <div className="absolute left-1/2 top-24 h-72 w-72 -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
      <div className="absolute bottom-8 right-10 h-56 w-56 rounded-full bg-zinc-400/10 blur-3xl" />

      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center text-center">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6 text-xs uppercase tracking-[0.4em] text-zinc-400"
        >
          Digital Yearbook
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, ease: 'easeOut' }}
          className="max-w-4xl font-display text-6xl leading-none text-white sm:text-7xl lg:text-8xl"
        >
          Batch 2022-26.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="mt-8 max-w-2xl text-base leading-8 text-zinc-300 sm:text-lg"
        >
          A cinematic archive of profiles, moments, and messages from four remarkable years.
          Move through the journey, open each legacy, and leave your own note behind.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="mt-10 flex flex-col gap-4 sm:flex-row"
        >
          <Link
            href="/yearbook"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-8 py-4 text-sm font-medium text-zinc-950 transition hover:-translate-y-0.5 hover:bg-zinc-100"
          >
            Start Journey
            <span aria-hidden="true">-&gt;</span>
          </Link>

          <a
            href="/the-wall"
            className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-8 py-4 text-sm text-zinc-100 transition hover:border-white/20 hover:bg-white/10"
          >
            Read the Wall
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.6 }}
          className="mt-14 grid w-full max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3"
        >
          {stats.map(({ number, label }, index) => (
            <div
              key={label}
              className="rounded-2xl border border-white/[0.08] bg-white/[0.04] px-5 py-4 text-left"
            >
              <p className="text-xs uppercase tracking-[0.35em] text-zinc-400">
                {String(index + 1).padStart(2, '0')}
              </p>
              <p className="mt-2 font-display text-2xl text-white">
                {typeof number === 'number' ? number : '--'}
              </p>
              <p className="mt-2 font-display text-xl text-white">{label}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
