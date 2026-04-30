import { cn } from '@/lib/utils';

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-2xl bg-white/[0.08]', className)} />;
}

export function ProfileCardSkeleton() {
  return (
    <div className="panel overflow-hidden p-3">
      <SkeletonBlock className="aspect-[4/5] w-full rounded-2xl" />
      <div className="mt-4 space-y-3 p-2">
        <SkeletonBlock className="h-4 w-2/3" />
        <SkeletonBlock className="h-3 w-1/2" />
        <SkeletonBlock className="h-3 w-full" />
      </div>
    </div>
  );
}

export function GalleryTileSkeleton({ tall = false }: { tall?: boolean }) {
  return <SkeletonBlock className={tall ? 'h-[420px] w-full' : 'h-[300px] w-full'} />;
}

export function StickyNoteSkeleton() {
  return <SkeletonBlock className="h-40 w-full rounded-[28px]" />;
}
