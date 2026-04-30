'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import type { YearbookProfile } from '@/lib/supabaseClient';
import { cn } from '@/lib/utils';

type Props = {
  profile: YearbookProfile;
  index: number;
  selected?: boolean;
  hoverPhotos?: string[];
  onSelect: (profile: YearbookProfile) => void;
};

export default function ProfileCard({ profile, index, selected = false, hoverPhotos = [], onSelect }: Props) {
  const portraitPosition =
    profile.full_name.trim().toLowerCase() === 'ganesh varun' ? 'object-[center_6%]' : 'object-[center_18%]';
  const scrollPhotos = useMemo(
    () => Array.from(new Set([profile.photoUrl, ...hoverPhotos].filter(Boolean))),
    [hoverPhotos, profile.photoUrl],
  );
  const [isHovering, setIsHovering] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  useEffect(() => {
    if (!isHovering || scrollPhotos.length <= 1) {
      setActivePhotoIndex(0);
      return;
    }

    let intervalId: number | null = null;
    const timeoutId = window.setTimeout(() => {
      setActivePhotoIndex((current) => (current + 1) % scrollPhotos.length);

      intervalId = window.setInterval(() => {
        setActivePhotoIndex((current) => (current + 1) % scrollPhotos.length);
      }, 2200);
    }, 10000);

    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
    };
  }, [isHovering, scrollPhotos]);

  return (
    <motion.button
      type="button"
      layoutId={`profile-${profile.id}`}
      variants={{
        hidden: { opacity: 0, y: 24 },
        show: {
          opacity: 1,
          y: 0,
          transition: {
            duration: 0.5,
            delay: index * 0.05,
          },
        },
      }}
      onClick={() => onSelect(profile)}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onFocus={() => setIsHovering(true)}
      onBlur={() => setIsHovering(false)}
      className={cn(
        'panel group overflow-hidden text-left transition-transform duration-300 hover:-translate-y-1',
        selected && 'ring-1 ring-white/20',
      )}
    >
      <div className="relative aspect-[4/5] overflow-hidden">
        {scrollPhotos.map((photoUrl, photoIndex) => (
          <Image
            key={`${profile.id}-${photoUrl}-${photoIndex}`}
            src={photoUrl || '/placeholder-profile.svg'}
            alt={profile.full_name}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
            placeholder="blur"
            blurDataURL={profile.blurDataURL}
            className={cn(
              'grayscale transition duration-700 group-hover:grayscale-0',
              photoIndex === 0
                ? cn('object-cover group-hover:scale-[1.03]', portraitPosition)
                : 'bg-zinc-950 object-contain object-center p-2',
              photoIndex === activePhotoIndex ? 'opacity-100' : 'opacity-0',
            )}
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
        {scrollPhotos.length > 1 ? (
          <div className="absolute right-4 top-4 rounded-full border border-white/10 bg-black/35 px-3 py-1 text-[10px] uppercase tracking-[0.28em] text-zinc-200">
            {scrollPhotos.length} photos
          </div>
        ) : null}
        <div className="absolute inset-x-0 bottom-0 p-5">
          <p className="text-xs uppercase tracking-[0.28em] text-zinc-300">{profile.role}</p>
          <h3 className="mt-2 font-display text-2xl text-white">{profile.full_name}</h3>
        </div>
      </div>

      <div className="space-y-3 p-5">
        <p className="max-h-20 overflow-hidden text-sm leading-6 text-zinc-300">{profile.quote}</p>
        <div className="flex items-center justify-between border-t border-white/[0.08] pt-4 text-xs uppercase tracking-[0.24em] text-zinc-400">
          <span>{profile.batch}</span>
          <span>Open Legacy</span>
        </div>
      </div>
    </motion.button>
  );
}
