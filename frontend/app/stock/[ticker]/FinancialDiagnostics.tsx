import { AnalyzeResponse, cardClassesFor } from "@/app/lib/analysis";

type DiagnosticsData = Pick<
  AnalyzeResponse,
  | "net_profit_margin"
  | "asset_turnover"
  | "financial_leverage"
  | "roe"
  | "piotroski_score"
  | "altman_z_score"
>;

function formatPercent(value: number | null): string {
  return value === null ? "N/A" : `${(value * 100).toFixed(2)}%`;
}

function formatMultiple(value: number | null): string {
  return value === null ? "N/A" : `${value.toFixed(2)}×`;
}

function DiagnosticRow({
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

function altmanZone(value: number | null): { label: string; colorClass: string } {
  if (value === null) return { label: "N/A", colorClass: "text-slate-500" };
  if (value > 2.99) return { label: "Safe Zone", colorClass: "text-emerald-400" };
  if (value >= 1.81) return { label: "Grey Zone", colorClass: "text-amber-400" };
  return { label: "Distress Zone", colorClass: "text-rose-400" };
}

export default function FinancialDiagnostics({
  data,
  isExporting,
}: {
  data: DiagnosticsData;
  isExporting: boolean;
}) {
  const { net_profit_margin, asset_turnover, financial_leverage, roe } = data;

  const computedRoe =
    net_profit_margin !== null && asset_turnover !== null && financial_leverage !== null
      ? net_profit_margin * asset_turnover * financial_leverage
      : null;

  // FMP computes these TTM ratios with slightly different period-averaging
  // methodologies across endpoints, so the product of the three real
  // components won't always exactly equal the separately-reported ROE
  // (verified empirically, e.g. MSFT: 0.393 * 0.458 * 1.675 = 0.302 vs
  // reported 0.331). Flagging the gap honestly rather than silently hiding
  // or fudging it.
  const showsReconciliationNote =
    computedRoe !== null && roe !== null && Math.abs(computedRoe - roe) > 0.02;

  const zone = altmanZone(data.altman_z_score);
  const piotroski = data.piotroski_score;

  const surfaceClasses = isExporting
    ? "bg-gray-50 border border-gray-200"
    : "bg-slate-950/40 border border-slate-700/50";
  const primaryText = isExporting ? "text-gray-900" : "text-slate-100";
  const secondaryText = isExporting ? "text-gray-700" : "text-slate-300";
  const mutedText = isExporting ? "text-gray-500" : "text-slate-500";

  return (
    <div className={`${cardClassesFor(isExporting)} p-4`}>
      <h2 className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
        Financial Diagnostics &amp; Risk
      </h2>

      <div className="mt-4">
        <h3 className="text-[11px] font-semibold tracking-wider text-slate-600 uppercase">
          DuPont ROE Decomposition
        </h3>
        <div className="mt-2 space-y-2">
          <DiagnosticRow
            label="Operating Efficiency (Net Profit Margin)"
            value={formatPercent(net_profit_margin)}
            isExporting={isExporting}
          />
          <DiagnosticRow
            label="Asset Productivity (Asset Turnover)"
            value={formatMultiple(asset_turnover)}
            isExporting={isExporting}
          />
          <DiagnosticRow
            label="Financial Leverage (Equity Multiplier)"
            value={formatMultiple(financial_leverage)}
            isExporting={isExporting}
          />
        </div>

        <div className={`mt-3 rounded-lg px-3 py-2 ${surfaceClasses}`}>
          <div className="flex items-center justify-between font-mono text-sm">
            <span className={secondaryText}>
              {formatPercent(net_profit_margin)} &times; {formatMultiple(asset_turnover)} &times;{" "}
              {formatMultiple(financial_leverage)}
            </span>
            <span className={`font-semibold ${primaryText}`}>= {formatPercent(computedRoe)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-xs">
            <span className={mutedText}>Reported ROE</span>
            <span className={`font-mono ${secondaryText}`}>{formatPercent(roe)}</span>
          </div>
          {showsReconciliationNote && (
            <p className={`mt-1.5 text-[11px] leading-snug ${mutedText}`}>
              Component product differs from reported ROE &mdash; FMP&rsquo;s TTM ratios
              use slightly different period-averaging across endpoints.
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-white/5">
        <h3 className="text-[11px] font-semibold tracking-wider text-slate-600 uppercase">
          Systematic Health Scores
        </h3>
        <div className="mt-2 space-y-3">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">Piotroski F-Score</span>
              <span className={`text-base font-medium font-mono tracking-tight ${primaryText}`}>
                {piotroski === null ? "N/A" : `${piotroski.toFixed(0)} / 9`}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full bg-cyan-500"
                style={{
                  width: piotroski === null ? "0%" : `${(piotroski / 9) * 100}%`,
                }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">Altman Z-Score</span>
            <span className="flex items-baseline gap-2">
              <span className={`text-base font-medium font-mono tracking-tight ${primaryText}`}>
                {data.altman_z_score === null ? "N/A" : data.altman_z_score.toFixed(2)}
              </span>
              <span className={`text-xs font-medium ${zone.colorClass}`}>{zone.label}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
