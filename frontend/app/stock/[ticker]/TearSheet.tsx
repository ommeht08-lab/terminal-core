"use client";

import { useState } from "react";
import generatePDF from "react-to-pdf";
import {
  AnalyzeResponse,
  cardClasses,
  cardClassesFor,
  formatValue,
  signalBadgeClasses,
  trendBadgeClasses,
} from "@/app/lib/analysis";
import ExportButton from "@/app/components/ExportButton";
import AnalystNotebook from "./AnalystNotebook";
import BacktestResults from "./BacktestResults";
import NewsFeed from "./NewsFeed";
import PriceChart from "./PriceChart";
import WatchlistButton from "./WatchlistButton";

const TEAR_SHEET_ID = "tear-sheet";

function DataRow({
  label,
  value,
  isExporting,
}: {
  label: string;
  value: string;
  isExporting: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-500">{label}</span>
      <span
        className={`text-base font-medium font-mono tracking-tight ${
          isExporting ? "text-gray-900" : "text-slate-100"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function formatPercent(value: number | null): string {
  return value === null ? "N/A" : `${(value * 100).toFixed(2)}%`;
}

function formatRatio(value: number | null): string {
  return value === null ? "N/A" : value.toFixed(2);
}

export default function TearSheet({ data }: { data: AnalyzeResponse }) {
  const [isExporting, setIsExporting] = useState(false);

  function handleExport() {
    setIsExporting(true);

    // generatePDF captures whatever is currently painted -- without this
    // delay it would screenshot the dark theme mid-transition, before React
    // has re-rendered the tear sheet in its light export theme.
    setTimeout(() => {
      generatePDF(() => document.getElementById(TEAR_SHEET_ID), {
        filename: `Om_Mehta_${data.ticker}_Research.pdf`,
        overrides: {
          canvas: {
            backgroundColor: "#ffffff",
          },
        },
      })
        .catch((error) => {
          console.error("Failed to generate tear sheet PDF:", error);
        })
        .finally(() => {
          setIsExporting(false);
        });
    }, 100);
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-5xl mx-auto p-4 space-y-4">
        <div className={`${cardClasses} p-4 flex flex-wrap items-center justify-between gap-4`}>
          <div className="flex items-baseline gap-3">
            <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-500">
              {data.ticker}
            </h1>
            <span className="text-xl font-semibold font-mono tracking-tight text-slate-200">
              {formatValue(data.price)}
            </span>
            <span className="text-xs text-slate-500">{data.date}</span>
          </div>
          <div className="flex items-center gap-3">
            <WatchlistButton ticker={data.ticker} />
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${signalBadgeClasses(
                data.hybrid_signal
              )}`}
            >
              {data.hybrid_signal}
            </span>
            <ExportButton isExporting={isExporting} onExport={handleExport} />
          </div>
        </div>

        <div
          id={TEAR_SHEET_ID}
          className={`grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4 items-start ${
            isExporting ? "bg-white text-black" : "bg-[#0a0a0a]"
          }`}
        >
          {/* Sidebar: quant data, chart, and news stay compact and out of the way. */}
          <div className="space-y-4 lg:sticky lg:top-24 lg:max-h-[calc(100vh-6.5rem)] lg:overflow-y-auto lg:pr-1">
            <div className={`${cardClassesFor(isExporting)} p-4`}>
              <h2 className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                Price History
              </h2>
              <div className="mt-2">
                <PriceChart history={data.history} />
              </div>
            </div>

            <div className={`${cardClassesFor(isExporting)} p-4`}>
              <h2 className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                Quant Metrics
              </h2>
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Trend</span>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${trendBadgeClasses(
                      data.trend
                    )}`}
                  >
                    {data.trend}
                  </span>
                </div>
                <DataRow label="Z-Score" value={formatValue(data.z_score)} isExporting={isExporting} />
                <DataRow label="50-Day SMA" value={formatValue(data.sma_50)} isExporting={isExporting} />
                <DataRow label="200-Day SMA" value={formatValue(data.sma_200)} isExporting={isExporting} />
                <DataRow label="RSI (14)" value={formatValue(data.rsi_14)} isExporting={isExporting} />
              </div>
            </div>

            <div className={`${cardClassesFor(isExporting)} p-4`}>
              <h2 className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                Fundamentals
              </h2>
              <div className="mt-3 space-y-2">
                <DataRow
                  label="Trailing P/E"
                  value={formatRatio(data.trailing_pe)}
                  isExporting={isExporting}
                />
                <DataRow
                  label="Forward P/E"
                  value={formatRatio(data.forward_pe)}
                  isExporting={isExporting}
                />
                <DataRow
                  label="Price/Book"
                  value={formatRatio(data.price_to_book)}
                  isExporting={isExporting}
                />
                <DataRow label="ROE" value={formatPercent(data.roe)} isExporting={isExporting} />
                <DataRow
                  label="Operating Margin"
                  value={formatPercent(data.operating_margin)}
                  isExporting={isExporting}
                />
              </div>
            </div>

            <BacktestResults backtest={data.backtest} isExporting={isExporting} />

            <NewsFeed news={data.news} isExporting={isExporting} />
          </div>

          {/* Primary pane: the editor is the main event on this page. */}
          <div className="lg:h-[calc(100vh-6.5rem)]">
            <AnalystNotebook ticker={data.ticker} isExporting={isExporting} />
          </div>
        </div>
      </div>
    </div>
  );
}
