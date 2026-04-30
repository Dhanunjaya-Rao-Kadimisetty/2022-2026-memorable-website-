'use client';

import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { buildDownloadFilename, downloadMedia } from '@/lib/downloadMedia';
import { fetchGalleryImages, type GalleryImage } from '@/lib/supabaseClient';

type Props = {
  images: GalleryImage[];
};

function categorySortValue(value: string) {
  const match = value.match(/^(\d+)(st|nd|rd|th)\s*Year$/i);
  if (match) {
    return Number(match[1]);
  }

  if (/events?/i.test(value)) return 50;
  if (/farewell/i.test(value)) return 60;
  return 100 + value.toLowerCase().charCodeAt(0);
}

export default function MediaVaultClient({ images }: Props) {
  const [liveImages, setLiveImages] = useState<GalleryImage[]>(images);
  const [filter, setFilter] = useState<string>('All');
  const [downloadState, setDownloadState] = useState<string>('');

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const data = await fetchGalleryImages();
        if (!active) return;
        setLiveImages(data);
      } catch {
        if (!active) return;
        setLiveImages(images);
      }
    })();

    return () => {
      active = false;
    };
  }, [images]);

  const filters = useMemo(() => {
    const uniqueCategories = Array.from(new Set(liveImages.map((image) => image.category).filter(Boolean)));
    return ['All', ...uniqueCategories.sort((a, b) => {
      const sortA = categorySortValue(a);
      const sortB = categorySortValue(b);
      return sortA === sortB ? a.localeCompare(b) : sortA - sortB;
    })];
  }, [liveImages]);

  const visibleImages = useMemo(() => {
    if (filter === 'All') return liveImages;
    return liveImages.filter((image) => image.category === filter);
  }, [filter, liveImages]);

  async function handleDownload(image: GalleryImage) {
    try {
      setDownloadState(image.id);
      await downloadMedia(image.photoUrl, buildDownloadFilename(image.title, image.photoUrl));
    } finally {
      setDownloadState('');
    }
  }

  return (
    <section className="mx-auto min-h-screen w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.35em] text-zinc-400">Media Vault</p>
          <h1 className="mt-3 font-display text-4xl text-white sm:text-5xl">Moments in Motion</h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-zinc-300 sm:text-base">
            A masonry archive pulled from Supabase Storage. Filter by chapter and explore the
            moments that shaped the batch.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {filters.map((item) => (
            <button
              key={item}
              onClick={() => setFilter(item)}
              className={
                item === filter
                  ? 'rounded-full bg-white px-4 py-2 text-sm font-medium text-zinc-950'
                  : 'rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/10 hover:text-white'
              }
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={filter}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="columns-1 gap-5 space-y-5 sm:columns-2 lg:columns-3"
        >
          {!liveImages.length ? (
            <div className="panel break-inside-avoid">
              <p className="text-sm text-zinc-300">
                No memories have been uploaded yet. Add photos or videos in the admin panel to populate
                this vault.
              </p>
            </div>
          ) : visibleImages.length ? (
            visibleImages.map((image, index) => (
              <motion.article
                key={image.id}
                layout
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: index * 0.04 }}
              whileHover={{ y: -6, scale: 1.01 }}
              className="group panel break-inside-avoid overflow-hidden will-change-transform"
            >
              <div className="relative overflow-hidden">
                {image.tagged_profile_ids.length ? (
                  <span className="absolute right-4 top-4 z-10 rounded-full bg-black/70 px-3 py-1 text-[11px] uppercase tracking-[0.25em] text-white">
                    Tagged in {image.tagged_profile_ids.length}
                  </span>
                ) : null}
                {image.mediaType === 'video' ? (
                  <video
                    controls
                    playsInline
                    preload="metadata"
                    className="h-auto w-full object-cover transition duration-700 group-hover:scale-[1.01]"
                  >
                    <source src={image.photoUrl || '/placeholder-gallery.svg'} />
                    Your browser does not support the video tag.
                  </video>
                ) : (
                  <Image
                    src={image.photoUrl || '/placeholder-gallery.svg'}
                    alt={image.alt_text || image.title}
                    width={image.width ?? 1200}
                    height={image.height ?? 1400}
                    className="h-auto w-full object-cover transition duration-700 group-hover:scale-[1.03]"
                    placeholder="blur"
                    blurDataURL={image.blurDataURL}
                    sizes="(max-width: 1024px) 50vw, 33vw"
                  />
                )}
                {image.mediaType === 'video' ? (
                  <span className="absolute left-4 top-4 rounded-full bg-black/70 px-3 py-1 text-[11px] uppercase tracking-[0.25em] text-white">
                    Video
                  </span>
                ) : null}
              </div>
              <div className="flex items-start justify-between gap-4 p-5">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">{image.category}</p>
                  <h3 className="mt-2 font-display text-2xl text-white">{image.title}</h3>
                  {image.tagged_profile_ids.length ? (
                    <p className="mt-2 text-xs uppercase tracking-[0.22em] text-zinc-400">
                      Tagged in this memory
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => void handleDownload(image)}
                  disabled={downloadState === image.id}
                  className="rounded-full border border-white/10 px-3 py-2 text-[11px] uppercase tracking-[0.22em] text-zinc-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {downloadState === image.id ? 'Downloading' : 'Download'}
                </button>
              </div>
            </motion.article>
            ))
          ) : (
            <div className="panel break-inside-avoid">
              <p className="text-sm text-zinc-300">
                No memories match this filter. Try another chapter or choose All.
              </p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
