import Link from "next/link";
import { API_BASE, cardClasses } from "@/app/lib/analysis";

type NoteEntry = {
  ticker: string;
  content: string;
  updated_at: string;
};

async function getNotes(): Promise<NoteEntry[]> {
  const res = await fetch(`${API_BASE}/api/notes`, {
    cache: "no-store",
  });

  if (!res.ok) {
    return [];
  }

  return res.json();
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function JournalPage() {
  const notes = await getNotes();

  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto py-12 px-6">
        <h1 className="text-2xl font-bold tracking-tight">Research Journal</h1>

        {notes.length === 0 ? (
          <div className={`mt-8 ${cardClasses} p-16 flex items-center justify-center`}>
            <p className="text-slate-500 text-sm">
              No research notes published yet.
            </p>
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            {notes.map((note) => (
              <article
                key={note.ticker}
                className={`${cardClasses} p-6`}
              >
                <div className="flex items-baseline justify-between gap-4">
                  <Link
                    href={`/stock/${note.ticker}`}
                    className="text-lg font-bold text-slate-100 hover:text-white hover:underline transition-colors"
                  >
                    {note.ticker}
                  </Link>
                  <span className="text-xs text-slate-500 whitespace-nowrap">
                    {formatDate(note.updated_at)}
                  </span>
                </div>
                <p className="mt-4 text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {note.content}
                </p>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
