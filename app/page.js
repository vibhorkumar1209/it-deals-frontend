"use client";

import { useState, useCallback } from "react";
import { SOURCES, DEAL_TYPES } from "../lib/sources.js";

// ── helpers ──────────────────────────────────────────────────────────────────
function truncate(s, n) {
  return s && s.length > n ? s.slice(0, n) + "…" : s || "";
}
function renderSourceLink(src) {
  if (!src) return <span>—</span>;
  if (src.startsWith("http")) {
    const domain = src.replace(/https?:\/\//, "").split("/")[0];
    return (
      <a href={src} target="_blank" rel="noreferrer" title={src}>
        {domain}
      </a>
    );
  }
  return <span>{src}</span>;
}

// ── main component ────────────────────────────────────────────────────────────
export default function Home() {
  // Input state
  const [company, setCompany]   = useState("");
  const [domain,  setDomain]    = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [yearStart, setYearStart] = useState("2020");
  const [yearEnd,   setYearEnd]   = useState("2025");

  // Source toggles
  const [activeSources, setActiveSources] = useState(
    new Set(SOURCES.map((s) => s.cat))
  );
  const toggleSource = (cat) => {
    setActiveSources((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  // Deal state
  const [allDeals,      setAllDeals]      = useState([]);
  const [filteredDeals, setFilteredDeals] = useState([]);
  const [confFilter,    setConfFilter]    = useState("");
  const [typeFilter,    setTypeFilter]    = useState("");

  // UI state
  const [status,      setStatus]      = useState("idle"); // idle | loading | done | error
  const [loadingStep, setLoadingStep] = useState("");
  const [errorMsg,    setErrorMsg]    = useState("");
  const [history,     setHistory]     = useState([]);
  const [histOpen,    setHistOpen]    = useState(false);
  const [savedMsg,    setSavedMsg]    = useState(false);

  // ── filter helper ────────────────────────────────────────────────────────
  const applyFilters = useCallback(
    (deals, cf, tf) => {
      return deals.filter((d) => {
        if (cf === "High"   && d.confidence !== "High")  return false;
        if (cf === "Medium" && d.confidence === "Low")   return false;
        if (tf && d.type !== tf)                          return false;
        return true;
      });
    },
    []
  );

  const handleConfFilter = (v) => {
    setConfFilter(v);
    setFilteredDeals(applyFilters(allDeals, v, typeFilter));
  };
  const handleTypeFilter = (v) => {
    setTypeFilter(v);
    setFilteredDeals(applyFilters(allDeals, confFilter, v));
  };

  // ── search ───────────────────────────────────────────────────────────────
  const runSearch = async () => {
    if (!company.trim()) { alert("Please enter a company name"); return; }

    setStatus("loading");
    setErrorMsg("");
    setAllDeals([]);
    setFilteredDeals([]);

    const steps = [
      "Searching press release wires…",
      "Scanning IT news sources…",
      "Checking vendor announcements…",
      "Extracting deal attributes…",
      "Normalising vendor names…",
    ];
    let si = 0;
    setLoadingStep(steps[si]);
    const stepInterval = setInterval(() => {
      si = (si + 1) % steps.length;
      setLoadingStep(steps[si]);
    }, 1800);

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: company.trim(),
          domain:  domain.trim(),
          linkedin: linkedin.trim(),
          yearStart,
          yearEnd,
          activeSources: [...activeSources],
        }),
      });

      clearInterval(stepInterval);
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `API error ${res.status}`);

      const deals = data.deals.map((d, i) => ({
        ...d,
        _id: Date.now() + i,
        _searched_company: company.trim(),
      }));
      setAllDeals(deals);
      setFilteredDeals(applyFilters(deals, confFilter, typeFilter));
      setStatus("done");
    } catch (e) {
      clearInterval(stepInterval);
      setErrorMsg(e.message);
      setStatus("error");
    }
  };

  // ── CSV download ─────────────────────────────────────────────────────────
  const downloadCSV = () => {
    const headers = ["#","Customer","Vendor","Deal Description","Date","Type",
                     "SI Partner","Value","Duration","Confidence","Source"];
    const rows = filteredDeals.map((d, i) =>
      [i + 1, d.customer, d.vendor, d.deal_description, d.date, d.type,
       d.si_partner || "", d.value || "", d.duration || "", d.confidence, d.source || ""]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `IT_Deals_${(company || "deals").replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── history ──────────────────────────────────────────────────────────────
  const saveToHistory = () => {
    if (!allDeals.length) return;
    const entry = {
      id:        Date.now(),
      company:   company.trim(),
      deals:     [...allDeals],
      timestamp: new Date().toLocaleString(),
      count:     allDeals.length,
    };
    setHistory((prev) => [entry, ...prev]);
    setHistOpen(true);
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2000);
  };

  const loadHistory = (entry) => {
    setAllDeals(entry.deals);
    setFilteredDeals(applyFilters(entry.deals, confFilter, typeFilter));
    setCompany(entry.company);
    setStatus("done");
  };
  const deleteHistory = (id) => setHistory((prev) => prev.filter((h) => h.id !== id));

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div>
          <div className="header-title">IT Deal Intelligence</div>
          <div className="header-sub">
            Powered by Claude API · RefractOne Market Intelligence Practice
          </div>
        </div>
        <span className="header-badge">Antigravity™</span>
      </header>

      {/* Input panel */}
      <div className="input-panel">
        <div className="field">
          <label>Company Name</label>
          <input
            type="text"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="e.g. Reliance Jio"
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
          />
        </div>
        <div className="field">
          <label>Domain</label>
          <input
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="e.g. jio.com"
          />
        </div>
        <div className="field">
          <label>LinkedIn URL</label>
          <input
            type="text"
            value={linkedin}
            onChange={(e) => setLinkedin(e.target.value)}
            placeholder="linkedin.com/company/…"
          />
        </div>
        <div className="field">
          <label>Year Range</label>
          <div className="year-row">
            <input
              type="number"
              value={yearStart}
              onChange={(e) => setYearStart(e.target.value)}
              min="2015" max="2025"
            />
            <span className="year-sep">–</span>
            <input
              type="number"
              value={yearEnd}
              onChange={(e) => setYearEnd(e.target.value)}
              min="2020" max="2026"
            />
            <button
              className="run-btn"
              onClick={runSearch}
              disabled={status === "loading"}
            >
              {status === "loading" ? "Searching…" : "Run Search"}
            </button>
          </div>
        </div>
      </div>

      {/* Sources strip */}
      <div className="sources-strip">
        <span className="sources-label">Sources:</span>
        {SOURCES.map((s) => (
          <label
            key={s.cat}
            className={`chip ${activeSources.has(s.cat) ? "active" : ""}`}
          >
            <input
              type="checkbox"
              checked={activeSources.has(s.cat)}
              onChange={() => toggleSource(s.cat)}
            />
            {s.cat}
          </label>
        ))}
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar-left">
          <span className="count-badge">
            {filteredDeals.length} deal{filteredDeals.length !== 1 ? "s" : ""}
          </span>
          <select
            className="filter-select"
            value={confFilter}
            onChange={(e) => handleConfFilter(e.target.value)}
          >
            <option value="">All confidence</option>
            <option value="High">High only</option>
            <option value="Medium">Medium+</option>
          </select>
          <select
            className="filter-select"
            value={typeFilter}
            onChange={(e) => handleTypeFilter(e.target.value)}
          >
            <option value="">All types</option>
            {DEAL_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="toolbar-right">
          <button
            className="action-btn"
            onClick={saveToHistory}
            disabled={!allDeals.length}
          >
            {savedMsg ? "✓ Saved" : "Save to history"}
          </button>
          <button
            className="action-btn primary"
            onClick={downloadCSV}
            disabled={!filteredDeals.length}
          >
            ⬇ Download CSV
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {status === "idle" && (
          <div className="state-box">
            <div className="state-icon">🔍</div>
            <div className="state-title">No deals loaded yet</div>
            <div className="state-sub">
              Enter a company name above and click <strong>Run Search</strong>.
              Claude will find IT deals using the sources from your uploaded list.
            </div>
          </div>
        )}

        {status === "loading" && (
          <div className="state-box">
            <div className="spinner" />
            <div className="state-title">Searching IT deal databases…</div>
            <div className="loading-step">{loadingStep}</div>
          </div>
        )}

        {status === "error" && (
          <>
            <div className="error-bar">Error: {errorMsg}</div>
            <div className="state-box" style={{ padding: "24px" }}>
              <div className="state-sub">
                Check that <code>ANTHROPIC_API_KEY</code> is set in your Vercel environment variables and try again.
              </div>
            </div>
          </>
        )}

        {status === "done" && filteredDeals.length === 0 && (
          <div className="state-box">
            <div className="state-icon">📭</div>
            <div className="state-title">No deals match the current filter</div>
            <div className="state-sub">Try relaxing the confidence or type filter.</div>
          </div>
        )}

        {status === "done" && filteredDeals.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Customer</th>
                  <th>Vendor</th>
                  <th>Deal Description</th>
                  <th>Date</th>
                  <th>Type</th>
                  <th>SI Partner</th>
                  <th>Value</th>
                  <th>Duration</th>
                  <th>Confidence</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {filteredDeals.map((d, i) => (
                  <tr key={d._id || i}>
                    <td>{i + 1}</td>
                    <td>
                      <div className="td-customer">{d.customer || "—"}</div>
                    </td>
                    <td>
                      <span className="td-vendor">{d.vendor || "—"}</span>
                    </td>
                    <td>
                      <div
                        className="td-desc"
                        title={d.deal_description || ""}
                      >
                        {truncate(d.deal_description, 100)}
                      </div>
                    </td>
                    <td className="td-date">{d.date || "—"}</td>
                    <td>
                      <span className="type-badge">{d.type || "—"}</span>
                    </td>
                    <td className="td-si">{d.si_partner || "—"}</td>
                    <td className="td-value">{d.value || "—"}</td>
                    <td className="td-dur">{d.duration || "—"}</td>
                    <td>
                      <span className={`conf-badge conf-${d.confidence || "Low"}`}>
                        {d.confidence || "Low"}
                      </span>
                    </td>
                    <td className="td-source">{renderSourceLink(d.source)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* History panel */}
      <div className="history-panel">
        <div className="history-header" onClick={() => setHistOpen((o) => !o)}>
          <span className="history-title">
            Report history ({history.length})
          </span>
          <span className={`history-chevron ${histOpen ? "open" : ""}`}>▼</span>
        </div>
        {histOpen && (
          <div className="history-body">
            {history.length === 0 && (
              <span style={{ fontSize: 11, color: "var(--text-sec)" }}>
                No saved reports yet. Run a search and click "Save to history".
              </span>
            )}
            {history.map((e) => (
              <div
                key={e.id}
                className="hist-item"
                onClick={() => loadHistory(e)}
              >
                <span>📁 {e.company}</span>
                <span className="hist-meta">
                  {e.count} deals · {e.timestamp}
                </span>
                <span
                  className="hist-del"
                  onClick={(ev) => { ev.stopPropagation(); deleteHistory(e.id); }}
                >
                  ×
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
