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
  const alignmentClasses = {
    top: 'object-top',
    bottom: 'object-bottom',
    center: 'object-center',
    left: 'object-left',
    right: 'object-right',
  };
  
  const portraitPosition = profile.photo_alignment 
    ? alignmentClasses[profile.photo_alignment] 
    : (profile.full_name.trim().toLowerCase() === 'ganesh varun' ? 'object-[center_6%]' : 'object-[center_18%]');

  const isBirthdayToday = useMemo(() => {
    if (!profile.birthday) return false;
    const today = new Date();
    // Birthday is stored as YYYY-MM-DD
    const [_, month, day] = profile.birthday.split('-').map(Number);
    return today.getDate() === day && (today.getMonth() + 1) === month;
  }, [profile.birthday]);

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
        
        {isBirthdayToday && (
          <div className="absolute left-4 top-4 z-10 rounded-full bg-emerald-500/90 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white shadow-lg backdrop-blur-sm">
            Birthday Today! 🎂
          </div>
        )}

        {scrollPhotos.length > 1 ? (
          <div className="absolute right-4 top-4 rounded-full border border-white/10 bg-black/35 px-3 py-1 text-[10px] uppercase tracking-[0.28em] text-zinc-200 backdrop-blur-sm">
            {scrollPhotos.length} photos
          </div>
        ) : null}
        
        <div className="absolute inset-x-0 bottom-0 p-5">
          <p className="text-xs uppercase tracking-[0.28em] text-zinc-300">{profile.role}</p>
          <h3 className="mt-2 font-display text-2xl text-white">{profile.full_name}</h3>
                  <div className="mt-3 flex gap-3 transition-opacity duration-300">
            {profile.whatsapp_url && (
              <a
                href={profile.whatsapp_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-zinc-400 hover:text-emerald-400 transition-colors"
              >
                <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.652zm6.599-3.835c1.474.875 3.01 1.336 4.609 1.336 5.235 0 9.493-4.258 9.496-9.493.002-2.537-.987-4.922-2.787-6.72s-4.183-2.787-6.72-2.789c-5.235 0-9.493 4.258-9.496 9.494-.001 1.687.449 3.332 1.302 4.764l-1.104 4.032 4.14-1.084zm11.383-7.513c-.26-.13-1.536-.758-1.773-.844-.236-.086-.407-.13-.578.13-.171.26-.66.844-.81 1.016-.149.172-.299.19-.56.061-.26-.13-1.096-.404-2.088-1.287-.772-.689-1.293-1.54-1.444-1.8-.15-.26-.016-.401.114-.531.117-.117.26-.303.39-.454.13-.151.173-.26.26-.433.086-.173.043-.324-.021-.454-.065-.13-.578-1.393-.792-1.905-.208-.5-.436-.433-.578-.44l-.493-.008c-.171 0-.45.065-.685.325-.236.26-.9.879-.9 2.146 0 1.266.921 2.492 1.05 2.665.13.172 1.812 2.768 4.39 3.882.613.265 1.091.422 1.464.541.617.196 1.178.168 1.621.102.494-.074 1.536-.627 1.751-1.233.214-.607.214-1.125.15-1.233-.065-.108-.236-.172-.497-.302z"/></svg>
              </a>
            )}
            {profile.instagram_url && (
              <a
                href={profile.instagram_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-zinc-400 hover:text-pink-500 transition-colors"
              >
                <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
              </a>
            )}
            {profile.snapchat_url && (
              <a
                href={profile.snapchat_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-zinc-400 hover:text-yellow-400 transition-colors"
              >
                <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24"><path d="M12 2c-.655 0-1.233.153-1.734.46a4.23 4.23 0 0 0-1.573 1.574C8.24 4.704 8 5.485 8 6.37c0 .546.102 1.05.307 1.514.204.464.484.87.84 1.218a5.244 5.244 0 0 0 .506.438c-.085.048-.15.1-.194.156-.044.056-.066.126-.066.21 0 .114.04.212.118.293.078.082.176.123.293.123.117 0 .215-.041.293-.123.078-.081.118-.179.118-.293 0-.084-.022-.154-.066-.21a.482.482 0 0 1-.193-.156c.15-.125.32-.27.506-.438.356-.348.636-.754.84-1.218A3.753 3.753 0 0 0 12 6.37c0-.885-.24-1.666-.693-2.336a4.23 4.23 0 0 0-1.573-1.574C9.233 2.153 8.655 2 8 2zm0 1c.54 0 1 .13 1.38.39a3.23 3.23 0 0 1 1.18 1.18c.34.503.51 1.092.51 1.77 0 .426-.08.82-.24 1.182-.16.363-.38.68-.66 1.05l-.54.6c-.1.112-.206.223-.318.334-.092-.128-.184-.256-.276-.384-.368-.512-.668-.948-.9-1.308a3.178 3.178 0 0 1-.346-1.474c0-.678.17-1.267.51-1.77A3.23 3.23 0 0 1 10.62 3.39c.38-.26.84-.39 1.38-.39zm0 8.5c-.754 0-1.442.146-2.064.438A5.5 5.5 0 0 0 8.04 13.43c-.46.756-.69 1.6-.69 2.533 0 .11.01.226.03.35.02.124.048.24.084.348-.378.114-.73.284-1.056.51a3.504 3.504 0 0 0-.89 1.004c-.218.424-.328.87-.328 1.338 0 .114.04.212.118.293.078.082.176.123.293.123.117 0 .215-.041.293-.123.078-.081.118-.179.118-.293 0-.316.074-.616.222-.9.148-.284.354-.53.618-.738.303-.24.646-.386 1.03-.438l.194.348c.15.26.33.486.54.678a3.11 3.11 0 0 0 .84.51c.333.126.7.19 1.1.19s.767-.064 1.1-.19a3.11 3.11 0 0 0 .84-.51c.21-.192.39-.418.54-.678l.194-.348c.384.052.727.198 1.03.438.264.208.47.454.618.738.148.284.222.584.222.9 0 .114.04.212.118.293.078.082.176.123.293.123.117 0 .215-.041.293-.123.078-.081.118-.179.118-.293 0-.468-.11-.914-.328-1.338a3.504 3.504 0 0 0-.89-1.004c-.326-.226-.678-.396-1.056-.51.036-.108.064-.224.084-.348.02-.124.03-.24.03-.35 0-.933-.23-1.777-.69-2.533a5.5 5.5 0 0 0-1.896-1.492c-.622-.292-1.31-.438-2.064-.438zm0 1c.594 0 1.144.116 1.65.348.506.232.934.562 1.284.99s.61.944.78 1.548c.17.604.256 1.26.256 1.968 0 .092-.008.188-.024.288a3.48 3.48 0 0 1-.226 1.03l-.408-.34c-.382-.316-.838-.568-1.368-.756a5.55 5.55 0 0 0-1.944-.286c-.722 0-1.37.095-1.944.286-.53.188-.986.44-1.368.756l-.408.34a3.48 3.48 0 0 1-.226-1.03 2.71 2.71 0 0 1-.024-.288c0-.708.086-1.364.256-1.968.17-.604.43-1.12.78-1.548s.778-.758 1.284-.99c.506-.232 1.056-.348 1.65-.348zm0 4.19c.673 0 1.3.118 1.88.354.34.138.65.32 1.38.75.22.13.433.257.64.382l-.4.34a2.11 2.11 0 0 1-.57.348c-.22.08-.467.126-.74.136-.21.008-.423.012-.64.012a4.55 4.55 0 0 1-1.55-.264c-.426-.15-.81-.366-1.15-.648a2.11 2.11 0 0 1-.57.348c-.22.08-.467.126-.74.136-.21.008-.423.012-.64.012a4.55 4.55 0 0 1-1.55-.264c-.426-.15-.81-.366-1.15-.648.207-.125.42-.252.64-.382.73-.43 1.04-.612 1.38-.75a5.1 5.1 0 0 1 1.88-.354z"/></svg>
              </a>
            )}
            {profile.twitter_url && (
              <a
                href={profile.twitter_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-zinc-400 hover:text-sky-400 transition-colors"
              >
                <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24"><path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.84 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/></svg>
              </a>
            )}
          </div>
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
