"use client";

import { useState, useCallback, useEffect } from "react";
import { Plus, Trash2, Play, Download, ChevronRight, ChevronLeft, Loader2, CheckCircle2, Zap, History, X, Clock } from "lucide-react";
import s from "./enrich.module.css";

const HISTORY_KEY = "enrich_report_history";
const MAX_HISTORY = 50;

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]"); }
  catch { return []; }
}
function saveHistory(h) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h)); } catch {}
}
function addToHistory(goal, fields, rows) {
  if (!rows.length) return;
  const companies = [...new Set(rows.map(r => r.company_name))];
  const entry = {
    id: Date.now(),
    date: new Date().toISOString(),
    goal: goal.slice(0, 120),
    companies,
    fields,
    rows,
  };
  const existing = loadHistory();
  saveHistory([entry, ...existing].slice(0, MAX_HISTORY));
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4001";

const PRESETS = [
  {
    label: "IT Deal Details",
    goal: "Find all IT technology deals, vendor contracts, outsourcing agreements, and digital transformation initiatives signed by this company in the last 5 years.",
    fields: [
      { key: "vendor",      label: "Vendor Name",  type: "string", description: "Technology vendor or service provider" },
      { key: "deal_type",   label: "Deal Type",    type: "string", description: "ERP / Cloud / Outsourcing / Cybersecurity etc." },
      { key: "deal_value",  label: "Deal Value",   type: "string", description: "Contract value in USD millions if known" },
      { key: "date_signed", label: "Date Signed",  type: "date",   description: "Announcement or signing date" },
      { key: "description", label: "Description",  type: "string", description: "One-line description of what was agreed" },
      { key: "source",      label: "Source URL",   type: "string", description: "URL of press release or news article" },
    ],
  },
  {
    label: "Vendor Intelligence",
    goal: "Research the company's key technology vendors, software products in use, and known IT infrastructure stack.",
    fields: [
      { key: "erp_vendor",     label: "ERP System",     type: "string", description: "Core ERP platform in use" },
      { key: "crm_vendor",     label: "CRM System",     type: "string", description: "CRM platform in use" },
      { key: "cloud_provider", label: "Cloud Provider", type: "string", description: "Primary cloud: AWS / Azure / GCP" },
      { key: "core_banking",   label: "Core Banking",   type: "string", description: "Core banking system if applicable" },
      { key: "si_partner",     label: "SI Partner",     type: "string", description: "Primary system integrator / IT services partner" },
    ],
  },
  {
    label: "Company Firmographics",
    goal: "Research key firmographic details for the company including employee count, revenue, headquarters, and industry.",
    fields: [
      { key: "hq",        label: "Headquarters",  type: "string", description: "City and country" },
      { key: "employees", label: "Employees",     type: "number", description: "Approximate headcount" },
      { key: "revenue",   label: "Revenue (USD)", type: "string", description: "Annual revenue" },
      { key: "industry",  label: "Industry",      type: "string", description: "Primary industry sector" },
      { key: "founded",   label: "Founded",       type: "string", description: "Year founded" },
    ],
  },
];

export default function EnrichPage() {
  const [step, setStep]           = useState(1);
  const [goal, setGoal]           = useState(PRESETS[0].goal);
  const [fields, setFields]       = useState(PRESETS[0].fields);
  const [inputs, setInputs]       = useState([{ company_name: "", domain: "", industry: "", vendor: "" }]);
  const [rawText, setRawText]     = useState("");
  const [inputMode, setInputMode] = useState("table");
  const [status, setStatus]       = useState("idle");   // idle | running | complete | error
  const [progress, setProgress]   = useState("");
  const [rows, setRows]           = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory]     = useState([]);
  const [historyEntry, setHistoryEntry] = useState(null);
  // Search boosters
  const [showBoosters, setShowBoosters] = useState(false);
  const [vendorText, setVendorText]   = useState("");
  const [sourceText, setSourceText]   = useState("");
  const [keywordText, setKeywordText] = useState("");
  const [runT3, setRunT3]             = useState(false);
  // Vendor competitor lookup
  const [myVendor, setMyVendor]               = useState("");
  const [competitorSegments, setCompetitorSegments] = useState([]); // [{name, description, competitors:[]}]
  const [competitorVendors, setCompetitorVendors] = useState([]);   // flat selected list
  const [competitorLoading, setCompetitorLoading] = useState(false);
  const [competitorError, setCompetitorError]   = useState("");

  useEffect(() => { setHistory(loadHistory()); }, []);

  // Parse booster text fields into arrays (one item per line or comma-separated)
  const parseList = (text) => text.split(/[\n,]/).map(s => s.trim()).filter(Boolean);
  const vendors  = parseList(vendorText);
  const sources  = parseList(sourceText);
  const keywords = parseList(keywordText);

  /* ── Competitor lookup ── */
  const fetchCompetitors = async (vendorName) => {
    if (!vendorName.trim()) return;
    setCompetitorLoading(true);
    setCompetitorError("");
    setCompetitorSegments([]);
    setCompetitorVendors([]);
    try {
      const res = await fetch(`${API_URL}/api/vendor-competitors?vendor=${encodeURIComponent(vendorName.trim())}`);
      const data = await res.json();
      if (data.segments?.length) {
        setCompetitorSegments(data.segments);
        // Default: all competitors selected
        const all = [...new Set(data.segments.flatMap(s => s.competitors))];
        setCompetitorVendors(all);
      } else {
        setCompetitorError(data.message || "No competitors found for this vendor.");
      }
    } catch {
      setCompetitorError("Failed to fetch competitors — check API connection.");
    } finally {
      setCompetitorLoading(false);
    }
  };

  const toggleCompetitor = (name) => {
    setCompetitorVendors(prev =>
      prev.includes(name) ? prev.filter(v => v !== name) : [...prev, name]
    );
  };

  /* ── Helpers ── */
  const applyPreset = (p) => { setGoal(p.goal); setFields(p.fields); };
  const addField    = () => setFields(f => [...f, { key: `field_${f.length+1}`, label: "", type: "string", description: "" }]);
  const removeField = (i) => setFields(f => f.filter((_, idx) => idx !== i));
  const updateField = (i, patch) => setFields(f => f.map((fi, idx) => idx === i ? { ...fi, ...patch } : fi));

  const parsedInputs = inputMode === "paste"
    ? rawText.trim().split("\n").flatMap(line => {
        const parts = line.split(/[,\t]/);
        return parts.length >= 2 ? [{
          company_name: parts[0].trim(),
          domain:       parts[1].trim(),
          industry:     parts[2]?.trim() || "",
          vendor:       parts[3]?.trim() || "",
        }] : [];
      })
    : inputs.filter(r => r.company_name && r.domain);

  /* ── Run ── */
  const run = useCallback(async () => {
    setStatus("running"); setRows([]); setProgress("Connecting…");
    try {
      const res = await fetch(`${API_URL}/api/enrich-task`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal,
          schema_fields: fields,
          inputs: parsedInputs,
          ...(vendors.length           && { vendors }),
          ...(sources.length           && { sources }),
          ...(keywords.length          && { keywords }),
          ...(competitorVendors.length && { competitor_vendors: competitorVendors }),
          run_t3: runT3,
        }),
      });
      if (!res.ok || !res.body) throw new Error(`${res.status}`);
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
            if (ev.type === "progress" || ev.type === "heartbeat") setProgress(ev.message ?? "");
            else if (ev.type === "row") { setRows(prev => [...prev, ev.row]); setProgress(`✅ ${ev.index + 1} deals streamed…`); }
            else if (ev.type === "complete") {
              setStatus("complete");
              setProgress(`Done — ${ev.succeeded} deals enriched`);
              setRows(prev => { addToHistory(goal, fields, ev.results ?? prev); setHistory(loadHistory()); return prev; });
            }
            else if (ev.type === "error") { setStatus("error"); setProgress(ev.message ?? "Error"); }
          } catch {}
        }
      }
    } catch (e) {
      setStatus("error"); setProgress(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [goal, fields, parsedInputs]);

  /* ── Downloads ── */
  const downloadCSV = () => {
    if (!rows.length) return;
    const keys = ["company_name", "domain", ...fields.map(f => f.key)];
    const header = ["Company", "Domain", ...fields.map(f => f.label)];
    const csv = [header.join(","), ...rows.map(r => keys.map(k => `"${(r[k] ?? "").replace(/"/g,'""')}"`).join(","))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }));
    a.download = "enrichment-results.csv"; a.click();
  };
  const downloadJSON = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" }));
    a.download = "enrichment-results.json"; a.click();
  };

  /* ── Render ── */
  return (
    <div className={s.page}>
      {/* Header */}
      <header className={s.header}>
        <div className={s.headerInner}>
          <div className={s.iconBox}><Zap size={14} color="#3491E8" /></div>
          <div>
            <div className={s.headerTitle}>Web Enrichment Tasks</div>
            <div className={s.headerSub}>Define goal · Configure schema · Run across multiple companies</div>
          </div>
          <div className={s.headerActions}>
            <button className={s.historyBtn} onClick={() => { setHistory(loadHistory()); setShowHistory(true); setHistoryEntry(null); }}>
              <History size={13} /> History {history.length > 0 && <span className={s.historyBadge}>{history.length}</span>}
            </button>
            <a href="/" className={s.backLink}>← IT Deal Scan</a>
          </div>
        </div>
      </header>

      {/* ── History Panel ── */}
      {showHistory && (
        <div className={s.historyOverlay} onClick={() => { setShowHistory(false); setHistoryEntry(null); }}>
          <div className={s.historyPanel} onClick={e => e.stopPropagation()}>
            <div className={s.historyHeader}>
              <span className={s.historyTitle}>
                {historyEntry ? (
                  <button className={s.historyBack} onClick={() => setHistoryEntry(null)}>← Back</button>
                ) : "Report History"}
              </span>
              {!historyEntry && history.length > 0 && (
                <button className={s.historyDeleteAll} onClick={() => { saveHistory([]); setHistory([]); }}>
                  Clear all
                </button>
              )}
              <button className={s.historyClose} onClick={() => { setShowHistory(false); setHistoryEntry(null); }}><X size={15} /></button>
            </div>

            {!historyEntry && (
              history.length === 0
                ? <div className={s.historyEmpty}>No reports saved yet. Run an enrichment task to save results.</div>
                : <div className={s.historyList}>
                    {history.map(entry => (
                      <button key={entry.id} className={s.historyItem} onClick={() => setHistoryEntry(entry)}>
                        <div className={s.historyItemTop}>
                          <span className={s.historyItemCompanies}>{entry.companies.slice(0, 3).join(", ")}{entry.companies.length > 3 ? ` +${entry.companies.length - 3}` : ""}</span>
                          <span className={s.historyItemCount}>{entry.rows.length} rows</span>
                        </div>
                        <div className={s.historyItemGoal}>{entry.goal}</div>
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
                <div className={s.historyDetailGoal}>{historyEntry.goal}</div>
                <div className={s.historyDetailActions}>
                  <button className={s.dlBtnCSV} onClick={() => {
                    const keys = ["company_name", "domain", ...historyEntry.fields.map(f => f.key)];
                    const header = ["Company", "Domain", ...historyEntry.fields.map(f => f.label)];
                    const csv = [header.join(","), ...historyEntry.rows.map(r => keys.map(k => `"${(r[k] ?? "").replace(/"/g,'""')}"`).join(","))].join("\n");
                    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿"+csv], {type:"text/csv;charset=utf-8;"}));
                    a.download = `report-${new Date(historyEntry.date).toISOString().slice(0,10)}.csv`; a.click();
                  }}><Download size={12} /> CSV</button>
                  <button className={s.dlBtnJSON} onClick={() => {
                    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(historyEntry.rows, null, 2)], {type:"application/json"}));
                    a.download = `report-${new Date(historyEntry.date).toISOString().slice(0,10)}.json`; a.click();
                  }}><Download size={12} /> JSON</button>
                  <button className={s.historyDeleteOne} onClick={() => {
                    const updated = history.filter(h => h.id !== historyEntry.id);
                    saveHistory(updated); setHistory(updated); setHistoryEntry(null);
                  }}><Trash2 size={12} /> Delete</button>
                </div>
                <div className={s.tableWrap} style={{marginTop:8}}>
                  <div className={s.tableScroll}>
                    <table className={s.table}>
                      <thead className={s.thead}>
                        <tr className={s.theadTr}>
                          <th className={s.th}>#</th>
                          <th className={s.th}>Company</th>
                          {historyEntry.fields.map(f => <th key={f.key} className={s.th}>{f.label}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {historyEntry.rows.map((row, i) => (
                          <tr key={i} className={`${s.tbodyTr} ${i%2===0?"":s.tbodyTrEven}`}>
                            <td className={`${s.td} ${s.tdNum}`}>{i+1}</td>
                            <td className={`${s.td} ${s.tdCo}`}>{row.company_name}</td>
                            {historyEntry.fields.map(f => (
                              <td key={f.key} className={`${s.td} ${s.tdVal}`}>
                                {row[f.key] ? <span className={s.tdValInner}>{row[f.key]}</span> : <span className={s.tdNone}>—</span>}
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
        {/* Step indicator */}
        <div className={s.steps}>
          {[1,2,3].map((sn, i) => (
            <span key={sn} style={{display:"flex",alignItems:"center",gap:8}}>
              <button
                className={`${s.stepDot} ${step===sn ? s.stepDotActive : step>sn ? s.stepDotDone : s.stepDotIdle}`}
                onClick={() => status==="idle" && setStep(sn)}
              >
                {step > sn ? "✓" : sn}
              </button>
              <span className={step===sn ? s.stepLabelActive : s.stepLabel}>
                {sn===1 ? "Goal & Schema" : sn===2 ? "Companies" : "Run & Results"}
              </span>
              {sn < 3 && <span className={s.stepArrow}>›</span>}
            </span>
          ))}
        </div>

        {/* ── Step 1 ── */}
        {step === 1 && (
          <div style={{display:"flex",flexDirection:"column",gap:20}}>
            {/* Presets */}
            <div className={s.card}>
              <div className={s.cardTitle}>Quick-start presets</div>
              <div className={s.flexRow}>
                {PRESETS.map(p => (
                  <button key={p.label} className={s.pill} onClick={() => applyPreset(p)}>{p.label}</button>
                ))}
              </div>
            </div>

            {/* Goal */}
            <div className={s.card}>
              <div className={s.cardTitle}>Enrichment goal</div>
              <div className={s.cardSub}>Describe what Parallel.ai should research for each company.</div>
              <textarea
                className={`${s.inp} ${s.ta}`}
                style={{height:88}}
                value={goal}
                onChange={e => setGoal(e.target.value)}
                placeholder="e.g. Find all IT deals and technology contracts signed in the last 5 years…"
              />
            </div>

            {/* Schema */}
            <div className={s.card}>
              <div className={s.row}>
                <div className={s.cardTitle}>Output schema</div>
                <button className={s.btnAdd} onClick={addField}><Plus size={12} /> Add field</button>
              </div>
              {fields.map((f, i) => (
                <div key={i} className={s.schemaRow}>
                  <input className={s.inp} placeholder="field_key" value={f.key}
                    onChange={e => updateField(i, { key: e.target.value.replace(/\s+/g,"_").toLowerCase() })} />
                  <input className={s.inp} placeholder="Display label" value={f.label}
                    onChange={e => updateField(i, { label: e.target.value })} />
                  <select className={s.sel} value={f.type} onChange={e => updateField(i, { type: e.target.value })}>
                    <option value="string">Text</option>
                    <option value="number">Number</option>
                    <option value="date">Date</option>
                    <option value="boolean">Yes/No</option>
                  </select>
                  <input className={s.inp} placeholder="Description (helps AI)" value={f.description}
                    onChange={e => updateField(i, { description: e.target.value })} />
                  <button className={s.btnIcon} onClick={() => removeField(i)}><Trash2 size={14} /></button>
                </div>
              ))}
            </div>

            {/* Search Intelligence Status */}
            <div className={s.card}>
              <div className={s.cardTitle}>🚀 Search intelligence</div>
              <div className={s.boosterStatus}>
                <div className={s.boosterStat}><span className={s.boosterStatNum}>14,913</span><span className={s.boosterStatLabel}>vendors</span></div>
                <div className={s.boosterDivider} />
                <div className={s.boosterStat}><span className={s.boosterStatNum}>183</span><span className={s.boosterStatLabel}>categories</span></div>
                <div className={s.boosterDivider} />
                <div className={s.boosterStat}><span className={s.boosterStatNum}>301</span><span className={s.boosterStatLabel}>keywords</span></div>
                <div className={s.boosterDivider} />
                <div className={s.boosterStat}><span className={s.boosterStatNum}>32</span><span className={s.boosterStatLabel}>sources</span></div>
                <div className={s.boosterDivider} />
                <div className={s.boosterStat}><span className={s.boosterStatNum}>3</span><span className={s.boosterStatLabel}>tiers</span></div>
              </div>
              <div className={s.boosterDesc}>
                Tier 1: all 32 sources + 33 product keywords + 20 process keywords + top vendors with category context.
                Tier 2: remaining process/tech keywords + vendor×category pairs.
                Tier 3: broad catch-alls. Auto-escalates if fewer than 10 deals found.
              </div>

              {/* ── Your vendor → competitor search ── */}
              <hr className={s.divider} />
              <div style={{fontSize:12,fontWeight:600,color:"#fff",marginBottom:4}}>Your vendor <span style={{fontSize:11,color:"#64748b",fontWeight:400}}>(optional) — adds top competitors to Tier 2 search</span></div>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <input
                  className={s.inp}
                  style={{flex:1}}
                  placeholder="e.g. SAP, Oracle, TCS…"
                  value={myVendor}
                  onChange={e => { setMyVendor(e.target.value); setCompetitorVendors([]); setCompetitorError(""); }}
                  onKeyDown={e => e.key === "Enter" && fetchCompetitors(myVendor)}
                />
                <button
                  className={`${s.btn} ${s.btnGhost}`}
                  style={{whiteSpace:"nowrap"}}
                  disabled={!myVendor.trim() || competitorLoading}
                  onClick={() => fetchCompetitors(myVendor)}
                >
                  {competitorLoading ? <><Loader2 size={13} className={s.spin} /> Searching…</> : "Find competitors"}
                </button>
              </div>
              {competitorError && <div style={{fontSize:11,color:"#E63946"}}>{competitorError}</div>}
              {competitorSegments.length > 0 && (
                <div style={{display:"flex",flexDirection:"column",gap:12}}>
                  <div style={{fontSize:11,color:"#34d399"}}>
                    ✓ {competitorVendors.length} competitors selected across {competitorSegments.length} segments — added to Tier 2 search
                  </div>
                  {competitorSegments.map((seg, si) => (
                    <div key={si} style={{background:"#07111a",border:"1px solid #1a3a50",borderRadius:10,padding:"10px 14px"}}>
                      <div style={{display:"flex",alignItems:"baseline",gap:8,marginBottom:6}}>
                        <span style={{fontSize:12,fontWeight:600,color:"#fff"}}>{seg.name}</span>
                        {seg.description && <span style={{fontSize:11,color:"#475569"}}>{seg.description}</span>}
                      </div>
                      <div className={s.flexRow}>
                        {seg.competitors.map(v => {
                          const selected = competitorVendors.includes(v);
                          return (
                            <button key={v} onClick={() => toggleCompetitor(v)} style={{
                              fontSize:11,padding:"3px 10px",borderRadius:20,cursor:"pointer",
                              fontFamily:"inherit",transition:"all 0.15s",
                              background: selected ? "rgba(52,145,232,0.18)" : "transparent",
                              border: selected ? "1px solid rgba(52,145,232,0.45)" : "1px solid #1a3a50",
                              color: selected ? "#93c5fd" : "#475569",
                            }}>
                              {selected ? "✓ " : ""}{v}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={s.actions}>
              <div />
              <button className={`${s.btn} ${s.btnPrimary}`} onClick={() => setStep(2)} disabled={!goal.trim() || fields.length===0}>
                Next: Add Companies <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2 ── */}
        {step === 2 && (
          <div style={{display:"flex",flexDirection:"column",gap:20}}>
            <div className={s.card}>
              <div className={s.row}>
                <div className={s.cardTitle}>Companies to enrich</div>
                <div className={s.flexRow}>
                  <button className={`${s.pill} ${inputMode==="table" ? s.pillActive : ""}`} onClick={() => setInputMode("table")}>Row entry</button>
                  <button className={`${s.pill} ${inputMode==="paste" ? s.pillActive : ""}`} onClick={() => setInputMode("paste")}>Paste CSV</button>
                </div>
              </div>

              {inputMode === "table" && (
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  <div style={{display:"grid",gridTemplateColumns:"1.5fr 1fr 0.8fr 1fr auto",gap:8,fontSize:11,color:"#64748b",fontWeight:600,padding:"0 2px"}}>
                    <span>Company Name</span><span>Domain</span><span>Industry</span><span>Vendor <span style={{color:"#334155",fontWeight:400}}>(optional)</span></span><span />
                  </div>
                  {inputs.map((inp_, i) => (
                    <div key={i} style={{display:"grid",gridTemplateColumns:"1.5fr 1fr 0.8fr 1fr auto",gap:8,alignItems:"center"}}>
                      <input className={s.inp} placeholder="e.g. HDFC Bank" value={inp_.company_name}
                        onChange={e => setInputs(prev => prev.map((r,idx) => idx===i ? {...r, company_name: e.target.value} : r))} />
                      <input className={s.inp} placeholder="e.g. hdfcbank.com" value={inp_.domain}
                        onChange={e => setInputs(prev => prev.map((r,idx) => idx===i ? {...r, domain: e.target.value} : r))} />
                      <input className={s.inp} placeholder="e.g. Banking" value={inp_.industry || ""}
                        onChange={e => setInputs(prev => prev.map((r,idx) => idx===i ? {...r, industry: e.target.value} : r))} />
                      <input className={s.inp} placeholder="e.g. SAP, TCS…" value={inp_.vendor || ""}
                        onChange={e => setInputs(prev => prev.map((r,idx) => idx===i ? {...r, vendor: e.target.value} : r))} />
                      <button className={s.btnIcon} onClick={() => setInputs(prev => prev.filter((_,idx) => idx!==i))}><Trash2 size={14} /></button>
                    </div>
                  ))}
                  <button className={s.btnAdd} onClick={() => setInputs(prev => [...prev, { company_name:"", domain:"", industry:"", vendor:"" }])}>
                    <Plus size={12} /> Add company
                  </button>
                </div>
              )}

              {inputMode === "paste" && (
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  <div className={s.cardSub}>One company per line: <code style={{color:"#94a3b8"}}>Company Name, domain.com, industry, vendor (all optional except first two)</code></div>
                  <textarea className={`${s.inp} ${s.ta}`} style={{height:140,fontFamily:"monospace",fontSize:12}}
                    placeholder={"HDFC Bank, hdfcbank.com, Banking, SAP\nICICI Bank, icicibank.com, Banking\nAxis Bank, axisbank.com"}
                    value={rawText} onChange={e => setRawText(e.target.value)} />
                  {parsedInputs.length > 0 && <div className={s.hint}>✓ {parsedInputs.length} companies parsed</div>}
                </div>
              )}
            </div>

            <div className={s.actions}>
              <button className={`${s.btn} ${s.btnGhost}`} onClick={() => setStep(1)}><ChevronLeft size={16} /> Back</button>
              <button className={`${s.btn} ${s.btnPrimary}`} onClick={() => setStep(3)} disabled={parsedInputs.length===0}>
                Next: Run Task <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3 ── */}
        {step === 3 && (
          <div style={{display:"flex",flexDirection:"column",gap:20}}>
            {/* Summary */}
            <div className={s.card}>
              <div className={s.cardTitle}>Task summary</div>
              <div className={s.summaryGrid}>
                <div><div className={s.summaryLabel}>Companies</div><div className={s.summaryValue}>{parsedInputs.length}</div></div>
                <div><div className={s.summaryLabel}>Output fields</div><div className={s.summaryValue}>{fields.length}</div></div>
                <div><div className={s.summaryLabel}>Research engine</div><div className={s.summaryValueBlue}>Apify + Claude</div></div>
                {vendors.length          > 0 && <div><div className={s.summaryLabel}>Extra vendors</div><div className={s.summaryValueBlue}>{vendors.length}</div></div>}
                {sources.length          > 0 && <div><div className={s.summaryLabel}>Extra sources</div><div className={s.summaryValueBlue}>{sources.length}</div></div>}
                {keywords.length         > 0 && <div><div className={s.summaryLabel}>Extra keywords</div><div className={s.summaryValueBlue}>{keywords.length}</div></div>}
                {competitorVendors.length > 0 && <div><div className={s.summaryLabel}>T2 competitors</div><div className={s.summaryValueBlue}>{competitorVendors.length} · {myVendor}</div></div>}
                {parsedInputs.filter(r => r.vendor).length > 0 && <div><div className={s.summaryLabel}>With vendor</div><div className={s.summaryValueBlue}>{parsedInputs.filter(r => r.vendor).length} companies</div></div>}
              </div>
              <hr className={s.divider} />
              <div className={s.goalPreview}>{goal}</div>
              <hr className={s.divider} />
              {/* T3 toggle */}
              <label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",userSelect:"none"}}>
                <div
                  onClick={() => setRunT3(v => !v)}
                  style={{
                    width:36, height:20, borderRadius:10, flexShrink:0,
                    background: runT3 ? "#3491E8" : "#1a3a50",
                    position:"relative", transition:"background 0.2s", cursor:"pointer",
                  }}
                >
                  <div style={{
                    position:"absolute", top:3, left: runT3 ? 18 : 3,
                    width:14, height:14, borderRadius:"50%", background:"#fff",
                    transition:"left 0.2s",
                  }} />
                </div>
                <div>
                  <div style={{fontSize:12,fontWeight:600,color: runT3 ? "#fff" : "#94a3b8"}}>Enable Tier 3 deep search</div>
                  <div style={{fontSize:11,color:"#475569"}}>+5 min · +$1.72 · keyword catch-all across 150 tech terms — only needed for niche companies</div>
                </div>
              </label>
            </div>

            {/* Status */}
            {status !== "idle" && (
              <div className={s.statusBar}>
                {status === "running"  && <Loader2 size={16} color="#3491E8" className={s.spin} />}
                {status === "complete" && <CheckCircle2 size={16} color="#34d399" />}
                <span className={s.statusText}>{progress}</span>
                {status === "complete" && (
                  <div className={s.dlBtn}>
                    <button className={s.dlBtnCSV} onClick={downloadCSV}><Download size={12} /> CSV</button>
                    <button className={s.dlBtnJSON} onClick={downloadJSON}><Download size={12} /> JSON</button>
                  </div>
                )}
              </div>
            )}

            {/* Results table */}
            {rows.length > 0 && (
              <div className={s.tableWrap}>
                <div className={s.tableScroll}>
                  <table className={s.table}>
                    <thead className={s.thead}>
                      <tr className={s.theadTr}>
                        <th className={s.th}>#</th>
                        <th className={s.th}>Company</th>
                        <th className={s.th}>Domain</th>
                        {fields.map(f => <th key={f.key} className={s.th}>{f.label}</th>)}
                        <th className={s.th}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, i) => (
                        <tr key={i} className={`${s.tbodyTr} ${i%2===0 ? "" : s.tbodyTrEven}`}>
                          <td className={`${s.td} ${s.tdNum}`}>{i+1}</td>
                          <td className={`${s.td} ${s.tdCo}`}>{row.company_name}</td>
                          <td className={`${s.td} ${s.tdDom}`}>{row.domain}</td>
                          {fields.map(f => (
                            <td key={f.key} className={`${s.td} ${s.tdVal}`}>
                              {row[f.key]
                                ? <span className={s.tdValInner}>{row[f.key]}</span>
                                : <span className={s.tdNone}>—</span>}
                            </td>
                          ))}
                          <td className={s.td}>
                            <span className={`${s.badge} ${row._status==="ok" ? s.badgeOk : s.badgeNone}`}>
                              {row._status==="ok" ? "Enriched" : "No data"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className={s.actions}>
              <button className={`${s.btn} ${s.btnGhost}`} disabled={status==="running"} onClick={() => { setStep(2); setStatus("idle"); setRows([]); }}>
                <ChevronLeft size={16} /> Back
              </button>
              <button className={`${s.btn} ${s.btnPrimary}`} onClick={run} disabled={status==="running" || parsedInputs.length===0}>
                {status==="running"
                  ? <><Loader2 size={16} className={s.spin} /> Running…</>
                  : <><Play size={16} /> {status==="complete" ? "Run again" : "Run enrichment"}</>}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
