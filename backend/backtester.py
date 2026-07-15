import pandas as pd

TRADING_DAYS_PER_YEAR = 252


def run_mean_reversion_backtest(
    df: pd.DataFrame,
    ma_lookback_period: int,
    std_dev_multiplier: float,
    initial_capital: float = 10000.0,
    risk_free_rate: float = 0.04,
) -> dict:
    """Configurable Bollinger-Band mean-reversion backtest for the Telemetry
    page's "Run Historical Backtest" tool: buy when the close drops below
    SMA - multiplier*std (lower band), close the position when it rises
    above SMA + multiplier*std (upper band). Long-only, single position at a
    time. This reimplements the band-crossing rule described in the request
    using the same ma_lookback_period/std_dev_multiplier the Risk Controls
    panel exposes -- it is this app's own simulation, not a verified replica
    of the actual Java execution engine's live logic, which this app has no
    visibility into.

    Distinct from run_backtest() below (the tear sheet's fixed 20-day
    Z-Score strategy) -- different entry/exit rule, configurable window, and
    adds Sharpe ratio + a paired strategy/buy-hold equity curve for charting,
    none of which the tear sheet's version needs.
    """
    closes = df["Close"]
    sma = closes.rolling(window=ma_lookback_period).mean()
    std = closes.rolling(window=ma_lookback_period).std()
    lower_band = sma - std_dev_multiplier * std
    upper_band = sma + std_dev_multiplier * std

    cash = initial_capital
    shares = 0.0
    holding = False
    buy_price = None
    completed_trades = []
    strategy_equity = []

    for close, lower, upper in zip(closes, lower_band, upper_band):
        if pd.notna(lower) and pd.notna(upper):
            if not holding and close < lower:
                shares = cash / close
                cash = 0.0
                holding = True
                buy_price = close
            elif holding and close > upper:
                cash = shares * close
                completed_trades.append((buy_price, close))
                shares = 0.0
                holding = False
                buy_price = None

        strategy_equity.append(shares * close if holding else cash)

    strategy_series = pd.Series(strategy_equity, index=df.index)

    first_close = closes.iloc[0]
    buy_hold_shares = initial_capital / first_close
    buy_hold_series = closes * buy_hold_shares

    final_equity = strategy_series.iloc[-1] if len(strategy_series) else initial_capital
    total_return = (final_equity / initial_capital - 1) * 100

    running_max = strategy_series.cummax()
    drawdown = (strategy_series - running_max) / running_max * 100
    max_drawdown = drawdown.min()
    if pd.isna(max_drawdown):
        max_drawdown = 0.0

    total_trades = len(completed_trades)
    if total_trades == 0:
        win_rate = 0.0
    else:
        wins = sum(1 for buy, sell in completed_trades if sell > buy)
        win_rate = (wins / total_trades) * 100

    # Sharpe uses the strategy's own daily returns against a daily-equivalent
    # of the annual risk-free rate -- standard geometric decomposition, not
    # a flat rate/252 approximation.
    daily_returns = strategy_series.pct_change().dropna()
    daily_risk_free = (1 + risk_free_rate) ** (1 / TRADING_DAYS_PER_YEAR) - 1
    excess_returns = daily_returns - daily_risk_free
    if len(excess_returns) > 1 and excess_returns.std() != 0:
        sharpe_ratio = (excess_returns.mean() / excess_returns.std()) * (
            TRADING_DAYS_PER_YEAR**0.5
        )
    else:
        sharpe_ratio = 0.0

    equity_curve = [
        {
            "date": date.strftime("%Y-%m-%d"),
            "strategy_equity": round(float(strat), 2),
            "buy_hold_equity": round(float(bh), 2),
        }
        for date, strat, bh in zip(df.index, strategy_series, buy_hold_series)
    ]

    return {
        "total_return": round(float(total_return), 2),
        "sharpe_ratio": round(float(sharpe_ratio), 2),
        "max_drawdown": round(float(max_drawdown), 2),
        "win_rate": round(float(win_rate), 2),
        "total_trades": total_trades,
        "equity_curve": equity_curve,
    }


def run_backtest(
    df: pd.DataFrame, initial_capital: float = 10000.0, years: float = 5.0
) -> dict:
    """Simulate a Z-Score mean-reversion strategy: buy when z_score <= -2.0,
    sell when z_score >= 0.0. Requires df to already have a 'Z_Score_20' column.
    """
    closes = df["Close"]
    z_scores = df["Z_Score_20"]

    cash = initial_capital
    shares = 0.0
    holding = False
    buy_price = None
    completed_trades = []
    equity_curve = []

    for close, z in zip(closes, z_scores):
        if pd.notna(z):
            if not holding and z <= -2.0:
                shares = cash / close
                cash = 0.0
                holding = True
                buy_price = close
            elif holding and z >= 0.0:
                cash = shares * close
                completed_trades.append((buy_price, close))
                shares = 0.0
                holding = False
                buy_price = None

        equity_curve.append(shares * close if holding else cash)

    equity_series = pd.Series(equity_curve, index=df.index)
    final_equity = equity_series.iloc[-1] if len(equity_series) else initial_capital

    strategy_return = (final_equity / initial_capital - 1) * 100

    first_close = closes.iloc[0]
    last_close = closes.iloc[-1]
    buy_hold_return = (last_close / first_close - 1) * 100

    cagr = ((final_equity / initial_capital) ** (1 / years) - 1) * 100

    running_max = equity_series.cummax()
    drawdown = (equity_series - running_max) / running_max * 100
    max_drawdown = drawdown.min()
    if pd.isna(max_drawdown):
        max_drawdown = 0.0

    total_trades = len(completed_trades)
    if total_trades == 0:
        win_rate = 0.0
    else:
        wins = sum(1 for buy, sell in completed_trades if sell > buy)
        win_rate = (wins / total_trades) * 100

    return {
        "strategy_return": round(strategy_return, 2),
        "buy_hold_return": round(buy_hold_return, 2),
        "cagr": round(cagr, 2),
        "max_drawdown": round(max_drawdown, 2),
        "win_rate": round(win_rate, 2),
        "total_trades": total_trades,
    }
