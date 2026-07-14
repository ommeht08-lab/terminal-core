"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { API_BASE, cardClassesFor } from "@/app/lib/analysis";

type SaveState = "idle" | "unsaved" | "saving" | "saved";
type Tab = "write" | "preview";

const AUTOSAVE_DELAY_MS = 1750;

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "idle") return null;

  const label =
    state === "saving" ? "Saving..." : state === "saved" ? "Saved" : "Unsaved";
  const colorClass =
    state === "saving"
      ? "text-amber-400"
      : state === "saved"
        ? "text-emerald-400"
        : "text-slate-500";

  return (
    <span className={`text-xs font-medium transition-colors ${colorClass}`}>
      {label}
    </span>
  );
}

export default function AnalystNotebook({
  ticker,
  isExporting,
}: {
  ticker: string;
  isExporting: boolean;
}) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [tab, setTab] = useState<Tab>("write");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A raw <textarea> captures blank in html2canvas (it's a form control, not
  // painted content), so a PDF export must always show the rendered Preview
  // pane regardless of which tab the user was last looking at.
  const effectiveTab: Tab = isExporting ? "preview" : tab;

  useEffect(() => {
    let cancelled = false;
    // Client components can persist across a /stock/[ticker] navigation rather
    // than remount, so this state must be reset explicitly when `ticker`
    // changes -- not a stray render-triggering setState, hence the disable.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setSaveState("idle");

    fetch(`${API_BASE}/api/notes/${ticker}`)
      .then((res) => res.json())
      .then((data: { content: string | null }) => {
        if (!cancelled) setContent(data.content ?? "");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [ticker]);

  async function persist(value: string) {
    setSaveState("saving");
    try {
      await fetch(`${API_BASE}/api/notes/${ticker}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: value }),
      });
      setSaveState("saved");
    } catch {
      setSaveState("unsaved");
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    setContent(value);
    setSaveState("unsaved");

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => persist(value), AUTOSAVE_DELAY_MS);
  }

  const surfaceClasses = isExporting
    ? "bg-gray-50 border border-gray-200"
    : "bg-slate-950/40 border border-slate-700/50";

  return (
    <div className={`${cardClassesFor(isExporting)} p-4 flex flex-col h-full`}>
      <div className="flex items-center justify-between shrink-0">
        <h2 className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
          Analyst Notebook
        </h2>
        {!isExporting && <SaveIndicator state={saveState} />}
      </div>

      {!isExporting && (
        <div className="mt-3 flex gap-1 border-b border-white/[0.05] shrink-0">
          {(["write", "preview"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`-mb-px border-b-2 px-3 py-1.5 text-xs font-medium uppercase tracking-wider transition-colors ${
                tab === t
                  ? "border-cyan-500 text-slate-200"
                  : "border-transparent text-slate-500 hover:text-slate-300"
              }`}
            >
              {t === "write" ? "Write" : "Preview"}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 flex-1 min-h-0">
        {effectiveTab === "write" ? (
          <textarea
            value={content}
            onChange={handleChange}
            disabled={loading}
            placeholder="Write your research thesis in Markdown..."
            className={`h-full w-full resize-none rounded-lg px-3 py-2 font-mono text-sm text-slate-100 placeholder:text-slate-600 transition-colors focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 disabled:opacity-50 ${surfaceClasses}`}
          />
        ) : (
          <div className={`h-full overflow-y-auto rounded-lg px-4 py-3 ${surfaceClasses}`}>
            {content.trim() === "" ? (
              <p className="text-sm text-slate-600">Nothing to preview yet.</p>
            ) : (
              <div
                className={`prose prose-sm md:prose-base max-w-none ${
                  isExporting ? "" : "prose-invert"
                }`}
              >
                <ReactMarkdown>{content}</ReactMarkdown>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
