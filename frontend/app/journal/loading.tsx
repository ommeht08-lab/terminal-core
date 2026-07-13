import { cardClasses } from "@/app/lib/analysis";

function Bar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-white/5 ${className}`} />;
}

export default function Loading() {
  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto py-12 px-6">
        <Bar className="h-8 w-56" />

        <div className="mt-8 space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={`${cardClasses} p-6`}>
              <div className="flex items-baseline justify-between gap-4">
                <Bar className="h-5 w-16" />
                <Bar className="h-3 w-24" />
              </div>
              <div className="mt-4 space-y-2">
                <Bar className="h-3 w-full" />
                <Bar className="h-3 w-5/6" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
