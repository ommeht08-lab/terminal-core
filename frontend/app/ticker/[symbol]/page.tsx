import { API_BASE, ValuationInputs, cardClasses } from "@/app/lib/analysis";
import ValuationTool from "./ValuationTool";

function unavailable(ticker: string): ValuationInputs {
  return {
    ticker,
    available: false,
    free_cash_flow: null,
    total_debt: null,
    cash_and_equivalents: null,
    shares_outstanding: null,
    current_price: null,
  };
}

// Real FMP fundamentals only -- a fetch failure and a "ticker not covered"
// response both resolve to the same unavailable() shape, so the page always
// renders a clean data-unavailable state instead of crashing or fabricating
// DCF inputs.
async function getValuationInputs(ticker: string): Promise<ValuationInputs> {
  try {
    const res = await fetch(`${API_BASE}/api/valuation/${ticker}`, { cache: "no-store" });
    if (!res.ok) return unavailable(ticker);
    return await res.json();
  } catch {
    return unavailable(ticker);
  }
}

export default async function ValuationPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = await params;
  const ticker = symbol.toUpperCase();
  const inputs = await getValuationInputs(ticker);

  return (
    <div className="min-h-screen bg-[#020617]">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-mono">{ticker}</h1>
          <p className="mt-1 text-sm text-slate-500">
            Interactive discounted cash flow valuation.
          </p>
        </div>

        {inputs.available ? (
          <ValuationTool inputs={inputs} />
        ) : (
          <div className={`${cardClasses} p-8 text-center`}>
            <p className="text-sm text-slate-500">
              Valuation data isn&rsquo;t available for {ticker} right now &mdash; FMP may not
              report full fundamentals for this ticker on the current plan, or the ticker
              doesn&rsquo;t exist.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
