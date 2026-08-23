"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Search, Trash2, X, ExternalLink, Library, Maximize2, Minimize2 } from "lucide-react";
import { UsageBadge, ApiOriginBadge, fetchServerReports, mergeReportHistory, resolveApiOnlyEntry } from "../lib/usage";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4001";

// ── Module registry — one entry per module with a Report History feature ──────
// localKey: the localStorage key that module's own component reads/writes.
// Keep in sync with the *_HIST_KEY constants in each module's own file.
const MODULES = [
  { key: "it_deal_finder",           label: "IT Deal Finder",          accent: "#3491E8", localKey: "it_deal_finder_history" },
  { key: "tech_stack_finder",        label: "Tech Stack Finder",       accent: "#818cf8", localKey: "it_tech_stack_history" },
  { key: "compkill",                 label: "CompKill",                accent: "#E63946", localKey: "competitive_intel_history" },
  { key: "signal_intelligence",      label: "Signal Intelligence",     accent: "#fbbf24", localKey: "signal_intel_history" },
  { key: "gcc_intelligence",         label: "GCC Intelligence",        accent: "#f472b6", localKey: "gcc_intel_v2_history" },
  { key: "aftermarket_intelligence", label: "Aftermarket Deep Dive",   accent: "#34d399", localKey: "aftermarket_history" },
  { key: "it_deals_by_industry",     label: "IT Deals by Industry",    accent: "#22d3ee", localKey: "industry_deals_history" },
];
const MODULE_BY_KEY = Object.fromEntries(MODULES.map(m => [m.key, m]));

function loadLocal(localKey) {
  try {
    const r = JSON.parse(localStorage.getItem(localKey) ?? "[]");
    return Array.isArray(r) ? r : [];
  } catch {
    return [];
  }
}

function saveLocal(localKey, list) {
  try { localStorage.setItem(localKey, JSON.stringify(list)); } catch {}
}

// ── Per-module title / detail extraction (mirrors what each module's own
//    History panel shows) — falls back to the generic server summary for
//    entries that haven't been resolved from `_apiOnly` yet. ────────────────
function entryTitle(moduleKey, e) {
  if (e._apiOnly) return e.target || "Untitled";
  switch (moduleKey) {
    case "it_deal_finder":
    case "tech_stack_finder": {
      const cos = e.companies || [];
      return cos.slice(0, 2).join(", ") + (cos.length > 2 ? ` +${cos.length - 2}` : "") || "Untitled";
    }
    case "compkill": return e.target || "Untitled";
    case "signal_intelligence": return e.companies || "Untitled";
    case "gcc_intelligence": return e.query || "Untitled";
    case "aftermarket_intelligence": return e.company || "Untitled";
    case "it_deals_by_industry": return `${e.industry || ""}${e.geography ? ` · ${e.geography}` : ""}` || "Untitled";
    default: return e.target || e.company || e.query || "Untitled";
  }
}

function entryCount(moduleKey, e) {
  if (e._apiOnly) return e.summary || "";
  switch (moduleKey) {
    case "it_deal_finder": return `${(e.rows || []).length} deals`;
    case "tech_stack_finder": return `${(e.rows || []).filter(r => r._status === "ok").length} tools`;
    case "compkill": return `${(e.competitors || []).length} competitors · ${(e.modules || []).length} modules`;
    case "signal_intelligence": return `${e.total ?? (e.rows || []).length} signals`;
    case "gcc_intelligence": return `${(e.results || []).length} location${(e.results || []).length === 1 ? "" : "s"}`;
    case "aftermarket_intelligence": return e.summary || `${(e.capRows || []).length} capabilities`;
    case "it_deals_by_industry": return `${(e.allDeals || []).length} deals · ${(e.renewalDeals || []).length} in renewal window`;
    default: return e.summary || "";
  }
}

function formatDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch { return ""; }
}
function formatTime(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

// ── Cost cell with hover breakdown ─────────────────────────────────────────
function CostCell({ usage }) {
  const [hover, setHover] = useState(false);
  if (!usage || !usage.calls) return <span style={{ fontSize: 11, color: "#334155" }}>—</span>;
  const tokens = (usage.input_tokens || 0) + (usage.output_tokens || 0);
  const cost = usage.cost_usd || 0;
  return (
    <div style={{ position: "relative", display: "inline-block" }} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0", fontFamily: "ui-monospace,monospace" }}>
        ${cost < 0.01 ? cost.toFixed(4) : cost.toFixed(3)}
      </div>
      <div style={{ fontSize: 10, color: "#64748b", fontFamily: "ui-monospace,monospace" }}>
        {tokens >= 1000 ? `${(tokens / 1000).toFixed(1)}K tok` : `${tokens} tok`}
      </div>
      {hover && (
        <div style={{
          position: "absolute", bottom: "100%", left: 0, marginBottom: 6, zIndex: 30,
          background: "#0c1f2e", color: "#e2e8f0", borderRadius: 8, padding: "10px 14px",
          fontSize: 11, lineHeight: 1.7, whiteSpace: "nowrap", boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
          border: "1px solid #1a3a50",
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4, color: "#3491E8" }}>Real measured usage</div>
          <div>{usage.calls} Gemini calls ({usage.grounded_calls ?? 0} grounded)</div>
          <div>{(usage.input_tokens || 0).toLocaleString()} in + {(usage.output_tokens || 0).toLocaleString()} out tokens</div>
          <div style={{ borderTop: "1px solid #1a3a50", marginTop: 4, paddingTop: 4, fontWeight: 700 }}>
            Total: ${cost.toFixed(4)}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Generic table for an array of row objects — auto-derives columns from
//    the union of keys present, skips internal (_-prefixed) fields, and
//    stringifies nested objects/arrays so any module's shape renders. ──────
function AutoTable({ rows }) {
  if (!rows || !rows.length) return <div style={{ padding: 20, fontSize: 12, color: "#475569" }}>No rows.</div>;
  const cols = [...new Set(rows.flatMap(r => Object.keys(r || {})))].filter(k => !k.startsWith("_"));
  const cell = (v) => {
    if (v == null || v === "") return "—";
    if (Array.isArray(v)) return v.map(x => typeof x === "object" ? JSON.stringify(x) : String(x)).join(", ");
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
  };
  return (
    <div style={{ overflowX: "auto", maxHeight: 420, overflowY: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ position: "sticky", top: 0, background: "#0c1f2e" }}>
            {cols.map(c => (
              <th key={c} style={{ padding: "8px 10px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#64748b", letterSpacing: "0.04em", whiteSpace: "nowrap", borderBottom: "1px solid #1a3a50" }}>
                {c.replace(/_/g, " ").toUpperCase()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              {cols.map(c => (
                <td key={c} style={{ padding: "7px 10px", verticalAlign: "top", color: "#cbd5e1", maxWidth: 280 }}>
                  {cell(r[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Detail modal — resolves the data arrays for whichever module the entry
//    belongs to, with sub-tabs for modules that have more than one table. ──
function ReportDetailModal({ entry, moduleKey, onClose }) {
  const meta = MODULE_BY_KEY[moduleKey];
  const tables = useMemo(() => {
    switch (moduleKey) {
      case "it_deal_finder":
      case "tech_stack_finder":
        return [{ id: "rows", label: "Rows", rows: entry.rows || [] }];
      case "compkill": {
        const flat = (entry.results || []).flatMap(co =>
          (co.modules || []).map(m => ({ company: co.company, is_target: co.is_target, module: m.module, confidence: m.confidence, ...(m.data || {}) }))
        );
        return [{ id: "results", label: "Modules", rows: flat }];
      }
      case "signal_intelligence":
        return [{ id: "rows", label: "Signals", rows: entry.rows || [] }];
      case "gcc_intelligence":
        return [{ id: "results", label: "Locations", rows: entry.results || [] }];
      case "aftermarket_intelligence":
        return [
          { id: "capRows", label: "Capabilities", rows: entry.capRows || [] },
          { id: "spendRows", label: "Spend by Module", rows: entry.spendRows || [] },
          { id: "aggRows", label: "Aggregate Spend", rows: entry.aggRows || [] },
          { id: "spendDealRows", label: "IT Deals", rows: entry.spendDealRows || [] },
          { id: "readyRows", label: "Readiness", rows: entry.readyRows || [] },
          { id: "compRows", label: "Competitors", rows: entry.compRows || [] },
        ].filter(t => t.rows.length > 0);
      case "it_deals_by_industry":
        return [
          { id: "renewalDeals", label: `Renewal Deals (${(entry.renewalDeals || []).length})`, rows: entry.renewalDeals || [] },
          { id: "allDeals", label: `All Deals (${(entry.allDeals || []).length})`, rows: entry.allDeals || [] },
        ];
      default:
        return [];
    }
  }, [moduleKey, entry]);

  const [activeTable, setActiveTable] = useState(tables[0]?.id);
  const current = tables.find(t => t.id === activeTable) || tables[0];
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", padding: fullscreen ? 0 : 24 }}>
      <div onClick={e => e.stopPropagation()} style={fullscreen
        ? { background: "#080f16", border: "1px solid #1a3a50", borderRadius: 0, width: "100vw", maxWidth: "100vw", height: "100vh", maxHeight: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }
        : { background: "#080f16", border: "1px solid #1a3a50", borderRadius: 14, width: "100%", maxWidth: 1000, maxHeight: "85vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: "1px solid #1a3a50" }}>
          <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 10, color: meta?.accent, background: `${meta?.accent}20`, border: `1px solid ${meta?.accent}40` }}>
            {meta?.label}
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0" }}>{entryTitle(moduleKey, entry)}</div>
            <div style={{ fontSize: 11, color: "#64748b" }}>{formatDate(entry.date)} · {formatTime(entry.date)}</div>
          </div>
          <UsageBadge usage={entry.usage} />
          <button onClick={() => setFullscreen(f => !f)} title={fullscreen ? "Exit full screen" : "Expand to full screen"} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", display: "flex", alignItems: "center" }}>
            {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer" }}><X size={18} /></button>
        </div>

        {entry.synthesis && (
          <div style={{ padding: "14px 20px", borderBottom: "1px solid #1a3a50", fontSize: 12, color: "#94a3b8", lineHeight: 1.7, maxHeight: 160, overflowY: "auto" }}>
            {entry.synthesis}
          </div>
        )}

        {tables.length > 1 && (
          <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #1a3a50", padding: "0 20px" }}>
            {tables.map(t => (
              <button key={t.id} onClick={() => setActiveTable(t.id)}
                style={{
                  padding: "9px 16px", fontSize: 12, fontWeight: activeTable === t.id ? 700 : 500,
                  color: activeTable === t.id ? meta?.accent : "#64748b", background: "transparent", border: "none",
                  borderBottom: activeTable === t.id ? `2px solid ${meta?.accent}` : "2px solid transparent", cursor: "pointer",
                }}>
                {t.label}
              </button>
            ))}
          </div>
        )}

        <div style={{ flex: 1, overflow: "auto", padding: "12px 20px 20px" }}>
          <AutoTable rows={current?.rows} />
        </div>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const [entries, setEntries] = useState([]); // [{...entry, _module}]
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [resolvingId, setResolvingId] = useState(null);
  const [viewing, setViewing] = useState(null); // {entry, module}

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [allServer] = await Promise.all([fetchServerReports("", 500)]);
    const byModule = {};
    for (const r of allServer) (byModule[r.module] ??= []).push(r);

    const combined = [];
    for (const m of MODULES) {
      const local = loadLocal(m.localKey).map(e => ({ ...e, _module: m.key }));
      const merged = mergeReportHistory(local, byModule[m.key] || []).map(e => ({ ...e, _module: m.key }));
      combined.push(...merged);
    }
    combined.sort((a, b) => new Date(b.date) - new Date(a.date));
    setEntries(combined);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const filtered = useMemo(() => {
    return entries.filter(e => {
      if (typeFilter !== "all" && e._module !== typeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const title = entryTitle(e._module, e).toLowerCase();
        const count = entryCount(e._module, e).toLowerCase();
        if (!title.includes(q) && !count.includes(q)) return false;
      }
      return true;
    });
  }, [entries, typeFilter, search]);

  const typeCounts = useMemo(() => {
    const counts = { all: entries.length };
    for (const e of entries) counts[e._module] = (counts[e._module] || 0) + 1;
    return counts;
  }, [entries]);

  async function handleView(e) {
    let full = e;
    if (e._apiOnly) {
      setResolvingId(e.id);
      full = await resolveApiOnlyEntry(e);
      setResolvingId(null);
      if (!full) { alert("Could not load this report — it may have expired."); return; }
    }
    setViewing({ entry: full, module: e._module });
  }

  function handleDelete(e) {
    const m = MODULE_BY_KEY[e._module];
    if (!e._apiOnly && m) {
      const local = loadLocal(m.localKey).filter(x => x.id !== e.id);
      saveLocal(m.localKey, local);
    }
    if (e.run_id) {
      fetch(`${API_URL}/api/reports/${e.run_id}`, { method: "DELETE" }).catch(() => {});
    }
    setEntries(prev => prev.filter(x => !(x._module === e._module && x.id === e.id)));
    setConfirmDelete(null);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#080f16", color: "#e2e8f0", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #0c1f2e, #123147)", borderBottom: "1px solid #1a3a50", padding: "20px 32px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", gap: 16 }}>
          <a href="/enrich" style={{ color: "rgba(226,232,240,0.6)", textDecoration: "none", fontSize: 13, display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            ← Back
          </a>
          <div style={{ width: 1, height: 16, background: "#1a3a50", flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, color: "#3491E8", marginBottom: 3 }}>LIBRARY</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Library size={20} color="#3491E8" />
              <span style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>Report History</span>
            </div>
          </div>
          <div style={{ fontSize: 13, color: "#64748b" }}>
            {entries.length} total report{entries.length !== 1 ? "s" : ""}
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, maxWidth: 1200, margin: "0 auto", width: "100%", padding: "24px 32px" }}>

        {/* Type filter pills */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          <button onClick={() => setTypeFilter("all")} style={{
            padding: "7px 14px", fontSize: 12, fontWeight: 600, borderRadius: 20,
            border: `1px solid ${typeFilter === "all" ? "#3491E8" : "#1a3a50"}`,
            background: typeFilter === "all" ? "rgba(52,145,232,0.15)" : "transparent",
            color: typeFilter === "all" ? "#3491E8" : "#64748b", cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
          }}>
            All Types
            <span style={{ fontSize: 10, opacity: 0.8, background: typeFilter === "all" ? "rgba(52,145,232,0.2)" : "rgba(100,116,139,0.15)", borderRadius: 8, padding: "1px 6px" }}>
              {typeCounts.all || 0}
            </span>
          </button>
          {MODULES.filter(m => typeCounts[m.key] > 0).map(m => {
            const active = typeFilter === m.key;
            return (
              <button key={m.key} onClick={() => setTypeFilter(m.key)} style={{
                padding: "7px 14px", fontSize: 12, fontWeight: 600, borderRadius: 20,
                border: `1px solid ${active ? m.accent : "#1a3a50"}`,
                background: active ? `${m.accent}18` : "transparent",
                color: active ? m.accent : "#64748b", cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
              }}>
                {m.label}
                <span style={{ fontSize: 10, opacity: 0.8, background: active ? `${m.accent}25` : "rgba(100,116,139,0.15)", borderRadius: 8, padding: "1px 6px" }}>
                  {typeCounts[m.key] || 0}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div style={{ marginBottom: 20, position: "relative" }}>
          <Search size={15} color="#64748b" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search reports…"
            style={{
              width: "100%", padding: "11px 14px 11px 40px", background: "#0c1f2e", border: "1px solid #1a3a50",
              borderRadius: 10, color: "#e2e8f0", fontSize: 13, outline: "none", boxSizing: "border-box",
            }}
          />
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 24px", color: "#475569", fontSize: 13 }}>Loading reports…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 24px", border: "2px dashed #1a3a50", borderRadius: 14, background: "#0c1f2e" }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#94a3b8", marginBottom: 6 }}>No reports found</div>
            <div style={{ fontSize: 13, color: "#64748b" }}>
              {entries.length === 0 ? "Generate your first report to see it here." : "Try adjusting the filters or search term."}
            </div>
          </div>
        ) : (
          <div style={{ borderRadius: 12, border: "1px solid #1a3a50", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#0c1f2e" }}>
                  {["Report", "Type", "Details", "Generated", "Cost", ""].map((h, i) => (
                    <th key={i} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: 0.8, textTransform: "uppercase", borderBottom: "1px solid #1a3a50" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(e => {
                  const m = MODULE_BY_KEY[e._module];
                  const rowKey = `${e._module}|${e.id}`;
                  return (
                    <tr key={rowKey} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", cursor: "pointer" }}
                      onMouseEnter={ev => (ev.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                      onMouseLeave={ev => (ev.currentTarget.style.background = "transparent")}
                      onClick={() => handleView(e)}>
                      <td style={{ padding: "14px 16px", maxWidth: 320 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", lineHeight: 1.35 }}>{entryTitle(e._module, e)}</div>
                        {e._apiOnly && <div style={{ marginTop: 4 }}><ApiOriginBadge /></div>}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", padding: "4px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600, color: m?.accent, background: `${m?.accent}14`, border: `1px solid ${m?.accent}30`, whiteSpace: "nowrap" }}>
                          {m?.label || e._module}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px", fontSize: 12, color: "#94a3b8" }}>{entryCount(e._module, e)}</td>
                      <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                        <div style={{ fontSize: 12, color: "#cbd5e1" }}>{formatDate(e.date)}</div>
                        <div style={{ fontSize: 10, color: "#64748b" }}>{formatTime(e.date)}</div>
                      </td>
                      <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }} onClick={ev => ev.stopPropagation()}>
                        <CostCell usage={e.usage} />
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "right" }} onClick={ev => ev.stopPropagation()}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", alignItems: "center" }}>
                          <button onClick={() => handleView(e)} disabled={resolvingId === e.id}
                            style={{ padding: "5px 12px", fontSize: 11, fontWeight: 600, color: "#3491E8", background: "rgba(52,145,232,0.1)", border: "1px solid rgba(52,145,232,0.25)", borderRadius: 6, cursor: resolvingId === e.id ? "wait" : "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>
                            {resolvingId === e.id ? "Loading…" : <><ExternalLink size={11} /> View</>}
                          </button>
                          {confirmDelete === rowKey ? (
                            <button onClick={() => handleDelete(e)} style={{ padding: "5px 12px", fontSize: 11, fontWeight: 600, color: "#E63946", background: "rgba(230,57,70,0.12)", border: "1px solid rgba(230,57,70,0.3)", borderRadius: 6, cursor: "pointer" }}>
                              Confirm
                            </button>
                          ) : (
                            <button onClick={() => setConfirmDelete(rowKey)} style={{ padding: "5px 8px", fontSize: 11, color: "#64748b", background: "none", border: "1px solid rgba(100,116,139,0.3)", borderRadius: 6, cursor: "pointer" }}>
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {filtered.length > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16, fontSize: 11, color: "#64748b" }}>
            <span>Showing {filtered.length} of {entries.length} report{entries.length !== 1 ? "s" : ""}</span>
            <span>Local reports stored in this browser · all reports recorded server-side with real cost</span>
          </div>
        )}
      </div>

      {viewing && (
        <ReportDetailModal entry={viewing.entry} moduleKey={viewing.module} onClose={() => setViewing(null)} />
      )}
    </div>
  );
}
