import { StickyNoteSkeleton } from '@/components/Skeletons';

export default function Loading() {
  return (
    <section className="mx-auto min-h-screen w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-10 grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="panel space-y-4 p-6 sm:p-8">
          <div className="h-3 w-28 rounded-full bg-white/10" />
          <div className="h-12 w-72 rounded-full bg-white/10" />
          <div className="h-4 w-full rounded-full bg-white/10" />
          <div className="space-y-4 pt-4">
            <div className="h-12 rounded-2xl bg-white/10" />
            <div className="h-32 rounded-2xl bg-white/10" />
            <div className="h-12 w-32 rounded-full bg-white/10" />
          </div>
        </div>
        <div className="panel p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-3 w-28 rounded-full bg-white/10" />
              <div className="h-8 w-24 rounded-full bg-white/10" />
            </div>
            <div className="h-8 w-24 rounded-full bg-white/10" />
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <StickyNoteSkeleton key={index} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

