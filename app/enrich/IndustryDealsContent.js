"use client";

import { useState, useCallback } from "react";
import { Search, Loader2, CheckCircle2, ChevronRight, X, ExternalLink, RefreshCw } from "lucide-react";
import s from "./enrich.module.css";

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4001").trim();

const RENEWAL_OPTIONS = [
  { label: "1 month",  value: "1 month" },
  { label: "3 months", value: "3 months" },
  { label: "6 months", value: "6 months" },
  { label: "1 year",   value: "1 year" },
  { label: "3 years",  value: "3 years" },
  { label: "5 years",  value: "5 years" },
];

const TYPE_FILTERS  = ["All", "Public", "Private", "Government"];
const REV_FILTERS   = [
  { label: "All revenue", value: "all" },
  { label: "> $1B",       value: "1B" },
  { label: "> $100M",     value: "100M" },
  { label: "> $10M",      value: "10M" },
];

function revenueNum(str) {
  if (!str || str === "—") return 0;
  const m = str.match(/([\d.]+)\s*([BbMm])/);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  return m[2].toLowerCase() === "b" ? n * 1e9 : n * 1e6;
}

function fmtDate(s) {
  if (!s || s === "—") return "—";
  const [y, m] = s.split("-");
  if (!m) return y;
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(m,10)-1] || ""} ${y}`;
}

const DEAL_TABLE_COLS = [
  { key: "company_name",          label: "Company",      w: 130 },
  { key: "vendor",                label: "Vendor",       w: 120 },
  { key: "deal_category",         label: "Category",     w: 110 },
  { key: "deal_type",             label: "Type",         w: 120 },
  { key: "deal_value",            label: "Value",        w: 80  },
  { key: "announced_date",        label: "Announced",    w: 90  },
  { key: "duration_years",        label: "Duration",     w: 70  },
  { key: "estimated_renewal_date",label: "Est. Renewal", w: 100 },
  { key: "description",           label: "Description",  w: 220 },
  { key: "source",                label: "Source",       w: 90  },
];

function RenewalBadge({ dateStr }) {
  if (!dateStr || dateStr === "—") return <span style={{ color: "#64748b" }}>—</span>;
  const today = new Date();
  const dt    = new Date(dateStr + "-01");
  const diffMs = dt - today;
  const diffDays = Math.round(diffMs / 86400000);
  let bg = "rgba(52,211,153,0.15)", color = "#34d399", label = dateStr;
  if (diffDays < 0)       { bg = "rgba(100,116,139,0.15)"; color = "#64748b"; label = `${fmtDate(dateStr)} (past)`; }
  else if (diffDays <= 90)  { bg = "rgba(230,57,70,0.15)";  color = "#E63946"; label = fmtDate(dateStr); }
  else if (diffDays <= 365) { bg = "rgba(251,191,36,0.15)"; color = "#fbbf24"; label = fmtDate(dateStr); }
  else                      { bg = "rgba(52,211,153,0.15)"; color = "#34d399"; label = fmtDate(dateStr); }
  return (
    <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 4, background: bg, color, fontWeight: 600, whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

function DealTable({ deals }) {
  if (!deals.length) return (
    <div style={{ padding: "32px 0", textAlign: "center", color: "#475569", fontSize: 13 }}>
      No deals in this view.
    </div>
  );
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid rgba(52,145,232,0.2)" }}>
            {DEAL_TABLE_COLS.map(c => (
              <th key={c.key} style={{ padding: "8px 10px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#64748b", letterSpacing: "0.05em", minWidth: c.w, whiteSpace: "nowrap" }}>
                {c.label.toUpperCase()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {deals.map((d, i) => (
            <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)" }}>
              {DEAL_TABLE_COLS.map(c => (
                <td key={c.key} style={{ padding: "7px 10px", verticalAlign: "top", color: "#cbd5e1" }}>
                  {c.key === "estimated_renewal_date"
                    ? <RenewalBadge dateStr={d[c.key]} />
                    : c.key === "announced_date"
                    ? <span style={{ color: "#94a3b8" }}>{fmtDate(d[c.key])}</span>
                    : c.key === "duration_years"
                    ? <span style={{ color: "#94a3b8" }}>{d[c.key] ? `${d[c.key]}y` : "—"}</span>
                    : c.key === "deal_value"
                    ? <span style={{ color: "#34d399", fontWeight: 600 }}>{d[c.key] || "—"}</span>
                    : c.key === "deal_category"
                    ? <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "rgba(52,145,232,0.12)", color: "#3491E8", fontWeight: 600 }}>{d[c.key] || "—"}</span>
                    : c.key === "source"
                    ? (d.source_url
                        ? <a href={d.source_url} target="_blank" rel="noopener noreferrer" style={{ color: "#3491E8", display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11 }}>
                            {d.source_label || "Link"} <ExternalLink size={10} />
                          </a>
                        : <span style={{ color: "#475569" }}>{d.source_label || "—"}</span>)
                    : c.key === "description"
                    ? <span style={{ color: "#94a3b8", fontSize: 11, lineHeight: 1.4 }}>{d[c.key] || "—"}</span>
                    : <span>{d[c.key] || "—"}</span>
                  }
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function IndustryDealsContent() {
  const [step, setStep]               = useState("input");      // input | companies | searching | results
  const [form, setForm]               = useState({
    industry: "", geography: "", renewal_timeframe: "1 year",
    company_name: "", domain: "", focus_tech: "",
  });
  const [loadingCos, setLoadingCos]   = useState(false);
  const [companies, setCompanies]     = useState([]);
  const [selected, setSelected]       = useState(new Set());
  const [typeFilter, setTypeFilter]   = useState("All");
  const [revFilter, setRevFilter]     = useState("all");
  const [status, setStatus]           = useState("idle");       // idle | running | done | error
  const [progress, setProgress]       = useState("");
  const [processed, setProcessed]     = useState(0);
  const [total, setTotal]             = useState(0);
  const [renewalDeals, setRenewalDeals] = useState([]);
  const [allDeals, setAllDeals]       = useState([]);
  const [activeTab, setActiveTab]     = useState("renewal");

  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // ── Step 1: Generate company list ──────────────────────────────────────────
  const generateCompanies = useCallback(async () => {
    if (!form.industry.trim()) return;
    setLoadingCos(true);
    setCompanies([]);
    setSelected(new Set());
    try {
      const res = await fetch(`${API_URL}/api/industry-companies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          industry:     form.industry.trim(),
          geography:    form.geography.trim(),
          company_name: form.company_name.trim(),
          domain:       form.domain.trim(),
          focus_tech:   form.focus_tech.trim(),
        }),
      });
      if (!res.ok) throw new Error(`Server ${res.status}`);
      const data = await res.json();
      const cos  = data.companies || [];
      setCompanies(cos);
      setSelected(new Set(cos.map(c => c.company_name)));
      setStep("companies");
    } catch (e) {
      alert(`Failed to generate company list: ${e.message}`);
    } finally {
      setLoadingCos(false);
    }
  }, [form]);

  // ── Step 2 filtering ───────────────────────────────────────────────────────
  const visibleCos = companies.filter(c => {
    if (typeFilter !== "All" && c.type !== typeFilter) return false;
    if (revFilter !== "all") {
      const n = revenueNum(c.revenue_estimate);
      if (revFilter === "1B"   && n < 1e9)  return false;
      if (revFilter === "100M" && n < 1e8)  return false;
      if (revFilter === "10M"  && n < 1e7)  return false;
    }
    return true;
  });

  const toggleCo    = name => setSelected(s => { const n = new Set(s); n.has(name) ? n.delete(name) : n.add(name); return n; });
  const selectAll   = () => setSelected(new Set(visibleCos.map(c => c.company_name)));
  const deselectAll = () => setSelected(s => { const n = new Set(s); visibleCos.forEach(c => n.delete(c.company_name)); return n; });

  // ── Step 3: Search deals ───────────────────────────────────────────────────
  const searchDeals = useCallback(async () => {
    const selectedCos = companies.filter(c => selected.has(c.company_name));
    if (!selectedCos.length) return;
    setStep("searching");
    setStatus("running");
    setProgress("Connecting…");
    setProcessed(0);
    setTotal(selectedCos.length);
    setRenewalDeals([]);
    setAllDeals([]);

    try {
      const res = await fetch(`${API_URL}/api/industry-deals-search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companies:        selectedCos,
          industry:         form.industry.trim(),
          geography:        form.geography.trim(),
          renewal_timeframe: form.renewal_timeframe,
          focus_tech:       form.focus_tech.trim(),
        }),
      });
      if (!res.ok || !res.body) throw new Error(`Server ${res.status}`);

      const reader = res.body.getReader();
      const dec    = new TextDecoder();
      let buf      = "";
      let rd = [], ad = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n"); buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const ev = JSON.parse(line.slice(6));
            if (ev.type === "heartbeat") {
              setProgress(ev.message ?? "");
            } else if (ev.type === "batch_done") {
              setProcessed(ev.processed);
              setProgress(ev.message ?? "");
            } else if (ev.type === "deal") {
              const deal = ev.deal;
              ad = [...ad, deal];
              setAllDeals([...ad]);
              if (deal.in_renewal_window) {
                rd = [...rd, deal];
                setRenewalDeals([...rd]);
              }
              setProgress(`${ad.length} deals found (${rd.length} in renewal window)…`);
            } else if (ev.type === "complete") {
              setStatus("done");
              setStep("results");
              setProgress(`Done — ${ad.length} deals found across ${ev.processed} companies`);
            } else if (ev.type === "error") {
              setStatus("error");
              setProgress(ev.message ?? "Error");
            }
          } catch {}
        }
      }
      if (status === "running") { setStatus("done"); setStep("results"); }
    } catch (e) {
      setStatus("error");
      setProgress(`Failed: ${e.message}`);
    }
  }, [companies, selected, form, status]);

  const reset = () => {
    setStep("input"); setStatus("idle"); setProgress("");
    setCompanies([]); setSelected(new Set());
    setRenewalDeals([]); setAllDeals([]);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── Step 1: Input ── */}
      {step === "input" && (
        <div className={s.card}>
          <div style={{ marginBottom: 16 }}>
            <div className={s.cardTitle} style={{ fontSize: 14, marginBottom: 4 }}>IT Deals by Industry</div>
            <div className={s.cardSub}>Generate a company list for an industry, then search for IT deals approaching renewal.</div>
          </div>

          {/* Primary inputs */}
          <div style={{ display: "flex", gap: 12 }} style={{ gap: 12, marginBottom: 12 }}>
            <div className={s.fieldGroup} style={{ flex: 2 }}>
              <label className={s.fieldLabel}>INDUSTRY *</label>
              <input className={s.inp} placeholder="e.g. Banking, Retail, Healthcare, Manufacturing"
                value={form.industry} onChange={e => upd("industry", e.target.value)} />
            </div>
            <div className={s.fieldGroup} style={{ flex: 1 }}>
              <label className={s.fieldLabel}>GEOGRAPHY</label>
              <input className={s.inp} placeholder="e.g. India, USA, APAC"
                value={form.geography} onChange={e => upd("geography", e.target.value)} />
            </div>
          </div>

          {/* Renewal timeframe chips */}
          <div style={{ marginBottom: 16 }}>
            <div className={s.fieldLabel} style={{ marginBottom: 8 }}>RENEWAL TIMEFRAME</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {RENEWAL_OPTIONS.map(opt => (
                <button key={opt.value} type="button" onClick={() => upd("renewal_timeframe", opt.value)}
                  style={{
                    padding: "5px 14px", borderRadius: 20, fontSize: 12, cursor: "pointer",
                    border: form.renewal_timeframe === opt.value ? "1px solid #3491E8" : "1px solid rgba(100,116,139,0.3)",
                    background: form.renewal_timeframe === opt.value ? "rgba(52,145,232,0.18)" : "rgba(255,255,255,0.04)",
                    color: form.renewal_timeframe === opt.value ? "#3491E8" : "#94a3b8",
                    transition: "all 0.15s",
                  }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Optional inputs */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 10, color: "#475569", fontWeight: 700, letterSpacing: "0.06em", marginBottom: 10 }}>
              OPTIONAL — NARROWS SEARCH
            </div>
            <div style={{ display: "flex", gap: 12 }} style={{ gap: 12 }}>
              <div className={s.fieldGroup} style={{ flex: 1 }}>
                <label className={s.fieldLabel}>COMPANY NAME <span style={{ color: "#475569", fontWeight: 400 }}>optional</span></label>
                <input className={s.inp} placeholder="e.g. HDFC Bank"
                  value={form.company_name} onChange={e => upd("company_name", e.target.value)} />
              </div>
              <div className={s.fieldGroup} style={{ flex: 1 }}>
                <label className={s.fieldLabel}>COMPANY DOMAIN <span style={{ color: "#475569", fontWeight: 400 }}>optional</span></label>
                <input className={s.inp} placeholder="e.g. hdfcbank.com"
                  value={form.domain} onChange={e => upd("domain", e.target.value)} />
              </div>
              <div className={s.fieldGroup} style={{ flex: 1 }}>
                <label className={s.fieldLabel}>FOCUS TECHNOLOGY <span style={{ color: "#475569", fontWeight: 400 }}>optional</span></label>
                <input className={s.inp} placeholder="e.g. Core Banking, SAP, Cybersecurity"
                  value={form.focus_tech} onChange={e => upd("focus_tech", e.target.value)} />
              </div>
            </div>
          </div>

          <button
            onClick={generateCompanies}
            disabled={!form.industry.trim() || loadingCos}
            style={{
              display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 22px",
              background: form.industry.trim() && !loadingCos ? "#3491E8" : "rgba(52,145,232,0.3)",
              color: "#fff", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 600,
              cursor: form.industry.trim() && !loadingCos ? "pointer" : "not-allowed",
            }}>
            {loadingCos
              ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Generating list…</>
              : <><Search size={15} /> Generate Company List</>}
          </button>
        </div>
      )}

      {/* ── Step 2: Company selection ── */}
      {step === "companies" && (
        <>
          {/* Header */}
          <div className={s.card} style={{ padding: "12px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div>
                <span style={{ color: "#3491E8", fontWeight: 700, fontSize: 13 }}>{companies.length} companies</span>
                <span style={{ color: "#64748b", fontSize: 12 }}> found in {form.industry}{form.geography ? ` · ${form.geography}` : ""}</span>
              </div>
              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <button onClick={reset} style={{ fontSize: 11, color: "#64748b", background: "none", border: "1px solid rgba(100,116,139,0.25)", borderRadius: 5, padding: "4px 10px", cursor: "pointer" }}>
                  ← Back
                </button>
              </div>
            </div>

            {/* Filter bar */}
            <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ display: "flex", gap: 5 }}>
                {TYPE_FILTERS.map(t => (
                  <button key={t} onClick={() => setTypeFilter(t)} type="button"
                    style={{
                      padding: "4px 11px", borderRadius: 5, fontSize: 11, cursor: "pointer",
                      border: typeFilter === t ? "1px solid #3491E8" : "1px solid rgba(100,116,139,0.25)",
                      background: typeFilter === t ? "rgba(52,145,232,0.15)" : "transparent",
                      color: typeFilter === t ? "#3491E8" : "#94a3b8",
                    }}>{t}</button>
                ))}
              </div>
              <div style={{ width: 1, height: 18, background: "rgba(100,116,139,0.2)" }} />
              <div style={{ display: "flex", gap: 5 }}>
                {REV_FILTERS.map(r => (
                  <button key={r.value} onClick={() => setRevFilter(r.value)} type="button"
                    style={{
                      padding: "4px 11px", borderRadius: 5, fontSize: 11, cursor: "pointer",
                      border: revFilter === r.value ? "1px solid #818cf8" : "1px solid rgba(100,116,139,0.25)",
                      background: revFilter === r.value ? "rgba(129,140,248,0.15)" : "transparent",
                      color: revFilter === r.value ? "#818cf8" : "#94a3b8",
                    }}>{r.label}</button>
                ))}
              </div>
              <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
                <button onClick={selectAll}   style={{ fontSize: 11, color: "#34d399", background: "none", border: "none", cursor: "pointer", padding: "2px 6px" }}>Select all</button>
                <button onClick={deselectAll} style={{ fontSize: 11, color: "#E63946", background: "none", border: "none", cursor: "pointer", padding: "2px 6px" }}>Deselect all</button>
                <span style={{ fontSize: 11, color: "#64748b" }}>{selected.size} selected</span>
              </div>
            </div>
          </div>

          {/* Company cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
            {visibleCos.map(co => {
              const on = selected.has(co.company_name);
              const typeBg   = co.type === "Public" ? "rgba(52,211,153,0.12)" : co.type === "Government" ? "rgba(251,191,36,0.12)" : "rgba(129,140,248,0.12)";
              const typeClr  = co.type === "Public" ? "#34d399" : co.type === "Government" ? "#fbbf24" : "#818cf8";
              return (
                <div key={co.company_name} onClick={() => toggleCo(co.company_name)}
                  style={{
                    padding: "12px 14px", borderRadius: 8, cursor: "pointer",
                    border: on ? "1px solid #3491E8" : "1px solid rgba(100,116,139,0.18)",
                    background: on ? "rgba(52,145,232,0.07)" : "rgba(255,255,255,0.02)",
                    transition: "all 0.15s", position: "relative",
                  }}>
                  {on && (
                    <div style={{ position: "absolute", top: 8, right: 8, width: 16, height: 16, borderRadius: "50%", background: "#3491E8", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ color: "#fff", fontSize: 10, fontWeight: 700 }}>✓</span>
                    </div>
                  )}
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0", marginBottom: 5, paddingRight: 20, lineHeight: 1.3 }}>{co.company_name}</div>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 6 }}>
                    <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 3, background: typeBg, color: typeClr, fontWeight: 600 }}>{co.type}</span>
                    {co.revenue_estimate && co.revenue_estimate !== "—" && (
                      <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 3, background: "rgba(52,211,153,0.1)", color: "#34d399" }}>{co.revenue_estimate}</span>
                    )}
                  </div>
                  {co.headquarters && <div style={{ fontSize: 10, color: "#64748b", marginBottom: 4 }}>{co.headquarters}</div>}
                  <div style={{ fontSize: 10, color: "#475569", lineHeight: 1.4 }}>{co.description}</div>
                </div>
              );
            })}
          </div>

          {/* Find deals CTA */}
          <div style={{ position: "sticky", bottom: 16, display: "flex", justifyContent: "center" }}>
            <button
              onClick={searchDeals}
              disabled={selected.size === 0}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 28px",
                background: selected.size > 0 ? "#3491E8" : "rgba(52,145,232,0.3)",
                color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700,
                cursor: selected.size > 0 ? "pointer" : "not-allowed",
                boxShadow: selected.size > 0 ? "0 4px 20px rgba(52,145,232,0.3)" : "none",
              }}>
              <ChevronRight size={16} />
              Find IT Deals for {selected.size} Compan{selected.size === 1 ? "y" : "ies"}
            </button>
          </div>
        </>
      )}

      {/* ── Step 3: Searching ── */}
      {step === "searching" && (
        <div className={s.card}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <Loader2 size={20} color="#3491E8" style={{ animation: "spin 1s linear infinite", flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>Searching IT Deals…</div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{form.industry}{form.geography ? ` · ${form.geography}` : ""} · {form.renewal_timeframe} renewal window</div>
            </div>
          </div>
          {/* Progress bar */}
          <div style={{ height: 4, background: "rgba(52,145,232,0.15)", borderRadius: 2, marginBottom: 12, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${total ? (processed / total) * 100 : 0}%`, background: "#3491E8", borderRadius: 2, transition: "width 0.5s ease" }} />
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>{progress}</div>
          <div style={{ fontSize: 11, color: "#475569" }}>{processed}/{total} companies · {renewalDeals.length} renewal deals · {allDeals.length} total deals found</div>
          {/* Live preview table */}
          {allDeals.length > 0 && (
            <div style={{ marginTop: 16, maxHeight: 300, overflowY: "auto" }}>
              <DealTable deals={allDeals.slice(-10)} />
            </div>
          )}
        </div>
      )}

      {/* ── Results ── */}
      {step === "results" && (
        <>
          {/* Summary bar */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", background: "rgba(52,145,232,0.07)", border: "1px solid rgba(52,145,232,0.2)", borderRadius: 8, flexWrap: "wrap" }}>
            {status === "done" && <CheckCircle2 size={16} color="#34d399" />}
            <span style={{ fontSize: 12, color: "#94a3b8" }}>{progress}</span>
            <button onClick={reset} style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: "#3491E8", background: "rgba(52,145,232,0.1)", border: "1px solid rgba(52,145,232,0.25)", borderRadius: 5, padding: "4px 10px", cursor: "pointer" }}>
              <RefreshCw size={11} /> New Search
            </button>
          </div>

          {/* Tab switcher */}
          <div style={{ display: "flex", gap: 0, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            {[
              { id: "renewal", label: `Renewal Deals (${renewalDeals.length})`, color: "#E63946" },
              { id: "all",     label: `All Deals (${allDeals.length})`,         color: "#3491E8" },
            ].map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                style={{
                  padding: "10px 20px", fontSize: 12, fontWeight: activeTab === t.id ? 700 : 500,
                  color: activeTab === t.id ? t.color : "#64748b",
                  background: "transparent", border: "none",
                  borderBottom: activeTab === t.id ? `2px solid ${t.color}` : "2px solid transparent",
                  cursor: "pointer", transition: "all 0.15s",
                }}>{t.label}</button>
            ))}
          </div>

          {/* Table */}
          <div className={s.tableWrap} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8 }}>
            <DealTable deals={activeTab === "renewal" ? renewalDeals : allDeals} />
          </div>
        </>
      )}
    </div>
  );
}
