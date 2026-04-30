import { ProfileCardSkeleton } from '@/components/Skeletons';

export default function Loading() {
  return (
    <section className="mx-auto min-h-screen w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl space-y-3">
          <div className="h-3 w-28 rounded-full bg-white/10" />
          <div className="h-12 w-72 rounded-full bg-white/10" />
          <div className="h-4 w-full max-w-xl rounded-full bg-white/10" />
        </div>
        <div className="panel h-12 w-44" />
      </div>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <ProfileCardSkeleton key={index} />
        ))}
      </div>
    </section>
  );
}

