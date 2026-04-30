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
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-zinc-950/95 backdrop-blur-md"
      onClick={onClose}
    >
      {/* Header with Counter and Close */}
      <div className="absolute top-0 left-0 right-0 z-[110] flex items-center justify-between p-6">
        {allMedia.length > 1 && currentIndex >= 0 ? (
          <div className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-400 backdrop-blur-md">
            <span className="text-white">{currentIndex + 1}</span>
            <span className="mx-2 opacity-30">/</span>
            <span>{allMedia.length}</span>
          </div>
        ) : <div />}
        
        <button
          onClick={onClose}
          className="group flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-medium uppercase tracking-[0.2em] text-white backdrop-blur-md transition hover:bg-white/10"
        >
          <span>Close</span>
          <svg className="h-4 w-4 transition group-hover:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="relative flex h-full w-full items-center justify-center p-4 md:p-16 lg:p-24"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Navigation Controls */}
        {allMedia.length > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); handlePrev(); }}
              disabled={currentIndex <= 0}
              className="absolute left-6 top-1/2 z-[110] -translate-y-1/2 rounded-full border border-white/5 bg-white/5 p-5 text-white shadow-2xl backdrop-blur-xl transition hover:border-white/20 hover:bg-white/10 disabled:opacity-0"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleNext(); }}
              disabled={currentIndex >= allMedia.length - 1}
              className="absolute right-6 top-1/2 z-[110] -translate-y-1/2 rounded-full border border-white/5 bg-white/5 p-5 text-white shadow-2xl backdrop-blur-xl transition hover:border-white/20 hover:bg-white/10 disabled:opacity-0"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}

        {/* Main Media Container */}
        <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-2xl border border-white/5 bg-black/40 shadow-2xl shadow-black/50">
          {activeMedia.mediaType === 'video' ? (
            <video
              src={activeMedia.photoUrl}
              controls
              autoPlay
              className="max-h-full max-w-full"
            />
          ) : (
            <div className="relative h-full w-full">
              <Image
                src={activeMedia.photoUrl}
                alt={activeMedia.alt_text || activeMedia.title}
                fill
                className="object-contain p-2"
                priority
                sizes="90vw"
              />
            </div>
          )}
        </div>

        {/* Floating Info & Download Panel */}
        <div className="absolute bottom-8 left-1/2 z-[110] w-[calc(100%-3rem)] max-w-2xl -translate-x-1/2 rounded-3xl border border-white/10 bg-zinc-900/40 p-5 shadow-2xl backdrop-blur-2xl md:bottom-12 md:p-6">
          <div className="flex flex-col items-center justify-between gap-5 md:flex-row">
            <div className="flex-1 text-center md:text-left">
              <div className="flex items-center justify-center gap-3 md:justify-start">
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-400">
                  {activeMedia.category}
                </span>
                {activeMedia.mediaType === 'video' && (
                  <span className="rounded-full bg-sky-500/10 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-sky-400">
                    Video
                  </span>
                )}
              </div>
              <h2 className="mt-2 font-display text-lg text-white md:text-xl">{activeMedia.title}</h2>
              <p className="mt-1 line-clamp-1 text-xs text-zinc-400">
                {activeMedia.alt_text || 'Archived memory from the batch collection.'}
              </p>
            </div>
            
            <button
              onClick={handleDownload}
              disabled={downloadState}
              className="group flex w-full items-center justify-center gap-3 rounded-2xl bg-white px-6 py-3 text-[11px] font-bold uppercase tracking-[0.15em] text-zinc-950 transition hover:bg-zinc-100 disabled:opacity-50 md:w-auto"
            >
              {downloadState ? (
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="h-4 w-4 transition group-hover:-translate-y-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              )}
              <span>{downloadState ? 'Processing' : 'Download'}</span>
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
