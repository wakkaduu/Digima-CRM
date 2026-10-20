import { cn } from '../../lib/cn';
import { Skeleton } from '../ui/States';
import { SkeletonCardList } from '../ui/Skeletons';

/** The review screen before its data arrives: filters and queue on the left, receipt and decision panel on the right (desktop). */
export function QueueSkeleton({ opened }: { opened: boolean }) {
  return (
    <div className="lg:grid lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start lg:gap-6">
      <section aria-hidden={opened} className={cn(opened && 'hidden lg:block')}>
        <div aria-hidden className="mb-3 space-y-2">
          <div className="flex gap-1">
            <Skeleton className="h-11 w-24" />
            <Skeleton className="h-11 w-36" />
            <Skeleton className="h-11 w-24" />
          </div>
          <Skeleton className="h-11 w-full" />
        </div>
        <SkeletonCardList label="Loading payments" count={5} />
      </section>
      <section aria-hidden className={cn(!opened && 'max-lg:hidden')}>
        <div className="space-y-4 rounded-card border border-border bg-surface p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <Skeleton className="h-6 w-24" />
          </div>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_16rem]">
            <Skeleton className="h-80 w-full" />
            <div className="space-y-3">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
              <Skeleton className="h-11 w-full" />
              <div className="flex gap-2">
                <Skeleton className="h-11 flex-1" />
                <Skeleton className="h-11 flex-1" />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
