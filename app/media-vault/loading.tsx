import { GalleryTileSkeleton } from '@/components/Skeletons';

export default function Loading() {
  return (
    <section className="mx-auto min-h-screen w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl space-y-3">
          <div className="h-3 w-28 rounded-full bg-white/10" />
          <div className="h-12 w-72 rounded-full bg-white/10" />
          <div className="h-4 w-full max-w-xl rounded-full bg-white/10" />
        </div>
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-10 w-20 rounded-full bg-white/10" />
          ))}
        </div>
      </div>
      <div className="columns-1 gap-5 space-y-5 sm:columns-2 lg:columns-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <GalleryTileSkeleton key={index} tall={index % 2 === 0} />
        ))}
      </div>
    </section>
  );
}

