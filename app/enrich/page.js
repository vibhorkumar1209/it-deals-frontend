"use client";

import { useState, useCallback, useEffect } from "react";
import { Plus, Trash2, Play, Download, Loader2, CheckCircle2, History, X, Clock, Search } from "lucide-react";
import s from "./enrich.module.css";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4001";

// ── Fixed schema (matches enrich_pipeline.py SCHEMA_FIELDS) ──────────────────
const SCHEMA_FIELDS = [
  { key: "vendor",      label: "Vendor" },
  { key: "deal_type",   label: "Deal Type" },
  { key: "deal_value",  label: "Value" },
  { key: "date_signed", label: "Date" },
  { key: "description", label: "Description" },
  { key: "source",      label: "Source" },
];

const FIXED_GOAL =
  "Find every IT and technology deal, contract, outsourcing agreement, and digital transformation initiative involving this company.";

// ── History helpers ───────────────────────────────────────────────────────────
const HISTORY_KEY = "it_deal_finder_history";
const MAX_HISTORY  = 50;

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]"); }
  catch { return []; }
}
function saveHistory(h) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h)); } catch {}
}
function addToHistory(companies, rows) {
  if (!rows.length) return;
  const entry = {
    id: Date.now(),
    date: new Date().toISOString(),
    companies: companies.map(c => c.company_name).filter(Boolean),
    rows,
  };
  saveHistory([entry, ...loadHistory()].slice(0, MAX_HISTORY));
}

// ── Parse CSV / newline text → string array ───────────────────────────────────
function parseCSV(text) {
  return text.split(/[\n,]/).map(s => s.trim()).filter(Boolean);
}

// ── Empty company row ─────────────────────────────────────────────────────────
const emptyCompany = () => ({
  id: Math.random().toString(36).slice(2),
  company_name: "",
  domain: "",
  linkedin_url: "",
  focus_tech_text: "",
  focus_vendor_text: "",
});

export default function DealFinderPage() {
  const [companies, setCompanies]   = useState([emptyCompany()]);
  const [status, setStatus]         = useState("idle");   // idle | running | done | error
  const [progress, setProgress]     = useState("");
  const [rows, setRows]             = useState([]);
  const [showHistory, setShowHistory]   = useState(false);
  const [history, setHistory]           = useState([]);
  const [historyEntry, setHistoryEntry] = useState(null);

  useEffect(() => setHistory(loadHistory()), []);

  // ── Company list helpers ──────────────────────────────────────────────────
  const addCompany    = () => setCompanies(cs => [...cs, emptyCompany()]);
  const removeCompany = (id) => setCompanies(cs => cs.filter(c => c.id !== id));
  const updateCompany = (id, patch) =>
    setCompanies(cs => cs.map(c => c.id === id ? { ...c, ...patch } : c));

  // ── Run ───────────────────────────────────────────────────────────────────
  const validCompanies = companies.filter(c => c.company_name.trim() && c.domain.trim());

  const run = useCallback(async () => {
    if (!validCompanies.length) return;
    setStatus("running"); setRows([]); setProgress("Connecting to research engine…");

    const inputs = validCompanies.map(c => ({
      company_name:  c.company_name.trim(),
      domain:        c.domain.trim(),
      linkedin_url:  c.linkedin_url.trim(),
      focus_tech:    parseCSV(c.focus_tech_text),
      focus_vendor:  parseCSV(c.focus_vendor_text),
    }));

    try {
      const res = await fetch(`${API_URL}/api/enrich-task`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: FIXED_GOAL,
          schema_fields: SCHEMA_FIELDS.map(f => ({ key: f.key, label: f.label, type: "string", description: "" })),
          inputs,
        }),
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
              const okCount = allRows.filter(r => r._status === "ok").length;
              setProgress(`${okCount} deal${okCount === 1 ? "" : "s"} found — populating table…`);
            } else if (ev.type === "complete") {
              setStatus("done");
              const succeeded = ev.succeeded ?? allRows.filter(r => r._status === "ok").length;
              setProgress(`Done — ${succeeded} deals found across ${validCompanies.length} ${validCompanies.length === 1 ? "company" : "companies"}`);
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

  // ── Downloads ─────────────────────────────────────────────────────────────
  const downloadCSV = (rowsToExport = rows) => {
    if (!rowsToExport.length) return;
    const keys   = ["company_name", "domain", ...SCHEMA_FIELDS.map(f => f.key)];
    const header = ["Company", "Domain", ...SCHEMA_FIELDS.map(f => f.label)];
    const csv = [
      header.join(","),
      ...rowsToExport.map(r =>
        keys.map(k => `"${(r[k] ?? "").replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }));
    a.download = "it-deals.csv"; a.click();
  };

  const downloadJSON = (rowsToExport = rows) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(rowsToExport, null, 2)], { type: "application/json" }));
    a.download = "it-deals.json"; a.click();
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={s.page}>

      {/* Header */}
      <header className={s.header}>
        <div className={s.headerInner}>
          <div className={s.iconBox}><Search size={14} color="#3491E8" /></div>
          <div>
            <div className={s.headerTitle}>IT Deal Finder</div>
            <div className={s.headerSub}>Powered by RefractOne</div>
          </div>
          <div className={s.headerActions}>
            <button className={s.historyBtn}
              onClick={() => { setHistory(loadHistory()); setShowHistory(true); setHistoryEntry(null); }}>
              <History size={13} /> History
              {history.length > 0 && <span className={s.historyBadge}>{history.length}</span>}
            </button>
            <a href="/tech-stack" className={s.navLink} style={{fontSize:12,color:"#818cf8",textDecoration:"none",padding:"5px 10px",borderRadius:6,background:"rgba(129,140,248,0.08)",border:"1px solid rgba(129,140,248,0.2)"}}>Tech Stack Finder</a>
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
                  : "Report History"}
              </span>
              {!historyEntry && history.length > 0 && (
                <button className={s.historyDeleteAll} onClick={() => { saveHistory([]); setHistory([]); }}>Clear all</button>
              )}
              <button className={s.historyClose} onClick={() => { setShowHistory(false); setHistoryEntry(null); }}><X size={15} /></button>
            </div>

            {!historyEntry && (
              history.length === 0
                ? <div className={s.historyEmpty}>No reports yet. Run a search to save results.</div>
                : <div className={s.historyList}>
                    {history.map(entry => (
                      <button key={entry.id} className={s.historyItem} onClick={() => setHistoryEntry(entry)}>
                        <div className={s.historyItemTop}>
                          <span className={s.historyItemCompanies}>
                            {entry.companies.slice(0, 3).join(", ")}
                            {entry.companies.length > 3 ? ` +${entry.companies.length - 3}` : ""}
                          </span>
                          <span className={s.historyItemCount}>{entry.rows.length} deals</span>
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
                  <span className={s.historyItemCount}>{historyEntry.rows.length} deals · {historyEntry.companies.length} companies</span>
                </div>
                <div className={s.historyDetailActions}>
                  <button className={s.dlBtnCSV} onClick={() => downloadCSV(historyEntry.rows)}><Download size={12}/> CSV</button>
                  <button className={s.dlBtnJSON} onClick={() => downloadJSON(historyEntry.rows)}><Download size={12}/> JSON</button>
                  <button className={s.historyDeleteOne} onClick={() => {
                    const updated = history.filter(h => h.id !== historyEntry.id);
                    saveHistory(updated); setHistory(updated); setHistoryEntry(null);
                  }}><Trash2 size={12}/> Delete</button>
                </div>
                <div className={s.tableWrap} style={{marginTop:8}}>
                  <div className={s.tableScroll}>
                    <table className={s.table}>
                      <thead className={s.thead}><tr className={s.theadTr}>
                        <th className={s.th}>#</th>
                        <th className={s.th}>Company</th>
                        {SCHEMA_FIELDS.map(f => <th key={f.key} className={s.th}>{f.label}</th>)}
                      </tr></thead>
                      <tbody>
                        {historyEntry.rows.map((row, i) => (
                          <tr key={i} className={`${s.tbodyTr} ${i%2===0?"":s.tbodyTrEven}`}>
                            <td className={`${s.td} ${s.tdNum}`}>{i+1}</td>
                            <td className={`${s.td} ${s.tdCo}`}>{row.company_name}</td>
                            {SCHEMA_FIELDS.map(f => (
                              <td key={f.key} className={`${s.td} ${s.tdVal}`}>
                                {f.key === "source" && row[f.key]
                                  ? <a href={row[f.key]} target="_blank" rel="noreferrer" className={s.sourceLink}>↗ link</a>
                                  : row[f.key]
                                    ? <span className={s.tdValInner}>{row[f.key]}</span>
                                    : <span className={s.tdNone}>—</span>}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <main className={s.main}>

        {/* Companies card */}
        <div className={s.card}>
          <div className={s.row}>
            <div className={s.cardTitle}>Companies</div>
            <button className={s.btnAdd} onClick={addCompany}><Plus size={12}/> Add company</button>
          </div>
          <div className={s.cardSub}>Enter each company you want to research. Domain confirms the organisation. LinkedIn and focus fields are optional but improve accuracy.</div>

          {companies.map((c, idx) => (
            <div key={c.id} className={s.companyBlock}>
              {/* Row 1: core fields */}
              <div className={s.companyRow1}>
                <div className={s.fieldGroup}>
                  <label className={s.fieldLabel}>Company Name *</label>
                  <input className={s.inp} placeholder="e.g. HDFC Bank"
                    value={c.company_name}
                    onChange={e => updateCompany(c.id, { company_name: e.target.value })} />
                </div>
                <div className={s.fieldGroup}>
                  <label className={s.fieldLabel}>Domain *</label>
                  <input className={s.inp} placeholder="e.g. hdfcbank.com"
                    value={c.domain}
                    onChange={e => updateCompany(c.id, { domain: e.target.value })} />
                </div>
                <div className={s.fieldGroup}>
                  <label className={s.fieldLabel}>LinkedIn URL <span className={s.optional}>optional</span></label>
                  <input className={s.inp} placeholder="linkedin.com/company/…"
                    value={c.linkedin_url}
                    onChange={e => updateCompany(c.id, { linkedin_url: e.target.value })} />
                </div>
                {companies.length > 1 && (
                  <button className={s.btnIcon} style={{alignSelf:"flex-end",marginBottom:2}}
                    onClick={() => removeCompany(c.id)}><Trash2 size={14}/></button>
                )}
              </div>

              {/* Row 2: focus fields */}
              <div className={s.companyRow2}>
                <div className={s.fieldGroup}>
                  <label className={s.fieldLabel}>
                    Focus Technologies <span className={s.optional}>optional · comma or newline separated</span>
                  </label>
                  <textarea className={`${s.inp} ${s.ta}`} style={{height:72,fontFamily:"monospace",fontSize:11}}
                    placeholder={"core banking, cloud migration, ERP, cybersecurity, payments"}
                    value={c.focus_tech_text}
                    onChange={e => updateCompany(c.id, { focus_tech_text: e.target.value })} />
                  {parseCSV(c.focus_tech_text).length > 0 &&
                    <div className={s.csvCount}>{parseCSV(c.focus_tech_text).length} technologies</div>}
                </div>
                <div className={s.fieldGroup}>
                  <label className={s.fieldLabel}>
                    Focus Vendors <span className={s.optional}>optional · comma or newline separated</span>
                  </label>
                  <textarea className={`${s.inp} ${s.ta}`} style={{height:72,fontFamily:"monospace",fontSize:11}}
                    placeholder={"TCS, Infosys, SAP, Oracle, Microsoft, AWS, Temenos"}
                    value={c.focus_vendor_text}
                    onChange={e => updateCompany(c.id, { focus_vendor_text: e.target.value })} />
                  {parseCSV(c.focus_vendor_text).length > 0 &&
                    <div className={s.csvCount}>{parseCSV(c.focus_vendor_text).length} vendors</div>}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Run bar */}
        <div className={s.runBar}>
          {status !== "idle" && (
            <div className={s.statusBar}>
              {status === "running"  && <Loader2 size={16} color="#3491E8" className={s.spin}/>}
              {status === "done"     && <CheckCircle2 size={16} color="#34d399"/>}
              {status === "error"    && <span style={{color:"#E63946",fontSize:13}}>✕</span>}
              <span className={s.statusText}>{progress}</span>
              {(status === "done") && rows.length > 0 && (
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
              ? <><Loader2 size={16} className={s.spin}/> Researching…</>
              : <><Play size={16}/> {status === "done" ? "Search again" : "Find Deals"}</>}
          </button>
        </div>

        {/* Results table */}
        {rows.length > 0 && (
          <div className={s.tableWrap}>
            <div className={s.tableScroll}>
              <table className={s.table}>
                <thead className={s.thead}>
                  <tr className={s.theadTr}>
                    <th className={s.th}>#</th>
                    <th className={s.th}>Company</th>
                    {SCHEMA_FIELDS.map(f => <th key={f.key} className={s.th}>{f.label}</th>)}
                    <th className={s.th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} className={`${s.tbodyTr} ${i%2===0?"":s.tbodyTrEven} ${s.rowNew}`}>
                      <td className={`${s.td} ${s.tdNum}`}>{i+1}</td>
                      <td className={`${s.td} ${s.tdCo}`}>{row.company_name}</td>
                      {SCHEMA_FIELDS.map(f => (
                        <td key={f.key} className={`${s.td} ${s.tdVal}`}>
                          {f.key === "source" && row[f.key]
                            ? <a href={row[f.key]} target="_blank" rel="noreferrer" className={s.sourceLink}>↗ link</a>
                            : row[f.key]
                              ? <span className={s.tdValInner}>{row[f.key]}</span>
                              : <span className={s.tdNone}>—</span>}
                        </td>
                      ))}
                      <td className={s.td}>
                        <span className={`${s.badge} ${row._status==="ok" ? s.badgeOk : s.badgeNone}`}>
                          {row._status === "ok" ? "Found" : row._status === "timeout" ? "Timeout" : "No data"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
