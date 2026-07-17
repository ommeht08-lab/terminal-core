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

// Matches backend GET /api/journal/recent -- the landing page's Recent
// Theses grid. `name` is null until a ticker has been individually analyzed
// at least once (same Watchlist name-cache convention as
// WatchlistSummaryItem). `excerpt` is a plain-text preview of the note's
// markdown content, already truncated server-side.
export type RecentThesis = {
  ticker: string;
  name: string | null;
  excerpt: string;
  updated_at: string | null;
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

// Matches backend GET/POST /api/bot/config. This app only persists these
// values -- it has no channel to the Java execution engine itself, so an
// update only takes effect if/however that engine polls this table.
export type AlgoConfig = {
  ma_lookback_period: number;
  std_dev_multiplier: number;
  updated_at: string | null;
};

// Matches backend POST /api/backtest. This is the Telemetry page's own
// simulation of the Risk Controls parameters against real historical
// OHLCV -- not a verified replica of the Java execution engine's live
// logic, which this app can't see. Distinct from the tear sheet's
// BacktestResult (fixed 20-day Z-Score strategy, no Sharpe/equity curve).
export type BacktestEquityPoint = {
  date: string;
  strategy_equity: number;
  buy_hold_equity: number;
};

export type HistoricalBacktestResult = {
  ticker: string;
  total_return: number;
  sharpe_ratio: number;
  max_drawdown: number;
  win_rate: number;
  total_trades: number;
  equity_curve: BacktestEquityPoint[];
};

// Matches backend GET /api/portfolio/optimize. `weights` are percentages
// (sum to 100) keyed by ticker, only covering `tickers_used` -- which is
// frequently a subset of the full watchlist, since Polygon's rate limit
// (see `rate_limited`) makes fetching a large watchlist in one request
// unworkable. `available: false` covers both an empty/near-empty watchlist
// (`reason: "insufficient_tickers"`) and a rate limit hit before 2 tickers
// could be fetched (`reason: "rate_limited"`).
export type PortfolioWeights = Record<string, number>;

export type OptimizedPortfolio = {
  expected_return: number;
  volatility: number;
  sharpe_ratio: number;
  weights: PortfolioWeights;
};

export type RandomPortfolioPoint = {
  return: number;
  volatility: number;
  sharpe_ratio: number;
};

export type PortfolioOptimizeResponse = {
  available: boolean;
  reason: "rate_limited" | "insufficient_tickers" | null;
  tickers_used: string[];
  requested_count: number;
  rate_limited: boolean;
  max_sharpe_portfolio: OptimizedPortfolio | null;
  min_volatility_portfolio: OptimizedPortfolio | null;
  random_portfolios: RandomPortfolioPoint[];
};

// Matches backend GET /api/sentiment/{ticker}. Headline text only (no full
// article body is available from either FMP or the Google News RSS
// fallback get_news() uses) -- `compound_score` is VADER's per-headline
// score, `-1.0` to `1.0`. `available: false` means no news came back for
// this ticker, not an error.
export type SentimentArticle = NewsArticle & {
  compound_score: number;
};

export type SentimentClassification = "Bullish" | "Bearish" | "Neutral";

export type SentimentResponse = {
  ticker: string;
  available: boolean;
  compound_score: number | null;
  classification: SentimentClassification | null;
  article_count: number;
  top_positive: SentimentArticle[];
  top_negative: SentimentArticle[];
};

// Matches backend GET /api/valuation/{ticker}. `available` is False whenever
// any of the four raw DCF inputs is missing (FMP's per-ticker fundamentals
// restriction) -- the frontend must never run the DCF model on a partial set
// of these, since a null defaulted to 0 would silently distort the output.
export type ValuationInputs = {
  ticker: string;
  available: boolean;
  free_cash_flow: number | null;
  total_debt: number | null;
  cash_and_equivalents: number | null;
  shares_outstanding: number | null;
  current_price: number | null;
};

// Matches backend GET /api/screener/volatility. Any of the metric fields can
// be null if a ticker didn't return quite enough trading-day history to
// compute a full 30-day window. `rate_limited: true` means Polygon's 5
// req/min cap was hit mid-screen -- `rows` is a real but partial result, not
// a full pass over the watchlist, so the frontend must say so rather than
// presenting it as complete coverage.
export type ScreenerRow = {
  ticker: string;
  price: number;
  rsi_14: number | null;
  std_dev_30: number | null;
  pct_from_sma_20: number | null;
  std_devs_from_sma: number | null;
};

export type VolatilityScreenerResponse = {
  rows: ScreenerRow[];
  rate_limited: boolean;
  requested_count: number;
  returned_count: number;
};

// Mean-reversion read on a screener row: oversold (RSI < 30 or >2 std devs
// below the 20-day SMA) reads bullish/green, overbought (RSI > 70 or >2 std
// devs above) reads bearish/red, everything else is neutral.
export type ScreenerSignal = "oversold" | "overbought" | "neutral";

export function screenerSignal(row: ScreenerRow): ScreenerSignal {
  const oversold =
    (row.rsi_14 !== null && row.rsi_14 < 30) ||
    (row.std_devs_from_sma !== null && row.std_devs_from_sma < -2);
  const overbought =
    (row.rsi_14 !== null && row.rsi_14 > 70) ||
    (row.std_devs_from_sma !== null && row.std_devs_from_sma > 2);

  if (oversold) return "oversold";
  if (overbought) return "overbought";
  return "neutral";
}

export function screenerRowClasses(signal: ScreenerSignal): string {
  if (signal === "oversold") return "bg-emerald-500/10 hover:bg-emerald-500/15";
  if (signal === "overbought") return "bg-rose-500/10 hover:bg-rose-500/15";
  return "hover:bg-white/[0.03]";
}

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
