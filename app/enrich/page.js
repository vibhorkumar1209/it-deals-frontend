"use client";

import { useState, useCallback, useEffect } from "react";
import { Plus, Trash2, Play, Download, Loader2, CheckCircle2, History, X, Clock, Search, Target, Cpu, DollarSign, ChevronDown, ChevronUp } from "lucide-react";
import s from "./enrich.module.css";

// ── GCC Intel constants ───────────────────────────────────────────────────────
const GCC_AFTERMARKET_DOMAINS = [
  "Warranty Management","Service Operations & Field Service","Quality Management",
  "Knowledge Management & Technical Documentation","Parts & Spare Parts Management",
  "Dealer Management System (DMS)","Supply Chain & Procurement","Manufacturing Execution & IoT",
  "Engineering & PLM","Customer Experience & CRM","Finance & ERP","HR & Workforce Management",
  "Data Foundation & Analytics","AI & Automation Platform","Cybersecurity & Compliance",
];
const GCC_TECH_FIELDS  = [{key:"domain",label:"Domain"},{key:"layer",label:"Layer"},{key:"tool_vendor",label:"Tool / Vendor"},{key:"current_status",label:"Status"},{key:"notes",label:"Notes"},{key:"source",label:"Source"}];
const GCC_VENDOR_FIELDS = [{key:"domain",label:"Domain"},{key:"signal_strength",label:"Signal"},{key:"opportunity_type",label:"Opportunity"},{key:"existing_competitor",label:"Incumbent"},{key:"readiness_score",label:"Score"},{key:"rationale",label:"Rationale"},{key:"source",label:"Source"}];
const GCC_BUDGET_FIELDS = [{key:"domain",label:"Domain"},{key:"estimated_budget",label:"Est. Budget (USD)"},{key:"budget_basis",label:"Basis"},{key:"source",label:"Source"}];
const GCC_STATUS_COLORS = {"Active":{bg:"rgba(52,211,153,0.12)",color:"#34d399"},"Legacy":{bg:"rgba(251,191,36,0.12)",color:"#fbbf24"},"Evaluating":{bg:"rgba(52,145,232,0.12)",color:"#3491E8"},"Planned":{bg:"rgba(129,140,248,0.12)",color:"#818cf8"},"Replaced":{bg:"rgba(230,57,70,0.12)",color:"#E63946"}};
const GCC_SIGNAL_COLORS = {"High":{bg:"rgba(52,211,153,0.15)",color:"#34d399"},"Medium":{bg:"rgba(251,191,36,0.15)",color:"#fbbf24"},"Low":{bg:"rgba(100,116,139,0.15)",color:"#64748b"},"None":{bg:"rgba(30,58,80,0.5)",color:"#334155"}};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4001";

// ── Fixed schema (matches enrich_pipeline.py SCHEMA_FIELDS) ──────────────────
const SCHEMA_FIELDS = [
  { key: "vendor",      label: "Vendor/Partner" },
  { key: "deal_type",   label: "Deal Type" },
  { key: "deal_value",  label: "Deal Value" },
  { key: "date_signed", label: "Last Detected" },
  { key: "deal_focus",  label: "Deal Focus" },
  { key: "description", label: "Deal Description" },
  { key: "source",      label: "Source" },
];

// ── Format date string as "Mon YYYY" ─────────────────────────────────────────
function fmtMonthYear(val) {
  if (!val) return "-";
  // Try parsing known formats: YYYY-MM-DD, YYYY-MM, YYYY
  const clean = val.trim();
  const full = new Date(clean);
  if (!isNaN(full.getTime()) && clean.length >= 7) {
    return full.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
  }
  // Year only — return as-is
  if (/^\d{4}$/.test(clean)) return clean;
  // Already looks like "Jan 2024" etc.
  return clean;
}

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
  // ── Module switcher ───────────────────────────────────────────────────────
  const [activeModule, setActiveModule] = useState("deals"); // "deals" | "gcc"

  // ── IT Deal Finder state ──────────────────────────────────────────────────
  const [companies, setCompanies]   = useState([emptyCompany()]);
  const [status, setStatus]         = useState("idle");
  const [progress, setProgress]     = useState("");
  const [rows, setRows]             = useState([]);
  const [showHistory, setShowHistory]   = useState(false);
  const [history, setHistory]           = useState([]);
  const [historyEntry, setHistoryEntry] = useState(null);

  // ── GCC Intel state ───────────────────────────────────────────────────────
  const [gccCompany, setGccCompany]     = useState("");
  const [gccDomain, setGccDomain]       = useState("");
  const [gccVendor, setGccVendor]       = useState("");
  const [gccFocusText, setGccFocusText] = useState("");
  const [gccStatus, setGccStatus]       = useState("idle");
  const [gccProgress, setGccProgress]   = useState("");
  const [gccTechRows, setGccTechRows]   = useState([]);
  const [gccBudgetRows, setGccBudgetRows] = useState([]);
  const [gccVendorRows, setGccVendorRows] = useState([]);
  const [gccTab, setGccTab]             = useState("tech");
  const [gccExpanded, setGccExpanded]   = useState({});

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

  // ── GCC Run ───────────────────────────────────────────────────────────────
  const runGCC = useCallback(async () => {
    if (!gccCompany.trim()) return;
    setGccStatus("running"); setGccProgress("Connecting to GCC Intelligence Engine…");
    setGccTechRows([]); setGccBudgetRows([]); setGccVendorRows([]);
    try {
      const res = await fetch(`${API_URL}/api/gcc-intel`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_name: gccCompany.trim(), domain: gccDomain.trim(), target_vendor: gccVendor.trim(), focus_domains: parseCSV(gccFocusText) }),
      });
      if (!res.ok || !res.body) throw new Error(`Server error ${res.status}`);
      const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = "";
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n"); buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const ev = JSON.parse(line.slice(6));
            if (ev.type === "heartbeat" || ev.type === "progress") { setGccProgress(ev.message ?? ""); }
            else if (ev.type === "tech_stack_row") { setGccTechRows(r => [...r, ev.row]); setGccTab("tech"); }
            else if (ev.type === "budget_row") { setGccBudgetRows(r => [...r, ev.row]); }
            else if (ev.type === "vendor_signal_row") { setGccVendorRows(r => [...r, ev.row]); }
            else if (ev.type === "complete") { setGccStatus("done"); setGccProgress(`Done — ${ev.total_tools ?? 0} tools mapped across ${ev.domains_researched ?? 0} domains`); setGccTab("tech"); }
            else if (ev.type === "error") { setGccStatus("error"); setGccProgress(ev.message ?? "Error"); }
          } catch {}
        }
      }
    } catch (e) { setGccStatus("error"); setGccProgress(`Failed: ${e instanceof Error ? e.message : String(e)}`); }
  }, [gccCompany, gccDomain, gccVendor, gccFocusText]);

  const dlCSV = (rows, fields, name) => {
    if (!rows.length) return;
    const keys = fields.map(f => f.key);
    const csv = [fields.map(f=>f.label).join(","), ...rows.map(r => keys.map(k=>`"${(r[k]??"").replace(/"/g,'""')}"`).join(","))].join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿"+csv],{type:"text/csv;charset=utf-8;"})); a.download = name; a.click();
  };

  const gccTechByDomain = gccTechRows.reduce((acc, row) => { const d = row.domain||"Other"; if(!acc[d]) acc[d]=[]; acc[d].push(row); return acc; }, {});

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
          <div className={s.iconBox}>
            {activeModule === "gcc" ? <Target size={14} color="#f472b6" /> : <Search size={14} color="#3491E8" />}
          </div>
          <div>
            <div className={s.headerTitle}>RefractOne Intelligence</div>
            <div className={s.headerSub}>Powered by RefractOne</div>
          </div>
          <div className={s.headerActions}>
            {activeModule === "deals" && (
              <button className={s.historyBtn}
                onClick={() => { setHistory(loadHistory()); setShowHistory(true); setHistoryEntry(null); }}>
                <History size={13} /> History
                {history.length > 0 && <span className={s.historyBadge}>{history.length}</span>}
              </button>
            )}
            <a href="/tech-stack" className={s.navLink} style={{fontSize:12,color:"#818cf8",textDecoration:"none",padding:"5px 10px",borderRadius:6,background:"rgba(129,140,248,0.08)",border:"1px solid rgba(129,140,248,0.2)"}}>Tech Stack</a>
          </div>
        </div>
        {/* Module tabs */}
        <div className={s.moduleTabs}>
          <button className={`${s.moduleTab} ${activeModule==="deals" ? s.moduleTabActive : ""}`} onClick={() => setActiveModule("deals")}>
            <Search size={13}/> IT Deal Finder
          </button>
          <button className={`${s.moduleTab} ${activeModule==="gcc" ? s.moduleTabActiveGcc : ""}`} onClick={() => setActiveModule("gcc")}>
            <Target size={13}/> GCC Intelligence Hub
          </button>
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
                                  : f.key === "deal_focus" && row[f.key]
                                    ? <span className={s.focusBadge}>{row[f.key]}</span>
                                  : f.key === "date_signed"
                                    ? <span>{fmtMonthYear(row[f.key])}</span>
                                  : f.key === "deal_value"
                                    ? <span>{row[f.key] || "-"}</span>
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
      {/* ── GCC Intelligence Hub module ─────────────────────────────────── */}
      {activeModule === "gcc" && (
        <>
          <div className={s.card}>
            <div className={s.cardTitle}>GCC Intelligence Hub — Target Configuration</div>
            <div className={s.cardSub}>Two-phase AI research across {GCC_AFTERMARKET_DOMAINS.length} aftermarket domains. Optionally score a vendor's readiness signals.</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:12}}>
              <div className={s.fieldGroup}>
                <label className={s.fieldLabel}>Company Name *</label>
                <input className={s.inp} placeholder="e.g. Daimler Truck North America" value={gccCompany} onChange={e=>setGccCompany(e.target.value)} />
              </div>
              <div className={s.fieldGroup}>
                <label className={s.fieldLabel}>Company Domain</label>
                <input className={s.inp} placeholder="e.g. daimler-trucks.com" value={gccDomain} onChange={e=>setGccDomain(e.target.value)} />
              </div>
              <div className={s.fieldGroup}>
                <label className={s.fieldLabel}>Target Vendor <span className={s.optional}>optional</span></label>
                <input className={s.inp} placeholder="e.g. Tavant, Salesforce, SAP" value={gccVendor} onChange={e=>setGccVendor(e.target.value)} />
              </div>
              <div className={s.fieldGroup}>
                <label className={s.fieldLabel}>Focus Domains <span className={s.optional}>optional · comma separated</span></label>
                <textarea className={`${s.inp} ${s.ta}`} style={{height:58,fontSize:11,fontFamily:"monospace"}} placeholder={GCC_AFTERMARKET_DOMAINS.slice(0,2).join(", ")+"…"} value={gccFocusText} onChange={e=>setGccFocusText(e.target.value)} />
              </div>
            </div>
          </div>

          <div className={s.runBar}>
            {gccStatus !== "idle" && (
              <div className={s.statusBar}>
                {gccStatus==="running" && <Loader2 size={16} color="#f472b6" className={s.spin}/>}
                {gccStatus==="done"    && <CheckCircle2 size={16} color="#34d399"/>}
                {gccStatus==="error"   && <span style={{color:"#E63946",fontSize:13}}>✕</span>}
                <span className={s.statusText}>{gccProgress}</span>
                {gccStatus==="done" && (
                  <div className={s.dlBtn}>
                    {gccTechRows.length>0 && <button className={s.dlBtnCSV} onClick={()=>dlCSV(gccTechRows,GCC_TECH_FIELDS,"gcc-tech-stack.csv")}><Download size={12}/> Tech Stack</button>}
                    {gccBudgetRows.length>0 && <button className={s.dlBtnJSON} onClick={()=>dlCSV(gccBudgetRows,GCC_BUDGET_FIELDS,"gcc-budget.csv")}><Download size={12}/> Budget</button>}
                    {gccVendorRows.length>0 && <button className={s.dlBtnCSV} style={{background:"rgba(244,114,182,0.12)",color:"#f472b6"}} onClick={()=>dlCSV(gccVendorRows,GCC_VENDOR_FIELDS,"gcc-signals.csv")}><Download size={12}/> Signals</button>}
                  </div>
                )}
              </div>
            )}
            <button className={`${s.btn} ${s.btnPrimary} ${s.btnRun}`} style={{background:"#e879a0"}} onClick={runGCC} disabled={gccStatus==="running"||!gccCompany.trim()}>
              {gccStatus==="running" ? <><Loader2 size={16} className={s.spin}/> Researching…</> : <><Target size={16}/> {gccStatus==="done"?"Run again":"Run Intelligence"}</>}
            </button>
          </div>

          {(gccTechRows.length>0||gccBudgetRows.length>0||gccVendorRows.length>0) && (
            <div className={s.tableWrap} style={{borderRadius:14}}>
              <div style={{display:"flex",gap:0,borderBottom:"1px solid #1a3a50",background:"#0c1f2e"}}>
                {[["tech","Tech Stack",gccTechRows.length],["budget","IT Budget",gccBudgetRows.length],...(gccVendorRows.length?[["vendor",(gccVendor||"Vendor")+" Signals",gccVendorRows.length]]:[])]
                  .map(([id,label,cnt])=>(
                  <button key={id} onClick={()=>setGccTab(id)} style={{display:"inline-flex",alignItems:"center",gap:6,padding:"11px 18px",fontSize:12,fontWeight:600,color:gccTab===id?"#f472b6":"#475569",background:"none",border:"none",borderBottom:gccTab===id?"2px solid #f472b6":"2px solid transparent",cursor:"pointer",fontFamily:"inherit"}}>
                    {label} <span style={{background:"rgba(244,114,182,0.1)",color:"#f472b6",fontSize:10,padding:"1px 5px",borderRadius:10}}>{cnt}</span>
                  </button>
                ))}
              </div>

              {gccTab==="tech" && (
                <div>
                  {Object.entries(gccTechByDomain).map(([dom,drows])=>(
                    <div key={dom} style={{borderBottom:"1px solid #0f2a3d"}}>
                      <button style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"10px 16px",background:"#0a1c2a",border:"none",cursor:"pointer",fontFamily:"inherit",color:"#fff",textAlign:"left"}} onClick={()=>setGccExpanded(p=>({...p,[dom]:p[dom]===false?true:false}))}>
                        <span style={{fontSize:12,fontWeight:700,flex:1}}>{dom}</span>
                        <span style={{fontSize:10,color:"#3491E8",background:"rgba(52,145,232,0.1)",padding:"1px 7px",borderRadius:10}}>{drows.length} tools</span>
                        {gccExpanded[dom]===false ? <ChevronDown size={13}/> : <ChevronUp size={13}/>}
                      </button>
                      {gccExpanded[dom]!==false && (
                        <div className={s.tableScroll}>
                          <table className={s.table}><thead className={s.thead}><tr className={s.theadTr}>
                            {GCC_TECH_FIELDS.filter(f=>f.key!=="domain").map(f=><th key={f.key} className={s.th}>{f.label}</th>)}
                          </tr></thead><tbody>
                            {drows.map((row,i)=>{const st=GCC_STATUS_COLORS[row.current_status]||{};return(
                              <tr key={i} className={`${s.tbodyTr} ${i%2===0?"":s.tbodyTrEven} ${s.rowNew}`}>
                                <td className={s.td}><span style={{display:"inline-block",padding:"2px 6px",borderRadius:4,fontSize:10,fontWeight:600,background:"rgba(52,145,232,0.08)",color:"#475569"}}>{row.layer||"—"}</span></td>
                                <td className={`${s.td} ${s.tdCo}`}>{row.tool_vendor||"—"}</td>
                                <td className={s.td}>{row.current_status?<span style={{display:"inline-block",padding:"2px 7px",borderRadius:20,fontSize:10,fontWeight:700,background:st.bg,color:st.color}}>{row.current_status}</span>:<span className={s.tdNone}>—</span>}</td>
                                <td className={`${s.td} ${s.tdVal}`} style={{fontSize:11,color:"#94a3b8"}}>{row.notes||"—"}</td>
                                <td className={s.td}>{row.source&&row.source!=="-"?<a href={row.source} target="_blank" rel="noreferrer" className={s.sourceLink}>↗ link</a>:<span className={s.tdNone}>—</span>}</td>
                              </tr>);})}
                          </tbody></table>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {gccTab==="budget" && gccBudgetRows.length>0 && (
                <div className={s.tableScroll}><table className={s.table}><thead className={s.thead}><tr className={s.theadTr}>
                  {GCC_BUDGET_FIELDS.map(f=><th key={f.key} className={s.th}>{f.label}</th>)}
                </tr></thead><tbody>
                  {gccBudgetRows.map((row,i)=>(
                    <tr key={i} className={`${s.tbodyTr} ${i%2===0?"":s.tbodyTrEven} ${s.rowNew}`}>
                      <td className={`${s.td} ${s.tdCo}`}>{row.domain||"—"}</td>
                      <td className={s.td} style={{fontWeight:700,color:"#34d399",fontSize:13}}>{row.estimated_budget||"—"}</td>
                      <td className={s.td}>{row.budget_basis||"—"}</td>
                      <td className={s.td}>{row.source&&row.source!=="-"?<a href={row.source} target="_blank" rel="noreferrer" className={s.sourceLink}>↗ link</a>:<span className={s.tdNone}>—</span>}</td>
                    </tr>
                  ))}
                </tbody></table></div>
              )}

              {gccTab==="vendor" && gccVendorRows.length>0 && (
                <div className={s.tableScroll}><table className={s.table}><thead className={s.thead}><tr className={s.theadTr}>
                  {GCC_VENDOR_FIELDS.map(f=><th key={f.key} className={s.th}>{f.label}</th>)}
                </tr></thead><tbody>
                  {gccVendorRows.map((row,i)=>{const sig=GCC_SIGNAL_COLORS[row.signal_strength]||{};const score=parseInt(row.readiness_score)||0;return(
                    <tr key={i} className={`${s.tbodyTr} ${i%2===0?"":s.tbodyTrEven} ${s.rowNew}`}>
                      <td className={`${s.td} ${s.tdCo}`}>{row.domain||"—"}</td>
                      <td className={s.td}>{row.signal_strength?<span style={{display:"inline-block",padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:700,background:sig.bg,color:sig.color}}>{row.signal_strength}</span>:<span className={s.tdNone}>—</span>}</td>
                      <td className={s.td}><span style={{display:"inline-block",padding:"2px 6px",borderRadius:4,fontSize:10,background:"rgba(129,140,248,0.1)",color:"#818cf8"}}>{row.opportunity_type||"—"}</span></td>
                      <td className={`${s.td} ${s.tdCo}`}>{row.existing_competitor||"—"}</td>
                      <td className={s.td}>{score>0?<div style={{display:"flex",alignItems:"center",gap:6,minWidth:80}}><div style={{height:4,borderRadius:2,width:`${score}%`,background:score>=70?"#34d399":score>=40?"#fbbf24":"#E63946"}}/><span style={{fontSize:11,fontWeight:700}}>{score}</span></div>:<span className={s.tdNone}>—</span>}</td>
                      <td className={`${s.td} ${s.tdVal}`} style={{fontSize:11,color:"#94a3b8",maxWidth:240}}>{row.rationale||"—"}</td>
                      <td className={s.td}>{row.source&&row.source!=="-"?<a href={row.source} target="_blank" rel="noreferrer" className={s.sourceLink}>↗ link</a>:<span className={s.tdNone}>—</span>}</td>
                    </tr>);})}
                </tbody></table></div>
              )}
            </div>
          )}
        </>
      )}
      {activeModule === "deals" && <>

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
                            : f.key === "deal_focus" && row[f.key]
                              ? <span className={s.focusBadge}>{row[f.key]}</span>
                            : f.key === "date_signed"
                              ? <span>{fmtMonthYear(row[f.key])}</span>
                            : f.key === "deal_value"
                              ? <span>{row[f.key] || "-"}</span>
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
      </>}

      </main>
    </div>
  );
}
