"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Play, Download, Loader2, CheckCircle2, Plus, Trash2, Search, History, X, Clock } from "lucide-react";
import s from "./signal-intel.module.css";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4001";
const SIG_HIST_KEY = "signal_intel_history";
const MAX_HIST = 30;
function loadSigHist() { try { const r = JSON.parse(localStorage.getItem(SIG_HIST_KEY) ?? "[]"); return Array.isArray(r) ? r.filter(e => e && e.id && e.date) : []; } catch { return []; } }
function saveSigHist(h) { try { localStorage.setItem(SIG_HIST_KEY, JSON.stringify(h)); } catch {} }

const CATEGORY_LABELS = {
  "Executive & Leadership Shifts":    { color: "#f472b6", bg: "rgba(244,114,182,0.12)" },
  "Corporate Expansion & Growth":     { color: "#34d399", bg: "rgba(52,211,153,0.12)" },
  "Financial & Corporate Structure":  { color: "#fbbf24", bg: "rgba(251,191,36,0.12)" },
  "Tech Stack & Legal Triggers":      { color: "#60a5fa", bg: "rgba(96,165,250,0.12)" },
};

const IMPORTANCE_COLORS = {
  "Critical": { color: "#E63946", bg: "rgba(230,57,70,0.15)" },
  "High":     { color: "#f97316", bg: "rgba(249,115,22,0.15)" },
  "Medium":   { color: "#fbbf24", bg: "rgba(251,191,36,0.12)" },
  "Low":      { color: "#64748b", bg: "rgba(100,116,139,0.12)" },
  "—":        { color: "#334155", bg: "rgba(30,58,80,0.4)" },
};

const TYPE_LABELS = {
  new_hire:              "New Hire",
  internal_promotion:    "Promotion",
  champion_move:         "Champion Move",
  mass_exodus:           "Mass Exodus",
  headcount_surge:       "Headcount Surge",
  job_postings:          "Job Postings",
  office_opening:        "Office Opening",
  product_launch:        "Product Launch",
  funding_round:         "Funding Round",
  merger_acquisition:    "M&A",
  relocation:            "Relocation",
  earnings_shift:        "Earnings Shift",
  contract_renewal:      "Contract Renewal",
  regulatory_compliance: "Regulatory",
  system_outage:         "Outage / Breach",
  tech_refresh:          "Tech Refresh",
};

const CATEGORY_FILTERS = [
  "All",
  "Executive & Leadership Shifts",
  "Corporate Expansion & Growth",
  "Financial & Corporate Structure",
  "Tech Stack & Legal Triggers",
];

const IMPORTANCE_FILTERS = ["All", "Critical", "High", "Medium", "Low"];

function dlCSV(rows) {
  if (!rows.length) return;
  const keys = ["company", "domain", "category", "signal_type", "signal_title", "summary",
                "date", "importance", "importance_rationale", "source"];
  const headers = ["Company", "Domain", "Category", "Signal Type", "Signal", "Summary",
                   "Date", "Importance", "Why It Matters", "Source"];
  const csv = [
    headers.join(","),
    ...rows.map(r => keys.map(k => `"${(r[k] ?? "").toString().replace(/"/g, '""')}"`).join(",")),
  ].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }));
  a.download = "signal_intelligence.csv";
  a.click();
}

function isUrl(str) {
  return str && (str.startsWith("http://") || str.startsWith("https://"));
}

function srcLabel(url) {
  try {
    const h = new URL(url).hostname.replace(/^www\./, "");
    return h || url;
  } catch { return url; }
}

const emptyCompany = () => ({
  id: Math.random().toString(36).slice(2),
  name: "",
  domain: "",
});

function SignalCard({ row, isNew }) {
  const cat = CATEGORY_LABELS[row.category] || { color: "#8b5cf6", bg: "rgba(139,92,246,0.12)" };
  const imp = IMPORTANCE_COLORS[row.importance] || IMPORTANCE_COLORS["—"];
  const typeLabel = TYPE_LABELS[row.signal_type] || row.signal_type || "";
  const detail = row.financial_detail || row.magnitude || row.urgency || "";

  return (
    <div className={`${s.signalCard} ${isNew ? s.rowNew : ""}`}>
      <div className={s.signalLeft}>
        <span className={s.catBadge} style={{ background: cat.bg, color: cat.color }}>
          {row.category}
        </span>
        {typeLabel && <span className={s.typePill}>{typeLabel}</span>}
        {row.importance && row.importance !== "—" && (
          <span className={s.impBadge} style={{ background: imp.bg, color: imp.color }}>
            {row.importance}
          </span>
        )}
      </div>
      <div className={s.signalRight}>
        <div className={s.signalTitle}>{row.signal_title || "—"}</div>
        {row.summary && <div className={s.signalSummary}>{row.summary}</div>}
        {row.importance_rationale && (
          <div className={s.signalRationale}>{row.importance_rationale}</div>
        )}
        <div className={s.signalMeta}>
          {row.date && <span className={s.signalDate}>{row.date}</span>}
          {detail && <span className={s.signalDetail}>{detail}</span>}
          {row.person_name && row.person_name !== "Multiple" && (
            <span className={s.signalDetail}>👤 {row.person_name}</span>
          )}
          {row.source && (
            isUrl(row.source)
              ? <a href={row.source} target="_blank" rel="noopener noreferrer" className={s.sourceLink}
                   title={row.source}>🔗 {srcLabel(row.source)}</a>
              : <span className={s.signalDate} title={row.source}>📰 {row.source}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export function SignalIntelContent() {
  const [userCompany, setUserCompany]    = useState("");
  const [userDomain, setUserDomain]      = useState("");
  const [keyTriggers, setKeyTriggers]    = useState("");
  const [targetTech, setTargetTech]      = useState("");
  const [companies, setCompanies]        = useState([emptyCompany()]);
  const [status, setStatus]              = useState("idle");
  const [progress, setProgress]          = useState("");
  const [allSignals, setAllSignals]      = useState([]);
  const [newRowIds, setNewRowIds]        = useState(new Set());
  const [catFilter, setCatFilter]        = useState("All");
  const [impFilter, setImpFilter]        = useState("All");
  const [compFilter, setCompFilter]      = useState("All");
  const [search, setSearch]              = useState("");
  const [expandedComp, setExpandedComp] = useState({});
  const [showHist, setShowHist]          = useState(false);
  const [history, setHistory]            = useState([]);
  const [histEntry, setHistEntry]        = useState(null);
  const abortRef = useRef(null);

  useEffect(() => setHistory(loadSigHist()), []);

  const addCompany = () => {
    if (companies.length >= 100) return;
    setCompanies(prev => [...prev, emptyCompany()]);
  };

  const removeCompany = (id) =>
    setCompanies(prev => prev.filter(c => c.id !== id));

  const updateCompany = (id, field, val) =>
    setCompanies(prev => prev.map(c => c.id === id ? { ...c, [field]: val } : c));

  const run = useCallback(async () => {
    const validCompanies = companies.filter(c => c.name.trim());
    if (!validCompanies.length) return;

    setStatus("running");
    setProgress("Connecting to Signal Intelligence Engine…");
    setAllSignals([]);
    setNewRowIds(new Set());
    setHistEntry(null);

    const initExpanded = {};
    validCompanies.forEach(c => { initExpanded[c.name.trim()] = true; });
    setExpandedComp(initExpanded);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch(`${API_URL}/api/signal-intel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({
          target_companies: validCompanies.map(c => ({ name: c.name.trim(), domain: c.domain.trim() })),
          user_company: userCompany.trim(),
          user_domain: userDomain.trim(),
          key_triggers: keyTriggers.trim(),
          target_tech: targetTech.trim(),
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

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
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.type === "heartbeat") {
              setProgress(evt.message);
            } else if (evt.type === "signal_row") {
              const row = evt.row;
              const rowId = `${row.company}|${row.category}|${row.signal_title}|${Math.random()}`;
              row._id = rowId;
              setAllSignals(prev => [...prev, row]);
              setNewRowIds(prev => new Set([...prev, rowId]));
              setTimeout(() => setNewRowIds(prev => { const n = new Set(prev); n.delete(rowId); return n; }), 1200);
            } else if (evt.type === "signals_ranked") {
              setAllSignals(prev => {
                const others = prev.filter(r => r.company !== evt.company);
                const ranked = (evt.rows || []).map((r, i) => ({
                  ...r,
                  _id: r._id || `${r.company}|${r.category}|${r.signal_title}|ranked${i}`,
                }));
                return [...others, ...ranked];
              });
            } else if (evt.type === "complete") {
              setStatus("done");
              setProgress(`✅ Complete — ${evt.total} signals found across ${evt.companies_done} companies`);
              // capture final signals via functional update to avoid stale closure
              setAllSignals(prev => {
                if (prev.length > 0) {
                  const entry = {
                    id: Date.now(),
                    date: new Date().toISOString(),
                    companies: validCompanies.map(c => c.name).join(", "),
                    total: prev.length,
                    userCompany: userCompany.trim(),
                    rows: prev,
                  };
                  const newH = [entry, ...loadSigHist()].slice(0, MAX_HIST);
                  saveSigHist(newH);
                  setHistory(newH);
                }
                return prev;
              });
            } else if (evt.type === "error") {
              setStatus("error");
              setProgress(`Error: ${evt.message}`);
            }
          } catch {}
        }
      }
      setStatus("done");
    } catch (e) {
      if (e.name !== "AbortError") {
        setStatus("error");
        setProgress(`Connection error: ${e.message}`);
      }
    }
  }, [companies, userCompany, userDomain, keyTriggers, targetTech]);

  const stop = () => {
    abortRef.current?.abort();
    setStatus("stopped");
    setProgress("Stopped.");
  };

  const displaySignals = histEntry ? (histEntry.rows || []) : allSignals;
  const uniqueCompanies = [...new Set(displaySignals.map(r => r.company))];

  const filtered = displaySignals.filter(r => {
    if (catFilter !== "All" && r.category !== catFilter) return false;
    if (impFilter !== "All" && r.importance !== impFilter) return false;
    if (compFilter !== "All" && r.company !== compFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!`${r.signal_title} ${r.summary} ${r.company} ${r.signal_type}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Parse date string → sortable numeric value (newest = largest)
  function parseDateVal(str) {
    if (!str || str === "—" || str === "-") return 0;
    const MONTHS = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };
    let m;
    // ISO "2024-09" or "2024-09-15"
    m = str.match(/^(\d{4})-(\d{1,2})/);
    if (m) return parseInt(m[1]) * 100 + parseInt(m[2]);
    // "Sep 2024" / "September 2024"
    m = str.match(/^([A-Za-z]+)\s+(\d{4})/);
    if (m) return parseInt(m[2]) * 100 + (MONTHS[m[1].toLowerCase().slice(0,3)] || 0);
    // "2024 Sep"
    m = str.match(/^(\d{4})\s+([A-Za-z]+)/);
    if (m) return parseInt(m[1]) * 100 + (MONTHS[m[2].toLowerCase().slice(0,3)] || 0);
    // "Q2 2025"
    m = str.match(/Q([1-4])\s+(\d{4})/i);
    if (m) return parseInt(m[2]) * 100 + (parseInt(m[1]) - 1) * 3 + 1;
    // Year only "2024"
    m = str.match(/^(\d{4})$/);
    if (m) return parseInt(m[1]) * 100;
    return 0;
  }

  // Group by company, sort within each group newest-first
  const grouped = {};
  for (const row of filtered) {
    if (!grouped[row.company]) grouped[row.company] = [];
    grouped[row.company].push(row);
  }
  for (const co of Object.keys(grouped)) {
    grouped[co].sort((a, b) => parseDateVal(b.date) - parseDateVal(a.date));
  }
  // Company groups ordered by their most recent signal date (latest first)
  const sortedCompanies = Object.keys(grouped).sort((a, b) =>
    parseDateVal(grouped[b][0]?.date) - parseDateVal(grouped[a][0]?.date)
  );

  const toggleComp = (name) => setExpandedComp(prev => ({ ...prev, [name]: !prev[name] }));
  const isRunning = status === "running";

  const deleteEntry = (id) => {
    const u = history.filter(h => h.id !== id);
    saveSigHist(u);
    setHistory(u);
    if (histEntry?.id === id) setHistEntry(null);
  };

  return (
    <div className={s.main}>
      {/* History panel overlay */}
      {showHist && (
        <div className={s.historyOverlay} onClick={() => setShowHist(false)}>
          <div className={s.historyPanel} onClick={e => e.stopPropagation()}>
            <div className={s.historyHeader}>
              <span className={s.historyTitle}>Report History</span>
              {history.length > 0 && (
                <button className={s.historyDeleteAll} onClick={() => { saveSigHist([]); setHistory([]); setHistEntry(null); }}>
                  Clear all
                </button>
              )}
              <button className={s.historyClose} onClick={() => setShowHist(false)}><X size={15} /></button>
            </div>
            {history.length === 0
              ? <div className={s.historyEmpty}>No reports yet. Run a scan to save results.</div>
              : <div className={s.historyList}>
                  {history.map(e => (
                    <div key={e.id} className={s.historyItem}>
                      <button className={s.historyItemBtn} onClick={() => { setHistEntry(e); setShowHist(false); setCatFilter("All"); setImpFilter("All"); setCompFilter("All"); setSearch(""); }}>
                        <div className={s.historyItemTop}>
                          <span className={s.historyItemCompanies}>{e.companies}</span>
                          <span className={s.historyItemCount}>{e.total} signals</span>
                        </div>
                        {e.userCompany && <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>Ranked for: {e.userCompany}</div>}
                        <div className={s.historyItemDate}><Clock size={10} /> {new Date(e.date).toLocaleString()}</div>
                        <div className={s.historyItemCta}>Click to view →</div>
                      </button>
                      <button className={s.historyDeleteOne} onClick={ev => { ev.stopPropagation(); deleteEntry(e.id); }} title="Delete">✕</button>
                    </div>
                  ))}
                </div>
            }
          </div>
        </div>
      )}

      {/* Your company context */}
      <div className={s.card}>
        <div className={s.cardTitle}>
          <span>Your Company Context</span>
          <span style={{ fontSize: 11, fontWeight: 400, color: "#475569" }}>optional — ranks signals by relevance to your sales motion</span>
        </div>
        <div className={s.configGrid}>
          <div className={s.fieldGroup}>
            <label className={s.fieldLabel}>Your Company <span className={s.optional}>(optional)</span></label>
            <input className={s.inp} placeholder="e.g. Salesforce" value={userCompany} onChange={e => setUserCompany(e.target.value)} />
          </div>
          <div className={s.fieldGroup}>
            <label className={s.fieldLabel}>Your Domain <span className={s.optional}>(optional)</span></label>
            <input className={s.inp} placeholder="salesforce.com" value={userDomain} onChange={e => setUserDomain(e.target.value)} />
          </div>
          <div className={s.fieldGroup}>
            <label className={s.fieldLabel}>Key Triggers <span className={s.optional}>(optional)</span></label>
            <input className={s.inp} placeholder="e.g. CRM replacement, cloud migration" value={keyTriggers} onChange={e => setKeyTriggers(e.target.value)} />
          </div>
          <div className={s.fieldGroup}>
            <label className={s.fieldLabel}>Target Technology <span className={s.optional}>(optional)</span></label>
            <input className={s.inp} placeholder="e.g. ERP, AI platform, cybersecurity" value={targetTech} onChange={e => setTargetTech(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Target companies */}
      <div className={s.card}>
        <div className={s.companiesHeader}>
          <div className={s.cardTitle}>Target Companies</div>
          <span className={s.companiesCount}>{companies.length} / 100</span>
        </div>
        <div className={s.companiesGrid}>
          <div className={s.companyRow} style={{ marginBottom: 2 }}>
            <span style={{ fontSize: 11, color: "#475569", fontWeight: 600 }}>COMPANY NAME</span>
            <span style={{ fontSize: 11, color: "#475569", fontWeight: 600 }}>DOMAIN</span>
            <span />
          </div>
          {companies.map(co => (
            <div key={co.id} className={s.companyRow}>
              <input className={s.inp} placeholder="e.g. Acme Corp" value={co.name}
                onChange={e => updateCompany(co.id, "name", e.target.value)} />
              <input className={s.inp} placeholder="acme.com" value={co.domain}
                onChange={e => updateCompany(co.id, "domain", e.target.value)} />
              <button className={s.removeBtn} onClick={() => removeCompany(co.id)} title="Remove">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
        <button className={s.addCompanyBtn} onClick={addCompany} disabled={companies.length >= 100}>
          <Plus size={13} /> Add Company
        </button>
      </div>

      {/* Run bar */}
      <div className={s.runBar}>
        {isRunning ? (
          <button className={`${s.btn} ${s.btnPrimary}`} onClick={stop} style={{ background: "#E63946" }}>
            <Loader2 size={15} className={s.spin} /> Stop
          </button>
        ) : (
          <button className={`${s.btn} ${s.btnPrimary}`} onClick={run}
            disabled={!companies.some(c => c.name.trim())}>
            <Play size={15} /> Scan Signals
          </button>
        )}
        <div className={s.statusBar}>
          {status === "done" && <CheckCircle2 size={14} color="#34d399" />}
          {isRunning && <Loader2 size={14} className={s.spin} color="#8b5cf6" />}
          <span className={s.statusText}>{progress || "Enter target companies and click Scan Signals"}</span>
        </div>
        {displaySignals.length > 0 && (
          <button className={s.dlBtnCSV} onClick={() => dlCSV(displaySignals)}>
            <Download size={11} /> CSV ({displaySignals.length})
          </button>
        )}
        <button className={s.historyBtn} onClick={() => { setHistory(loadSigHist()); setShowHist(true); }}>
          <History size={13} /> History {history.length > 0 && `(${history.length})`}
        </button>
      </div>

      {/* Viewing history banner */}
      {histEntry && (
        <div className={s.historyBanner}>
          <span>📋 Viewing: <strong>{histEntry.companies}</strong> · {new Date(histEntry.date).toLocaleString()} · {histEntry.total} signals</span>
          <button className={s.historyBannerBack} onClick={() => setHistEntry(null)}>Back to current</button>
        </div>
      )}

      {/* Results */}
      {displaySignals.length > 0 && (
        <div className={s.resultsArea}>
          <div className={s.toolbar}>
            <div className={s.toolbarTitle}>
              {filtered.length} signal{filtered.length !== 1 ? "s" : ""}
              {filtered.length !== allSignals.length && ` (of ${allSignals.length})`}
            </div>
            {uniqueCompanies.length > 1 && (
              <div className={s.filterRow}>
                {["All", ...uniqueCompanies].map(co => (
                  <button key={co}
                    className={`${s.filterChip} ${compFilter === co ? s.filterChipActive : ""}`}
                    onClick={() => setCompFilter(co)}>
                    {co === "All" ? "All Companies" : co}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 8, padding: "8px 16px", background: "#0a1520", borderBottom: "1px solid #0f2a3d", flexWrap: "wrap", alignItems: "center" }}>
            <div className={s.filterRow}>
              {CATEGORY_FILTERS.map(f => {
                const cfg = f !== "All" ? CATEGORY_LABELS[f] : null;
                return (
                  <button key={f}
                    className={`${s.filterChip} ${catFilter === f ? s.filterChipActive : ""}`}
                    onClick={() => setCatFilter(f)}
                    style={catFilter === f && cfg ? { borderColor: cfg.color + "60", color: cfg.color, background: cfg.bg } : {}}>
                    {f === "All" ? "All Types" : f.split(" ")[0]}
                  </button>
                );
              })}
            </div>
            <div style={{ width: 1, height: 20, background: "#1a3a50", flexShrink: 0 }} />
            <div className={s.filterRow}>
              {IMPORTANCE_FILTERS.map(f => {
                const cfg = f !== "All" ? IMPORTANCE_COLORS[f] : null;
                return (
                  <button key={f}
                    className={`${s.filterChip} ${impFilter === f ? s.filterChipActive : ""}`}
                    onClick={() => setImpFilter(f)}
                    style={impFilter === f && cfg ? { borderColor: cfg.color + "60", color: cfg.color, background: cfg.bg } : {}}>
                    {f === "All" ? "All Importance" : f}
                  </button>
                );
              })}
            </div>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
              <Search size={12} color="#334155" />
              <input className={s.searchInp} placeholder="Search signals…"
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>

          <div className={s.tableWrap}>
            {sortedCompanies.length === 0 ? (
              <div className={s.emptyState}>
                <div className={s.emptyIcon}>🔍</div>
                No signals match the current filters
              </div>
            ) : (
              sortedCompanies.map(compName => {
                const rows = grouped[compName];
                const isOpen = expandedComp[compName] !== false;
                const hasCritical = rows.some(r => r.importance === "Critical");
                const hasHigh = rows.some(r => r.importance === "High");
                const topImp = hasCritical ? "Critical" : hasHigh ? "High" : null;
                const impCfg = topImp ? IMPORTANCE_COLORS[topImp] : null;
                return (
                  <div key={compName} className={s.compGroup}>
                    <button className={s.compGroupHeader} onClick={() => toggleComp(compName)}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span className={s.compGroupName}>{compName}</span>
                          {impCfg && (
                            <span className={s.impBadge} style={{ background: impCfg.bg, color: impCfg.color, fontSize: 10 }}>
                              {topImp} signals
                            </span>
                          )}
                          <span className={s.compGroupCount}>{rows.length} signal{rows.length !== 1 ? "s" : ""}</span>
                        </div>
                        {rows[0]?.domain && <span className={s.compGroupDomain}>{rows[0].domain}</span>}
                      </div>
                      <span style={{ fontSize: 12, color: "#334155", flexShrink: 0 }}>{isOpen ? "▲" : "▼"}</span>
                    </button>
                    {isOpen && (
                      <div className={s.signalList}>
                        {rows.map(row => (
                          <SignalCard key={row._id} row={row} isNew={newRowIds.has(row._id)} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {status === "idle" && allSignals.length === 0 && !histEntry && (
        <div style={{ textAlign: "center", padding: "48px 20px", color: "#334155", fontSize: 13 }}>
          <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.4 }}>⚡</div>
          <div style={{ color: "#475569", fontWeight: 600, marginBottom: 6 }}>Signal Intelligence ready</div>
          <div>Add target companies above and click <strong style={{ color: "#8b5cf6" }}>Scan Signals</strong></div>
          <div style={{ marginTop: 8, fontSize: 12, maxWidth: 420, margin: "8px auto 0" }}>
            Detects 16 buying signal types across Executive, Growth, Financial, and Tech triggers. Optionally rank by relevance to your company.
          </div>
        </div>
      )}
    </div>
  );
}
