"use client";

import { useState, useRef, useMemo } from "react";
import { Play, Download, Loader2, Plus, Trash2, Square, ChevronRight, ChevronDown, ExternalLink } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4001";
export const INTENT_HIST_KEY = "intent_map_history";
const MAX_HIST = 30;
const ACCENT = "#38bdf8";

const C = {
  panel: { background: "rgba(15,30,45,0.6)", border: "1px solid #1a3a50", borderRadius: 10, padding: 16 },
  label: { fontSize: 10, fontWeight: 700, letterSpacing: 0.6, color: "#64748b", textTransform: "uppercase", marginBottom: 6 },
  input: { width: "100%", boxSizing: "border-box", background: "#0b1724", border: "1px solid #1e3a50", borderRadius: 6, padding: "7px 9px", color: "#e2e8f0", fontSize: 12, outline: "none" },
  btn: { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "1px solid #1e3a50", background: "rgba(255,255,255,0.04)", color: "#94a3b8" },
  th: { textAlign: "left", padding: "8px 10px", fontSize: 10, fontWeight: 700, letterSpacing: 0.5, color: "#64748b", textTransform: "uppercase", borderBottom: "1px solid #1a3a50", whiteSpace: "nowrap" },
  td: { padding: "8px 10px", fontSize: 12, color: "#cbd5e1", borderBottom: "1px solid rgba(255,255,255,0.04)", verticalAlign: "top" },
};
const FIT_COLORS = { High: "#34d399", Medium: "#fbbf24", Low: "#94a3b8", None: "#475569" };

const uid = () => Math.random().toString(36).slice(2);
const emptyAccount = () => ({ id: uid(), company_name: "", domain: "", company_linkedin_url: "", buyers: "" });
const DEFAULT_WEIGHTS = [
  { id: uid(), term: "Generative AI", weight: 8 },
  { id: uid(), term: "Hiring data engineers", weight: 5 },
  { id: uid(), term: "Cloud migration", weight: 6 },
  { id: uid(), term: "New CIO / CTO", weight: 7 },
];

function loadHist() { try { const r = JSON.parse(localStorage.getItem(INTENT_HIST_KEY) ?? "[]"); return Array.isArray(r) ? r : []; } catch { return []; } }
function saveHist(h) { try { localStorage.setItem(INTENT_HIST_KEY, JSON.stringify(h)); } catch {} }

// "Name | Title | LinkedIn URL", one buyer per line.
function parseBuyers(text) {
  return text.split("\n").map(l => l.split("|").map(x => x.trim())).filter(p => p[0])
    .map(([full_name, job_title = "", linkedin_url = ""]) => ({ full_name, job_title, linkedin_url }));
}

// One row per stakeholder × account. Signals are scoped to the stakeholder's
// department; an unmapped stakeholder shows the account's top signals.
export function intentMapCsvRows(results) {
  const rows = [];
  for (const r of [...results].sort((a, b) => b.composite_score - a.composite_score)) {
    for (const s of r.stakeholders) {
      let ms = r.matches.filter(m => m.department === s.department);
      if (!ms.length) ms = r.matches.slice(0, 3);
      rows.push({
        "Company Name": r.company_name,
        "Domain": r.domain,
        "Account Score": r.composite_score,
        "Matched Signals & Weights": [...new Set(ms.map(m => `${m.term} (W:${m.weight})`))].join(", "),
        "Signal Evidence Snippet": ms.map(m => (m.evidence_kind === "paraphrase" ? `[paraphrased] ${m.evidence}` : `"${m.evidence}"`)
          + ` [${m.source_url || "no url"}]`).join(" | "),
        "Dynamic Department": s.department,
        "Stakeholder Name": s.full_name,
        "Stakeholder Title": s.job_title,
        "Stakeholder LinkedIn": s.linkedin_url,
        "Claude Rationale": s.rationale,
      });
    }
  }
  return rows;
}

function downloadCsv(results) {
  const rows = intentMapCsvRows(results);
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const esc = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [headers.map(esc).join(","), ...rows.map(r => headers.map(h => esc(r[h])).join(","))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = `intent_map_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}

function Drilldown({ r }) {
  const total = r.departments.reduce((s, d) => s + d.contribution, 0) || 1;
  return (
    <div style={{ padding: "14px 16px 18px", background: "rgba(8,15,22,0.7)", borderBottom: "1px solid #1a3a50" }}>
      {r.summary && <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6, marginBottom: 14 }}>{r.summary}</div>}

      <div style={C.label}>Ranked signals</div>
      {r.matches.length ? (
        <div style={{ overflowX: "auto", marginBottom: 6 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>{["Term", "Weight", "Freshness", "Points", "Date", "Department", "Evidence", "Why it matched"].map(h => <th key={h} style={C.th}>{h}</th>)}</tr></thead>
            <tbody>
              {r.matches.map((m, i) => (
                <tr key={i}>
                  <td style={{ ...C.td, color: ACCENT, fontWeight: 600, whiteSpace: "nowrap" }}>{m.term}</td>
                  <td style={C.td}>{m.weight}</td>
                  <td style={C.td}>{m.decay}</td>
                  <td style={{ ...C.td, fontWeight: 700 }}>{m.counted ? m.contribution : 0}</td>
                  <td style={{ ...C.td, whiteSpace: "nowrap" }}>{m.date || "undated"}</td>
                  <td style={C.td}>{m.department}</td>
                  <td style={{ ...C.td, maxWidth: 360 }}>
                    {m.evidence_kind === "paraphrase" && <span style={{ fontSize: 9, color: "#fbbf24", marginRight: 4 }}>PARAPHRASED</span>}
                    <span style={{ fontStyle: "italic" }}>{m.evidence}</span>
                    {m.source_url && <a href={m.source_url} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 6, color: "#64748b" }}><ExternalLink size={11} /></a>}
                  </td>
                  <td style={{ ...C.td, maxWidth: 260, color: "#94a3b8" }}>{m.rationale}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>None of your intent terms were found for this account.</div>}
      <div style={{ fontSize: 10, color: "#475569", marginBottom: 16 }}>Each term counts once, at its freshest evidence. Points = weight × freshness (halves every half-life; undated = 0.5).</div>

      <div style={C.label}>Dynamic department mapping</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10, marginBottom: 16 }}>
        {r.departments.map(d => {
          const people = r.stakeholders.filter(s => s.department === d.name);
          return (
            <div key={d.name} style={{ ...C.panel, padding: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>{d.name}</div>
              <div style={{ fontSize: 11, color: "#64748b", margin: "2px 0 8px" }}>{d.theme}</div>
              <div style={{ height: 6, background: "#0b1724", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${(100 * d.contribution) / total}%`, height: "100%", background: ACCENT }} />
              </div>
              <div style={{ fontSize: 10, color: "#64748b", margin: "4px 0 8px" }}>{d.contribution.toFixed(2)} pts · {d.signal_ids.length} signal(s)</div>
              {r.matches.filter(m => m.department === d.name).map((m, i) => (
                <div key={i} style={{ fontSize: 11, color: "#94a3b8", marginBottom: 3 }}>
                  <span style={{ color: ACCENT }}>{m.term}</span> (W:{m.weight}) — {m.evidence.slice(0, 140)}
                </div>
              ))}
              {people.length > 0 && (
                <div style={{ fontSize: 11, color: "#cbd5e1", marginTop: 8 }}>
                  → {people.map(p => <span key={p.buyer_key} style={{ marginRight: 8 }}>{p.full_name} <span style={{ color: FIT_COLORS[p.fit] }}>({p.fit})</span></span>)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={C.label}>Routed stakeholders</div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr>{["Name", "Title", "Department", "Fit", "Rationale"].map(h => <th key={h} style={C.th}>{h}</th>)}</tr></thead>
        <tbody>
          {r.stakeholders.map(s => (
            <tr key={s.buyer_key}>
              <td style={{ ...C.td, whiteSpace: "nowrap" }}>
                {s.linkedin_url ? <a href={s.linkedin_url} target="_blank" rel="noopener noreferrer" style={{ color: "#e2e8f0" }}>{s.full_name}</a> : s.full_name}
              </td>
              <td style={C.td}>{s.job_title}</td>
              <td style={C.td}>{s.department}</td>
              <td style={{ ...C.td, color: FIT_COLORS[s.fit], fontWeight: 700 }}>{s.fit}</td>
              <td style={{ ...C.td, color: "#94a3b8" }}>{s.rationale}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function IntentMapLeaderboard({ results }) {
  const [open, setOpen] = useState(null);
  const sorted = useMemo(() => [...results].sort((a, b) => b.composite_score - a.composite_score), [results]);
  return (
    <div style={{ ...C.panel, padding: 0, overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr>{["", "Rank", "Company Name", "Composite Score", "Dynamically Identified Departments", "Primary Stakeholder Route"].map(h => <th key={h} style={C.th}>{h}</th>)}</tr></thead>
        <tbody>
          {sorted.map((r, i) => {
            const isOpen = open === r.company_name;
            return [
              <tr key={r.company_name} onClick={() => setOpen(isOpen ? null : r.company_name)} style={{ cursor: "pointer", background: isOpen ? "rgba(56,189,248,0.06)" : "transparent" }}>
                <td style={{ ...C.td, width: 20, color: "#64748b" }}>{isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
                <td style={{ ...C.td, fontWeight: 700 }}>{i + 1}</td>
                <td style={{ ...C.td, fontWeight: 600, color: "#e2e8f0" }}>
                  {r.company_name}
                  <div style={{ fontSize: 10, color: "#475569", fontWeight: 400 }}>{r.domain}{r.cached_at ? " · cached" : ""}</div>
                </td>
                <td style={{ ...C.td, minWidth: 140 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, height: 6, background: "#0b1724", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ width: `${Math.min(r.composite_score, 100)}%`, height: "100%", background: ACCENT }} />
                    </div>
                    <span style={{ fontWeight: 700, color: "#e2e8f0" }}>{r.composite_score}</span>
                  </div>
                </td>
                <td style={C.td}>{r.departments.map(d => d.name).join(", ") || "—"}</td>
                <td style={C.td}>{r.primary_route}</td>
              </tr>,
              isOpen && <tr key={`${r.company_name}-d`}><td colSpan={6} style={{ padding: 0 }}><Drilldown r={r} /></td></tr>,
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}

export function IntentMapContent() {
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS);
  const [accounts, setAccounts] = useState([emptyAccount()]);
  const [halfLife, setHalfLife] = useState(180);
  const [forceRefresh, setForceRefresh] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");
  const [statusBy, setStatusBy] = useState({});
  const [errors, setErrors] = useState({});
  const [results, setResults] = useState([]);
  const abortRef = useRef(null);

  const validWeights = weights.filter(w => w.term.trim() && Number(w.weight) > 0);
  const validAccounts = accounts.filter(a => a.company_name.trim() && a.domain.trim());
  const canRun = !running && validWeights.length && validAccounts.length;

  const setW = (id, k, v) => setWeights(p => p.map(w => w.id === id ? { ...w, [k]: v } : w));
  const setA = (id, k, v) => setAccounts(p => p.map(a => a.id === id ? { ...a, [k]: v } : a));

  async function run() {
    setRunning(true); setResults([]); setErrors({}); setProgress("Connecting to Intent Map engine…");
    setStatusBy(Object.fromEntries(validAccounts.map(a => [a.company_name.trim(), "queued"])));
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const got = [];
    try {
      const res = await fetch(`${API_URL}/api/intent-map`, {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: ctrl.signal,
        body: JSON.stringify({
          accounts: validAccounts.map(a => ({
            company_name: a.company_name.trim(), domain: a.domain.trim(),
            company_linkedin_url: a.company_linkedin_url.trim(), prospective_buyers: parseBuyers(a.buyers),
          })),
          weights: validWeights.map(w => ({ term: w.term.trim(), weight: Number(w.weight) })),
          half_life_days: Number(halfLife), force_refresh: forceRefresh,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}${res.status === 422 ? " — check inputs (weights 1–10, every buyer needs a name)" : ""}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          let evt;
          try { evt = JSON.parse(line.slice(6)); } catch { continue; }
          if (evt.type === "heartbeat") setProgress(evt.message);
          else if (evt.type === "account_status") setStatusBy(p => ({ ...p, [evt.company]: evt.status }));
          else if (evt.type === "account_result") {
            got.push(evt.result);
            setResults(p => [...p, evt.result]);
            setStatusBy(p => ({ ...p, [evt.company]: "done" }));
          } else if (evt.type === "account_error") {
            setErrors(p => ({ ...p, [evt.company]: evt.message }));
            setStatusBy(p => ({ ...p, [evt.company]: "error" }));
          } else if (evt.type === "complete") {
            setProgress(`✅ Complete — ${evt.total} account(s) scored`);
            if (got.length) {
              saveHist([{
                id: Date.now(), date: new Date().toISOString(), run_id: evt.run_id, usage: evt.usage,
                companies: validAccounts.map(a => a.company_name.trim()).join(", "),
                weights: validWeights.map(w => ({ term: w.term.trim(), weight: Number(w.weight) })),
                results: got,
              }, ...loadHist()].slice(0, MAX_HIST));
            }
          } else if (evt.type === "error") setProgress(`Error: ${evt.message}`);
        }
      }
    } catch (e) {
      setProgress(e.name === "AbortError" ? "Stopped." : `Error: ${e.message}`);
    } finally {
      setRunning(false);
    }
  }

  const pending = Object.entries(statusBy).filter(([, s]) => !["done", "error"].includes(s));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 1fr) minmax(320px, 2fr)", gap: 16 }}>
        <div style={C.panel}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0", marginBottom: 4 }}>Intent weights</div>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 10 }}>Signals you care about and how much each matters (1–10). Matched by meaning, not keyword.</div>
          {weights.map(w => (
            <div key={w.id} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
              <input style={C.input} placeholder="e.g. Snowflake" value={w.term} onChange={e => setW(w.id, "term", e.target.value)} />
              <input style={{ ...C.input, width: 60 }} type="number" min={1} max={10} value={w.weight} onChange={e => setW(w.id, "weight", e.target.value)} />
              <button style={{ ...C.btn, padding: "6px 8px" }} onClick={() => setWeights(p => p.filter(x => x.id !== w.id))} aria-label="Remove term"><Trash2 size={12} /></button>
            </div>
          ))}
          <button style={{ ...C.btn, marginTop: 4 }} onClick={() => setWeights(p => [...p, { id: uid(), term: "", weight: 5 }])}><Plus size={12} /> Add term</button>
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 16, flexWrap: "wrap" }}>
            <label style={{ fontSize: 11, color: "#94a3b8" }}>Half-life (days)
              <input style={{ ...C.input, width: 70, marginLeft: 6, display: "inline-block" }} type="number" min={30} max={730} value={halfLife} onChange={e => setHalfLife(e.target.value)} />
            </label>
            <label style={{ fontSize: 11, color: "#94a3b8", display: "flex", alignItems: "center", gap: 5 }}>
              <input type="checkbox" checked={forceRefresh} onChange={e => setForceRefresh(e.target.checked)} /> Ignore 90-day cache
            </label>
          </div>
        </div>

        <div style={C.panel}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0", marginBottom: 10 }}>Target accounts & buyers</div>
          {accounts.map(a => (
            <div key={a.id} style={{ border: "1px solid #1a3a50", borderRadius: 8, padding: 10, marginBottom: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 6, marginBottom: 6 }}>
                <input style={C.input} placeholder="Company name *" value={a.company_name} onChange={e => setA(a.id, "company_name", e.target.value)} />
                <input style={C.input} placeholder="Domain *" value={a.domain} onChange={e => setA(a.id, "domain", e.target.value)} />
                <input style={C.input} placeholder="Company LinkedIn" value={a.company_linkedin_url} onChange={e => setA(a.id, "company_linkedin_url", e.target.value)} />
                <button style={{ ...C.btn, padding: "6px 8px" }} disabled={accounts.length === 1} onClick={() => setAccounts(p => p.filter(x => x.id !== a.id))} aria-label="Remove account"><Trash2 size={12} /></button>
              </div>
              <textarea style={{ ...C.input, minHeight: 58, resize: "vertical", fontFamily: "inherit" }}
                placeholder={"Prospective buyers, one per line: Name | Job title | LinkedIn URL\nJane Doe | VP Data Engineering | https://linkedin.com/in/janedoe"}
                value={a.buyers} onChange={e => setA(a.id, "buyers", e.target.value)} />
            </div>
          ))}
          <button style={C.btn} disabled={accounts.length >= 50} onClick={() => setAccounts(p => [...p, emptyAccount()])}><Plus size={12} /> Add account</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        {running
          ? <button style={{ ...C.btn, color: "#E63946" }} onClick={() => abortRef.current?.abort()}><Square size={12} /> Stop</button>
          : <button style={{ ...C.btn, background: canRun ? "rgba(56,189,248,0.15)" : C.btn.background, color: canRun ? ACCENT : "#475569", borderColor: canRun ? "rgba(56,189,248,0.4)" : "#1e3a50", cursor: canRun ? "pointer" : "not-allowed" }}
              disabled={!canRun} onClick={run}><Play size={12} /> Run Intent Map</button>}
        <button style={{ ...C.btn, color: results.length ? "#e2e8f0" : "#475569", cursor: results.length ? "pointer" : "not-allowed" }}
          disabled={!results.length} onClick={() => downloadCsv(results)}><Download size={12} /> Export Finalized Pipeline to CSV</button>
        {running && <Loader2 size={14} className="spin" style={{ color: ACCENT, animation: "spin 1s linear infinite" }} />}
        <span style={{ fontSize: 12, color: "#94a3b8" }}>{progress}</span>
      </div>

      {pending.length > 0 && (
        <div style={{ fontSize: 11, color: "#64748b" }}>{pending.map(([n, s]) => `${n}: ${s}`).join(" · ")}</div>
      )}
      {Object.entries(errors).map(([n, m]) => (
        <div key={n} style={{ fontSize: 12, color: "#E63946" }}>{n}: {m}</div>
      ))}

      {results.length > 0
        ? <IntentMapLeaderboard results={results} />
        : !running && <div style={{ ...C.panel, textAlign: "center", color: "#475569", fontSize: 12 }}>Add accounts and run — accounts land here ranked by score as each finishes. Click a row to audit its signals.</div>}
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}
