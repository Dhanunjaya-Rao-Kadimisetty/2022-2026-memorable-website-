'use client';

import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import Image from 'next/image';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import ProfileCard from '@/components/ProfileCard';
import { fetchGalleryImages, fetchProfiles, type GalleryImage, type YearbookProfile } from '@/lib/supabaseClient';
import MediaLightbox from '@/components/MediaLightbox';

type Props = {
  profiles: YearbookProfile[];
  gallery: GalleryImage[];
};

export default function YearbookClient({ profiles, gallery }: Props) {
  const [liveProfiles, setLiveProfiles] = useState<YearbookProfile[]>(profiles);
  const [liveGallery, setLiveGallery] = useState<GalleryImage[]>(gallery);
  const [selected, setSelected] = useState<YearbookProfile | null>(null);
  const [selectedMemory, setSelectedMemory] = useState<GalleryImage | null>(null);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const [profileData, galleryData] = await Promise.all([fetchProfiles(), fetchGalleryImages()]);
        if (!active) return;
        setLiveProfiles(profileData);
        setLiveGallery(galleryData);
      } catch {
        if (!active) return;
        setLiveProfiles(profiles);
        setLiveGallery(gallery);
      }
    })();

    return () => {
      active = false;
    };
  }, [gallery, profiles]);

  const filteredProfiles = useMemo(() => {
    if (!deferredSearch) return liveProfiles;

    return liveProfiles.filter((profile) => {
      const haystack = [profile.full_name, profile.role, profile.batch, profile.quote, profile.story]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(deferredSearch);
    });
  }, [deferredSearch, liveProfiles]);

  const featuredMemories = useMemo(() => {
    if (!selected) return [];
    return liveGallery.filter((item) => item.tagged_profile_ids.includes(selected.id));
  }, [liveGallery, selected]);

  const hoverGalleryLookup = useMemo(() => {
    const lookup = new Map<string, string[]>();

    for (const profile of liveProfiles) {
      const priorityPhotos = profile.priorityPhotoUrls.filter(Boolean);
      const taggedPhotos = liveGallery
        .filter((item) => item.mediaType === 'image' && item.tagged_profile_ids.includes(profile.id))
        .map((item) => item.photoUrl)
        .filter(Boolean);

      lookup.set(profile.id, Array.from(new Set([...priorityPhotos, ...taggedPhotos])));
    }

    return lookup;
  }, [liveGallery, liveProfiles]);

  return (
    <section className="mx-auto min-h-screen w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.35em] text-zinc-400">Yearbook</p>
          <h1 className="mt-3 font-display text-4xl text-white sm:text-5xl">Profiles of the Batch</h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-zinc-300 sm:text-base">
            Open any portrait to reveal a legacy quote, a short story, and the feeling they left
            in the room.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <label className="flex-1">
              <span className="sr-only">Search profiles</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name, role, or batch"
                className="w-full rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm text-white outline-none placeholder:text-zinc-500"
              />
            </label>
            <button
              type="button"
              onClick={() => setSearch('')}
              disabled={!search}
              className="rounded-full border border-white/10 px-5 py-3 text-sm text-zinc-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Clear
            </button>
          </div>
        </div>
        <div className="panel px-5 py-4 text-sm text-zinc-300">
          <span className="text-white">{filteredProfiles.length}</span> of {liveProfiles.length} profiles
        </div>
      </div>

      <LayoutGroup>
        <motion.div
          variants={{
            hidden: { opacity: 0 },
            show: {
              opacity: 1,
              transition: {
                staggerChildren: 0.08,
              },
            },
          }}
          initial="hidden"
          animate="show"
          className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3"
        >
          {!liveProfiles.length ? (
            <div className="panel sm:col-span-2 xl:col-span-3">
              <p className="text-sm text-zinc-300">
                No profiles are published yet. Add people in the admin panel to fill this grid.
              </p>
            </div>
          ) : filteredProfiles.length ? (
            filteredProfiles.map((profile, index) => (
              <ProfileCard
                key={profile.id}
                profile={profile}
                index={index}
                selected={selected?.id === profile.id}
                hoverPhotos={hoverGalleryLookup.get(profile.id) ?? []}
                onSelect={setSelected}
              />
            ))
          ) : (
            <div className="panel sm:col-span-2 xl:col-span-3">
              <p className="text-sm text-zinc-300">
                No profiles match your search. Try a different name, role, or batch.
              </p>
            </div>
          )}
        </motion.div>

        <AnimatePresence mode="wait">
          {selected ? (
            <motion.div
              className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4 py-8 backdrop-blur-md"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelected(null)}
            >
              <motion.div
                layoutId={`profile-${selected.id}`}
                initial={{ scale: 0.96, y: 18 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.96, y: 18 }}
                transition={{ type: 'spring', stiffness: 180, damping: 22 }}
                className="panel relative grid w-full max-w-4xl overflow-hidden md:grid-cols-[1.05fr_0.95fr]"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="relative min-h-[320px]">
                  <Image
                    src={selected.photoUrl || '/placeholder-profile.svg'}
                    alt={selected.full_name}
                    fill
                    priority
                    sizes="(max-width: 768px) 100vw, 50vw"
                    placeholder="blur"
                    blurDataURL={selected.blurDataURL}
                    className="object-cover object-[center_18%] grayscale-0"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
                  
                  {selected.birthday && (
                    <div className="absolute left-6 top-6 rounded-2xl bg-black/40 px-4 py-2 backdrop-blur-md border border-white/10">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Birthday</p>
                      <p className="mt-1 text-sm font-medium text-white">
                        {new Date(selected.birthday).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex flex-col justify-between p-6 sm:p-8">
                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-zinc-400">{selected.role}</p>
                    <h2 className="mt-3 font-display text-4xl text-white">{selected.full_name}</h2>
                    <p className="mt-2 text-sm uppercase tracking-[0.25em] text-zinc-500">
                      {selected.batch}
                    </p>

                    <div className="mt-6 flex flex-wrap gap-3">
                      {selected.whatsapp_url && (
                        <a
                          href={selected.whatsapp_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[10px] font-medium uppercase tracking-widest text-zinc-200 transition hover:bg-emerald-500/10 hover:text-emerald-400"
                        >
                          WhatsApp
                        </a>
                      )}
                      {selected.instagram_url && (
                        <a
                          href={selected.instagram_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[10px] font-medium uppercase tracking-widest text-zinc-200 transition hover:bg-pink-500/10 hover:text-pink-500"
                        >
                          Instagram
                        </a>
                      )}
                      {selected.snapchat_url && (
                        <a
                          href={selected.snapchat_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[10px] font-medium uppercase tracking-widest text-zinc-200 transition hover:bg-yellow-500/10 hover:text-yellow-400"
                        >
                          Snapchat
                        </a>
                      )}
                      {selected.twitter_url && (
                        <a
                          href={selected.twitter_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[10px] font-medium uppercase tracking-widest text-zinc-200 transition hover:bg-sky-500/10 hover:text-sky-400"
                        >
                          Twitter
                        </a>
                      )}
                    </div>

                    <blockquote className="mt-8 border-l border-white/10 pl-5 text-lg leading-8 text-zinc-200">
                      {selected.quote}
                    </blockquote>

                    <p className="mt-6 text-sm leading-7 text-zinc-300">{selected.story}</p>

                    <div className="mt-8">
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-xs uppercase tracking-[0.35em] text-zinc-400">
                          Featured in memories
                        </p>
                        <span className="text-xs uppercase tracking-[0.25em] text-zinc-500">
                          {featuredMemories.length} found
                        </span>
                      </div>

                      {featuredMemories.length ? (
                        <div className="mt-4 grid max-h-[320px] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
                          {featuredMemories.map((memory) => (
                            <div
                              key={memory.id}
                              onClick={() => setSelectedMemory(memory)}
                              className="group cursor-pointer overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] transition-colors hover:border-white/20"
                            >
                              <div className="relative aspect-[4/3]">
                                {memory.mediaType === 'video' ? (
                                  <video
                                    controls
                                    playsInline
                                    preload="metadata"
                                    className="h-full w-full object-cover"
                                  >
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
                              </div>
                              <div className="p-4">
                                <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                                  {memory.category}
                                </p>
                                <h3 className="mt-2 font-display text-lg text-white">{memory.title}</h3>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-4 rounded-2xl border border-dashed border-white/10 px-4 py-5 text-sm leading-6 text-zinc-400">
                          No memories are tagged with this person yet. Add tags in the admin gallery
                          form to make this section populate.
                        </p>
                      )}
                    </div>

                    <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => setSelected(null)}
                        className="inline-flex items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-medium text-zinc-950 transition hover:bg-zinc-100"
                      >
                        Close Portrait
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </LayoutGroup>

      <AnimatePresence>
        {selectedMemory && (
          <MediaLightbox
            media={selectedMemory}
            onClose={() => setSelectedMemory(null)}
            allMedia={featuredMemories}
          />
        )}
      </AnimatePresence>
    </section>
  );
}
