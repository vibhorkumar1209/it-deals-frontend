// Shared helpers for displaying real Gemini API usage (tokens + cost) per
// saved report. `usage` is the {calls, grounded_calls, input_tokens,
// output_tokens, cost_usd} object the backend embeds in each SSE "complete"
// event — see usage_logger.py get_usage_by_run().

export function formatUsage(usage) {
  if (!usage || !usage.calls) return null;
  const tokens = (usage.input_tokens || 0) + (usage.output_tokens || 0);
  const tokStr = tokens >= 1000 ? `${(tokens / 1000).toFixed(1)}K tok` : `${tokens} tok`;
  const cost = usage.cost_usd || 0;
  const costStr = cost < 0.01 ? `$${cost.toFixed(4)}` : `$${cost.toFixed(3)}`;
  return `${costStr} · ${tokStr} · ${usage.calls} call${usage.calls === 1 ? "" : "s"}`;
}

export function UsageBadge({ usage, style }) {
  const label = formatUsage(usage);
  if (!label) return null;
  return (
    <span
      style={{
        fontSize: 10,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
        color: "#64748b",
        background: "rgba(100,116,139,0.1)",
        padding: "2px 6px",
        borderRadius: 4,
        fontWeight: 600,
        whiteSpace: "nowrap",
        ...style,
      }}
      title={usage ? `${usage.input_tokens ?? 0} input + ${usage.output_tokens ?? 0} output tokens, ${usage.grounded_calls ?? 0} grounded call(s)` : undefined}
    >
      {label}
    </span>
  );
}

// Small pill marking a history entry as generated outside this browser (a
// direct API call, curl, automation, another client) — the server ledger
// knows it happened and what it cost, but full row/result data was never
// saved to THIS browser's localStorage, so it can't be opened for detail.
export function ApiOriginBadge({ style }) {
  return (
    <span
      style={{
        fontSize: 9,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
        color: "#a78bfa",
        background: "rgba(167,139,250,0.12)",
        padding: "2px 6px",
        borderRadius: 4,
        fontWeight: 700,
        letterSpacing: "0.03em",
        whiteSpace: "nowrap",
        ...style,
      }}
      title="Generated via a direct API call — cost is real, but full report data wasn't saved to this browser"
    >
      VIA API
    </span>
  );
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4001";

/** Fetch server-recorded report summaries for one module — includes reports
 *  triggered by ANY caller (this browser, another browser, curl, automation),
 *  not just ones this browser's own JS happened to save to localStorage. */
export async function fetchServerReports(module, limit = 100) {
  try {
    const res = await fetch(`${API_URL}/api/reports?module=${encodeURIComponent(module)}&limit=${limit}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.reports) ? data.reports : [];
  } catch {
    return [];
  }
}

/** Merge a browser's localStorage history (full data, keyed by numeric id)
 *  with the server ledger (summary + cost only, keyed by run_id). Entries
 *  present in both are deduped in favor of the local (full-data) copy;
 *  server-only entries — reports this browser never saw — are added with
 *  `_apiOnly: true` so the UI can mark them and skip click-to-view. */
export function mergeReportHistory(localEntries, serverReports) {
  const localRunIds = new Set(localEntries.map(e => e.run_id).filter(Boolean));
  const apiOnly = serverReports
    .filter(r => !localRunIds.has(r.run_id))
    .map(r => ({
      id: r.run_id,
      run_id: r.run_id,
      date: new Date(r.ts * 1000).toISOString(),
      target: r.target,
      companies: r.target ? r.target.split(", ") : [],
      company: r.target,
      query: r.target,
      summary: r.summary,
      usage: r.usage,
      _apiOnly: true,
    }));
  return [...localEntries, ...apiOnly].sort((a, b) => new Date(b.date) - new Date(a.date));
}

/** Fetch one report's full record (metadata + result data) — for opening an
 *  `_apiOnly` history entry (one this browser's own localStorage never saw)
 *  for full detail, not just a cost summary. */
export async function fetchFullReport(runId) {
  try {
    const res = await fetch(`${API_URL}/api/reports/${runId}`);
    if (!res.ok) return null;
    return await res.json(); // {run_id, ts, module, target, summary, usage, data}
  } catch {
    return null;
  }
}

/** Resolve an `_apiOnly` history entry into a fully-openable one by fetching
 *  its full data from the server and merging it in. `data`'s keys are saved
 *  server-side using each module's own local-entry field names (rows,
 *  results, capRows, etc. — see report_store.py callers in main.py), so a
 *  plain spread reproduces exactly what a local entry looks like. Returns
 *  the entry unchanged if it wasn't `_apiOnly`, or null if the fetch failed. */
export async function resolveApiOnlyEntry(entry) {
  if (!entry?._apiOnly) return entry;
  const full = await fetchFullReport(entry.run_id);
  if (!full) return null;
  return { ...entry, ...(full.data || {}), usage: full.usage ?? entry.usage, _apiOnly: false };
}
