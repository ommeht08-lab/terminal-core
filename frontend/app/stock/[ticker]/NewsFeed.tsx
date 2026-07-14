"use client";

import { NewsArticle, cardClassesFor } from "@/app/lib/analysis";

export default function NewsFeed({
  news,
  isExporting,
}: {
  news: NewsArticle[];
  isExporting: boolean;
}) {
  return (
    <div className={`${cardClassesFor(isExporting)} p-4`}>
      <h2 className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
        News
      </h2>

      {news.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">
          No recent news available.
        </p>
      ) : (
        <div className="mt-3 divide-y divide-white/5">
          {news.map((article) => (
            <div key={article.link} className="py-3 first:pt-0 last:pb-0">
              <a
                href={article.link}
                target="_blank"
                rel="noopener noreferrer"
                className={`text-sm font-medium transition-colors ${
                  isExporting
                    ? "text-gray-900"
                    : "text-slate-200 hover:text-cyan-400"
                }`}
              >
                {article.title}
              </a>
              <p className="mt-1 text-xs text-slate-500">
                {article.publisher}
                {article.time ? ` · ${article.time}` : ""}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
