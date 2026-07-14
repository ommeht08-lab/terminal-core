"use client";

import { useEffect, useState } from "react";
import { API_BASE, NewsArticle, cardClasses } from "@/app/lib/analysis";

type Sector = "Technology" | "Finance" | "Healthcare" | "Energy";

const SECTORS: Sector[] = ["Technology", "Finance", "Healthcare", "Energy"];

export default function SectorIntelPage() {
  const [activeSector, setActiveSector] = useState<Sector>("Technology");
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Resetting loading/error state when activeSector changes is intentional,
    // not a stray render-cascading setState -- same justification as the
    // ticker-load effect this pattern was originally established for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(false);

    fetch(`${API_BASE}/api/news/sector?sector=${encodeURIComponent(activeSector)}`)
      .then((res) => {
        if (!res.ok) throw new Error("request failed");
        return res.json();
      })
      .then((data: NewsArticle[]) => {
        if (!cancelled) setArticles(data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeSector]);

  return (
    <div className="min-h-screen bg-[#020617]">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sector Intel</h1>
          <p className="mt-1 text-sm text-slate-500">
            Macro industry news, aggregated by sector.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {SECTORS.map((sector) => {
            const active = sector === activeSector;
            return (
              <button
                key={sector}
                onClick={() => setActiveSector(sector)}
                className={`rounded-full px-4 py-2 text-sm font-medium border transition-colors ${
                  active
                    ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/30"
                    : "bg-slate-900/40 text-slate-400 border-slate-700/50 hover:text-slate-200"
                }`}
              >
                {sector}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className={`${cardClasses} p-16 flex items-center justify-center`}>
            <p className="text-sm text-slate-500">
              Loading {activeSector.toLowerCase()} coverage&hellip;
            </p>
          </div>
        ) : error || articles.length === 0 ? (
          <div className={`${cardClasses} p-16 flex items-center justify-center`}>
            <p className="text-sm text-slate-500">
              No {activeSector.toLowerCase()} sector news available right now.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {articles.map((article) => (
              <a
                key={article.link}
                href={article.link}
                target="_blank"
                rel="noopener noreferrer"
                className={`${cardClasses} p-5 flex flex-col`}
              >
                <span className="text-sm font-medium text-slate-100 leading-snug">
                  {article.title}
                </span>
                <span className="mt-3 text-xs text-slate-500">
                  {article.publisher}
                  {article.time ? ` · ${article.time}` : ""}
                </span>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
