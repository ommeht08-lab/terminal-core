import { cardClasses } from "@/app/lib/analysis";

function Bar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-white/5 ${className}`} />;
}

export default function DashboardLoading() {
  return (
    <div className="min-h-screen">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <Bar className="h-8 w-64" />

        <div className={`${cardClasses} overflow-hidden`}>
          <div className="border-b border-white/[0.05] px-6 py-3 flex gap-10">
            {Array.from({ length: 6 }).map((_, i) => (
              <Bar key={i} className="h-3 w-16" />
            ))}
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="border-b border-white/[0.05] last:border-b-0 px-6 py-4 flex items-center gap-10"
            >
              <Bar className="h-4 w-14" />
              <Bar className="h-4 w-16" />
              <Bar className="h-4 w-14" />
              <Bar className="h-4 w-12" />
              <Bar className="h-4 w-16" />
              <Bar className="h-6 w-28 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
