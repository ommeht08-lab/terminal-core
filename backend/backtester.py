import pandas as pd


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
