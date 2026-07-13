import Link from "next/link";
import { cardClasses } from "@/app/lib/analysis";

type FeaturedThesis = {
  ticker: string;
  name: string;
  thesis: string;
  date: string;
};

const FEATURED_THESES: FeaturedThesis[] = [
  {
    ticker: "AAPL",
    name: "Apple Inc.",
    thesis:
      "Services mix-shift and installed-base loyalty support durable margin expansion even as hardware unit growth normalizes.",
    date: "Jun 18, 2026",
  },
  {
    ticker: "MSFT",
    name: "Microsoft Corporation",
    thesis:
      "Azure's AI-driven consumption growth and Copilot attach rates justify a premium multiple relative to legacy enterprise software peers.",
    date: "Jun 2, 2026",
  },
  {
    ticker: "CRWD",
    name: "CrowdStrike Holdings",
    thesis:
      "Platform consolidation into the Falcon suite drives net-retention expansion, though valuation leaves little room for execution missteps.",
    date: "May 21, 2026",
  },
  {
    ticker: "NVDA",
    name: "NVIDIA Corporation",
    thesis:
      "The full-stack AI infrastructure moat remains intact, but the thesis hinges on hyperscaler capex discipline holding through the cycle.",
    date: "May 9, 2026",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <section className="px-6 pt-24 pb-20 text-center">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
          Om Mehta Equity Research
        </h1>
        <p className="mt-5 max-w-xl mx-auto text-base md:text-lg text-slate-400">
          A student-built platform focused on business quality, valuation
          discipline, and thesis-driven investing.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-medium px-5 py-2.5 transition-colors"
          >
            Enter Terminal
          </Link>
          {/* TODO: point at the real GitHub/LinkedIn URL once supplied. */}
          <Link
            href="#"
            className="rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 text-sm font-medium px-5 py-2.5 transition-colors"
          >
            View on GitHub
          </Link>
        </div>
      </section>

      <section className="px-6 pb-24 flex-1">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
            Recent Theses
          </h2>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {FEATURED_THESES.map((item) => (
              <div key={item.ticker} className={`${cardClasses} p-6 flex flex-col`}>
                <div className="flex items-baseline justify-between gap-3">
                  <div>
                    <span className="font-mono font-bold text-lg text-slate-100">
                      {item.ticker}
                    </span>
                    <span className="ml-2 text-sm text-slate-500">{item.name}</span>
                  </div>
                  <span className="text-xs text-slate-500 whitespace-nowrap">
                    {item.date}
                  </span>
                </div>
                <p className="mt-3 text-sm text-slate-300 leading-relaxed flex-1">
                  {item.thesis}
                </p>
                <Link
                  href={`/stock/${item.ticker}`}
                  className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  View Tear Sheet
                  <span aria-hidden>&rarr;</span>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 pb-24">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
            About the Founder
          </h2>
          <div className={`mt-4 ${cardClasses} p-6`}>
            <p className="text-sm text-slate-300 leading-relaxed">
              Founded by Om Mehta, a junior at Rock Ridge High School. This
              isn&rsquo;t a class project &mdash; it&rsquo;s a working tool I
              built to practice reading filings, backtesting signals, and
              writing theses the way a real analyst would.
            </p>
            <ul className="mt-4 space-y-1.5 text-sm text-slate-400">
              <li className="flex gap-2">
                <span className="text-slate-600">&mdash;</span>
                DECA Officer
              </li>
              <li className="flex gap-2">
                <span className="text-slate-600">&mdash;</span>
                Founded DiaCare, a nonprofit focused on community awareness
                and free clinic donations
              </li>
            </ul>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/5 px-6 py-8">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <span>Built with Next.js 16 &middot; FastAPI &middot; SQLite &middot; Python</span>
          <span>&copy; 2026 Om Mehta</span>
        </div>
      </footer>
    </div>
  );
}
