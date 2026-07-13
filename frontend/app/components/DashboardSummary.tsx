"use client";

import { WatchlistSummaryItem, cardClasses } from "@/app/lib/analysis";

export default function DashboardSummary({ data }: { data: WatchlistSummaryItem[] }) {
  const advancersCount = data.filter(
    (row) => row.change_percent !== null && row.change_percent > 0
  ).length;

  const scored = data.filter(
    (row): row is WatchlistSummaryItem & { fundamental_score: number } =>
      row.fundamental_score !== null
  );
  const avgQuality =
    scored.length === 0
      ? null
      : scored.reduce((sum, row) => sum + row.fundamental_score, 0) / scored.length;

  const stats = [
    { label: "Coverage Universe", value: data.length.toString() },
    { label: "Advancers", value: advancersCount.toString() },
    {
      label: "Average Quality",
      value: avgQuality === null ? "--" : `${avgQuality.toFixed(1)}/100`,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      {stats.map((stat) => (
        <div key={stat.label} className={`${cardClasses} p-6`}>
          <p className="text-3xl font-light text-white font-mono tracking-tight">
            {stat.value}
          </p>
          <p className="mt-1 text-sm text-slate-400">{stat.label}</p>
        </div>
      ))}
    </div>
  );
}
