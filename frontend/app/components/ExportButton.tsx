"use client";

export default function ExportButton({
  isExporting,
  onExport,
}: {
  isExporting: boolean;
  onExport: () => void;
}) {
  return (
    <button
      onClick={onExport}
      disabled={isExporting}
      className="inline-flex items-center gap-2 bg-slate-900/40 border border-slate-700/50 hover:bg-slate-900/60 text-slate-300 text-sm px-4 py-2 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isExporting && (
        <span className="h-3.5 w-3.5 rounded-full border-2 border-slate-400 border-t-transparent animate-spin" />
      )}
      {isExporting ? "Exporting..." : "Export Tear Sheet"}
    </button>
  );
}
