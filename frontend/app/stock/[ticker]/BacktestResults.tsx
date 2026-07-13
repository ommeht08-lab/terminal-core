import { BacktestResult, cardClassesFor } from "@/app/lib/analysis";

function signColorClass(value: number): string {
  if (value > 0) return "text-emerald-400";
  if (value < 0) return "text-rose-400";
  return "text-slate-300";
}

function Row({
  label,
  value,
  colorClass,
  isExporting,
}: {
  label: string;
  value: string;
  colorClass?: string;
  isExporting: boolean;
}) {
  // text-slate-100/300 read fine on the dark theme but are near-invisible on
  // the white export background, so the default (no explicit sign color)
  // falls back to a dark, legible color while exporting.
  const resolvedColorClass = colorClass ?? (isExporting ? "text-gray-900" : "text-slate-100");

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-500">{label}</span>
      <span className={`text-base font-medium font-mono tracking-tight ${resolvedColorClass}`}>
        {value}
      </span>
    </div>
  );
}

export default function BacktestResults({
  backtest,
  isExporting,
}: {
  backtest: BacktestResult;
  isExporting: boolean;
}) {
  return (
    <div className={`${cardClassesFor(isExporting)} p-4`}>
      <h2 className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
        Backtest
      </h2>
      <div className="mt-3 space-y-2">
        <Row
          label="Strategy Return"
          value={`${backtest.strategy_return.toFixed(2)}%`}
          colorClass={signColorClass(backtest.strategy_return)}
          isExporting={isExporting}
        />
        <Row
          label="Buy & Hold Return"
          value={`${backtest.buy_hold_return.toFixed(2)}%`}
          colorClass={signColorClass(backtest.buy_hold_return)}
          isExporting={isExporting}
        />
        <Row
          label="CAGR"
          value={`${backtest.cagr.toFixed(2)}%`}
          colorClass={signColorClass(backtest.cagr)}
          isExporting={isExporting}
        />
        <Row
          label="Max Drawdown"
          value={`${backtest.max_drawdown.toFixed(2)}%`}
          colorClass={backtest.max_drawdown < 0 ? "text-rose-400" : undefined}
          isExporting={isExporting}
        />
        <Row
          label="Win Rate"
          value={`${backtest.win_rate.toFixed(2)}%`}
          isExporting={isExporting}
        />
        <Row
          label="Total Trades"
          value={backtest.total_trades.toString()}
          isExporting={isExporting}
        />
      </div>
    </div>
  );
}
