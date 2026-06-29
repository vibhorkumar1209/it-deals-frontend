"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Search, Play, Plus, Trash2, Download, CheckCircle2, ChevronRight, BarChart2, Loader2, History, X, Clock } from "lucide-react";
import s from "./competitive-intel.module.css";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4001";

const ALL_MODULES = {
  metrics:   "Overall Company Metrics",
  portfolio: "Service / Product / Platform Portfolio",
  overlap:   "Core Competitive Overlap",
  customer:  "Customer Base",
  brand:     "Brand & Analyst Mentions",
  talent:    "Talent & Headcount",
  deals:     "JV / M&A / Partnerships",
  stack:     "Tech Stack",
  news:      "Recent Key News",
};

const BENCHMARK_FOCI = [
  "Overall Competitiveness",
  "Technology & AI",
  "Market Share & Growth",
  "Talent & Culture",
  "Financial Performance",
  "Customer Success",
  "Analyst & Brand Presence",
];

const HIST_PANEL_STYLE = {
  position: "fixed", inset: 0, zIndex: 50,
  background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-start", justifyContent: "flex-end",
};

const STEP_LABELS = ["Target", "Competitors", "Modules", "Analyzing", "Results"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function ConfidenceDot({ level }) {
  const cls = level === "green" ? s.dotGreen : level === "amber" ? s.dotAmber : s.dotGrey;
  const title = level === "green" ? "High confidence" : level === "amber" ? "Partial data" : "Low confidence";
  return <span className={`${s.dot} ${cls}`} title={title} />;
}

function formatValue(val) {
  if (val === null || val === undefined || val === "" || val === "—") {
    return <span className={s.emDash}>—</span>;
  }
  if (Array.isArray(val)) {
    if (!val.length) return <span className={s.emDash}>—</span>;
    return (
      <div className={s.tagList}>
        {val.slice(0, 12).map((v, i) => (
          <span key={i} className={s.tag}>{String(v)}</span>
        ))}
        {val.length > 12 && <span className={s.tag}>+{val.length - 12} more</span>}
      </div>
    );
  }
  if (typeof val === "object") {
    const entries = Object.entries(val).filter(([, v]) => v && v !== "—");
    if (!entries.length) return <span className={s.emDash}>—</span>;
    return (
      <div className={s.tagList}>
        {entries.slice(0, 8).map(([k, v]) => (
          <span key={k} className={s.tag}>{k}: {String(v)}</span>
        ))}
      </div>
    );
  }
  return <span>{String(val)}</span>;
}

function ModuleDataTable({ data }) {
  if (!data || typeof data !== "object" || !Object.keys(data).length) {
    return <div className={s.cardSub} style={{ padding: "12px 0" }}>No data available for this module.</div>;
  }
  const entries = Object.entries(data);
  return (
    <div className={s.dataTableWrap}>
      <table className={s.dataTable}>
        <tbody>
          {entries.map(([key, val]) => (
            <tr key={key}>
              <td className={s.dataTdKey}>{key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</td>
              <td className={s.dataTdVal}>{formatValue(val)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function exportJSON(results, target) {
  const blob = new Blob([JSON.stringify({ target, generated: new Date().toISOString(), results }, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `competitive-intel-${target.replace(/\s+/g, "-").toLowerCase()}.json`;
  a.click();
}

function exportHTML(results, synthesis, target, competitors) {
  const rows = [];
  const allMods = results[0]?.modules?.map(m => m.module) ?? [];

  // comparison table: metric × company
  const companyNames = results.map(r => r.company);
  const coreRows = results.map(r => r.modules.find(m => m.module === "metrics")?.data ?? {});
  const coreKeys = [...new Set(coreRows.flatMap(d => Object.keys(d)))].slice(0, 12);

  const tableRows = coreKeys.map(key => {
    const label = key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    const cells = coreRows.map(d => {
      const v = d[key];
      if (Array.isArray(v)) return v.join(", ");
      if (typeof v === "object" && v) return Object.entries(v).map(([k2, v2]) => `${k2}: ${v2}`).join("; ");
      return v || "—";
    });
    return `<tr><td style="color:#64748b;font-weight:600;padding:8px 12px;border-bottom:1px solid #1a3a50">${label}</td>${cells.map((c, i) => `<td style="padding:8px 12px;border-bottom:1px solid #1a3a50;${i===0?"background:rgba(230,57,70,0.04)":""}">${c}</td>`).join("")}</tr>`;
  });

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>CompKill — ${target}</title>
<style>body{background:#080f16;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:0;padding:32px}
h1{color:#fff;font-size:22px}h2{color:#3491E8;font-size:15px;margin:28px 0 12px}
p{color:#94a3b8;line-height:1.8;font-size:13px}
table{width:100%;border-collapse:collapse;background:#0c1f2e;border-radius:10px;overflow:hidden}
th{background:#0c1f2e;color:#334155;font-size:10px;text-transform:uppercase;letter-spacing:.05em;padding:10px 12px;text-align:left;border-bottom:1px solid #1a3a50}
</style></head><body>
<h1>CompKill — Competition Benchmarking: ${target}</h1>
<p>Generated ${new Date().toLocaleString()} · Competitors: ${competitors.join(", ") || "None"}</p>
<h2>Core Comparison</h2>
<table><thead><tr><th>Metric</th>${companyNames.map((n, i) => `<th>${n}${i===0?" (Target)":""}</th>`).join("")}</tr></thead>
<tbody>${tableRows.join("")}</tbody></table>
${synthesis ? `<h2>Strategic Analysis</h2>${synthesis.split("\n\n").map(p => `<p>${p}</p>`).join("")}` : ""}
</body></html>`;

  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  a.download = `competitive-intel-${target.replace(/\s+/g, "-").toLowerCase()}.html`;
  a.click();
}

// ── History helpers ───────────────────────────────────────────────────────────

const COMP_HIST_KEY = "competitive_intel_history";
function loadCompHist() { try { return JSON.parse(localStorage.getItem(COMP_HIST_KEY) ?? "[]"); } catch { return []; } }
function saveCompHist(h) { try { localStorage.setItem(COMP_HIST_KEY, JSON.stringify(h)); } catch {} }

// ── Main Component ────────────────────────────────────────────────────────────

export function CompetitiveIntelContent() {
  // Step state
  const [step, setStep] = useState(1);

  // Step 1 — Target
  const [targetCompany,      setTargetCompany]      = useState("");
  const [targetDomain,       setTargetDomain]        = useState("");
  const [industryContext,    setIndustryContext]     = useState("");
  const [technologyContext,  setTechnologyContext]   = useState("");

  // Step 2 — Competitors
  const [discovering,    setDiscovering]    = useState(false);
  const [discoverError,  setDiscoverError]  = useState("");
  const [suggestedComps, setSuggestedComps] = useState([]);
  const [selectedComps,  setSelectedComps]  = useState([]);     // {name, domain, descriptor}
  const [manualName,     setManualName]     = useState("");
  const [manualDomain,   setManualDomain]   = useState("");

  // Step 3 — Config
  const [enabledModules,   setEnabledModules]  = useState(Object.keys(ALL_MODULES));
  const [benchmarkFoci,    setBenchmarkFoci]   = useState([BENCHMARK_FOCI[0]]);

  // Step 4 — Loading
  const [log, setLog] = useState([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [analyzing, setAnalyzing] = useState(false);
  const abortRef = useRef(null);

  // Step 5 — Results
  const [results,    setResults]    = useState([]);    // [{company, domain, is_target, modules}]
  const [synthesis,  setSynthesis]  = useState("");
  const [activeCompanyIdx, setActiveCompanyIdx] = useState(0);
  const [activeModule,     setActiveModule]     = useState("metrics");
  const [showCompare,      setShowCompare]      = useState(false);

  // History
  const [showHist,  setShowHist]  = useState(false);
  const [history,   setHistory]   = useState([]);
  const [histEntry, setHistEntry] = useState(null);

  useEffect(() => setHistory(loadCompHist()), []);

  // ── Step 1 helpers ──────────────────────────────────────────────────────────

  const handleDiscover = useCallback(async () => {
    if (!targetCompany.trim()) return;
    setDiscovering(true);
    setDiscoverError("");
    setSuggestedComps([]);
    setSelectedComps([]);
    try {
      const res = await fetch(`${API_URL}/api/competitive/discover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_company: targetCompany.trim(),
          target_domain: targetDomain.trim(),
          industry_context: industryContext.trim(),
          technology_context: technologyContext.trim(),
        }),
        signal: AbortSignal.timeout(120_000),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setSuggestedComps(data.competitors || []);
      setStep(2);
    } catch (e) {
      if (e.name !== "AbortError") setDiscoverError(e.message);
    } finally {
      setDiscovering(false);
    }
  }, [targetCompany, targetDomain]);

  // ── Step 2 helpers ──────────────────────────────────────────────────────────

  const toggleCompetitor = useCallback((comp) => {
    setSelectedComps(prev => {
      const exists = prev.some(c => c.name === comp.name);
      if (exists) return prev.filter(c => c.name !== comp.name);
      if (prev.length >= 5) return prev; // max 5
      return [...prev, comp];
    });
  }, []);

  const addManual = useCallback(() => {
    if (!manualName.trim()) return;
    const comp = { name: manualName.trim(), domain: manualDomain.trim(), descriptor: "Manually added" };
    setSelectedComps(prev => prev.length < 5 ? [...prev, comp] : prev);
    setManualName("");
    setManualDomain("");
  }, [manualName, manualDomain]);

  const removeSelected = useCallback((name) => {
    setSelectedComps(prev => prev.filter(c => c.name !== name));
  }, []);

  // ── Step 4 — Run analysis ───────────────────────────────────────────────────

  const handleAnalyze = useCallback(async () => {
    setStep(4);
    setAnalyzing(true);
    setLog([]);
    setResults([]);
    setSynthesis("");
    setProgress({ done: 0, total: 0 });
    setActiveCompanyIdx(0);
    setActiveModule("core");

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const addLog = (msg, highlight = false) =>
      setLog(prev => [...prev.slice(-60), { msg, highlight }]);

    try {
      const res = await fetch(`${API_URL}/api/competitive/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_company:      targetCompany.trim(),
          target_domain:       targetDomain.trim(),
          competitors:         selectedComps.map(c => ({ name: c.name, domain: c.domain })),
          enabled_modules:     enabledModules,
          benchmark_focus:     benchmarkFoci,
          industry_context:    industryContext.trim(),
          technology_context:  technologyContext.trim(),
        }),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const localResults = [];
      let localSynthesis = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          if (!part.startsWith("data: ")) continue;
          let evt;
          try { evt = JSON.parse(part.slice(6)); } catch { continue; }

          if (evt.type === "start") {
            setProgress({ done: 0, total: evt.total_calls ?? 0 });
            addLog(`Starting analysis for ${evt.total_companies} companies…`);
          } else if (evt.type === "heartbeat") {
            setProgress({ done: evt.done_calls ?? 0, total: evt.total_calls ?? 0 });
          } else if (evt.type === "company_result") {
            setProgress({ done: evt.done_calls ?? 0, total: evt.total_calls ?? 0 });
            const mods = (evt.modules ?? []).map(m => m.module).join(", ");
            addLog(`✓ ${evt.company} — [${mods}]`, true);
            const record = {
              company: evt.company,
              domain: evt.domain,
              is_target: evt.is_target,
              modules: evt.modules ?? [],
            };
            localResults.push(record);
            setResults([...localResults]);
          } else if (evt.type === "synthesis_start") {
            addLog("Generating strategic synthesis…");
          } else if (evt.type === "synthesis") {
            localSynthesis = evt.text ?? "";
            setSynthesis(localSynthesis);
            addLog("✓ Strategic synthesis complete", true);
          } else if (evt.type === "timeout") {
            addLog(`⚠ ${evt.message}`);
          } else if (evt.type === "complete") {
            addLog(`✓ Analysis complete — ${evt.total_companies} companies`, true);
          } else if (evt.type === "error") {
            addLog(`✗ Error: ${evt.message}`);
          }
        }
      }

      // Save to history before flipping to step 5
      const entry = {
        id: Date.now(),
        date: new Date().toISOString(),
        target: targetCompany.trim(),
        competitors: selectedComps.map(c => c.name),
        modules: enabledModules,
        benchmarkFoci,
        industryContext: industryContext.trim(),
        technologyContext: technologyContext.trim(),
        results: localResults,
        synthesis: localSynthesis,
      };
      const h = [entry, ...loadCompHist()].slice(0, 30);
      saveCompHist(h);
      setHistory(h);
      setStep(5);
    } catch (e) {
      if (e.name !== "AbortError") {
        addLog(`✗ ${e.message}`);
      }
    } finally {
      setAnalyzing(false);
    }
  }, [targetCompany, targetDomain, selectedComps, enabledModules, benchmarkFoci, industryContext, technologyContext]);

  // ── Render steps ────────────────────────────────────────────────────────────

  // When viewing a history entry, use its data; otherwise use live state
  const dispResults   = histEntry ? (histEntry.results ?? [])   : results;
  const dispSynthesis = histEntry ? (histEntry.synthesis ?? "")  : synthesis;
  const dispTarget    = histEntry ? histEntry.target              : targetCompany;
  const dispComps     = histEntry ? histEntry.competitors         : selectedComps.map(c => c.name);

  const activeCompany = dispResults[activeCompanyIdx];
  const activeModuleData = activeCompany?.modules?.find(m => m.module === activeModule);

  const progressPct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  // All module IDs present in results, ordered by ALL_MODULES definition
  const allModuleIds = Object.keys(ALL_MODULES).filter(id =>
    dispResults.some(r => r.modules?.some(m => m.module === id))
  );

  return (
    <div className={s.main} style={{ maxWidth: "100%", padding: "20px 0 60px" }}>
        {/* Step progress bar */}
        <div className={s.stepBar}>
          {STEP_LABELS.map((label, i) => {
            const num = i + 1;
            const isActive = step === num;
            const isDone = step > num;
            return (
              <>
                <div key={`item-${num}`} className={s.stepItem}>
                  <div className={`${s.stepDot} ${isDone ? s.stepDotDone : isActive ? s.stepDotActive : s.stepDotPending}`}>
                    {isDone ? <CheckCircle2 size={12} /> : num}
                  </div>
                  <span className={`${s.stepLabel} ${isDone ? s.stepLabelDone : isActive ? s.stepLabelActive : s.stepLabelPending}`}>
                    {label}
                  </span>
                </div>
                {i < STEP_LABELS.length - 1 && (
                  <div key={`line-${num}`} className={`${s.stepLine} ${isDone ? s.stepLineDone : ""}`} />
                )}
              </>
            );
          })}
        </div>

        {/* ── Step 1: Target Company ── */}
        {step === 1 && (
          <>
            {/* History panel for step 1 */}
            {showHist && (
              <div style={HIST_PANEL_STYLE} onClick={() => setShowHist(false)}>
                <div className={s.historyPanel} onClick={e => e.stopPropagation()}>
                  <div className={s.historyHeader}>
                    <span className={s.historyTitle}>Report History</span>
                    {history.length > 0 && (
                      <button className={s.historyDeleteAll} onClick={() => { saveCompHist([]); setHistory([]); }}>Clear all</button>
                    )}
                    <button className={s.historyClose} onClick={() => setShowHist(false)}><X size={15} /></button>
                  </div>
                  {history.length === 0
                    ? <div style={{ padding: "24px 16px", color: "#475569", fontSize: 12 }}>No reports yet.</div>
                    : <div className={s.historyList}>{history.map(e => (
                        <div key={e.id} className={s.historyItem} style={{ position: "relative" }}>
                          <div
                            style={{ cursor: "pointer" }}
                            onClick={() => {
                              setHistEntry(e);
                              setActiveCompanyIdx(0);
                              setActiveModule("core");
                              setShowHist(false);
                              setStep(5);
                            }}
                          >
                            <div className={s.historyItemTop}>
                              <span className={s.historyItemCompanies}>{e.target}</span>
                              <span className={s.historyItemCount}>{e.competitors?.length ?? 0} competitors</span>
                            </div>
                            <div className={s.historyItemDate}><Clock size={10} /> {new Date(e.date).toLocaleString()}</div>
                            {(e.industryContext || e.technologyContext) && (
                              <div style={{ fontSize: 10, color: "#334155", marginTop: 2 }}>
                                {e.industryContext && <span>{e.industryContext}</span>}
                                {e.industryContext && e.technologyContext && <span> · </span>}
                                {e.technologyContext && <span>{e.technologyContext}</span>}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={ev => { ev.stopPropagation(); const u = history.filter(h => h.id !== e.id); saveCompHist(u); setHistory(u); if (histEntry?.id === e.id) setHistEntry(null); }}
                            style={{ position: "absolute", top: 8, right: 8, background: "rgba(230,57,70,0.08)", border: "1px solid rgba(230,57,70,0.2)", cursor: "pointer", color: "#E63946", padding: "2px 7px", borderRadius: 4, fontSize: 11, fontWeight: 700 }}
                          >✕</button>
                        </div>
                      ))}</div>
                  }
                </div>
              </div>
            )}

            <div className={s.card}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4 }}>
                <div>
                  <div className={s.cardTitle}><Search size={16} color="#3491E8" /> Target Company</div>
                  <div className={s.cardSub}>Enter the company you want to benchmark against its competitive landscape.</div>
                </div>
                <button className={s.historyBtn} onClick={() => { setHistory(loadCompHist()); setShowHist(true); }}>
                  <History size={13} /> History {history.length > 0 && <span className={s.historyBadge}>{history.length}</span>}
                </button>
              </div>
              <div className={s.fieldRow}>
                <div className={s.fieldGroup}>
                  <label className={s.fieldLabel}>Company Name *</label>
                  <input
                    className={s.inp}
                    placeholder="e.g. Salesforce, SAP, Wipro"
                    value={targetCompany}
                    onChange={e => setTargetCompany(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && !discovering && targetCompany.trim() && handleDiscover()}
                  />
                </div>
                <div className={s.fieldGroup}>
                  <label className={s.fieldLabel}>Domain <span style={{ color: "#334155", fontWeight: 400 }}>(optional)</span></label>
                  <input
                    className={s.inp}
                    placeholder="e.g. salesforce.com"
                    value={targetDomain}
                    onChange={e => setTargetDomain(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && !discovering && targetCompany.trim() && handleDiscover()}
                  />
                </div>
              </div>
              <div className={s.fieldRow}>
                <div className={s.fieldGroup}>
                  <label className={s.fieldLabel}>Industry Focus <span style={{ color: "#475569", fontWeight: 400 }}>(optional)</span></label>
                  <input
                    className={s.inp}
                    placeholder="e.g. Semiconductor manufacturing, Retail banking, SaaS CRM"
                    value={industryContext}
                    onChange={e => setIndustryContext(e.target.value)}
                  />
                </div>
                <div className={s.fieldGroup}>
                  <label className={s.fieldLabel}>Technology Focus <span style={{ color: "#475569", fontWeight: 400 }}>(optional)</span></label>
                  <input
                    className={s.inp}
                    placeholder="e.g. Cloud infrastructure, Generative AI, ERP platforms"
                    value={technologyContext}
                    onChange={e => setTechnologyContext(e.target.value)}
                  />
                </div>
              </div>
              {discoverError && <div className={s.errorBox}>{discoverError}</div>}
              <div className={s.btnActions}>
                <button
                  className={`${s.btn} ${s.btnPrimary}`}
                  onClick={handleDiscover}
                  disabled={discovering || !targetCompany.trim()}
                >
                  {discovering ? <><div className={s.spinner} /> Discovering competitors…</> : <><Search size={14} /> Find Competitors</>}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── Step 2: Competitor Selection ── */}
        {step === 2 && (
          <div className={s.card}>
            <div className={s.cardTitle}><CheckCircle2 size={16} color="#3491E8" /> Select Competitors</div>
            <div className={s.cardSub}>
              Select up to 5 competitors to benchmark against <strong style={{ color: "#fff" }}>{targetCompany}</strong>.
              {selectedComps.length > 0 && <span className={s.badge} style={{ marginLeft: 8 }}>{selectedComps.length}/5 selected</span>}
            </div>

            <div className={s.discoverGrid}>
              {suggestedComps.map((comp) => {
                const isSelected = selectedComps.some(c => c.name === comp.name);
                const isDisabled = !isSelected && selectedComps.length >= 5;
                return (
                  <div
                    key={comp.name}
                    className={`${s.competitorCard} ${isSelected ? s.competitorCardSelected : ""} ${isDisabled ? s.competitorCardDisabled : ""}`}
                    onClick={() => !isDisabled && toggleCompetitor(comp)}
                  >
                    <div className={`${s.competitorCheck} ${isSelected ? s.competitorCheckActive : ""}`}>
                      {isSelected && <CheckCircle2 size={11} color="#fff" />}
                    </div>
                    <div className={s.competitorCardBody}>
                      <div className={s.competitorName}>{comp.name}</div>
                      {comp.domain && <div className={s.competitorDomain}>{comp.domain}</div>}
                      {comp.descriptor && <div className={s.competitorDesc}>{comp.descriptor}</div>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Manual add */}
            <div>
              <div className={s.sectionLabel} style={{ marginBottom: 8 }}>Add Manually</div>
              <div className={s.manualRow}>
                <input className={`${s.inp} ${s.inpSm}`} style={{ maxWidth: 220 }} placeholder="Company name" value={manualName} onChange={e => setManualName(e.target.value)} />
                <input className={`${s.inp} ${s.inpSm}`} style={{ maxWidth: 180 }} placeholder="domain.com" value={manualDomain} onChange={e => setManualDomain(e.target.value)} />
                <button className={`${s.btn} ${s.btnGhost}`} style={{ padding: "7px 14px" }} onClick={addManual} disabled={!manualName.trim() || selectedComps.length >= 5}>
                  <Plus size={13} /> Add
                </button>
              </div>
            </div>

            {/* Selected list */}
            {selectedComps.length > 0 && (
              <div>
                <div className={s.sectionLabel} style={{ marginBottom: 8 }}>Selected for analysis</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {selectedComps.map(c => (
                    <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, background: "#080f16", border: "1px solid rgba(52,145,232,0.2)" }}>
                      <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: "#fff" }}>{c.name}</span>
                      {c.domain && <span style={{ fontSize: 11, color: "#475569" }}>{c.domain}</span>}
                      <button className={s.btnDanger} onClick={() => removeSelected(c.name)}><Trash2 size={11} /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className={s.btnActions}>
              <button className={`${s.btn} ${s.btnSec}`} onClick={() => setStep(1)}>← Back</button>
              <button className={`${s.btn} ${s.btnPrimary}`} onClick={() => setStep(3)}>
                Continue <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Module Config ── */}
        {step === 3 && (
          <div className={s.card}>
            <div className={s.cardTitle}><BarChart2 size={16} color="#3491E8" /> Analysis Configuration</div>
            <div className={s.cardSub}>Choose benchmark focus and which intelligence modules to run.</div>

            <div>
              <div className={s.sectionLabel} style={{ marginBottom: 6 }}>
                Benchmark Focus
                <span style={{ color: "#334155", fontWeight: 400, fontSize: 10, marginLeft: 8 }}>select one or more · {benchmarkFoci.length} selected</span>
              </div>
              <div className={s.focusGrid}>
                {BENCHMARK_FOCI.map(f => {
                  const on = benchmarkFoci.includes(f);
                  return (
                    <button
                      key={f}
                      className={`${s.focusChip} ${on ? s.focusChipActive : ""}`}
                      onClick={() => setBenchmarkFoci(prev =>
                        prev.includes(f)
                          ? prev.length > 1 ? prev.filter(x => x !== f) : prev
                          : [...prev, f]
                      )}
                    >{f}</button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className={s.sectionLabel} style={{ marginBottom: 10 }}>
                Intelligence Modules &nbsp;
                <span style={{ color: "#3491E8", fontWeight: 400, fontSize: 10 }}>{enabledModules.length}/{Object.keys(ALL_MODULES).length} enabled</span>
              </div>
              <div className={s.moduleGrid}>
                {Object.entries(ALL_MODULES).map(([id, label]) => {
                  const isOn = enabledModules.includes(id);
                  const isCore = id === "metrics";
                  return (
                    <div
                      key={id}
                      className={`${s.moduleToggle} ${isOn ? s.moduleToggleActive : ""}`}
                      onClick={() => {
                        if (isCore) return;
                        setEnabledModules(prev => isOn ? prev.filter(m => m !== id) : [...prev, id]);
                      }}
                      style={isCore ? { opacity: 0.7, cursor: "default" } : {}}
                    >
                      <div className={`${s.moduleToggleCheck} ${isOn ? s.moduleToggleCheckActive : ""}`}>
                        {isOn && <CheckCircle2 size={10} color="#fff" />}
                      </div>
                      <span className={`${s.moduleToggleName} ${isOn ? s.moduleToggleNameActive : ""}`}>{label}</span>
                      {isCore && <span className={s.badge}>Always</span>}
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ padding: "12px 14px", borderRadius: 10, background: "#080f16", border: "1px solid #1a3a50", fontSize: 12, color: "#475569" }}>
              <strong style={{ color: "#94a3b8" }}>Scope:</strong> {targetCompany} vs {selectedComps.length} competitor{selectedComps.length !== 1 ? "s" : ""} &nbsp;·&nbsp;
              {enabledModules.length} module{enabledModules.length !== 1 ? "s" : ""} &nbsp;·&nbsp;
              {benchmarkFoci.length} benchmark focus{benchmarkFoci.length !== 1 ? "es" : ""} &nbsp;·&nbsp;
              ~{Math.ceil((selectedComps.length + 1) * enabledModules.length * 0.5)} min estimated
            </div>

            <div className={s.btnActions}>
              <button className={`${s.btn} ${s.btnSec}`} onClick={() => setStep(2)}>← Back</button>
              <button className={`${s.btn} ${s.btnPrimary}`} onClick={handleAnalyze}>
                <Play size={14} /> Run Analysis
              </button>
            </div>
          </div>
        )}

        {/* ── Step 4: Loading ── */}
        {step === 4 && (
          <div className={s.card}>
            <div className={s.loadingWrap}>
              <div className={s.spinner} style={{ width: 32, height: 32, borderWidth: 3 }} />
              <div>
                <div className={s.loadingTitle}>Analyzing Competitive Landscape</div>
                <div className={s.loadingSubtitle} style={{ textAlign: "center", marginTop: 4 }}>
                  {targetCompany} vs {selectedComps.length} competitor{selectedComps.length !== 1 ? "s" : ""} · {enabledModules.length} modules
                </div>
              </div>
              {progress.total > 0 && (
                <>
                  <div style={{ width: "100%", maxWidth: 480, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                    <div className={s.progressBar}>
                      <div className={s.progressFill} style={{ width: `${progressPct}%` }} />
                    </div>
                    <div className={s.progressText}>{progressPct}%</div>
                  </div>
                </>
              )}
              <div className={s.logBox}>
                {log.length === 0 && <div className={s.logLine}>Connecting to intelligence pipeline…</div>}
                {log.map((l, i) => (
                  <div key={i} className={`${s.logLine} ${l.highlight ? s.logLineHighlight : ""}`}>{l.msg}</div>
                ))}
              </div>
              {results.length > 0 && !analyzing && (
                <button className={`${s.btn} ${s.btnPrimary}`} onClick={() => setStep(5)}>
                  View Results <ChevronRight size={14} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Step 5: Results Dashboard ── */}
        {step === 5 && dispResults.length > 0 && (
          <>
            {/* History panel overlay */}
            {showHist && (
              <div className={s.historyOverlay} onClick={() => setShowHist(false)}>
                <div className={s.historyPanel} onClick={e => e.stopPropagation()}>
                  <div className={s.historyHeader}>
                    <span className={s.historyTitle}>Report History</span>
                    {history.length > 0 && (
                      <button className={s.historyDeleteAll} onClick={() => { saveCompHist([]); setHistory([]); }}>Clear all</button>
                    )}
                    <button className={s.historyClose} onClick={() => setShowHist(false)}><X size={15} /></button>
                  </div>
                  {history.length === 0
                    ? <div style={{ padding: "24px 16px", color: "#475569", fontSize: 12 }}>No reports yet.</div>
                    : <div className={s.historyList}>{history.map(e => (
                        <div key={e.id} className={s.historyItem} style={{ position: "relative" }}>
                          <div
                            style={{ cursor: "pointer" }}
                            onClick={() => {
                              setHistEntry(e);
                              setActiveCompanyIdx(0);
                              setActiveModule("core");
                              setShowHist(false);
                            }}
                          >
                            <div className={s.historyItemTop}>
                              <span className={s.historyItemCompanies}>{e.target}</span>
                              <span className={s.historyItemCount}>{e.competitors?.length ?? 0} competitors</span>
                            </div>
                            <div className={s.historyItemDate}><Clock size={10} /> {new Date(e.date).toLocaleString()}</div>
                          </div>
                          <button
                            onClick={ev => { ev.stopPropagation(); const u = history.filter(h => h.id !== e.id); saveCompHist(u); setHistory(u); if (histEntry?.id === e.id) setHistEntry(null); }}
                            style={{ position: "absolute", top: 8, right: 8, background: "rgba(230,57,70,0.08)", border: "1px solid rgba(230,57,70,0.2)", cursor: "pointer", color: "#E63946", padding: "2px 7px", borderRadius: 4, fontSize: 11, fontWeight: 700 }}
                            title="Delete this report"
                          >✕</button>
                        </div>
                      ))}</div>
                  }
                </div>
              </div>
            )}

            {/* History banner when viewing a past report */}
            {histEntry && (
              <div className={s.histBanner}>
                <span>📋 Viewing: <strong>{histEntry.target}</strong> · {new Date(histEntry.date).toLocaleString()}</span>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <button className={`${s.exportBtn} ${s.exportBtnJson}`} onClick={() => exportJSON(histEntry.results, histEntry.target)}>
                    <Download size={10} /> JSON
                  </button>
                  <button className={`${s.exportBtn} ${s.exportBtnHtml}`} onClick={() => exportHTML(histEntry.results, histEntry.synthesis, histEntry.target, histEntry.competitors)}>
                    <Download size={10} /> HTML
                  </button>
                  <button
                    onClick={() => { const u = history.filter(h => h.id !== histEntry.id); saveCompHist(u); setHistory(u); setHistEntry(null); }}
                    style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: "pointer", border: "1px solid rgba(230,57,70,0.3)", background: "rgba(230,57,70,0.08)", color: "#E63946", fontFamily: "inherit" }}
                  ><Trash2 size={11} /> Delete</button>
                  <button
                    onClick={() => setHistEntry(null)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: "pointer", border: "1px solid rgba(52,145,232,0.3)", background: "rgba(52,145,232,0.08)", color: "#3491E8", fontFamily: "inherit" }}
                  ><X size={11} /> Back to live</button>
                </div>
              </div>
            )}

            {/* Export bar */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
              <div style={{ flex: 1, fontSize: 13, color: "#475569" }}>
                <strong style={{ color: "#fff" }}>{dispTarget}</strong> vs {dispComps.join(", ")} · {dispResults.length} companies · {(histEntry?.modules ?? enabledModules).length} modules
              </div>
              <div className={s.exportBar}>
                <button className={`${s.exportBtn} ${s.exportBtnJson}`} onClick={() => exportJSON(dispResults, dispTarget)}>
                  <Download size={11} /> JSON
                </button>
                <button className={`${s.exportBtn} ${s.exportBtnHtml}`} onClick={() => exportHTML(dispResults, dispSynthesis, dispTarget, dispComps)}>
                  <Download size={11} /> HTML Report
                </button>
                <button className={s.historyBtn} onClick={() => { setHistory(loadCompHist()); setShowHist(true); }}>
                  <History size={13} /> History {history.length > 0 && <span className={s.historyBadge}>{history.length}</span>}
                </button>
                <button
                  className={`${s.btn} ${s.btnSec}`}
                  style={{ fontSize: 11, padding: "5px 10px" }}
                  onClick={() => { setStep(1); setResults([]); setSynthesis(""); setHistEntry(null); }}
                >
                  New Analysis
                </button>
              </div>
            </div>

            {/* ── Comparison Tables — one per module ── */}
            {allModuleIds.map(modId => {
              const modRows = dispResults.map(r => ({
                company: r.company,
                is_target: r.is_target,
                data: r.modules.find(m => m.module === modId)?.data ?? {},
                confidence: r.modules.find(m => m.module === modId)?.confidence ?? "grey",
              }));
              const keys = [...new Set(modRows.flatMap(r => Object.keys(r.data)))];
              if (!keys.length) return null;
              return (
                <div key={modId} className={s.card} style={{ marginBottom: 12 }}>
                  <div className={s.cardTitle}>{ALL_MODULES[modId] ?? modId}</div>
                  <div className={s.compTableWrap}>
                    <table className={s.compTable}>
                      <thead>
                        <tr>
                          <th>Metric</th>
                          {dispResults.map(r => (
                            <th key={r.company}>
                              {r.company}{r.is_target ? " ★" : ""}
                              <span style={{ marginLeft: 4 }}>
                                <ConfidenceDot level={modRows.find(m => m.company === r.company)?.confidence ?? "grey"} />
                              </span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {keys.map(key => (
                          <tr key={key}>
                            <td style={{ color: "#64748b", fontWeight: 600, whiteSpace: "nowrap" }}>
                              {key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                            </td>
                            {modRows.map(({ company, is_target, data }) => {
                              const v = data[key];
                              let display = "";
                              if (Array.isArray(v)) display = v.slice(0, 4).join(", ") + (v.length > 4 ? "…" : "");
                              else if (typeof v === "object" && v) display = Object.entries(v).slice(0, 2).map(([k2, v2]) => `${k2}: ${v2}`).join("; ");
                              else display = v || "—";
                              return (
                                <td key={company} className={is_target ? s.compTableTarget : ""} style={{ color: display === "—" ? "#334155" : "#e2e8f0" }}>
                                  {display}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}

            {/* Synthesis */}
            {dispSynthesis && (
              <div className={s.synthesisCard} style={{ marginTop: 16 }}>
                <div className={s.synthesisTitle}>
                  <BarChart2 size={14} /> Strategic Analysis — {histEntry ? (histEntry.benchmarkFoci ?? histEntry.benchmarkFocus ?? "Overview") : benchmarkFoci.join(", ")}
                </div>
                {dispSynthesis.split("\n\n").filter(Boolean).map((para, i) => (
                  <p key={i} className={s.synthesisParagraph}>{para}</p>
                ))}
              </div>
            )}
          </>
        )}
    </div>
  );
}

export default function CompetitiveIntelPage() {
  return (
    <div className={s.page}>
      <header className={s.header}>
        <div className={s.headerInner}>
          <div className={s.iconBox}><BarChart2 size={16} color="#3491E8" /></div>
          <div>
            <div className={s.headerTitle}>CompKill</div>
            <div className={s.headerSub}>Competition Benchmarking · Powered by RefractOne</div>
          </div>
          <nav className={s.headerActions}>
            <a href="/enrich" className={s.navLink}>← Back to Intelligence Hub</a>
          </nav>
        </div>
      </header>
      <div style={{ maxWidth: 1300, margin: "0 auto", padding: "0 20px" }}>
        <CompetitiveIntelContent />
      </div>
    </div>
  );
}
