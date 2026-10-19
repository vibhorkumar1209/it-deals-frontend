"use client";

import { useState, useRef, useMemo } from "react";
import { Play, Download, Loader2, Plus, Trash2, Square, ChevronRight, ChevronDown, ExternalLink, RotateCcw } from "lucide-react";

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
// Scoring Guide colours: High green, Medium amber, Low yellow, None grey.
const LEVEL_COLORS = { High: "#34d399", Medium: "#f59e0b", Low: "#facc15", None: "#475569" };
const BAND_COLORS = { High: "#34d399", Medium: "#f59e0b", Low: "#94a3b8" };
const FIT_COLORS = { High: "#34d399", Medium: "#fbbf24", Low: "#94a3b8", None: "#475569" };

const uid = () => Math.random().toString(36).slice(2);
const emptyAccount = () => ({ id: uid(), company_name: "", domain: "", company_linkedin_url: "", buyers: "" });
// Mirrors DEFAULT_PARAMETERS in it-deals-api/intent_map_pipeline.py; "{focus}" is filled server-side.
const defaultParams = () => [
  { id: uid(), name: "Investment & IT spend increase", weight: 25, description: "Rising investment or IT spend in {focus}: funded programmes, licence/platform rollouts, budget statements." },
  { id: uid(), name: "Strategic initiatives", weight: 30, description: "Named strategies, roadmaps, transformation programmes, pilots or certifications in {focus}." },
  { id: uid(), name: "Regulatory / operational urgency", weight: 20, description: "Regulation, deadlines, resilience, security or third-party requirements that create {focus} demand." },
  { id: uid(), name: "Hiring signal", weight: 15, description: "Open roles or team build-out in {focus} and the IT functions that run it." },
  { id: uid(), name: "Decision-maker change (IT)", weight: 10, description: "A new CIO, CTO, CDO, CISO, Head of {focus} or other IT leader appointed in the last 12 months." },
];

function loadHist() { try { const r = JSON.parse(localStorage.getItem(INTENT_HIST_KEY) ?? "[]"); return Array.isArray(r) ? r : []; } catch { return []; } }
function saveHist(h) { try { localStorage.setItem(INTENT_HIST_KEY, JSON.stringify(h)); } catch {} }

// "Name | Title | LinkedIn URL", one buyer per line.
function parseBuyers(text) {
  return text.split("\n").map(l => l.split("|").map(x => x.trim())).filter(p => p[0])
    .map(([full_name, job_title = "", linkedin_url = ""]) => ({ full_name, job_title, linkedin_url }));
}

const evidenceText = e => (e.evidence_kind === "paraphrase" ? `[paraphrased] ${e.evidence}` : `"${e.evidence}"`) + ` [${e.source_url || "no url"}]`;

// One row per stakeholder × account, with the sheet's per-parameter columns.
// Signals are scoped to the stakeholder's department; an unmapped stakeholder
// shows the account's top-weighted evidence instead.
export function intentMapCsvRows(results) {
  const rows = [];
  for (const r of [...results].sort((a, b) => b.composite_score - a.composite_score)) {
    const params = r.parameters || [];
    const allEv = params.flatMap(p => p.evidence.map(e => ({ ...e, param: p })));
    const paramCols = Object.fromEntries(params.map(p => [`${p.name} (${p.weight}%)`, p.level === "None" ? "None" : `${p.level} — ${p.finding}`]));
    const stakeholders = r.stakeholders.length ? r.stakeholders : [{ department: "", full_name: "", job_title: "", linkedin_url: "", rationale: "" }];
    for (const s of stakeholders) {
      let ev = allEv.filter(e => e.department === s.department);
      if (!ev.length) ev = allEv.filter(e => e.param.level !== "None").sort((a, b) => b.param.points - a.param.points).slice(0, 3);
      rows.push({
        "Company Name": r.company_name,
        "Domain": r.domain,
        "Sector": r.sector || "",
        [`Fit for ${r.seller || "Seller"}`]: r.band || "",
        "Account Score": r.composite_score,
        ...paramCols,
        "Matched Signals & Weights": params.filter(p => p.level !== "None").map(p => `${p.name} (W:${p.weight}%, ${p.level})`).join(", "),
        "Signal Evidence Snippet": ev.map(evidenceText).join(" | "),
        "Dynamic Department": s.department,
        "Stakeholder Name": s.full_name,
        "Stakeholder Title": s.job_title,
        "Stakeholder LinkedIn": s.linkedin_url,
        "Claude Rationale": s.rationale,
        "Sources": (r.sources || []).join(" "),
      });
    }
  }
  return rows;
}

function downloadCsv(results) {
  const rows = intentMapCsvRows(results);
  if (!rows.length) return;
  const headers = [...new Set(rows.flatMap(r => Object.keys(r)))];
  const esc = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [headers.map(esc).join(","), ...rows.map(r => headers.map(h => esc(r[h])).join(","))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = `intent_map_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}

const Pill = ({ text, color }) => (
  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 9, color, background: `${color}22`, border: `1px solid ${color}55`, whiteSpace: "nowrap" }}>{text}</span>
);

function Drilldown({ r }) {
  if (!r.parameters) {
    return <div style={{ padding: 16, fontSize: 12, color: "#64748b", borderBottom: "1px solid #1a3a50" }}>Older report format — re-run this account for the parameter breakdown.</div>;
  }
  const deptTotal = r.departments.reduce((s, d) => s + d.contribution, 0) || 1;
  return (
    <div style={{ padding: "14px 16px 18px", background: "rgba(8,15,22,0.7)", borderBottom: "1px solid #1a3a50" }}>
      {r.summary && <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6, marginBottom: 14 }}>{r.summary}</div>}

      <div style={C.label}>Intent parameters</div>
      <div style={{ overflowX: "auto", marginBottom: 6 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>{["Parameter", "Weight", "Signal", "Points", "Finding", "Evidence"].map(h => <th key={h} style={C.th}>{h}</th>)}</tr></thead>
          <tbody>
            {r.parameters.map(p => (
              <tr key={p.name}>
                <td style={{ ...C.td, fontWeight: 600, color: "#e2e8f0", minWidth: 150 }}>{p.name}</td>
                <td style={C.td}>{p.weight}%</td>
                <td style={C.td}><Pill text={p.level} color={LEVEL_COLORS[p.level]} /></td>
                <td style={{ ...C.td, fontWeight: 700 }}>{p.points}</td>
                <td style={{ ...C.td, maxWidth: 340 }}>{p.finding}</td>
                <td style={{ ...C.td, maxWidth: 360 }}>
                  {p.evidence.map(e => (
                    <div key={e.id} style={{ marginBottom: 5, color: "#94a3b8" }}>
                      {e.evidence_kind === "paraphrase" && <span style={{ fontSize: 9, color: "#fbbf24", marginRight: 4 }}>PARAPHRASED</span>}
                      <span style={{ fontStyle: "italic" }}>{e.evidence}</span>
                      <span style={{ color: "#475569" }}> {e.date || "undated"}</span>
                      {e.source_url && <a href={e.source_url} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 5, color: "#64748b" }}><ExternalLink size={11} /></a>}
                    </div>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 10, color: "#475569", marginBottom: 16 }}>
        Signal: High (confirmed) = 3 · Medium (likely) = 2 · Low (emerging) = 1 · None = 0. Points = weight × signal ÷ 3. Score = sum of points; High ≥75, Medium 45–74, Low &lt;45.
      </div>

      {r.departments.length > 0 && <>
        <div style={C.label}>Dynamic department mapping</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10, marginBottom: 16 }}>
          {r.departments.map(d => {
            const people = r.stakeholders.filter(s => s.department === d.name);
            return (
              <div key={d.name} style={{ ...C.panel, padding: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>{d.name}</div>
                <div style={{ fontSize: 11, color: "#64748b", margin: "2px 0 8px" }}>{d.theme}</div>
                <div style={{ height: 6, background: "#0b1724", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${(100 * d.contribution) / deptTotal}%`, height: "100%", background: ACCENT }} />
                </div>
                <div style={{ fontSize: 10, color: "#64748b", margin: "4px 0 6px" }}>{d.contribution} supporting signal(s)</div>
                {people.length > 0 && (
                  <div style={{ fontSize: 11, color: "#cbd5e1" }}>
                    → {people.map(p => <span key={p.buyer_key} style={{ marginRight: 8 }}>{p.full_name} <span style={{ color: FIT_COLORS[p.fit] }}>({p.fit})</span></span>)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </>}

      {r.stakeholders.length > 0 && <>
        <div style={C.label}>Routed stakeholders</div>
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 14 }}>
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
      </>}

      {(r.sources || []).length > 0 && <>
        <div style={C.label}>Sources</div>
        <div style={{ fontSize: 11, lineHeight: 1.7 }}>
          {r.sources.map(u => <div key={u}><a href={u} target="_blank" rel="noopener noreferrer" style={{ color: "#64748b", wordBreak: "break-all" }}>{u}</a></div>)}
        </div>
      </>}
    </div>
  );
}

export function IntentMapLeaderboard({ results }) {
  const [open, setOpen] = useState(null);
  const sorted = useMemo(() => [...results].sort((a, b) => b.composite_score - a.composite_score), [results]);
  const paramNames = sorted.find(r => r.parameters)?.parameters.map(p => p.name) || [];
  const seller = sorted.find(r => r.seller)?.seller;
  const short = n => n.replace(/ \(IT\)$/, "").split(/[ /&]+/).filter(Boolean).slice(0, 2).join(" ");
  const cols = ["", "Rank", "Company Name", "Composite Score", seller ? `Fit for ${seller}` : "Band", ...paramNames.map(short), "Departments", "Primary Stakeholder Route"];
  return (
    <div style={{ ...C.panel, padding: 0, overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr>{cols.map((h, i) => <th key={i} style={C.th} title={paramNames[i - 5] || ""}>{h}</th>)}</tr></thead>
        <tbody>
          {sorted.map((r, i) => {
            const isOpen = open === r.company_name;
            const band = r.band || "";
            return [
              <tr key={r.company_name} onClick={() => setOpen(isOpen ? null : r.company_name)} style={{ cursor: "pointer", background: isOpen ? "rgba(56,189,248,0.06)" : "transparent" }}>
                <td style={{ ...C.td, width: 20, color: "#64748b" }}>{isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
                <td style={{ ...C.td, fontWeight: 700 }}>{i + 1}</td>
                <td style={{ ...C.td, fontWeight: 600, color: "#e2e8f0" }}>
                  {r.company_name}
                  <div style={{ fontSize: 10, color: "#475569", fontWeight: 400 }}>{[r.sector, r.domain].filter(Boolean).join(" · ")}{r.cached_at ? " · cached" : ""}</div>
                </td>
                <td style={{ ...C.td, minWidth: 130 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, height: 6, background: "#0b1724", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ width: `${Math.min(r.composite_score, 100)}%`, height: "100%", background: BAND_COLORS[band] || ACCENT }} />
                    </div>
                    <span style={{ fontWeight: 700, color: "#e2e8f0" }}>{r.composite_score}</span>
                  </div>
                </td>
                <td style={C.td}>{band ? <Pill text={band} color={BAND_COLORS[band]} /> : "—"}</td>
                {paramNames.map(n => {
                  const p = (r.parameters || []).find(x => x.name === n);
                  return <td key={n} style={C.td}>{p ? <span title={p.finding} style={{ display: "inline-block", width: 10, height: 10, borderRadius: 5, background: LEVEL_COLORS[p.level] }} /> : "—"}</td>;
                })}
                <td style={C.td}>{r.departments.map(d => d.name).join(", ") || "—"}</td>
                <td style={C.td}>{r.primary_route}</td>
              </tr>,
              isOpen && <tr key={`${r.company_name}-d`}><td colSpan={cols.length} style={{ padding: 0 }}><Drilldown r={r} /></td></tr>,
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}

export function IntentMapContent() {
  const [params, setParams] = useState(defaultParams);
  const [seller, setSeller] = useState("Fujitsu");
  const [focus, setFocus] = useState("Digital Workplace");
  const [region, setRegion] = useState("");
  const [accounts, setAccounts] = useState([emptyAccount()]);
  const [forceRefresh, setForceRefresh] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");
  const [statusBy, setStatusBy] = useState({});
  const [errors, setErrors] = useState({});
  const [results, setResults] = useState([]);
  const abortRef = useRef(null);

  const validParams = params.filter(p => p.name.trim() && Number(p.weight) > 0);
  const weightSum = validParams.reduce((s, p) => s + Number(p.weight), 0);
  const validAccounts = accounts.filter(a => a.company_name.trim() && a.domain.trim());
  const canRun = !running && validParams.length && validAccounts.length && focus.trim();

  const setP = (id, k, v) => setParams(p => p.map(x => x.id === id ? { ...x, [k]: v } : x));
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
          parameters: validParams.map(p => ({ name: p.name.trim(), weight: Number(p.weight), description: p.description.trim() })),
          focus_area: focus.trim(), seller_company: seller.trim(), region: region.trim(), force_refresh: forceRefresh,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}${res.status === 422 ? " — check inputs (weights 1–100, every buyer needs a name)" : ""}`);
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
                focus_area: focus.trim(), seller_company: seller.trim(), results: got,
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
      <div style={{ ...C.panel, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
        <div><div style={C.label}>Your company</div><input style={C.input} value={seller} onChange={e => setSeller(e.target.value)} placeholder="e.g. Fujitsu" /></div>
        <div><div style={C.label}>Focus area *</div><input style={C.input} value={focus} onChange={e => setFocus(e.target.value)} placeholder="e.g. Digital Workplace" /></div>
        <div><div style={C.label}>Region (optional)</div><input style={C.input} value={region} onChange={e => setRegion(e.target.value)} placeholder="e.g. UK" /></div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(300px, 1.2fr) minmax(320px, 1fr)", gap: 16 }}>
        <div style={C.panel}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0", flex: 1 }}>Intent parameters</div>
            <button style={{ ...C.btn, padding: "4px 8px", fontSize: 11 }} onClick={() => setParams(defaultParams())} title="Reset to default parameters"><RotateCcw size={11} /> Defaults</button>
          </div>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 10 }}>
            Each is rated High / Medium / Low / None from web evidence. Weights total <span style={{ color: weightSum === 100 ? "#34d399" : "#f59e0b", fontWeight: 700 }}>{weightSum}%</span>{weightSum !== 100 && " (scaled to 100%)"}.
          </div>
          {params.map(p => (
            <div key={p.id} style={{ border: "1px solid #1a3a50", borderRadius: 8, padding: 8, marginBottom: 8 }}>
              <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                <input style={C.input} placeholder="Parameter name" value={p.name} onChange={e => setP(p.id, "name", e.target.value)} />
                <input style={{ ...C.input, width: 64 }} type="number" min={1} max={100} value={p.weight} onChange={e => setP(p.id, "weight", e.target.value)} aria-label="Weight %" />
                <span style={{ fontSize: 11, color: "#64748b", alignSelf: "center" }}>%</span>
                <button style={{ ...C.btn, padding: "6px 8px" }} onClick={() => setParams(x => x.filter(y => y.id !== p.id))} aria-label="Remove parameter"><Trash2 size={12} /></button>
              </div>
              <input style={{ ...C.input, fontSize: 11, color: "#94a3b8" }} placeholder="What counts as evidence ({focus} = focus area)" value={p.description} onChange={e => setP(p.id, "description", e.target.value)} />
            </div>
          ))}
          <button style={C.btn} disabled={params.length >= 10} onClick={() => setParams(p => [...p, { id: uid(), name: "", weight: 10, description: "" }])}><Plus size={12} /> Add parameter</button>
          <label style={{ fontSize: 11, color: "#94a3b8", display: "flex", alignItems: "center", gap: 5, marginTop: 14 }}>
            <input type="checkbox" checked={forceRefresh} onChange={e => setForceRefresh(e.target.checked)} /> Ignore 90-day cache
          </label>
        </div>

        <div style={C.panel}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0", marginBottom: 10 }}>Target accounts & buyers</div>
          {accounts.map(a => (
            <div key={a.id} style={{ border: "1px solid #1a3a50", borderRadius: 8, padding: 10, marginBottom: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 6, marginBottom: 6 }}>
                <input style={C.input} placeholder="Company name *" value={a.company_name} onChange={e => setA(a.id, "company_name", e.target.value)} />
                <input style={C.input} placeholder="Domain *" value={a.domain} onChange={e => setA(a.id, "domain", e.target.value)} />
                <button style={{ ...C.btn, padding: "6px 8px" }} disabled={accounts.length === 1} onClick={() => setAccounts(p => p.filter(x => x.id !== a.id))} aria-label="Remove account"><Trash2 size={12} /></button>
              </div>
              <input style={{ ...C.input, marginBottom: 6 }} placeholder="Company LinkedIn (optional)" value={a.company_linkedin_url} onChange={e => setA(a.id, "company_linkedin_url", e.target.value)} />
              <textarea style={{ ...C.input, minHeight: 58, resize: "vertical", fontFamily: "inherit" }}
                placeholder={"Prospective buyers (optional), one per line: Name | Job title | LinkedIn URL\nJane Doe | Head of End User Computing | https://linkedin.com/in/janedoe"}
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
        {running && <Loader2 size={14} style={{ color: ACCENT, animation: "spin 1s linear infinite" }} />}
        <span style={{ fontSize: 12, color: "#94a3b8" }}>{progress}</span>
      </div>

      {pending.length > 0 && <div style={{ fontSize: 11, color: "#64748b" }}>{pending.map(([n, s]) => `${n}: ${s}`).join(" · ")}</div>}
      {Object.entries(errors).map(([n, m]) => <div key={n} style={{ fontSize: 12, color: "#E63946" }}>{n}: {m}</div>)}

      {results.length > 0
        ? <IntentMapLeaderboard results={results} />
        : !running && <div style={{ ...C.panel, textAlign: "center", color: "#475569", fontSize: 12 }}>Add accounts and run — accounts land here ranked by score as each finishes. Click a row for the parameter-by-parameter evidence.</div>}
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}
