'use client';

import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import type { GalleryImage } from '@/lib/supabaseClient';
import { buildDownloadFilename, downloadMedia } from '@/lib/downloadMedia';

type Props = {
  media: GalleryImage | null;
  onClose: () => void;
  allMedia?: GalleryImage[];
};

export default function MediaLightbox({ media, onClose, allMedia = [] }: Props) {
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [downloadState, setDownloadState] = useState(false);

  useEffect(() => {
    if (media && allMedia.length > 0) {
      const index = allMedia.findIndex((m) => m.id === media.id);
      setCurrentIndex(index);
    } else {
      setCurrentIndex(-1);
    }
  }, [media, allMedia]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && currentIndex > 0) {
        handlePrev();
      }
      if (e.key === 'ArrowRight' && currentIndex < allMedia.length - 1) {
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, currentIndex, allMedia]);

  const activeMedia = currentIndex >= 0 ? allMedia[currentIndex] : media;

  if (!activeMedia) return null;

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < allMedia.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleDownload = async () => {
    if (!activeMedia) return;
    try {
      setDownloadState(true);
      await downloadMedia(activeMedia.photoUrl, buildDownloadFilename(activeMedia.title, activeMedia.photoUrl));
    } finally {
      setDownloadState(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="relative flex h-full w-full flex-col items-center justify-center p-4 md:p-12"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-6 top-6 z-[110] rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Main Media */}
        <div className="relative flex h-full w-full items-center justify-center">
          {activeMedia.mediaType === 'video' ? (
            <video
              src={activeMedia.photoUrl}
              controls
              autoPlay
              className="max-h-full max-w-full rounded-xl shadow-2xl"
            />
          ) : (
            <div className="relative h-full w-full">
              <Image
                src={activeMedia.photoUrl}
                alt={activeMedia.alt_text || activeMedia.title}
                fill
                className="object-contain"
                priority
                sizes="100vw"
              />
            </div>
          )}
        </div>

        {/* Navigation Controls */}
        {allMedia.length > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); handlePrev(); }}
              disabled={currentIndex <= 0}
              className="absolute left-4 top-1/2 z-[110] -translate-y-1/2 rounded-full bg-white/5 p-4 text-white transition hover:bg-white/15 disabled:opacity-20"
            >
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleNext(); }}
              disabled={currentIndex >= allMedia.length - 1}
              className="absolute right-4 top-1/2 z-[110] -translate-y-1/2 rounded-full bg-white/5 p-4 text-white transition hover:bg-white/15 disabled:opacity-20"
            >
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}

        {/* Info & Download Overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-8 md:p-12">
          <div className="mx-auto flex max-w-4xl flex-col items-center justify-between gap-4 text-center md:flex-row md:text-left">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-zinc-400">{activeMedia.category}</p>
              <h2 className="mt-2 font-display text-2xl text-white md:text-3xl">{activeMedia.title}</h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-300">
                {activeMedia.alt_text || 'Archived memory from the batch collection.'}
              </p>
            </div>
            <button
              onClick={handleDownload}
              disabled={downloadState}
              className="flex items-center gap-2 rounded-full bg-white px-8 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200 disabled:opacity-50"
            >
              {downloadState ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Processing
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download Original
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
