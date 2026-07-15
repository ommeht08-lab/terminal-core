import Link from "next/link";
import { API_BASE, RecentThesis, cardClasses } from "@/app/lib/analysis";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatThesisDate(updatedAt: string | null): string | null {
  if (!updatedAt) return null;
  const parsed = new Date(updatedAt);
  return Number.isNaN(parsed.getTime()) ? null : dateFormatter.format(parsed);
}

// Real journal data only -- no mock/placeholder theses. A fetch failure or an
// empty journal both resolve to [], and the page renders its own "no theses
// yet" state rather than ever falling back to fabricated content.
async function getRecentTheses(): Promise<RecentThesis[]> {
  try {
    const res = await fetch(`${API_BASE}/api/journal/recent`, { cache: "no-store" });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export default async function LandingPage() {
  const theses = await getRecentTheses();

  return (
    <div className="min-h-screen flex flex-col">
      <section className="px-6 pt-24 pb-20 text-center">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-100 via-slate-100 to-cyan-400">
          Prism Quantitative
        </h1>
        <p className="mt-5 max-w-xl mx-auto text-base md:text-lg text-slate-400">
          A student-built equity research platform by Om Mehta, focused on
          business quality, valuation discipline, and thesis-driven investing.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-sm font-semibold px-5 py-2.5 transition-colors"
          >
            Active Coverage
          </Link>
          {/* TODO: point at the real GitHub/LinkedIn URL once supplied. */}
          <Link
            href="#"
            className="rounded-lg bg-slate-900/40 border border-slate-700/50 hover:bg-slate-900/60 text-slate-300 text-sm font-medium px-5 py-2.5 transition-colors"
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
          {theses.length === 0 ? (
            <div className={`mt-4 ${cardClasses} p-8 text-center`}>
              <p className="text-sm text-slate-500">No recent theses published yet.</p>
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {theses.map((item) => (
                <div key={item.ticker} className={`${cardClasses} p-6 flex flex-col`}>
                  <div className="flex items-baseline justify-between gap-3">
                    <div>
                      <span className="font-mono font-bold text-lg text-slate-100">
                        {item.ticker}
                      </span>
                      {item.name && (
                        <span className="ml-2 text-sm text-slate-500">{item.name}</span>
                      )}
                    </div>
                    {formatThesisDate(item.updated_at) && (
                      <span className="text-xs text-slate-500 whitespace-nowrap">
                        {formatThesisDate(item.updated_at)}
                      </span>
                    )}
                  </div>
                  <p className="mt-3 text-sm text-slate-300 leading-relaxed flex-1">
                    {item.excerpt}
                  </p>
                  <Link
                    href={`/stock/${item.ticker}`}
                    className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    View Tear Sheet
                    <span aria-hidden>&rarr;</span>
                  </Link>
                </div>
              ))}
            </div>
          )}
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
            {/* TODO(om): add more accomplishments/activities here once supplied --
                a prior draft incorrectly credited a nonprofit founding that
                isn't accurate; removed rather than left in place. */}
            <ul className="mt-4 space-y-1.5 text-sm text-slate-400">
              <li className="flex gap-2">
                <span className="text-slate-600">&mdash;</span>
                DECA Officer
              </li>
            </ul>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-800/60 px-6 py-8">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <span>Prism Quantitative &middot; Built with Next.js 16, FastAPI, Postgres, Polygon &amp; FMP</span>
          <span>&copy; 2026 Om Mehta</span>
        </div>
      </footer>
    </div>
  );
}
