// Falls back to the local dev backend when NEXT_PUBLIC_API_URL isn't set (e.g. no
// .env.local yet). NEXT_PUBLIC_ vars are inlined at build time, so this is safe to
// import from both Server and Client Components. In production this must be set
// to the deployed backend's URL via the hosting platform's env config.
export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export type FundamentalBreakdown = {
  Growth: number;
  Profitability: number;
  Health: number;
  Valuation: number;
};

export type HistoryPoint = {
  date: string;
  close: number | null;
  sma_50: number | null;
  sma_200: number | null;
  volume: number | null;
};

export type BacktestResult = {
  strategy_return: number;
  buy_hold_return: number;
  cagr: number;
  max_drawdown: number;
  win_rate: number;
  total_trades: number;
};

export type NewsArticle = {
  title: string;
  publisher: string;
  time: string | null;
  link: string;
};

// Matches backend WatchlistSummaryItem (POST /api/watchlist/summary). Deliberately
// lighter than AnalyzeResponse -- no trend/z_score/sparkline, since that endpoint
// skips the heavy per-ticker pipeline. name/fundamental_score are null until a
// ticker has been individually analyzed at least once (DB cache warms lazily).
export type WatchlistSummaryItem = {
  ticker: string;
  name: string | null;
  price: number | null;
  change_percent: number | null;
  fundamental_score: number | null;
};

export type AnalyzeResponse = {
  ticker: string;
  date: string;
  price: number | null;
  sma_50: number | null;
  sma_200: number | null;
  z_score: number | null;
  trend: string;
  fundamental_score: number;
  fundamental_breakdown: FundamentalBreakdown;
  hybrid_signal: string;
  history: HistoryPoint[];
  sparkline: number[];
  backtest: BacktestResult;
  news: NewsArticle[];
  trailing_pe: number | null;
  forward_pe: number | null;
  price_to_book: number | null;
  roe: number | null;
  operating_margin: number | null;
  rsi_14: number | null;
  net_profit_margin: number | null;
  asset_turnover: number | null;
  financial_leverage: number | null;
  piotroski_score: number | null;
  altman_z_score: number | null;
};

// Matches backend BotPositionsResponse (GET /api/bot/positions). `error` is
// only set when `configured` is true but the Alpaca request itself failed --
// missing keys is a normal "not wired up yet" state, not an error.
export type BotPosition = {
  ticker: string;
  quantity: number;
  current_price: number;
  unrealized_pl: number;
  unrealized_plpc: number;
  market_value: number;
};

export type BotPositionsResponse = {
  configured: boolean;
  error: "rate_limited" | "unavailable" | null;
  positions: BotPosition[];
};

// Matches backend BotPnlResponse (GET /api/bot/pnl). Individual bars can have
// null equity/profit_loss on days the account had no activity yet.
export type BotEquityPoint = {
  date: string;
  equity: number | null;
  profit_loss: number | null;
  profit_loss_pct: number | null;
};

export type BotPnlResponse = {
  configured: boolean;
  error: "rate_limited" | "unavailable" | null;
  equity_curve: BotEquityPoint[];
};

export const cardClasses =
  "bg-slate-900/40 border border-slate-700/50 backdrop-blur-md rounded-2xl shadow-xl shadow-black/20 hover:bg-slate-900/60 hover:border-slate-600/60 transition-all duration-300";

// Swaps glassmorphism for a flat light card while a PDF tear sheet is being
// captured -- backdrop-blur/hover states don't matter for a static screenshot.
export function cardClassesFor(isExporting: boolean): string {
  return isExporting ? "bg-gray-50 border border-gray-200 rounded-2xl" : cardClasses;
}

export function signalBadgeClasses(signal: string): string {
  switch (signal) {
    case "Oversold Opportunity (Mean Reversion)":
      return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
    case "Fundamental Breakdown (Value Trap)":
      return "bg-rose-500/10 text-rose-400 border border-rose-500/20";
    case "Overbought but High Quality (Hold/Trim)":
      return "bg-amber-500/10 text-amber-400 border border-amber-500/20";
    case "Overvalued Junk (Strong Sell)":
      return "bg-rose-500/10 text-rose-400 border border-rose-500/20";
    default:
      return "bg-slate-500/10 text-slate-300 border border-slate-500/20";
  }
}

export function trendBadgeClasses(trend: string): string {
  if (trend === "Bullish")
    return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
  if (trend === "Bearish")
    return "bg-rose-500/10 text-rose-400 border border-rose-500/20";
  return "bg-slate-500/10 text-slate-300 border border-slate-500/20";
}

export function formatValue(value: number | null): string {
  return value === null ? "N/A" : value.toString();
}

export function changeColorClass(value: number | null): string {
  if (value === null || value === 0) return "text-slate-300";
  return value > 0 ? "text-emerald-400" : "text-rose-400";
}

export function formatChangePercent(value: number | null): string {
  if (value === null) return "--";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}
