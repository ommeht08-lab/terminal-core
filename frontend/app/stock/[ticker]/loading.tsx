import { cardClasses } from "@/app/lib/analysis";

function Bar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-white/5 ${className}`} />;
}

function MetricColumn() {
  return (
    <div className={`${cardClasses} p-4`}>
      <Bar className="h-3 w-24" />
      <div className="mt-4 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between">
            <Bar className="h-4 w-20" />
            <Bar className="h-4 w-14" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-5xl mx-auto p-4 space-y-4">
        <div className={`${cardClasses} p-4 flex flex-wrap items-center justify-between gap-4`}>
          <div className="flex items-baseline gap-3">
            <Bar className="h-9 w-28" />
            <Bar className="h-6 w-20" />
            <Bar className="h-4 w-24" />
          </div>
          <div className="flex items-center gap-3">
            <Bar className="h-8 w-32 rounded-full" />
            <Bar className="h-8 w-40 rounded-full" />
          </div>
        </div>

        <div className={`${cardClasses} p-4`}>
          <Bar className="h-3 w-28" />
          <Bar className="mt-4 h-[280px] w-full" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <MetricColumn />
          <MetricColumn />
          <MetricColumn />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className={`${cardClasses} p-4`}>
            <Bar className="h-3 w-32" />
            <Bar className="mt-3 h-24 w-full" />
            <Bar className="mt-3 h-8 w-28 rounded-lg" />
          </div>

          <div className={`${cardClasses} p-4`}>
            <Bar className="h-3 w-16" />
            <div className="mt-3 divide-y divide-white/5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="py-3 first:pt-0 last:pb-0 space-y-2">
                  <Bar className="h-4 w-5/6" />
                  <Bar className="h-3 w-1/3" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
