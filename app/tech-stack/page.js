"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Plus, Trash2, Play, Download, Loader2, CheckCircle2, History, X, Clock, Cpu, ChevronDown } from "lucide-react";
import s from "./tech-stack.module.css";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4001";

const SCHEMA_FIELDS = [
  { key: "core_tech_category",  label: "Core Category" },
  { key: "tech_stack_category", label: "Tech Category" },
  { key: "vendor",              label: "Tech" },
  { key: "integration_partner", label: "Implementation Partner" },
  { key: "last_detected",       label: "Last Detected" },
  { key: "tech_install",        label: "Install Size" },
  { key: "renewal_date",        label: "Renewal" },
  { key: "confidence_score",    label: "Confidence" },
  { key: "source_info",         label: "Source" },
];

// Category taxonomy — shown in picker, NOT hardcoded into search queries
const CATEGORY_TAXONOMY = {
  "⚙️ Core Technology Stack": [
    "Programming Languages & Frameworks", "Data Management & Streaming",
    "Cloud & Infrastructure", "DevOps & CI/CD",
    "Container & Orchestration", "Version Control",
    "API Management", "iPaaS & Integration",
  ],
  "🏦 Enterprise & Financial Systems": [
    "ERP & Finance", "Financial & Enterprise Systems",
    "Payment Infrastructure", "Risk & Compliance Platforms",
    "HR & Payroll", "Procurement & Source-to-Pay",
    "Contract Lifecycle Management", "ITSM & Service Desk",
  ],
  "☁️ Infrastructure & Cloud": [
    "Cloud Hosting", "Databases", "CDN & DNS",
    "Identity & IAM", "Collaboration & Productivity",
    "Device Management / MDM", "Network & VPN",
  ],
  "🧠 AI, Data & Analytics": [
    "AI/ML Infrastructure", "Data Warehousing", "Data Integration & ETL",
    "Business Intelligence", "Product Analytics", "Data Catalogue & Governance",
  ],
  "🛡️ Security, Compliance & Observability": [
    "Cybersecurity / EDR", "SIEM & Threat Detection", "Vulnerability Management",
    "GRC & Compliance", "DLP & Data Security", "Zero Trust / ZTNA",
    "APM & Monitoring",
  ],
  "📈 Sales, Marketing & Customer Support": [
    "CRM & Account Management", "Marketing Automation", "Sales Intelligence",
    "Customer Support & Helpdesk", "Billing & Subscription",
    "E-Commerce Platform", "CPQ & Configure-Price-Quote",
  ],
  "🤝 Workplace Productivity": [
    "Project & Knowledge Management", "Low-Code / No-Code",
  ],
};

function CategoryPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Parse currently selected categories from comma-separated string
  const selected = new Set(
    value.split(",").map(s => s.trim()).filter(Boolean)
  );

  function toggle(cat) {
    const next = new Set(selected);
    if (next.has(cat)) next.delete(cat); else next.add(cat);
    onChange([...next].join(", "));
  }

  // Close on outside click
  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11,
          color: "#3491E8", background: "transparent", border: "1px solid rgba(52,145,232,0.35)",
          borderRadius: 5, padding: "3px 8px", cursor: "pointer", marginTop: 4,
        }}
      >
        <ChevronDown size={11} /> Browse categories {selected.size > 0 && `(${selected.size} selected)`}
      </button>
      {open && (
        <div style={{
          position: "absolute", zIndex: 200, top: "calc(100% + 4px)", left: 0,
          background: "#0c1e2e", border: "1px solid rgba(52,145,232,0.25)",
          borderRadius: 8, padding: "12px 14px", width: 460, maxHeight: 400,
          overflowY: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        }}>
          {selected.size > 0 && (
            <button
              type="button"
              onClick={() => onChange("")}
              style={{ fontSize: 10, color: "#64748b", background: "none", border: "none", cursor: "pointer", marginBottom: 8, padding: 0 }}
            >
              Clear all
            </button>
          )}
          {Object.entries(CATEGORY_TAXONOMY).map(([group, cats]) => (
            <div key={group} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: "#64748b", marginBottom: 5, fontWeight: 600 }}>{group}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {cats.map(cat => {
                  const on = selected.has(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => toggle(cat)}
                      style={{
                        fontSize: 11, padding: "3px 8px", borderRadius: 4, cursor: "pointer",
                        border: on ? "1px solid #3491E8" : "1px solid rgba(100,116,139,0.3)",
                        background: on ? "rgba(52,145,232,0.18)" : "rgba(255,255,255,0.04)",
                        color: on ? "#3491E8" : "#94a3b8",
                        transition: "all 0.15s",
                      }}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid rgba(100,116,139,0.2)" }}>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{
                fontSize: 11, color: "#3491E8", background: "rgba(52,145,232,0.1)",
                border: "1px solid rgba(52,145,232,0.3)", borderRadius: 5,
                padding: "4px 12px", cursor: "pointer",
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const CORE_CATEGORY_COLORS = {
  "Core Enterprise Operations": { bg: "rgba(99,102,241,0.12)", color: "#818cf8" },
  "Customer-Facing & Revenue":  { bg: "rgba(52,211,153,0.12)", color: "#34d399" },
  "Infrastructure & Cloud":     { bg: "rgba(52,145,232,0.12)", color: "#3491E8" },
  "Development & Engineering":  { bg: "rgba(251,191,36,0.12)", color: "#fbbf24" },
  "Data Analytics & AI":        { bg: "rgba(244,114,182,0.12)", color: "#f472b6" },
  "Security & Compliance":      { bg: "rgba(230,57,70,0.12)",   color: "#E63946" },
};

function confidenceColor(score) {
  const n = parseInt(score);
  if (n >= 90) return { bg: "rgba(52,211,153,0.15)", color: "#34d399" };
  if (n >= 75) return { bg: "rgba(52,145,232,0.15)", color: "#3491E8" };
  if (n >= 60) return { bg: "rgba(251,191,36,0.15)", color: "#fbbf24" };
  return { bg: "rgba(100,116,139,0.15)", color: "#64748b" };
}

// ── History helpers ────────────────────────────────────────────────────────────
const HISTORY_KEY = "it_tech_stack_history";
const MAX_HISTORY  = 30;
function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]"); } catch { return []; }
}
function saveHistory(h) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h)); } catch {}
}
function addToHistory(companies, rows) {
  if (!rows.length) return;
  const entry = { id: Date.now(), date: new Date().toISOString(),
    companies: companies.map(c => c.company_name).filter(Boolean), rows };
  saveHistory([entry, ...loadHistory()].slice(0, MAX_HISTORY));
}

function parseCSV(text) {
  return text.split(/[\n,]/).map(s => s.trim()).filter(Boolean);
}

const emptyCompany = () => ({
  id: Math.random().toString(36).slice(2),
  company_name: "", domain: "", linkedin_url: "",
  focus_categories_text: "", focus_vendors_text: "",
});

export default function TechStackPage() {
  const [companies, setCompanies]       = useState([emptyCompany()]);
  const [status, setStatus]             = useState("idle");
  const [progress, setProgress]         = useState("");
  const [rows, setRows]                 = useState([]);
  const [showHistory, setShowHistory]   = useState(false);
  const [history, setHistory]           = useState([]);
  const [historyEntry, setHistoryEntry] = useState(null);

  useEffect(() => setHistory(loadHistory()), []);

  const addCompany    = () => setCompanies(cs => [...cs, emptyCompany()]);
  const removeCompany = (id) => setCompanies(cs => cs.filter(c => c.id !== id));
  const updateCompany = (id, patch) =>
    setCompanies(cs => cs.map(c => c.id === id ? { ...c, ...patch } : c));

  const validCompanies = companies.filter(c => c.company_name.trim() && c.domain.trim());

  const run = useCallback(async () => {
    if (!validCompanies.length) return;
    setStatus("running"); setRows([]); setProgress("Connecting to tech stack scanner…");

    const inputs = validCompanies.map(c => ({
      company_name:       c.company_name.trim(),
      domain:             c.domain.trim(),
      linkedin_url:       c.linkedin_url.trim(),
      focus_categories:   parseCSV(c.focus_categories_text),
      focus_vendors:      parseCSV(c.focus_vendors_text),
    }));

    try {
      const res = await fetch(`${API_URL}/api/tech-stack`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputs }),
      });
      if (!res.ok || !res.body) throw new Error(`Server error ${res.status}`);

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let allRows = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n"); buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const ev = JSON.parse(line.slice(6));
            if (ev.type === "heartbeat" || ev.type === "progress") {
              setProgress(ev.message ?? "");
            } else if (ev.type === "row") {
              allRows = [...allRows, ev.row];
              setRows([...allRows]);
              const ok = allRows.filter(r => r._status === "ok").length;
              setProgress(`${ok} tool${ok === 1 ? "" : "s"} detected — scanning…`);
            } else if (ev.type === "complete") {
              setStatus("done");
              const ok = allRows.filter(r => r._status === "ok").length;
              setProgress(`Done — ${ok} tools detected across ${validCompanies.length} ${validCompanies.length === 1 ? "company" : "companies"}`);
              addToHistory(validCompanies, allRows);
              setHistory(loadHistory());
            } else if (ev.type === "error") {
              setStatus("error"); setProgress(ev.message ?? "Error");
            }
          } catch {}
        }
      }
      if (status === "running") setStatus("done");
    } catch (e) {
      setStatus("error");
      setProgress(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [validCompanies]);

  // ── Downloads ──────────────────────────────────────────────────────────────
  const downloadCSV = (rowsToExport = rows) => {
    if (!rowsToExport.length) return;
    const keys   = ["company_name", "domain", ...SCHEMA_FIELDS.map(f => f.key)];
    const header = ["Company", "Domain", ...SCHEMA_FIELDS.map(f => f.label)];
    const csv = [
      header.join(","),
      ...rowsToExport.map(r => keys.map(k => `"${(r[k] ?? "").replace(/"/g, '""')}"`).join(",")),
    ].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }));
    a.download = "tech-stack.csv"; a.click();
  };

  const downloadJSON = (rowsToExport = rows) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(rowsToExport, null, 2)], { type: "application/json" }));
    a.download = "tech-stack.json"; a.click();
  };

  // ── Results table ──────────────────────────────────────────────────────────
  const renderTable = (tableRows) => (
    <div className={s.tableWrap}>
      <div className={s.tableScroll}>
        <table className={s.table}>
          <thead className={s.thead}>
            <tr className={s.theadTr}>
              <th className={s.th}>#</th>
              <th className={s.th}>Company</th>
              {SCHEMA_FIELDS.map(f => <th key={f.key} className={s.th}>{f.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {tableRows.map((row, i) => {
              const catStyle = CORE_CATEGORY_COLORS[row.core_tech_category] || {};
              const confStyle = confidenceColor(row.confidence_score);
              return (
                <tr key={i} className={`${s.tbodyTr} ${i % 2 === 0 ? "" : s.tbodyTrEven} ${s.rowNew}`}>
                  <td className={`${s.td} ${s.tdNum}`}>{i + 1}</td>
                  <td className={`${s.td} ${s.tdCo}`}>{row.company_name}</td>
                  {SCHEMA_FIELDS.map(f => (
                    <td key={f.key} className={`${s.td} ${s.tdVal}`}>
                      {f.key === "core_tech_category" && row[f.key] && row[f.key] !== "—" ? (
                        <span className={s.catBadge} style={{ background: catStyle.bg, color: catStyle.color }}>
                          {row[f.key]}
                        </span>
                      ) : f.key === "confidence_score" && row[f.key] && row[f.key] !== "—" ? (
                        <span className={s.confBadge} style={{ background: confStyle.bg, color: confStyle.color }}>
                          {row[f.key]}
                        </span>
                      ) : f.key === "source_info" && row[f.key] && row[f.key] !== "—" ? (
                        <span className={s.sourceBadge}>{row[f.key]}</span>
                      ) : row[f.key] && row[f.key] !== "—" ? (
                        <span className={s.tdValInner}>{row[f.key]}</span>
                      ) : (
                        <span className={s.tdNone}>—</span>
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className={s.page}>

      {/* Header */}
      <header className={s.header}>
        <div className={s.headerInner}>
          <div className={s.iconBox}><Cpu size={14} color="#818cf8" /></div>
          <div>
            <div className={s.headerTitle}>Tech Stack Finder</div>
            <div className={s.headerSub}>Powered by RefractOne</div>
          </div>
          <div className={s.headerActions}>
            <button className={s.historyBtn}
              onClick={() => { setHistory(loadHistory()); setShowHistory(true); setHistoryEntry(null); }}>
              <History size={13} /> History
              {history.length > 0 && <span className={s.historyBadge}>{history.length}</span>}
            </button>
            <a href="/enrich" className={s.navLink}>IT Deal Finder</a>
            <a href="/" className={s.backLink}>← IT Deal Scan</a>
          </div>
        </div>
      </header>

      {/* History panel */}
      {showHistory && (
        <div className={s.historyOverlay} onClick={() => { setShowHistory(false); setHistoryEntry(null); }}>
          <div className={s.historyPanel} onClick={e => e.stopPropagation()}>
            <div className={s.historyHeader}>
              <span className={s.historyTitle}>
                {historyEntry
                  ? <button className={s.historyBack} onClick={() => setHistoryEntry(null)}>← Back</button>
                  : "Scan History"}
              </span>
              {!historyEntry && history.length > 0 && (
                <button className={s.historyDeleteAll} onClick={() => { saveHistory([]); setHistory([]); }}>Clear all</button>
              )}
              <button className={s.historyClose} onClick={() => { setShowHistory(false); setHistoryEntry(null); }}><X size={15} /></button>
            </div>
            {!historyEntry && (
              history.length === 0
                ? <div className={s.historyEmpty}>No scans yet. Run a search to save results.</div>
                : <div className={s.historyList}>
                    {history.map(entry => (
                      <button key={entry.id} className={s.historyItem} onClick={() => setHistoryEntry(entry)}>
                        <div className={s.historyItemTop}>
                          <span className={s.historyItemCompanies}>
                            {entry.companies.slice(0, 3).join(", ")}
                            {entry.companies.length > 3 ? ` +${entry.companies.length - 3}` : ""}
                          </span>
                          <span className={s.historyItemCount}>{entry.rows.filter(r=>r._status==="ok").length} tools</span>
                        </div>
                        <div className={s.historyItemDate}><Clock size={10} /> {new Date(entry.date).toLocaleString()}</div>
                      </button>
                    ))}
                  </div>
            )}
            {historyEntry && (
              <div className={s.historyDetail}>
                <div className={s.historyDetailMeta}>
                  <span className={s.historyItemDate}><Clock size={10} /> {new Date(historyEntry.date).toLocaleString()}</span>
                  <span className={s.historyItemCount}>{historyEntry.rows.filter(r=>r._status==="ok").length} tools · {historyEntry.companies.length} companies</span>
                </div>
                <div className={s.historyDetailActions}>
                  <button className={s.dlBtnCSV} onClick={() => downloadCSV(historyEntry.rows)}><Download size={12}/> CSV</button>
                  <button className={s.dlBtnJSON} onClick={() => downloadJSON(historyEntry.rows)}><Download size={12}/> JSON</button>
                  <button className={s.historyDeleteOne} onClick={() => {
                    const updated = history.filter(h => h.id !== historyEntry.id);
                    saveHistory(updated); setHistory(updated); setHistoryEntry(null);
                  }}><Trash2 size={12}/> Delete</button>
                </div>
                <div style={{marginTop:8}}>{renderTable(historyEntry.rows)}</div>
              </div>
            )}
          </div>
        </div>
      )}

      <main className={s.main}>

        {/* Companies card */}
        <div className={s.card}>
          <div className={s.row}>
            <div>
              <div className={s.cardTitle}>Companies to scan</div>
              <div className={s.cardSub}>Always runs a full wide-spectrum scan (Core Tech Stack, Enterprise & Financial Systems, Security, AI/Data…). Adding Focus Categories or Focus Vendors runs a second targeted pass on top.</div>
            </div>
            <button className={s.btnAdd} onClick={addCompany}><Plus size={12}/> Add company</button>
          </div>

          {companies.map((c) => (
            <div key={c.id} className={s.companyBlock}>
              <div className={s.companyRow1}>
                <div className={s.fieldGroup}>
                  <label className={s.fieldLabel}>Company Name *</label>
                  <input className={s.inp} placeholder="e.g. HDFC Bank"
                    value={c.company_name} onChange={e => updateCompany(c.id, { company_name: e.target.value })} />
                </div>
                <div className={s.fieldGroup}>
                  <label className={s.fieldLabel}>Domain *</label>
                  <input className={s.inp} placeholder="e.g. hdfcbank.com"
                    value={c.domain} onChange={e => updateCompany(c.id, { domain: e.target.value })} />
                </div>
                <div className={s.fieldGroup}>
                  <label className={s.fieldLabel}>LinkedIn URL <span className={s.optional}>optional</span></label>
                  <input className={s.inp} placeholder="linkedin.com/company/…"
                    value={c.linkedin_url} onChange={e => updateCompany(c.id, { linkedin_url: e.target.value })} />
                </div>
                {companies.length > 1 && (
                  <button className={s.btnIcon} style={{alignSelf:"flex-end",marginBottom:2}}
                    onClick={() => removeCompany(c.id)}><Trash2 size={14}/></button>
                )}
              </div>
              <div className={s.companyRow2}>
                <div className={s.fieldGroup}>
                  <label className={s.fieldLabel}>
                    Focus Categories <span className={s.optional}>optional · leave blank for full audit</span>
                  </label>
                  <textarea className={`${s.inp} ${s.ta}`} style={{height:56,fontFamily:"monospace",fontSize:11}}
                    placeholder={"e.g. CRM & Account Management, Cloud Hosting, AI/ML Infrastructure"}
                    value={c.focus_categories_text}
                    onChange={e => updateCompany(c.id, { focus_categories_text: e.target.value })} />
                  <CategoryPicker
                    value={c.focus_categories_text}
                    onChange={v => updateCompany(c.id, { focus_categories_text: v })}
                  />
                  {parseCSV(c.focus_categories_text).length > 0 &&
                    <div className={s.csvCount}>{parseCSV(c.focus_categories_text).length} categories — laser-focused mode</div>}
                </div>
                <div className={s.fieldGroup}>
                  <label className={s.fieldLabel}>
                    Focus Vendors <span className={s.optional}>optional · also finds their competitors</span>
                  </label>
                  <textarea className={`${s.inp} ${s.ta}`} style={{height:68,fontFamily:"monospace",fontSize:11}}
                    placeholder={"Salesforce, SAP, Microsoft Azure, Snowflake"}
                    value={c.focus_vendors_text}
                    onChange={e => updateCompany(c.id, { focus_vendors_text: e.target.value })} />
                  {parseCSV(c.focus_vendors_text).length > 0 &&
                    <div className={s.csvCount}>{parseCSV(c.focus_vendors_text).length} vendors — laser-focused mode</div>}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Run bar */}
        <div className={s.runBar}>
          {status !== "idle" && (
            <div className={s.statusBar}>
              {status === "running" && <Loader2 size={16} color="#818cf8" className={s.spin}/>}
              {status === "done"    && <CheckCircle2 size={16} color="#34d399"/>}
              {status === "error"   && <span style={{color:"#E63946",fontSize:13}}>✕</span>}
              <span className={s.statusText}>{progress}</span>
              {status === "done" && rows.length > 0 && (
                <div className={s.dlBtn}>
                  <button className={s.dlBtnCSV} onClick={() => downloadCSV()}><Download size={12}/> CSV</button>
                  <button className={s.dlBtnJSON} onClick={() => downloadJSON()}><Download size={12}/> JSON</button>
                </div>
              )}
            </div>
          )}
          <button
            className={`${s.btn} ${s.btnPrimary} ${s.btnRun}`}
            onClick={run}
            disabled={status === "running" || validCompanies.length === 0}>
            {status === "running"
              ? <><Loader2 size={16} className={s.spin}/> Scanning…</>
              : <><Cpu size={16}/> {status === "done" ? "Scan again" : "Scan Tech Stack"}</>}
          </button>
        </div>

        {/* Results */}
        {rows.length > 0 && renderTable(rows)}

      </main>
    </div>
  );
}
