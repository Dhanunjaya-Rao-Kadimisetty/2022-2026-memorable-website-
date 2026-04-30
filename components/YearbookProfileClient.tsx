'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { fetchGalleryImages, fetchProfiles, type GalleryImage, type YearbookProfile } from '@/lib/supabaseClient';
import { cn } from '@/lib/utils';

type Props = {
  profileId: string;
  initialProfiles?: YearbookProfile[];
  initialGallery?: GalleryImage[];
  initialResolved?: boolean;
};

export default function YearbookProfileClient({
  profileId,
  initialProfiles = [],
  initialGallery = [],
  initialResolved = false,
}: Props) {
  const [profiles, setProfiles] = useState<YearbookProfile[]>(initialProfiles);
  const [gallery, setGallery] = useState<GalleryImage[]>(initialGallery);
  const [loading, setLoading] = useState(!initialResolved);
  const normalizedProfileId = profileId.trim();

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const [profileData, galleryData] = await Promise.all([fetchProfiles(), fetchGalleryImages()]);
        if (!active) return;
        setProfiles(profileData);
        setGallery(galleryData);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const profile = useMemo(
    () => profiles.find((item) => item.id === normalizedProfileId) ?? null,
    [normalizedProfileId, profiles],
  );
  const featuredMemories = useMemo(
    () => gallery.filter((item) => item.tagged_profile_ids.includes(normalizedProfileId)),
    [gallery, normalizedProfileId],
  );

  if (!normalizedProfileId) {
    return (
      <section className="mx-auto min-h-screen w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="panel space-y-4 p-6 sm:p-8">
          <p className="text-sm text-zinc-300">This profile link is missing a person id.</p>
          <Link
            href="/yearbook"
            className="inline-flex rounded-full border border-white/10 px-5 py-3 text-sm text-zinc-100 transition hover:bg-white/[0.08]"
          >
            Back to Yearbook
          </Link>
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="mx-auto min-h-screen w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="panel p-6 text-sm text-zinc-300">Loading profile...</div>
      </section>
    );
  }

  if (!profile) {
    return (
      <section className="mx-auto min-h-screen w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="panel space-y-4 p-6 sm:p-8">
          <p className="text-sm text-zinc-300">This profile was not found in Supabase.</p>
          <Link
            href="/yearbook"
            className="inline-flex rounded-full border border-white/10 px-5 py-3 text-sm text-zinc-100 transition hover:bg-white/[0.08]"
          >
            Back to Yearbook
          </Link>
        </div>
      </section>
    );
  }

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

  return (
    <section className="mx-auto min-h-screen w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-zinc-400">Yearbook Profile</p>
          <h1 className="mt-3 font-display text-4xl text-white sm:text-5xl">{profile.full_name}</h1>
        </div>
        <Link
          href="/yearbook"
          className="rounded-full border border-white/10 px-5 py-3 text-sm text-zinc-100 transition hover:bg-white/[0.08]"
        >
          Back to Yearbook
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <article className="panel overflow-hidden">
          <div className="relative min-h-[420px]">
            <Image
              src={profile.photoUrl || '/placeholder-profile.svg'}
              alt={profile.full_name}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 40vw"
              placeholder="blur"
              blurDataURL={profile.blurDataURL}
              className={cn("object-cover", portraitPosition)}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
          </div>
          <div className="space-y-5 p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-zinc-400">{profile.role}</p>
                <p className="mt-2 text-sm uppercase tracking-[0.25em] text-zinc-500">{profile.batch}</p>
              </div>
              {profile.birthday && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-center">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Birthday</p>
                  <p className="mt-1 text-sm font-medium text-white">
                    {new Date(profile.birthday).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-3 py-2">
              {profile.whatsapp_url && (
                <Link
                  href={profile.whatsapp_url}
                  target="_blank"
                  className="rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-xs font-medium uppercase tracking-widest text-zinc-200 transition hover:bg-emerald-500/10 hover:text-emerald-400"
                >
                  WhatsApp
                </Link>
              )}
              {profile.instagram_url && (
                <Link
                  href={profile.instagram_url}
                  target="_blank"
                  className="rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-xs font-medium uppercase tracking-widest text-zinc-200 transition hover:bg-pink-500/10 hover:text-pink-500"
                >
                  Instagram
                </Link>
              )}
              {profile.snapchat_url && (
                <Link
                  href={profile.snapchat_url}
                  target="_blank"
                  className="rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-xs font-medium uppercase tracking-widest text-zinc-200 transition hover:bg-yellow-500/10 hover:text-yellow-400"
                >
                  Snapchat
                </Link>
              )}
              {profile.twitter_url && (
                <Link
                  href={profile.twitter_url}
                  target="_blank"
                  className="rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-xs font-medium uppercase tracking-widest text-zinc-200 transition hover:bg-sky-500/10 hover:text-sky-400"
                >
                  Twitter
                </Link>
              )}
            </div>

            <blockquote className="border-l border-white/10 pl-5 text-lg leading-8 text-zinc-200">
              {profile.quote}
            </blockquote>
            <p className="text-sm leading-7 text-zinc-300">{profile.story}</p>
          </div>
        </article>

        <div className="space-y-6">
          <div className="panel p-6 sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-zinc-400">Tagged memories</p>
                <h2 className="mt-3 font-display text-3xl text-white">
                  {featuredMemories.length} memories
                </h2>
              </div>
              <span className="rounded-full border border-white/10 px-4 py-2 text-xs uppercase tracking-[0.25em] text-zinc-300">
                Appears here
              </span>
            </div>

            {featuredMemories.length ? (
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {featuredMemories.map((memory) => (
                  <article
                    key={memory.id}
                    className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.04]"
                  >
                    <div className="relative aspect-[4/3]">
                      {memory.mediaType === 'video' ? (
                        <video controls playsInline preload="metadata" className="h-full w-full object-cover">
                          <source src={memory.photoUrl || '/placeholder-gallery.svg'} />
                          Your browser does not support the video tag.
                        </video>
                      ) : (
                        <Image
                          src={memory.photoUrl || '/placeholder-gallery.svg'}
                          alt={memory.alt_text || memory.title}
                          fill
                          sizes="(max-width: 768px) 100vw, 50vw"
                          className="object-cover"
                        />
                      )}
                      {memory.mediaType === 'video' ? (
                        <span className="absolute left-4 top-4 rounded-full bg-black/70 px-3 py-1 text-[11px] uppercase tracking-[0.25em] text-white">
                          Video
                        </span>
                      ) : null}
                    </div>
                    <div className="p-4">
                      <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">{memory.category}</p>
                      <h3 className="mt-2 font-display text-xl text-white">{memory.title}</h3>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-6 rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm leading-7 text-zinc-400">
                No memories are tagged with this person yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
