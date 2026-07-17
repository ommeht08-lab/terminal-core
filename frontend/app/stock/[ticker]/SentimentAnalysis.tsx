"use client";

import { SentimentArticle, SentimentResponse, cardClassesFor, trendBadgeClasses } from "@/app/lib/analysis";

function ArticleRow({
  article,
  isExporting,
}: {
  article: SentimentArticle;
  isExporting: boolean;
}) {
  const scoreColor =
    article.compound_score > 0.05
      ? "text-emerald-400"
      : article.compound_score < -0.05
        ? "text-rose-400"
        : "text-slate-500";

  return (
    <div className="py-2.5 first:pt-0 last:pb-0 flex items-start justify-between gap-3">
      <a
        href={article.link}
        target="_blank"
        rel="noopener noreferrer"
        className={`text-sm font-medium leading-snug transition-colors ${
          isExporting ? "text-gray-900" : "text-slate-200 hover:text-cyan-400"
        }`}
      >
        {article.title}
      </a>
      <span className={`shrink-0 text-xs font-mono font-semibold ${scoreColor}`}>
        {article.compound_score > 0 ? "+" : ""}
        {article.compound_score.toFixed(2)}
      </span>
    </div>
  );
}

export default function SentimentAnalysis({
  sentiment,
  isExporting,
}: {
  sentiment: SentimentResponse;
  isExporting: boolean;
}) {
  const mutedText = isExporting ? "text-gray-500" : "text-slate-500";

  return (
    <div className={`${cardClassesFor(isExporting)} p-4`}>
      <h2 className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
        NLP Sentiment Engine
      </h2>

      {!sentiment.available ||
      sentiment.compound_score === null ||
      sentiment.classification === null ? (
        <p className={`mt-3 text-sm ${mutedText}`}>
          No recent news available to analyze.
        </p>
      ) : (
        <>
          <div className="mt-3 flex items-center justify-between">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${trendBadgeClasses(
                sentiment.classification
              )}`}
            >
              {sentiment.classification}
            </span>
            <span
              className={`text-base font-semibold font-mono tracking-tight ${
                isExporting ? "text-gray-900" : "text-slate-100"
              }`}
            >
              {sentiment.compound_score > 0 ? "+" : ""}
              {sentiment.compound_score.toFixed(3)}
            </span>
          </div>

          {/* Gauge: -1.0 (fully bearish) to +1.0 (fully bullish), 0 centered. */}
          <div className="mt-3 relative h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
            <div className="absolute inset-y-0 left-1/2 w-px bg-white/20" />
            <div
              className={`absolute inset-y-0 w-2 rounded-full ${
                sentiment.classification === "Bullish"
                  ? "bg-emerald-400"
                  : sentiment.classification === "Bearish"
                    ? "bg-rose-400"
                    : "bg-slate-400"
              }`}
              style={{
                left: `calc(${((sentiment.compound_score + 1) / 2) * 100}% - 4px)`,
              }}
            />
          </div>
          <p className={`mt-1.5 text-[11px] ${mutedText}`}>
            Aggregated across {sentiment.article_count} recent headlines.
          </p>

          {sentiment.top_positive.length > 0 && (
            <div className="mt-4 pt-4 border-t border-white/5">
              <h3 className="text-[11px] font-semibold tracking-wider text-slate-600 uppercase">
                Bullish Signals
              </h3>
              <div className="mt-1 divide-y divide-white/5">
                {sentiment.top_positive.map((article) => (
                  <ArticleRow key={article.link} article={article} isExporting={isExporting} />
                ))}
              </div>
            </div>
          )}

          {sentiment.top_negative.length > 0 && (
            <div className="mt-4 pt-4 border-t border-white/5">
              <h3 className="text-[11px] font-semibold tracking-wider text-slate-600 uppercase">
                Bearish Signals
              </h3>
              <div className="mt-1 divide-y divide-white/5">
                {sentiment.top_negative.map((article) => (
                  <ArticleRow key={article.link} article={article} isExporting={isExporting} />
                ))}
              </div>
            </div>
          )}

          <p className={`mt-4 text-[11px] leading-snug ${mutedText}`}>
            Scored with VADER against headline text only (no full article body is available
            from either data source) &mdash; a lexicon-based heuristic, not a guarantee of
            true market sentiment.
          </p>
        </>
      )}
    </div>
  );
}
