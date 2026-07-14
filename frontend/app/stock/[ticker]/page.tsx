import { API_BASE, AnalyzeResponse } from "@/app/lib/analysis";
import TearSheet from "./TearSheet";

async function getAnalysis(ticker: string): Promise<AnalyzeResponse | null> {
  const res = await fetch(`${API_BASE}/api/analyze/${ticker}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    return null;
  }

  return res.json();
}

export default async function StockPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;
  const data = await getAnalysis(ticker);

  if (!data) {
    return (
      <div className="min-h-screen bg-[#020617]">
        <div className="max-w-5xl mx-auto p-4">
          <p className="text-rose-400">
            Failed to load data for {ticker.toUpperCase()}
          </p>
        </div>
      </div>
    );
  }

  return <TearSheet data={data} />;
}
