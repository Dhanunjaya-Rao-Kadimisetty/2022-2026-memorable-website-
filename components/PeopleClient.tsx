'use client';

import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { buildDownloadFilename, downloadMedia } from '@/lib/downloadMedia';
import { fetchGalleryImages, fetchProfiles, type GalleryImage, type YearbookProfile } from '@/lib/supabaseClient';
import MediaLightbox from '@/components/MediaLightbox';

type Props = {
  profiles: YearbookProfile[];
  gallery: GalleryImage[];
};

type PersonSummary = YearbookProfile & {
  memories: GalleryImage[];
  imageCount: number;
  videoCount: number;
  totalCount: number;
  firstMemory: GalleryImage | null;
};

function buildPriorityPhotoMemories(profile: YearbookProfile): GalleryImage[] {
  return profile.priorityPhotoUrls
    .filter(Boolean)
    .map((photoUrl, index) => ({
      id: `${profile.id}-priority-${index}`,
      title: profile.priority_photo_details[index]?.title || `${profile.full_name} highlight ${index + 1}`,
      category: 'Profile Highlights',
      storage_path: profile.priority_photo_paths[index] ?? null,
      mediaType: 'image' as const,
      tagged_profile_ids: [profile.id],
      width: null,
      height: null,
      alt_text:
        profile.priority_photo_details[index]?.description ||
        `${profile.full_name} profile highlight photo ${index + 1}`,
      photoUrl,
      blurDataURL: profile.blurDataURL,
    }));
}

function buildPersonSummaries(profiles: YearbookProfile[], gallery: GalleryImage[]) {
  const summaries: PersonSummary[] = profiles.map((profile) => {
    const priorityMemories = buildPriorityPhotoMemories(profile);
    const taggedMemories = gallery.filter((item) => item.tagged_profile_ids.includes(profile.id));
    const memories = [...priorityMemories, ...taggedMemories];
    const imageCount = memories.filter((item) => item.mediaType === 'image').length;
    const videoCount = memories.filter((item) => item.mediaType === 'video').length;

    return {
      ...profile,
      memories,
      imageCount,
      videoCount,
      totalCount: memories.length,
      firstMemory: memories[0] ?? null,
    };
  });

  return summaries.sort((a, b) => a.full_name.localeCompare(b.full_name, undefined, { sensitivity: 'base' }));
}

export default function PeopleClient({ profiles, gallery }: Props) {
  const [liveProfiles, setLiveProfiles] = useState<YearbookProfile[]>(profiles);
  const [liveGallery, setLiveGallery] = useState<GalleryImage[]>(gallery);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(profiles[0]?.id ?? '');
  const [selectedMemory, setSelectedMemory] = useState<GalleryImage | null>(null);
  const [downloadState, setDownloadState] = useState<string>('');
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

  useEffect(() => {
    if (!selectedId && liveProfiles[0]?.id) {
      setSelectedId(liveProfiles[0].id);
    }
  }, [liveProfiles, selectedId]);

  const people = useMemo(() => buildPersonSummaries(liveProfiles, liveGallery), [liveProfiles, liveGallery]);

  const filteredPeople = useMemo(() => {
    if (!deferredSearch) return people;

    return people.filter((person) => {
      const haystack = [person.full_name, person.role, person.batch, person.quote, person.story]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(deferredSearch);
    });
  }, [deferredSearch, people]);

  const selectedPerson = useMemo(() => {
    return (
      people.find((person) => person.id === selectedId) ??
      filteredPeople[0] ??
      people[0] ??
      null
    );
  }, [filteredPeople, people, selectedId]);

  const totalMemories = liveGallery.length;
  const taggedMemories = liveGallery.filter((item) => item.tagged_profile_ids.length > 0).length;
  const unassignedMemories = Math.max(totalMemories - taggedMemories, 0);

  async function handleDownload(memory: GalleryImage) {
    try {
      setDownloadState(memory.id);
      await downloadMedia(memory.photoUrl, buildDownloadFilename(memory.title, memory.photoUrl));
    } finally {
      setDownloadState('');
    }
  }

  return (
    <section className="mx-auto min-h-screen w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="relative overflow-hidden rounded-[2rem] border border-white/[0.08] bg-white/[0.035] p-6 shadow-glow backdrop-blur-xl sm:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(250,204,21,0.16),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.12),transparent_28%)]" />
        <div className="relative grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-zinc-400">People &amp; Media</p>
            <h1 className="mt-3 font-display text-4xl text-white sm:text-5xl">
              Scan the archive by person
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-300 sm:text-base">
              This view groups every tagged photo and video by person, so you can open one face and
              see all related memories in one place.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <label className="flex-1">
                <span className="sr-only">Search people</span>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search a name, role, or quote"
                  className="w-full rounded-full border border-white/10 bg-black/20 px-5 py-3 text-sm text-white outline-none placeholder:text-zinc-500"
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

            <div className="mt-6 flex flex-wrap gap-3">
              <div className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-zinc-200">
                {liveProfiles.length} people
              </div>
              <div className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-zinc-200">
                {totalMemories} total memories
              </div>
              <div className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-zinc-200">
                {taggedMemories} tagged memories
              </div>
              <div className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-zinc-200">
                {unassignedMemories} untagged
              </div>
            </div>
          </div>

            <div className="panel relative overflow-hidden p-5">
              <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Selected person</p>
                <h2 className="mt-2 font-display text-3xl text-white">
                  {selectedPerson?.full_name ?? 'No match'}
                </h2>
              </div>
              {selectedPerson ? (
                <Link
                  href="/yearbook"
                  className="rounded-full border border-white/10 px-4 py-2 text-xs uppercase tracking-[0.2em] text-zinc-200 transition hover:bg-white/[0.08]"
                >
                  Open Yearbook
                </Link>
              ) : null}
            </div>

            {!liveProfiles.length ? (
              <p className="mt-6 text-sm leading-7 text-zinc-400">
                No people have been added yet. Add profiles in the admin panel to start linking memories.
              </p>
            ) : selectedPerson ? (
              <div className="mt-6 space-y-5">
                <div className="relative h-[240px] overflow-hidden rounded-[1.75rem] border border-white/[0.08]">
                  <Image
                    src={selectedPerson.photoUrl || '/placeholder-profile.svg'}
                    alt={selectedPerson.full_name}
                    fill
                    priority
                    sizes="(max-width: 1024px) 100vw, 40vw"
                    placeholder="blur"
                    blurDataURL={selectedPerson.blurDataURL}
                    className="object-cover object-center"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-zinc-300">
                    {selectedPerson.role || 'Profile'}
                  </span>
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-zinc-300">
                    {selectedPerson.batch || 'Batch'}
                  </span>
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-zinc-300">
                    {selectedPerson.totalCount} memories
                  </span>
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-zinc-300">
                    {selectedPerson.imageCount} photos
                  </span>
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-zinc-300">
                    {selectedPerson.videoCount} videos
                  </span>
                </div>

                <blockquote className="border-l border-white/10 pl-5 text-sm leading-7 text-zinc-200 sm:text-base">
                  {selectedPerson.quote || selectedPerson.story}
                </blockquote>
              </div>
            ) : (
              <p className="mt-6 text-sm leading-7 text-zinc-400">
                Search for a person to see their connected photos and videos.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="panel p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-4 px-1">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">People grid</p>
              <h2 className="mt-2 font-display text-2xl text-white">
                {filteredPeople.length} result{filteredPeople.length === 1 ? '' : 's'}
              </h2>
            </div>
            <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
              Tap a face to load memories
            </p>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={deferredSearch || 'all'}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="grid gap-4 sm:grid-cols-2"
            >
              {!people.length ? (
                <div className="rounded-[1.6rem] border border-dashed border-white/10 bg-white/[0.03] p-6 text-sm leading-7 text-zinc-400 sm:col-span-2">
                  No people are published yet. Add profiles in the admin panel to build this archive.
                </div>
              ) : filteredPeople.map((person, index) => {
                const isActive = selectedPerson?.id === person.id;

                return (
                  <motion.button
                    key={person.id}
                    type="button"
                    onClick={() => setSelectedId(person.id)}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: index * 0.03 }}
                    className={[
                      'group overflow-hidden rounded-[1.6rem] border text-left transition',
                      isActive
                        ? 'border-white/30 bg-white/[0.08]'
                        : 'border-white/[0.08] bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]',
                    ].join(' ')}
                  >
                    <div className="relative aspect-[4/5] overflow-hidden">
                      {person.firstMemory ? (
                        person.firstMemory.mediaType === 'video' ? (
                          <video
                            controls={false}
                            playsInline
                            muted
                            autoPlay
                            loop
                            preload="metadata"
                            className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]"
                          >
                            <source src={person.firstMemory.photoUrl || '/placeholder-gallery.svg'} />
                            Your browser does not support the video tag.
                          </video>
                        ) : (
                          <Image
                            src={person.firstMemory.photoUrl || person.photoUrl || '/placeholder-profile.svg'}
                            alt={person.full_name}
                            fill
                            sizes="(max-width: 768px) 100vw, 50vw"
                            className="object-cover transition duration-700 group-hover:scale-[1.03]"
                            placeholder="blur"
                            blurDataURL={person.firstMemory.blurDataURL}
                          />
                        )
                      ) : (
                        <Image
                          src={person.photoUrl || '/placeholder-profile.svg'}
                          alt={person.full_name}
                          fill
                          sizes="(max-width: 768px) 100vw, 50vw"
                          className="object-cover"
                          placeholder="blur"
                          blurDataURL={person.blurDataURL}
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/12 to-transparent" />
                      <div className="absolute inset-x-0 bottom-0 p-4">
                        <p className="text-[11px] uppercase tracking-[0.28em] text-zinc-300">
                          {person.role || 'Profile'}
                        </p>
                        <h3 className="mt-2 font-display text-2xl text-white">{person.full_name}</h3>
                        <p className="mt-1 text-xs uppercase tracking-[0.2em] text-zinc-400">
                          {person.totalCount} related memories
                        </p>
                      </div>
                    </div>
                  </motion.button>
                );
              })}

              {!filteredPeople.length && people.length ? (
                <div className="rounded-[1.6rem] border border-dashed border-white/10 bg-white/[0.03] p-6 text-sm leading-7 text-zinc-400 sm:col-span-2">
                  No people match that search. Try a different name, role, or quote.
                </div>
              ) : null}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="panel p-4 sm:p-5">
          <div className="flex items-center justify-between gap-4 px-1">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Related media</p>
              <h2 className="mt-2 font-display text-2xl text-white">
                {selectedPerson?.full_name ?? 'Person'}
              </h2>
            </div>
            {selectedPerson ? (
              <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-zinc-300">
                {selectedPerson.memories.length} items
              </span>
            ) : null}
          </div>

          {selectedPerson ? (
            selectedPerson.memories.length ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {selectedPerson.memories.map((memory) => (
                  <motion.article
                    key={memory.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    onClick={() => setSelectedMemory(memory)}
                    className="group cursor-pointer overflow-hidden rounded-[1.4rem] border border-white/[0.08] bg-white/[0.03] transition-colors hover:border-white/20"
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
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">{memory.category}</p>
                          <h3 className="mt-2 font-display text-xl text-white">{memory.title}</h3>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleDownload(memory)}
                          disabled={downloadState === memory.id}
                          className="rounded-full border border-white/10 px-3 py-2 text-[11px] uppercase tracking-[0.22em] text-zinc-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {downloadState === memory.id ? 'Downloading' : 'Download'}
                        </button>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-zinc-400">
                        {memory.alt_text || 'Tagged memory from the archive.'}
                      </p>
                    </div>
                  </motion.article>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-[1.4rem] border border-dashed border-white/10 bg-white/[0.03] px-4 py-6 text-sm leading-7 text-zinc-400">
                No memories are tagged with this person yet. Add them in the admin gallery to make
                this section populate.
              </div>
            )
          ) : (
            <div className="mt-4 rounded-[1.4rem] border border-dashed border-white/10 bg-white/[0.03] px-4 py-6 text-sm leading-7 text-zinc-400">
              Pick a person from the grid to see every related photo and video here.
            </div>
          )}
        </div>
      </div>
      </div>

      <AnimatePresence>
        {selectedMemory && (
          <MediaLightbox
            media={selectedMemory}
            onClose={() => setSelectedMemory(null)}
            allMedia={selectedPerson?.memories}
          />
        )}
      </AnimatePresence>
    </section>
  );
}
