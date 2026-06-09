"use client";

import { useState, useCallback, useRef } from "react";
import {
  Search, Globe, Building2, Users, Briefcase, DollarSign, Cpu,
  ChevronDown, ChevronUp, Plus, X, Download, Loader2, CheckCircle2,
  History, Trash2, Clock, Check
} from "lucide-react";

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4001").trim();
const GCC_HIST_KEY = "gcc_intel_v2_history";
const MAX_HIST = 30;

// ── Accent colour ─────────────────────────────────────────────────────────────
const ACC = "#f472b6";
const ACC_BG = "rgba(244,114,182,0.08)";
const ACC_BORDER = "rgba(244,114,182,0.2)";

// ── History helpers ───────────────────────────────────────────────────────────
function loadHist() {
  try { const r = JSON.parse(localStorage.getItem(GCC_HIST_KEY) ?? "[]"); return Array.isArray(r) ? r : []; }
  catch { return []; }
}
function saveHist(h) { try { localStorage.setItem(GCC_HIST_KEY, JSON.stringify(h)); } catch {} }

// ── Empty company row ─────────────────────────────────────────────────────────
const emptyRow = () => ({ id: Math.random().toString(36).slice(2), name: "", domain: "", location: "" });

// ── CSV export ────────────────────────────────────────────────────────────────
function exportCSV(results) {
  if (!results.length) return;
  const rows = [];
  rows.push(["Company", "GCC Location", "Established", "Operating Model", "Headcount",
    "Capability Areas", "Active Projects", "Key Leaders", "Parent Revenue",
    "Cloud Provider", "Digital Maturity"].join(","));
  for (const r of results) {
    const p = r.profile || {};
    const caps = (r.capabilities || []).map(c => c.capability_area).join("; ");
    const projs = (r.projects || []).filter(p => p.status === "Active").map(p => p.project_name).join("; ");
    const leaders = (r.talent || []).filter(t => t.type === "Leader").map(t => `${t.name} (${t.title})`).join("; ");
    const fin = r.financials || {};
    const tech = r.techstack || {};
    rows.push([
      r.company_name, r.gcc_location || p.primary_location || "-",
      p.established_year || "-", p.operating_model || "-", p.total_headcount || "-",
      caps || "-", projs || "-", leaders || "-",
      fin.parent_global_revenue || "-",
      tech.cloud_providers || "-", tech.digital_maturity_level || "-",
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + rows.join("\n")], { type: "text/csv;charset=utf-8;" }));
  a.download = "gcc-intelligence.csv"; a.click();
}

// ── Section tab data ──────────────────────────────────────────────────────────
const SECTION_TABS = [
  { key: "profile",       label: "Profile",       icon: Building2,  color: "#f472b6" },
  { key: "capabilities",  label: "Capabilities",  icon: Briefcase,  color: "#818cf8" },
  { key: "projects",      label: "Projects",      icon: Globe,      color: "#3491E8" },
  { key: "talent",        label: "Talent",        icon: Users,      color: "#34d399" },
  { key: "financials",    label: "Financials",    icon: DollarSign, color: "#fbbf24" },
  { key: "techstack",     label: "Tech Stack",    icon: Cpu,        color: "#22d3ee" },
];

// ── Inline badge ──────────────────────────────────────────────────────────────
function Badge({ text, bg = "rgba(52,145,232,0.12)", color = "#3491E8" }) {
  if (!text || text === "-") return <span style={{ color: "#334155" }}>—</span>;
  return <span style={{ background: bg, color, padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700, whiteSpace: "nowrap", display: "inline-block" }}>{text}</span>;
}

// ── Mini-table ────────────────────────────────────────────────────────────────
function MiniTable({ headers, rows, renderRow }) {
  if (!rows || !rows.length) return <div style={{ color: "#334155", fontSize: 12, padding: "12px 0" }}>No data available</div>;
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
        <thead>
          <tr style={{ background: "#0c3649" }}>
            {headers.map(h => <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "#64748b", fontWeight: 600, fontSize: 11, whiteSpace: "nowrap", borderBottom: "1px solid #1a3a50" }}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderTop: "1px solid #0f2a3d", background: i % 2 === 0 ? "transparent" : "#0a1520" }}>
              {renderRow(row)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const Td = ({ children, bold, notes, green, yellow }) => (
  <td style={{
    padding: "8px 12px", color: bold ? "#fff" : green ? "#34d399" : yellow ? "#fbbf24" : "#cbd5e1",
    fontWeight: bold ? 600 : 400, fontSize: notes ? 11 : undefined, maxWidth: notes ? 260 : undefined,
    lineHeight: notes ? 1.5 : undefined, verticalAlign: "top",
  }}>{children || <span style={{ color: "#334155" }}>—</span>}</td>
);

// ── Section renderers ─────────────────────────────────────────────────────────

function ProfileSection({ data }) {
  if (!data || typeof data !== "object") return <div style={{ color: "#334155", fontSize: 12, padding: 12 }}>Profile data not available</div>;
  const fields = [
    ["GCC Name", data.gcc_name],
    ["All Locations", data.gcc_locations],
    ["Primary Location", data.primary_location],
    ["Established", data.established_year],
    ["Operating Model", data.operating_model],
    ["Total Headcount", data.total_headcount],
    ["Parent HQ", data.parent_hq],
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {data.gcc_overview && (
        <div style={{ background: "rgba(244,114,182,0.06)", border: "1px solid rgba(244,114,182,0.15)", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#cbd5e1", lineHeight: 1.6 }}>
          {data.gcc_overview}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 8 }}>
        {fields.filter(([, v]) => v && v !== "-").map(([label, value]) => (
          <div key={label} style={{ background: "#0a1c2a", border: "1px solid #1a3a50", borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 12, color: "#fff", fontWeight: 600 }}>{value}</div>
          </div>
        ))}
      </div>
      {data.source && data.source !== "-" && (
        <a href={data.source} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#3491E8", textDecoration: "none" }}>↗ Source</a>
      )}
    </div>
  );
}

function CapabilitiesSection({ data }) {
  const MAT_COLORS = { "Nascent": "#E63946", "Growing": "#fbbf24", "Mature": "#3491E8", "Centre of Excellence": "#34d399" };
  return (
    <MiniTable
      headers={["Capability Area", "Maturity", "Team Size", "Key Functions", "Description"]}
      rows={Array.isArray(data) ? data : []}
      renderRow={row => (<>
        <Td bold>{row.capability_area}</Td>
        <Td><Badge text={row.maturity_level} bg={`rgba(${row.maturity_level === "Centre of Excellence" ? "52,211,153" : row.maturity_level === "Mature" ? "52,145,232" : row.maturity_level === "Growing" ? "251,191,36" : "230,57,70"},0.12)`} color={MAT_COLORS[row.maturity_level] || "#94a3b8"} /></Td>
        <Td green>{row.team_size_estimate}</Td>
        <Td notes>{row.key_functions}</Td>
        <Td notes>{row.description}</Td>
      </>)}
    />
  );
}

function ProjectsSection({ data }) {
  const STATUS_C = { "Active": "#34d399", "Announced": "#3491E8", "Completed": "#fbbf24", "Planning": "#818cf8" };
  return (
    <MiniTable
      headers={["Project", "Category", "Status", "Value", "Partner", "Timeline", "Description"]}
      rows={Array.isArray(data) ? data : []}
      renderRow={row => (<>
        <Td bold>{row.project_name}</Td>
        <Td><span style={{ fontSize: 10, color: "#818cf8", background: "rgba(129,140,248,0.1)", padding: "2px 6px", borderRadius: 4 }}>{row.category}</span></Td>
        <Td><Badge text={row.status} bg={`rgba(${row.status === "Active" ? "52,211,153" : row.status === "Announced" ? "52,145,232" : "251,191,36"},0.12)`} color={STATUS_C[row.status] || "#94a3b8"} /></Td>
        <Td green>{row.investment_value}</Td>
        <Td>{row.partner_vendor}</Td>
        <Td>{row.timeline}</Td>
        <Td notes>{row.description}</Td>
      </>)}
    />
  );
}

function TalentSection({ data }) {
  const SEN_C = { "C-Suite": "#f472b6", "VP": "#818cf8", "Director": "#3491E8", "Senior Manager": "#fbbf24" };
  const leaders = Array.isArray(data) ? data.filter(d => d.type !== "Talent Insight") : [];
  const insights = Array.isArray(data) ? data.filter(d => d.type === "Talent Insight") : [];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {insights.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {insights.map((ins, i) => (
            <div key={i} style={{ background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.15)", borderRadius: 8, padding: "8px 12px", fontSize: 11, color: "#94a3b8", maxWidth: 320 }}>
              <span style={{ color: "#34d399", fontWeight: 600 }}>Insight: </span>{ins.insight}
            </div>
          ))}
        </div>
      )}
      <MiniTable
        headers={["Name", "Title", "Seniority", "Function", "Reports To", "Contact", "LinkedIn"]}
        rows={leaders}
        renderRow={row => (<>
          <Td bold>{row.name}</Td>
          <Td>{row.title}</Td>
          <Td><Badge text={row.seniority} bg="rgba(244,114,182,0.1)" color={SEN_C[row.seniority] || "#94a3b8"} /></Td>
          <Td><span style={{ fontSize: 10, color: "#818cf8" }}>{row.function}</span></Td>
          <Td notes>{row.reporting_to}</Td>
          <Td notes>{row.contact_hint}</Td>
          <Td>{row.linkedin_url && row.linkedin_url !== "-" ? <a href={row.linkedin_url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#3491E8" }}>↗ LinkedIn</a> : null}</Td>
        </>)}
      />
    </div>
  );
}

function FinancialsSection({ data }) {
  if (!data || typeof data !== "object") return <div style={{ color: "#334155", fontSize: 12, padding: 12 }}>Financials not available</div>;
  const fields = [
    ["Parent Global Revenue", data.parent_global_revenue, "#fbbf24"],
    ["GCC Operational Budget", data.gcc_operational_budget, "#34d399"],
    ["GCC Revenue Generated", data.gcc_revenue_generated, "#34d399"],
    ["Cost Arbitrage", data.cost_arbitrage, "#3491E8"],
    ["IP / Patents Filed", data.ip_patents_filed, "#818cf8"],
    ["R&D Investment", data.r_and_d_investment, "#f472b6"],
    ["Proprietary Platforms", data.proprietary_platforms, "#94a3b8"],
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 8 }}>
        {fields.filter(([, v]) => v && v !== "-" && v !== "Unknown").map(([label, value, color]) => (
          <div key={label} style={{ background: "#0a1c2a", border: "1px solid #1a3a50", borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 13, color, fontWeight: 700 }}>{value}</div>
          </div>
        ))}
      </div>
      {data.financial_notes && data.financial_notes !== "-" && (
        <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6, padding: "8px 12px", background: "rgba(251,191,36,0.04)", border: "1px solid rgba(251,191,36,0.1)", borderRadius: 8 }}>
          {data.financial_notes}
        </div>
      )}
      {data.source && data.source !== "-" && (
        <a href={data.source} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#3491E8", textDecoration: "none" }}>↗ Source</a>
      )}
    </div>
  );
}

function TechStackSection({ data }) {
  if (!data || typeof data !== "object") return <div style={{ color: "#334155", fontSize: 12, padding: 12 }}>Tech stack not available</div>;
  const score = parseInt(data.cloud_maturity_score) || 0;
  const matColors = { "Cloud-Native": "#34d399", "Hybrid": "#3491E8", "Migrating": "#fbbf24", "Legacy-Heavy": "#E63946" };
  const autColors = { "Hyper-Automated": "#34d399", "High": "#3491E8", "Medium": "#fbbf24", "Low": "#E63946" };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {data.tech_highlights && (
        <div style={{ background: "rgba(34,211,238,0.06)", border: "1px solid rgba(34,211,238,0.15)", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#cbd5e1", lineHeight: 1.6 }}>
          {data.tech_highlights}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 8 }}>
        {[
          ["Cloud Provider", data.cloud_providers, "#22d3ee"],
          ["Cloud Migration", data.cloud_migration_maturity, matColors[data.cloud_migration_maturity] || "#94a3b8"],
          ["Automation", data.automation_index, autColors[data.automation_index] || "#94a3b8"],
          ["Digital Maturity", data.digital_maturity_level, "#818cf8"],
          ["Modern vs Legacy", data.modern_vs_legacy_split, "#3491E8"],
          ["AI/ML Platforms", data.ai_ml_platforms, "#f472b6"],
        ].filter(([, v]) => v && v !== "-" && v !== "Unknown").map(([label, value, color]) => (
          <div key={label} style={{ background: "#0a1c2a", border: "1px solid #1a3a50", borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 12, color, fontWeight: 600 }}>{value}</div>
          </div>
        ))}
      </div>
      {score > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "#0a1c2a", border: "1px solid #1a3a50", borderRadius: 8 }}>
          <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em", flexShrink: 0 }}>Cloud Maturity Score</div>
          <div style={{ flex: 1, background: "#0f2a3d", borderRadius: 4, height: 6 }}>
            <div style={{ width: `${score}%`, height: 6, borderRadius: 4, background: score >= 70 ? "#34d399" : score >= 45 ? "#fbbf24" : "#E63946", transition: "width 0.4s" }} />
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{score}</div>
        </div>
      )}
      {data.tech_vendors && data.tech_vendors !== "-" && (
        <div style={{ fontSize: 11, color: "#94a3b8" }}><span style={{ color: "#64748b" }}>Key vendors: </span>{data.tech_vendors}</div>
      )}
      {data.devops_adoption && data.devops_adoption !== "-" && (
        <div style={{ fontSize: 11, color: "#94a3b8" }}><span style={{ color: "#64748b" }}>DevOps: </span>{data.devops_adoption}</div>
      )}
    </div>
  );
}

// ── Company result card ───────────────────────────────────────────────────────
function CompanyCard({ result, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const [tab, setTab] = useState("profile");
  const p = result.profile || {};

  return (
    <div style={{ border: "1px solid #1a3a50", borderRadius: 12, overflow: "hidden", background: "#0c1f2e" }}>
      {/* Card header — click to expand */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left", color: "#fff" }}
      >
        <div style={{ width: 32, height: 32, borderRadius: 8, background: ACC_BG, border: `1px solid ${ACC_BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Building2 size={14} color={ACC} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{result.company_name}</div>
          <div style={{ fontSize: 11, color: "#475569", marginTop: 1 }}>
            {p.primary_location || result.gcc_location || "Location researching…"}
            {p.established_year && p.established_year !== "Unknown" && <span style={{ marginLeft: 8 }}>Est. {p.established_year}</span>}
            {p.total_headcount && p.total_headcount !== "Unknown" && <span style={{ marginLeft: 8, color: "#34d399" }}>{p.total_headcount} employees</span>}
          </div>
        </div>
        {p.operating_model && p.operating_model !== "Unknown" && (
          <span style={{ fontSize: 10, color: ACC, background: ACC_BG, padding: "3px 8px", borderRadius: 20, fontWeight: 600, flexShrink: 0, whiteSpace: "nowrap" }}>{p.operating_model}</span>
        )}
        <div style={{ color: "#334155", flexShrink: 0 }}>
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {open && (
        <div style={{ borderTop: "1px solid #1a3a50" }}>
          {/* Section tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid #1a3a50", background: "#080f16", overflowX: "auto" }}>
            {SECTION_TABS.map(({ key, label, icon: Icon, color }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 5, padding: "10px 16px",
                  fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", cursor: "pointer",
                  background: "none", border: "none", borderBottom: tab === key ? `2px solid ${color}` : "2px solid transparent",
                  color: tab === key ? color : "#475569", fontFamily: "inherit", transition: "color 0.15s",
                }}
              >
                <Icon size={12} />
                {label}
              </button>
            ))}
          </div>

          {/* Section content */}
          <div style={{ padding: 16 }}>
            {tab === "profile"       && <ProfileSection      data={result.profile} />}
            {tab === "capabilities"  && <CapabilitiesSection data={result.capabilities} />}
            {tab === "projects"      && <ProjectsSection     data={result.projects} />}
            {tab === "talent"        && <TalentSection       data={result.talent} />}
            {tab === "financials"    && <FinancialsSection   data={result.financials} />}
            {tab === "techstack"     && <TechStackSection    data={result.techstack} />}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main exported component ───────────────────────────────────────────────────
export function GCCIntelContent() {
  const [inputMode, setInputMode]           = useState("company"); // "company" | "industry"
  const [companyRows, setCompanyRows]       = useState([emptyRow()]);
  const [industry, setIndustry]             = useState("");
  const [industryLoc, setIndustryLoc]       = useState("");
  const [status, setStatus]                 = useState("idle"); // idle | discovering | discovered | enriching | done | error
  const [progress, setProgress]             = useState("");
  const [discoveredCos, setDiscoveredCos]   = useState([]);
  const [selected, setSelected]             = useState(new Set());
  const [results, setResults]               = useState([]);
  const [history, setHistory]               = useState(() => { try { return loadHist(); } catch { return []; } });
  const [showHist, setShowHist]             = useState(false);
  const [histEntry, setHistEntry]           = useState(null);
  const readerRef = useRef(null);

  // ── Company row helpers ─────────────────────────────────────────────────────
  const addRow = () => { if (companyRows.length < 50) setCompanyRows(r => [...r, emptyRow()]); };
  const removeRow = id => setCompanyRows(r => r.filter(x => x.id !== id));
  const updateRow = (id, field, val) => setCompanyRows(r => r.map(x => x.id === id ? { ...x, [field]: val } : x));

  // ── SSE reader helper ───────────────────────────────────────────────────────
  const readSSE = useCallback(async (url, body, handlers) => {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok || !res.body) throw new Error(`Server ${res.status}`);
    const reader = res.body.getReader();
    readerRef.current = reader;
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
          handlers[ev.type]?.(ev);
          if (ev.type === "heartbeat") setProgress(ev.message ?? "");
        } catch {}
      }
    }
  }, []);

  // ── Mode A: run enrichment directly ────────────────────────────────────────
  const runCompanyEnrich = useCallback(async () => {
    const valid = companyRows.filter(r => r.name.trim());
    if (!valid.length) return;
    setStatus("enriching"); setProgress("Connecting to GCC Intelligence Engine…");
    setResults([]); setHistEntry(null);
    try {
      const newResults = [];
      await readSSE(`${API_URL}/api/gcc-enrich`, {
        companies: valid.map(r => ({ company_name: r.name.trim(), gcc_location: r.location.trim(), domain: r.domain.trim() }))
      }, {
        gcc_enriched: ev => {
          const entry = { company_name: ev.company_name, gcc_location: ev.gcc_location, profile: ev.profile, capabilities: ev.capabilities, projects: ev.projects, talent: ev.talent, financials: ev.financials, techstack: ev.techstack };
          newResults.push(entry);
          setResults(r => [...r, entry]);
        },
        complete: ev => {
          setStatus("done");
          setProgress(`Done — ${ev.total_enriched ?? newResults.length} compan${(ev.total_enriched ?? newResults.length) === 1 ? "y" : "ies"} enriched`);
          const entry = { id: Date.now(), date: new Date().toISOString(), mode: "company", query: valid.map(r => r.name).join(", "), summary: `${newResults.length} GCC profile${newResults.length !== 1 ? "s" : ""}`, results: newResults };
          const h = [entry, ...loadHist()].slice(0, MAX_HIST);
          saveHist(h); setHistory(h);
        },
        error: ev => { setStatus("error"); setProgress(ev.message ?? "Error"); },
      });
    } catch (e) { setStatus("error"); setProgress(`Failed: ${e.message}`); }
  }, [companyRows, readSSE]);

  // ── Mode B: discover ────────────────────────────────────────────────────────
  const runDiscover = useCallback(async () => {
    if (!industry.trim()) return;
    setStatus("discovering"); setProgress("Discovering GCCs…");
    setDiscoveredCos([]); setSelected(new Set()); setResults([]); setHistEntry(null);
    try {
      const found = [];
      await readSSE(`${API_URL}/api/gcc-discover`, { industry: industry.trim(), location: industryLoc.trim() }, {
        discovery_company: ev => {
          found.push(ev.company);
          setDiscoveredCos(r => [...r, ev.company]);
        },
        complete: ev => {
          setStatus("discovered");
          setProgress(`Found ${ev.total_found ?? found.length} compan${(ev.total_found ?? found.length) === 1 ? "y" : "ies"} with GCCs — select and enrich`);
        },
        error: ev => { setStatus("error"); setProgress(ev.message ?? "Error"); },
      });
    } catch (e) { setStatus("error"); setProgress(`Failed: ${e.message}`); }
  }, [industry, industryLoc, readSSE]);

  // ── Mode B: enrich selected ─────────────────────────────────────────────────
  const runEnrichSelected = useCallback(async () => {
    const toEnrich = discoveredCos.filter(c => selected.has(c.company_name));
    if (!toEnrich.length) return;
    setStatus("enriching"); setProgress("Starting enrichment…");
    setResults([]); setHistEntry(null);
    try {
      const newResults = [];
      await readSSE(`${API_URL}/api/gcc-enrich`, {
        companies: toEnrich.map(c => ({ company_name: c.company_name, gcc_location: c.gcc_location, domain: "" }))
      }, {
        gcc_enriched: ev => {
          const entry = { company_name: ev.company_name, gcc_location: ev.gcc_location, profile: ev.profile, capabilities: ev.capabilities, projects: ev.projects, talent: ev.talent, financials: ev.financials, techstack: ev.techstack };
          newResults.push(entry);
          setResults(r => [...r, entry]);
        },
        complete: ev => {
          setStatus("done");
          setProgress(`Done — ${ev.total_enriched ?? newResults.length} GCC profile${(ev.total_enriched ?? newResults.length) !== 1 ? "s" : ""} enriched`);
          const entry = { id: Date.now(), date: new Date().toISOString(), mode: "industry", query: industry, summary: `${newResults.length} GCC profile${newResults.length !== 1 ? "s" : ""}`, results: newResults };
          const h = [entry, ...loadHist()].slice(0, MAX_HIST);
          saveHist(h); setHistory(h);
        },
        error: ev => { setStatus("error"); setProgress(ev.message ?? "Error"); },
      });
    } catch (e) { setStatus("error"); setProgress(`Failed: ${e.message}`); }
  }, [discoveredCos, selected, industry, readSSE]);

  const toggleSelect = name => setSelected(prev => { const s = new Set(prev); s.has(name) ? s.delete(name) : s.add(name); return s; });
  const selectAll = () => setSelected(new Set(discoveredCos.map(c => c.company_name)));
  const clearSelected = () => setSelected(new Set());

  const isRunning = status === "enriching" || status === "discovering";
  const displayResults = histEntry ? (histEntry.results || []) : results;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      {/* History overlay */}
      {showHist && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "flex-start", justifyContent: "flex-end" }}>
          <div onClick={() => setShowHist(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} />
          <div style={{ position: "relative", width: 340, maxHeight: "100vh", overflowY: "auto", background: "#0c1f2e", borderLeft: `1px solid ${ACC_BORDER}`, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 16px", borderBottom: "1px solid #1a3a50" }}>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: ACC }}>GCC Report History</span>
              {history.length > 0 && <button onClick={() => { saveHist([]); setHistory([]); setHistEntry(null); }} style={{ fontSize: 10, color: "#475569", background: "none", border: "none", cursor: "pointer" }}>Clear all</button>}
              <button onClick={() => setShowHist(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#475569" }}><X size={14} /></button>
            </div>
            {history.length === 0
              ? <div style={{ padding: 20, fontSize: 12, color: "#334155" }}>No history yet</div>
              : history.map(e => (
                <div key={e.id} style={{ borderBottom: "1px solid #0f2a3d", padding: "10px 14px", background: histEntry?.id === e.id ? ACC_BG : "transparent" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                    <button onClick={() => { setHistEntry(e); setShowHist(false); }} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0" }}>{e.query}</div>
                      <div style={{ fontSize: 10, color: "#475569", marginTop: 2 }}><Clock size={9} style={{ marginRight: 3, verticalAlign: "middle" }} />{new Date(e.date).toLocaleString()}</div>
                      <div style={{ fontSize: 10, color: ACC, marginTop: 2 }}>{e.summary}</div>
                    </button>
                    <button onClick={() => { const u = history.filter(h => h.id !== e.id); saveHist(u); setHistory(u); if (histEntry?.id === e.id) setHistEntry(null); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#334155", padding: 2, flexShrink: 0 }}><Trash2 size={12} /></button>
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      )}

      {/* Config card */}
      <div style={{ borderRadius: 14, border: "1px solid #1a3a50", background: "#0c1f2e", padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Title row */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>GCC Intelligence Hub</div>
            <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>Deep GCC profiles: capabilities · talent · financials · tech stack · projects</div>
          </div>
          <button
            onClick={() => { setHistory(loadHist()); setShowHist(true); setHistEntry(null); }}
            style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, padding: "5px 10px", borderRadius: 6, background: ACC_BG, border: `1px solid ${ACC_BORDER}`, color: ACC, cursor: "pointer" }}
          >
            <History size={12} /> History {history.length > 0 && <span style={{ background: ACC, color: "#fff", fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 10 }}>{history.length}</span>}
          </button>
        </div>

        {/* Mode selector */}
        <div style={{ display: "flex", gap: 0, border: "1px solid #1a3a50", borderRadius: 8, overflow: "hidden", width: "fit-content" }}>
          {[
            { key: "company",  label: "Company Search",     icon: Search },
            { key: "industry", label: "Industry Discovery", icon: Globe  },
          ].map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setInputMode(key)} style={{
              display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px",
              fontSize: 12, fontWeight: 600, cursor: "pointer", background: inputMode === key ? ACC_BG : "#080f16",
              border: "none", color: inputMode === key ? ACC : "#475569", fontFamily: "inherit",
              borderRight: key === "company" ? "1px solid #1a3a50" : "none",
            }}>
              <Icon size={12} /> {label}
            </button>
          ))}
        </div>

        {/* Mode A: Company list */}
        {inputMode === "company" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1.5fr auto", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>Company Name *</span>
              <span style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>Domain</span>
              <span style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>GCC Location (optional)</span>
              <span />
            </div>
            {companyRows.map(row => (
              <div key={row.id} style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1.5fr auto", gap: 6, alignItems: "center" }}>
                <input value={row.name} onChange={e => updateRow(row.id, "name", e.target.value)}
                  placeholder="e.g. Daimler Truck"
                  style={{ background: "#080f16", border: "1px solid #1e3a50", borderRadius: 8, padding: "7px 10px", fontSize: 12, color: "#fff", outline: "none", fontFamily: "inherit" }} />
                <input value={row.domain} onChange={e => updateRow(row.id, "domain", e.target.value)}
                  placeholder="e.g. daimler-trucks.com"
                  style={{ background: "#080f16", border: "1px solid #1e3a50", borderRadius: 8, padding: "7px 10px", fontSize: 12, color: "#fff", outline: "none", fontFamily: "inherit" }} />
                <input value={row.location} onChange={e => updateRow(row.id, "location", e.target.value)}
                  placeholder="e.g. India, Poland"
                  style={{ background: "#080f16", border: "1px solid #1e3a50", borderRadius: 8, padding: "7px 10px", fontSize: 12, color: "#fff", outline: "none", fontFamily: "inherit" }} />
                <button onClick={() => removeRow(row.id)} disabled={companyRows.length === 1}
                  style={{ background: "none", border: "none", cursor: companyRows.length === 1 ? "default" : "pointer", color: "#334155", padding: 4 }}>
                  <X size={14} />
                </button>
              </div>
            ))}
            {companyRows.length < 50 && (
              <button onClick={addRow} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: "#475569", background: "none", border: "1px dashed #1e3a50", borderRadius: 6, padding: "5px 10px", cursor: "pointer", width: "fit-content" }}>
                <Plus size={11} /> Add company {companyRows.length > 1 && `(${companyRows.length}/50)`}
              </button>
            )}
            <button
              onClick={runCompanyEnrich}
              disabled={isRunning || !companyRows.some(r => r.name.trim())}
              style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none", background: "#e879a0", color: "#fff", opacity: isRunning || !companyRows.some(r => r.name.trim()) ? 0.4 : 1, width: "fit-content", fontFamily: "inherit" }}
            >
              {status === "enriching" ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Enriching…</> : <><Search size={15} /> Run GCC Intelligence</>}
            </button>
          </div>
        )}

        {/* Mode B: Industry discovery */}
        {inputMode === "industry" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div style={{ flex: 2, minWidth: 200 }}>
                <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 5 }}>Industry Name *</div>
                <input value={industry} onChange={e => setIndustry(e.target.value)}
                  placeholder="e.g. Automotive, Banking, Insurance, Retail"
                  style={{ width: "100%", background: "#080f16", border: "1px solid #1e3a50", borderRadius: 8, padding: "7px 10px", fontSize: 12, color: "#fff", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
              </div>
              <div style={{ flex: 1, minWidth: 140 }}>
                <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 5 }}>GCC Location <span style={{ textTransform: "none", fontWeight: 400 }}>optional</span></div>
                <input value={industryLoc} onChange={e => setIndustryLoc(e.target.value)}
                  placeholder="e.g. India, Poland"
                  style={{ width: "100%", background: "#080f16", border: "1px solid #1e3a50", borderRadius: 8, padding: "7px 10px", fontSize: 12, color: "#fff", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
                <button
                  onClick={runDiscover}
                  disabled={isRunning || !industry.trim()}
                  style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "none", background: "#e879a0", color: "#fff", opacity: isRunning || !industry.trim() ? 0.4 : 1, fontFamily: "inherit" }}
                >
                  {status === "discovering" ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Discovering…</> : <><Globe size={14} /> Discover GCCs</>}
                </button>
              </div>
            </div>

            {/* Discovery results */}
            {discoveredCos.length > 0 && (
              <div style={{ border: "1px solid #1a3a50", borderRadius: 10, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "#0a1c2a", borderBottom: "1px solid #1a3a50" }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#e2e8f0", flex: 1 }}>{discoveredCos.length} companies discovered — select to enrich</span>
                  <button onClick={selectAll} style={{ fontSize: 10, color: "#3491E8", background: "none", border: "none", cursor: "pointer" }}>Select all</button>
                  <button onClick={clearSelected} style={{ fontSize: 10, color: "#475569", background: "none", border: "none", cursor: "pointer" }}>Clear</button>
                </div>
                <div style={{ maxHeight: 280, overflowY: "auto", display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))" }}>
                  {discoveredCos.map(c => (
                    <div key={c.company_name}
                      onClick={() => toggleSelect(c.company_name)}
                      style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "9px 12px", cursor: "pointer", borderBottom: "1px solid #0f2a3d", background: selected.has(c.company_name) ? ACC_BG : "transparent", transition: "background 0.1s" }}
                    >
                      <div style={{ width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${selected.has(c.company_name) ? ACC : "#1e3a50"}`, background: selected.has(c.company_name) ? ACC : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                        {selected.has(c.company_name) && <Check size={10} color="#fff" />}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>{c.company_name}</div>
                        <div style={{ fontSize: 10, color: "#475569", marginTop: 1 }}>
                          {c.gcc_location && <span>{c.gcc_location}</span>}
                          {c.estimated_headcount && c.estimated_headcount !== "Unknown" && <span style={{ marginLeft: 6, color: "#34d399" }}>{c.estimated_headcount}</span>}
                          {c.established_year && c.established_year !== "Unknown" && <span style={{ marginLeft: 6 }}>Est. {c.established_year}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {selected.size > 0 && (
                  <div style={{ padding: "10px 14px", background: "#0a1c2a", borderTop: "1px solid #1a3a50", display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>{selected.size} selected</span>
                    <button
                      onClick={runEnrichSelected}
                      disabled={isRunning}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "none", background: "#e879a0", color: "#fff", opacity: isRunning ? 0.4 : 1, fontFamily: "inherit" }}
                    >
                      {status === "enriching" ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Enriching…</> : <><Search size={13} /> Enrich {selected.size} Selected</>}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Status bar */}
      {status !== "idle" && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", borderRadius: 10, border: "1px solid #1a3a50", background: "#0c1f2e" }}>
          {isRunning && <Loader2 size={15} color={ACC} style={{ animation: "spin 1s linear infinite", flexShrink: 0 }} />}
          {status === "done" && <CheckCircle2 size={15} color="#34d399" style={{ flexShrink: 0 }} />}
          {status === "error" && <span style={{ color: "#E63946", flexShrink: 0 }}>✕</span>}
          {status === "discovered" && <Globe size={15} color="#3491E8" style={{ flexShrink: 0 }} />}
          <span style={{ fontSize: 12, color: "#94a3b8", flex: 1 }}>{progress}</span>
          {status === "done" && displayResults.length > 0 && (
            <button onClick={() => exportCSV(displayResults)} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, padding: "4px 9px", borderRadius: 6, background: "rgba(52,211,153,0.12)", color: "#34d399", border: "none", cursor: "pointer", flexShrink: 0 }}>
              <Download size={11} /> Export CSV
            </button>
          )}
        </div>
      )}

      {/* History banner */}
      {histEntry && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", background: ACC_BG, border: `1px solid ${ACC_BORDER}`, borderRadius: 8, fontSize: 11, color: ACC, flexWrap: "wrap" }}>
          <span>📋 Viewing history: <strong>{histEntry.query}</strong> · {new Date(histEntry.date).toLocaleString()} · {(histEntry.results || []).length} profiles</span>
          <button onClick={() => setHistEntry(null)} style={{ fontSize: 10, color: ACC, background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0 }}>Back to current</button>
        </div>
      )}

      {/* Results — per-company cards */}
      {displayResults.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>
            {displayResults.length} GCC Profile{displayResults.length !== 1 ? "s" : ""} — click a company to expand
          </div>
          {displayResults.map((result, i) => (
            <CompanyCard key={result.company_name + i} result={result} defaultOpen={displayResults.length === 1} />
          ))}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
