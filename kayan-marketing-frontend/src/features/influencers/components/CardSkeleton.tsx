// Pulse-animated placeholder mirroring the ResultCard layout — used in
// the grid while a search is in flight. Six skeletons match the typical
// "results just below the fold" volume on desktop without overwhelming
// shorter mobile viewports.

const SKELETON_COUNT = 6;

export function CardSkeletonGrid(): JSX.Element {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
      {Array.from({ length: SKELETON_COUNT }, (_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

function CardSkeleton(): JSX.Element {
  return (
    <article className="card flex flex-col gap-3 animate-pulse">
      <header className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-full bg-cream-2 flex-shrink-0" />
        <div className="flex-1 space-y-2 min-w-0">
          <div className="h-3.5 w-2/3 bg-cream-2 rounded" />
          <div className="h-3 w-1/2 bg-cream-2 rounded" />
          <div className="h-2.5 w-1/3 bg-cream-2 rounded" />
        </div>
      </header>
      <div className="flex items-center gap-4">
        <div className="space-y-1 w-1/3">
          <div className="h-2 w-2/3 bg-cream-2 rounded" />
          <div className="h-3 w-1/2 bg-cream-2 rounded" />
        </div>
        <div className="space-y-1 w-1/3">
          <div className="h-2 w-2/3 bg-cream-2 rounded" />
          <div className="h-3 w-1/2 bg-cream-2 rounded" />
        </div>
        <div className="space-y-1 w-1/3">
          <div className="h-2 w-2/3 bg-cream-2 rounded" />
          <div className="h-4 w-12 bg-cream-2 rounded-full" />
        </div>
      </div>
      <div className="h-2.5 w-full bg-cream-2 rounded" />
      <div className="flex justify-end pt-1 border-t border-line">
        <div className="h-6 w-16 bg-cream-2 rounded-full" />
      </div>
    </article>
  );
}
