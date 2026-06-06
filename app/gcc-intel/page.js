"use client";

import { useState, useCallback, useEffect } from "react";
import { Play, Download, Loader2, CheckCircle2, X, Cpu, Target, DollarSign, ChevronDown, ChevronUp } from "lucide-react";
import s from "./gcc-intel.module.css";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4001";

const TECH_STACK_FIELDS = [
  { key: "domain",         label: "Domain" },
  { key: "layer",          label: "Layer" },
  { key: "tool_vendor",    label: "Tool / Vendor" },
  { key: "current_status", label: "Status" },
  { key: "notes",          label: "Notes" },
  { key: "source",         label: "Source" },
];

const VENDOR_SIGNAL_FIELDS = [
  { key: "domain",              label: "Domain" },
  { key: "signal_strength",     label: "Signal" },
  { key: "opportunity_type",    label: "Opportunity" },
  { key: "existing_competitor", label: "Incumbent" },
  { key: "readiness_score",     label: "Score" },
  { key: "rationale",           label: "Rationale" },
  { key: "source",              label: "Source" },
];

const BUDGET_FIELDS = [
  { key: "domain",           label: "Domain" },
  { key: "estimated_budget", label: "Est. Budget (USD)" },
  { key: "budget_basis",     label: "Basis" },
  { key: "source",           label: "Source" },
];

const AFTERMARKET_DOMAINS = [
  "Warranty Management",
  "Service Operations & Field Service",
  "Quality Management",
  "Knowledge Management & Technical Documentation",
  "Parts & Spare Parts Management",
  "Dealer Management System (DMS)",
  "Supply Chain & Procurement",
  "Manufacturing Execution & IoT",
  "Engineering & PLM",
  "Customer Experience & CRM",
  "Finance & ERP",
  "HR & Workforce Management",
  "Data Foundation & Analytics",
  "AI & Automation Platform",
  "Cybersecurity & Compliance",
];

const STATUS_COLORS = {
  "Active":     { bg: "rgba(52,211,153,0.12)", color: "#34d399" },
  "Legacy":     { bg: "rgba(251,191,36,0.12)", color: "#fbbf24" },
  "Evaluating": { bg: "rgba(52,145,232,0.12)", color: "#3491E8" },
  "Planned":    { bg: "rgba(129,140,248,0.12)", color: "#818cf8" },
  "Replaced":   { bg: "rgba(230,57,70,0.12)",  color: "#E63946" },
};

const SIGNAL_COLORS = {
  "High":   { bg: "rgba(52,211,153,0.15)", color: "#34d399" },
  "Medium": { bg: "rgba(251,191,36,0.15)", color: "#fbbf24" },
  "Low":    { bg: "rgba(100,116,139,0.15)", color: "#64748b" },
  "None":   { bg: "rgba(30,58,80,0.5)",    color: "#334155" },
};

function parseCSV(text) {
  return text.split(/[\n,]/).map(s => s.trim()).filter(Boolean);
}

export default function GCCIntelPage() {
  const [companyName, setCompanyName]         = useState("");
  const [domain, setDomain]                   = useState("");
  const [targetVendor, setTargetVendor]       = useState("");
  const [focusText, setFocusText]             = useState("");
  const [status, setStatus]                   = useState("idle");
  const [progress, setProgress]               = useState("");
  const [techRows, setTechRows]               = useState([]);
  const [budgetRows, setBudgetRows]           = useState([]);
  const [vendorRows, setVendorRows]           = useState([]);
  const [activeTab, setActiveTab]             = useState("tech");
  const [expandedDomains, setExpandedDomains] = useState({});

  const focusDomains = parseCSV(focusText);

  const run = useCallback(async () => {
    if (!companyName.trim()) return;
    setStatus("running");
    setProgress("Connecting to GCC Intelligence Engine…");
    setTechRows([]); setBudgetRows([]); setVendorRows([]);

    try {
      const res = await fetch(`${API_URL}/api/gcc-intel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: companyName.trim(),
          domain: domain.trim(),
          target_vendor: targetVendor.trim(),
          focus_domains: focusDomains,
        }),
      });

      if (!res.ok || !res.body) throw new Error(`Server error ${res.status}`);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";

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
            } else if (ev.type === "tech_stack_row") {
              setTechRows(r => [...r, ev.row]);
            } else if (ev.type === "budget_row") {
              setBudgetRows(r => [...r, ev.row]);
            } else if (ev.type === "vendor_signal_row") {
              setVendorRows(r => [...r, ev.row]);
              setActiveTab("vendor");
            } else if (ev.type === "complete") {
              setStatus("done");
              const t = ev.total_tools ?? 0;
              const d = ev.domains_researched ?? 0;
              setProgress(`Done — ${t} tools mapped across ${d} domains`);
              setActiveTab("tech");
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
  }, [companyName, domain, targetVendor, focusDomains]);

  const downloadCSV = (rows, fields, filename) => {
    if (!rows.length) return;
    const keys = fields.map(f => f.key);
    const header = fields.map(f => f.label);
    const csv = [
      header.join(","),
      ...rows.map(r => keys.map(k => `"${(r[k] ?? "").replace(/"/g, '""')}"`).join(",")),
    ].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }));
    a.download = filename; a.click();
  };

  // Group tech stack rows by domain
  const techByDomain = techRows.reduce((acc, row) => {
    const d = row.domain || "Other";
    if (!acc[d]) acc[d] = [];
    acc[d].push(row);
    return acc;
  }, {});

  const toggleDomain = (d) => setExpandedDomains(prev => ({ ...prev, [d]: !prev[d] }));

  return (
    <div className={s.page}>

      {/* Header */}
      <header className={s.header}>
        <div className={s.headerInner}>
          <div className={s.iconBox}><Target size={14} color="#f472b6" /></div>
          <div>
            <div className={s.headerTitle}>GCC Intelligence Hub</div>
            <div className={s.headerSub}>Powered by RefractOne · Two-Phase AI Research</div>
          </div>
          <div className={s.headerActions}>
            <a href="/tech-stack" className={s.navLink} style={{color:"#818cf8",borderColor:"rgba(129,140,248,0.2)",background:"rgba(129,140,248,0.08)"}}>Tech Stack</a>
            <a href="/enrich" className={s.navLink} style={{color:"#3491E8",borderColor:"rgba(52,145,232,0.2)",background:"rgba(52,145,232,0.08)"}}>IT Deals</a>
            <a href="/" className={s.backLink}>← Home</a>
          </div>
        </div>
      </header>

      <main className={s.main}>

        {/* Config card */}
        <div className={s.card}>
          <div className={s.cardTitle}>Target Configuration</div>
          <div className={s.cardSub}>
            Researches enterprise IT landscape across {AFTERMARKET_DOMAINS.length} aftermarket domains using two-phase AI grounding.
            Optionally score a vendor's readiness signals against the target company.
          </div>

          <div className={s.configGrid}>
            <div className={s.fieldGroup}>
              <label className={s.fieldLabel}>Company Name *</label>
              <input className={s.inp} placeholder="e.g. Daimler Truck North America"
                value={companyName} onChange={e => setCompanyName(e.target.value)} />
            </div>
            <div className={s.fieldGroup}>
              <label className={s.fieldLabel}>Company Domain</label>
              <input className={s.inp} placeholder="e.g. daimler-trucks.com"
                value={domain} onChange={e => setDomain(e.target.value)} />
            </div>
            <div className={s.fieldGroup}>
              <label className={s.fieldLabel}>
                Target Vendor <span className={s.optional}>optional — for readiness scoring</span>
              </label>
              <input className={s.inp} placeholder="e.g. Tavant, Salesforce, SAP"
                value={targetVendor} onChange={e => setTargetVendor(e.target.value)} />
            </div>
            <div className={s.fieldGroup}>
              <label className={s.fieldLabel}>
                Focus Domains <span className={s.optional}>optional · comma separated · leave blank for all {AFTERMARKET_DOMAINS.length}</span>
              </label>
              <textarea className={`${s.inp} ${s.ta}`} style={{height:60,fontSize:11,fontFamily:"monospace"}}
                placeholder={AFTERMARKET_DOMAINS.slice(0,3).join(", ") + "…"}
                value={focusText} onChange={e => setFocusText(e.target.value)} />
              {focusDomains.length > 0 && (
                <div className={s.csvCount}>{focusDomains.length} domains selected</div>
              )}
            </div>
          </div>
        </div>

        {/* Run bar */}
        <div className={s.runBar}>
          {status !== "idle" && (
            <div className={s.statusBar}>
              {status === "running" && <Loader2 size={16} color="#f472b6" className={s.spin}/>}
              {status === "done"    && <CheckCircle2 size={16} color="#34d399"/>}
              {status === "error"   && <span style={{color:"#E63946",fontSize:13}}>✕</span>}
              <span className={s.statusText}>{progress}</span>
              {status === "done" && (
                <div className={s.dlBtn}>
                  {techRows.length > 0 && (
                    <button className={s.dlBtnCSV} onClick={() => downloadCSV(techRows, TECH_STACK_FIELDS, "gcc-tech-stack.csv")}>
                      <Download size={12}/> Tech Stack
                    </button>
                  )}
                  {budgetRows.length > 0 && (
                    <button className={s.dlBtnAlt} onClick={() => downloadCSV(budgetRows, BUDGET_FIELDS, "gcc-budget.csv")}>
                      <Download size={12}/> Budget
                    </button>
                  )}
                  {vendorRows.length > 0 && (
                    <button className={s.dlBtnVendor} onClick={() => downloadCSV(vendorRows, VENDOR_SIGNAL_FIELDS, "gcc-vendor-signals.csv")}>
                      <Download size={12}/> Signals
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
          <button
            className={`${s.btn} ${s.btnPrimary} ${s.btnRun}`}
            onClick={run}
            disabled={status === "running" || !companyName.trim()}>
            {status === "running"
              ? <><Loader2 size={16} className={s.spin}/> Researching…</>
              : <><Target size={16}/> {status === "done" ? "Run again" : "Run Intelligence"}</>}
          </button>
        </div>

        {/* Results tabs */}
        {(techRows.length > 0 || budgetRows.length > 0 || vendorRows.length > 0) && (
          <div className={s.resultsArea}>
            <div className={s.tabs}>
              <button className={`${s.tab} ${activeTab === "tech" ? s.tabActive : ""}`}
                onClick={() => setActiveTab("tech")}>
                <Cpu size={13}/> Tech Stack <span className={s.tabCount}>{techRows.length}</span>
              </button>
              <button className={`${s.tab} ${activeTab === "budget" ? s.tabActive : ""}`}
                onClick={() => setActiveTab("budget")}>
                <DollarSign size={13}/> IT Budget <span className={s.tabCount}>{budgetRows.length}</span>
              </button>
              {vendorRows.length > 0 && (
                <button className={`${s.tab} ${activeTab === "vendor" ? s.tabActive : ""}`}
                  onClick={() => setActiveTab("vendor")}>
                  <Target size={13}/> {targetVendor || "Vendor"} Signals <span className={s.tabCount}>{vendorRows.length}</span>
                </button>
              )}
            </div>

            {/* Tech Stack table — grouped by domain */}
            {activeTab === "tech" && techRows.length > 0 && (
              <div className={s.tableWrap}>
                {Object.entries(techByDomain).map(([dom, rows]) => (
                  <div key={dom} className={s.domainGroup}>
                    <button className={s.domainHeader} onClick={() => toggleDomain(dom)}>
                      <span className={s.domainName}>{dom}</span>
                      <span className={s.domainCount}>{rows.length} tools</span>
                      {expandedDomains[dom] === false ? <ChevronDown size={14}/> : <ChevronUp size={14}/>}
                    </button>
                    {expandedDomains[dom] !== false && (
                      <div className={s.tableScroll}>
                        <table className={s.table}>
                          <thead className={s.thead}>
                            <tr className={s.theadTr}>
                              {TECH_STACK_FIELDS.filter(f => f.key !== "domain").map(f => (
                                <th key={f.key} className={s.th}>{f.label}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((row, i) => {
                              const st = STATUS_COLORS[row.current_status] || {};
                              return (
                                <tr key={i} className={`${s.tbodyTr} ${i%2===0?"":s.tbodyTrEven} ${s.rowNew}`}>
                                  <td className={s.td}><span className={s.layerPill}>{row.layer || "—"}</span></td>
                                  <td className={`${s.td} ${s.tdBold}`}>{row.tool_vendor || "—"}</td>
                                  <td className={s.td}>
                                    {row.current_status
                                      ? <span className={s.statusBadge} style={{background: st.bg, color: st.color}}>{row.current_status}</span>
                                      : <span className={s.tdNone}>—</span>}
                                  </td>
                                  <td className={`${s.td} ${s.tdNotes}`}>{row.notes || "—"}</td>
                                  <td className={s.td}>
                                    {row.source && row.source !== "-"
                                      ? <a href={row.source} target="_blank" rel="noreferrer" className={s.sourceLink}>↗ link</a>
                                      : <span className={s.tdNone}>—</span>}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Budget table */}
            {activeTab === "budget" && budgetRows.length > 0 && (
              <div className={s.tableWrap}>
                <div className={s.tableScroll}>
                  <table className={s.table}>
                    <thead className={s.thead}>
                      <tr className={s.theadTr}>
                        {BUDGET_FIELDS.map(f => <th key={f.key} className={s.th}>{f.label}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {budgetRows.map((row, i) => (
                        <tr key={i} className={`${s.tbodyTr} ${i%2===0?"":s.tbodyTrEven} ${s.rowNew}`}>
                          <td className={`${s.td} ${s.tdBold}`}>{row.domain || "—"}</td>
                          <td className={`${s.td} ${s.tdBudget}`}>{row.estimated_budget || "—"}</td>
                          <td className={s.td}>{row.budget_basis || "—"}</td>
                          <td className={s.td}>
                            {row.source && row.source !== "-"
                              ? <a href={row.source} target="_blank" rel="noreferrer" className={s.sourceLink}>↗ link</a>
                              : <span className={s.tdNone}>—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Vendor Signals table */}
            {activeTab === "vendor" && vendorRows.length > 0 && (
              <div className={s.tableWrap}>
                <div className={s.tableScroll}>
                  <table className={s.table}>
                    <thead className={s.thead}>
                      <tr className={s.theadTr}>
                        {VENDOR_SIGNAL_FIELDS.map(f => <th key={f.key} className={s.th}>{f.label}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {vendorRows.map((row, i) => {
                        const sig = SIGNAL_COLORS[row.signal_strength] || {};
                        const score = parseInt(row.readiness_score) || 0;
                        return (
                          <tr key={i} className={`${s.tbodyTr} ${i%2===0?"":s.tbodyTrEven} ${s.rowNew}`}>
                            <td className={`${s.td} ${s.tdBold}`}>{row.domain || "—"}</td>
                            <td className={s.td}>
                              {row.signal_strength
                                ? <span className={s.signalBadge} style={{background:sig.bg,color:sig.color}}>{row.signal_strength}</span>
                                : <span className={s.tdNone}>—</span>}
                            </td>
                            <td className={s.td}><span className={s.oppPill}>{row.opportunity_type || "—"}</span></td>
                            <td className={`${s.td} ${s.tdBold}`}>{row.existing_competitor || "—"}</td>
                            <td className={s.td}>
                              {score > 0 ? (
                                <div className={s.scoreWrap}>
                                  <div className={s.scoreBar} style={{width:`${score}%`, background: score >= 70 ? "#34d399" : score >= 40 ? "#fbbf24" : "#E63946"}}/>
                                  <span className={s.scoreNum}>{score}</span>
                                </div>
                              ) : <span className={s.tdNone}>—</span>}
                            </td>
                            <td className={`${s.td} ${s.tdNotes}`}>{row.rationale || "—"}</td>
                            <td className={s.td}>
                              {row.source && row.source !== "-"
                                ? <a href={row.source} target="_blank" rel="noreferrer" className={s.sourceLink}>↗ link</a>
                                : <span className={s.tdNone}>—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}
