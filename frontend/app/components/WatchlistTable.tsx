"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  WatchlistSummaryItem,
  changeColorClass,
  formatChangePercent,
} from "@/app/lib/analysis";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function formatPrice(value: number | null): string {
  return value === null ? "--" : currencyFormatter.format(value);
}

function formatScore(value: number | null): string {
  return value === null ? "--" : `${value}/100`;
}

type SortKey = "ticker" | "name" | "price" | "change_percent" | "fundamental_score";
type SortDirection = "asc" | "desc";
type SortValue = string | number | null;
type FilterKey = "all" | "gainers" | "losers" | "high_quality";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "ticker", label: "Ticker" },
  { key: "name", label: "Name" },
  { key: "price", label: "Price" },
  { key: "change_percent", label: "1D Change" },
  { key: "fundamental_score", label: "Fundamental Score" },
];

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "gainers", label: "Gainers" },
  { key: "losers", label: "Losers" },
  { key: "high_quality", label: "High Quality (> 80)" },
];

function matchesFilter(row: WatchlistSummaryItem, filter: FilterKey): boolean {
  switch (filter) {
    case "gainers":
      return row.change_percent !== null && row.change_percent > 0;
    case "losers":
      return row.change_percent !== null && row.change_percent < 0;
    case "high_quality":
      return row.fundamental_score !== null && row.fundamental_score > 80;
    default:
      return true;
  }
}

function getSortValue(row: WatchlistSummaryItem, key: SortKey): SortValue {
  return row[key];
}

function compareValues(a: SortValue, b: SortValue): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  if (typeof a === "string" && typeof b === "string") {
    return a.localeCompare(b);
  }
  return (a as number) - (b as number);
}

export default function WatchlistTable({ data }: { data: WatchlistSummaryItem[] }) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey>("ticker");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  }

  const filteredData = useMemo(
    () => data.filter((row) => matchesFilter(row, activeFilter)),
    [data, activeFilter]
  );

  const sortedData = useMemo(() => {
    const copy = [...filteredData];
    copy.sort((a, b) => {
      const cmp = compareValues(getSortValue(a, sortKey), getSortValue(b, sortKey));
      return sortDirection === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [filteredData, sortKey, sortDirection]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 p-4 border-b border-white/[0.05]">
        {FILTERS.map((filter) => {
          const active = filter.key === activeFilter;
          return (
            <button
              key={filter.key}
              onClick={() => setActiveFilter(filter.key)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
                active
                  ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/30"
                  : "bg-white/5 text-slate-400 border-white/5 hover:text-slate-200"
              }`}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      <table className="w-full text-left text-sm text-slate-300">
      <thead>
        <tr className="border-b border-white/[0.05] text-xs font-semibold tracking-wider text-slate-500 uppercase">
          {COLUMNS.map((column) => {
            const active = column.key === sortKey;
            return (
              <th key={column.key} className="px-6 py-3 font-semibold">
                <button
                  onClick={() => handleSort(column.key)}
                  className={`flex items-center gap-1 uppercase tracking-wider transition-colors hover:text-slate-200 ${
                    active ? "text-slate-200" : "text-slate-500"
                  }`}
                >
                  {column.label}
                  {active && (
                    <span aria-hidden>{sortDirection === "asc" ? "↑" : "↓"}</span>
                  )}
                </button>
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {sortedData.length === 0 ? (
          <tr>
            <td colSpan={COLUMNS.length} className="px-6 py-10 text-center text-sm text-slate-500">
              No stocks match this filter.
            </td>
          </tr>
        ) : (
          sortedData.map((row) => (
            <tr
              key={row.ticker}
              onClick={() => router.push(`/stock/${row.ticker}`)}
              className="cursor-pointer border-b border-white/[0.05] last:border-b-0 transition-all duration-300 hover:bg-white/[0.04]"
            >
              <td className="px-6 py-4 font-semibold">
                <Link
                  href={`/stock/${row.ticker}`}
                  className="text-slate-100 hover:text-white hover:underline transition-colors"
                >
                  {row.ticker}
                </Link>
              </td>
              <td className="px-6 py-4 text-slate-400">
                {row.name ?? "--"}
              </td>
              <td className="px-6 py-4 font-mono tracking-tight text-slate-100">
                {formatPrice(row.price)}
              </td>
              <td className={`px-6 py-4 font-mono tracking-tight ${changeColorClass(row.change_percent)}`}>
                {formatChangePercent(row.change_percent)}
              </td>
              <td className="px-6 py-4 font-mono tracking-tight text-slate-100">
                {formatScore(row.fundamental_score)}
              </td>
            </tr>
          ))
        )}
      </tbody>
      </table>
    </div>
  );
}
