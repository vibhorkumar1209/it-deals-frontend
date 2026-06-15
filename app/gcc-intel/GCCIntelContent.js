"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Search, Globe, Building2,
  Plus, X, Download, Loader2, CheckCircle2,
  History, Trash2, Clock, Check, FileText, LayoutGrid, ChevronDown, ChevronUp
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
    const caps = (r.capabilities || []).map(c => c.capability_area).join("; ");
    const projs = (r.projects || []).filter(p => p.status === "Active").map(p => p.project_name).join("; ");
    const leaders = (r.talent || []).filter(t => t.type === "Leader").map(t => `${t.name} (${t.title})`).join("; ");
    const fin = r.financials || {};
    const tech = r.techstack || {};
    rows.push([
      r.company_name, r.gcc_location || "-",
      r.established_year || "-", r.operating_model || "-", r.headcount || "-",
      caps || "-", projs || "-", leaders || "-",
      fin.parent_global_revenue || "-",
      tech.cloud_providers || "-", tech.digital_maturity_level || "-",
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + rows.join("\n")], { type: "text/csv;charset=utf-8;" }));
  a.download = "gcc-intelligence.csv"; a.click();
}

// ── Markdown table parser + renderer ─────────────────────────────────────────

function parseMarkdownTable(text) {
  if (!text) return null;
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const tableLines = lines.filter(l => l.startsWith("|"));
  if (tableLines.length < 2) return null;
  const parseCells = line => line.replace(/^\||\|$/g, "").split("|").map(c => c.trim());
  const isSep = line => /^\|[\s\-:|]+\|/.test(line);
  const headers = parseCells(tableLines[0]);
  const dataLines = tableLines.slice(1).filter(l => !isSep(l));
  const rows = dataLines.map(parseCells);
  return { headers, rows };
}

// Split cell text into logical lines (on • bullets and explicit \n)
function splitCellLines(text) {
  // Normalise literal \n escape sequences then split on real newlines
  return text.replace(/\\n/g, "\n").split("\n");
}

// Render inline markdown within a single line: **bold** and [label](url)
function renderInline(line, asArrowLink = false) {
  const linkRe = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
  const boldRe = /\*\*([^*]+)\*\*/g;
  // Build a token list by scanning for links first, then bold in remaining strings
  const tokens = [];
  let cursor = 0;
  let m;
  linkRe.lastIndex = 0;
  while ((m = linkRe.exec(line)) !== null) {
    if (m.index > cursor) tokens.push({ type: "text", val: line.slice(cursor, m.index) });
    tokens.push({ type: "link", label: m[1], url: m[2] });
    cursor = m.index + m[0].length;
  }
  if (cursor < line.length) tokens.push({ type: "text", val: line.slice(cursor) });

  return tokens.map((tok, ti) => {
    if (tok.type === "link") {
      return (
        <a key={ti} href={tok.url} target="_blank" rel="noreferrer"
          style={{ color: "#3491E8", textDecoration: "none", marginLeft: 4 }}
          title={tok.label}
        >↗</a>
      );
    }
    // text — handle **bold**
    const parts = tok.val.split(boldRe);
    return parts.map((bp, bi) =>
      bi % 2 === 1
        ? <strong key={`${ti}-${bi}`} style={{ color: "#e2e8f0" }}>{bp}</strong>
        : bp
    );
  });
}

// Render a full cell: split into lines, each bullet gets its own block row
function renderCellContent(text, isSourceCol = false) {
  if (!text) return null;
  const lines = splitCellLines(text);
  const result = [];
  let key = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const isBullet = line.startsWith("•");
    const content = isBullet ? line.slice(1).trim() : line;

    if (isSourceCol) {
      // Source column: small font, arrow links inline, plain text for "(Source: ...)"
      result.push(
        <div key={key++} style={{ display: "flex", alignItems: "flex-start", gap: 4, marginBottom: 4 }}>
          {isBullet && <span style={{ color: "#475569", flexShrink: 0 }}>•</span>}
          <span style={{ fontSize: 10, color: "#475569", lineHeight: 1.5, wordBreak: "break-word" }}>
            {renderInline(content, true)}
          </span>
        </div>
      );
    } else {
      result.push(
        <div key={key++} style={{ display: "flex", alignItems: "flex-start", gap: 5, marginBottom: isBullet ? 5 : 2 }}>
          {isBullet && <span style={{ color: ACC, flexShrink: 0, marginTop: 1 }}>•</span>}
          <span style={{ lineHeight: 1.6, wordBreak: "break-word" }}>
            {renderInline(content)}
          </span>
        </div>
      );
    }
  }
  return result;
}


function MarkdownTableRenderer({ text, caption, tableType }) {
  // tableType: "t2" | "t3" | undefined
  const parsed = parseMarkdownTable(text);
  if (!parsed) {
    return (
      <div style={{ background: "#080f16", borderRadius: 10, padding: 16, border: "1px solid #1a3a50", overflowX: "auto" }}>
        <pre style={{ fontSize: 11, color: "#94a3b8", whiteSpace: "pre-wrap", margin: 0 }}>{text}</pre>
      </div>
    );
  }
  const { headers, rows } = parsed;
  const colCount = headers.length;

  // Col widths: first col narrow label, last col narrow source (for t3), middle wide content
  const colWidths = colCount === 2
    ? ["200px", "1fr"]
    : colCount === 3
    ? ["180px", "1fr", "160px"]   // source col narrow for t3
    : undefined;

  return (
    <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid #1a3a50" }}>
      {caption && (
        <div style={{ fontSize: 11, fontWeight: 700, color: tableType === "t3" ? "#818cf8" : ACC, padding: "8px 14px", background: "#0c1f2e", borderBottom: "1px solid #1a3a50", letterSpacing: "0.03em" }}>
          {caption}
        </div>
      )}
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: colCount === 3 ? 900 : 700, tableLayout: "fixed" }}>
        <colgroup>
          {colWidths ? colWidths.map((w, i) => <col key={i} style={{ width: w }} />) : null}
        </colgroup>
        <thead>
          <tr>
            {headers.map((h, i) => {
              const isSourceCol = colCount === 3 && i === colCount - 1;
              return (
                <th key={i} style={{ ...TH_STYLE, background: "#0c3649", padding: "10px 14px", fontSize: isSourceCol ? 9 : 10 }}>
                  {h.replace(/\*\*/g, "")}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} style={{ background: ri % 2 === 0 ? "transparent" : "#0a1520" }}>
              {headers.map((_, ci) => {
                const cell = row[ci] ?? "";
                const isFirstCol = ci === 0;
                const isLastCol = ci === colCount - 1;
                const isSourceCol = colCount === 3 && isLastCol;
                const isT2SourceCol = tableType === "t2" && colCount === 2 && isLastCol;

                let cellStyle = {
                  ...TD_STYLE,
                  padding: "12px 14px",
                  verticalAlign: "top",
                  lineHeight: 1.6,
                  wordBreak: "break-word",
                };
                if (isFirstCol) {
                  cellStyle = { ...cellStyle, fontSize: 11, fontWeight: 700, color: tableType === "t3" ? "#818cf8" : "#f472b6" };
                } else if (isSourceCol) {
                  cellStyle = { ...cellStyle, fontSize: 10, color: "#334155", padding: "12px 10px" };
                } else {
                  cellStyle = { ...cellStyle, fontSize: 11, color: "#cbd5e1" };
                }

                return (
                  <td key={ci} style={cellStyle}>
                    {isSourceCol
                      ? renderCellContent(cell, true)
                      : renderCellContent(cell, false)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Results table ────────────────────────────────────────────────────────────
function Pill({ text, bg = "rgba(52,145,232,0.1)", color = "#3491E8", size = 10 }) {
  if (!text || text === "-") return null;
  const isUnknown = text === "Unknown" || text === "unknown";
  return (
    <span style={{ display:"inline-block", background: isUnknown ? "rgba(100,116,139,0.08)" : bg, color: isUnknown ? "#334155" : color, padding:"1px 6px", borderRadius:20, fontSize:size, fontWeight:600, whiteSpace:"nowrap", margin:"1px 2px 1px 0", fontStyle: isUnknown ? "italic" : "normal" }}>
      {text}
    </span>
  );
}

// Show a "no data" placeholder so columns never render blank
function NoData({ label = "No data found" }) {
  return <span style={{ color:"#1e3a50", fontSize:10, fontStyle:"italic" }}>{label}</span>;
}

const MAT_C = { "Centre of Excellence":["rgba(52,211,153,0.12)","#34d399"], "Mature":["rgba(52,145,232,0.12)","#3491E8"], "Growing":["rgba(251,191,36,0.12)","#fbbf24"], "Nascent":["rgba(230,57,70,0.1)","#E63946"] };
const STATUS_C = { "Active":"#34d399","Announced":"#3491E8","Completed":"#fbbf24","Planning":"#818cf8" };
const SEN_C = { "C-Suite":"#f472b6","VP":"#818cf8","Director":"#3491E8","Senior Manager":"#fbbf24" };
const AUTO_C = { "Hyper-Automated":"#34d399","High":"#3491E8","Medium":"#fbbf24","Low":"#E63946" };

const TH_STYLE = { padding:"9px 12px", textAlign:"left", fontWeight:600, color:"#64748b", fontSize:10, textTransform:"uppercase", letterSpacing:"0.04em", whiteSpace:"nowrap", borderBottom:"1px solid #1a3a50", background:"#0c3649" };
const TD_STYLE = { padding:"10px 12px", verticalAlign:"top", borderTop:"1px solid #0f2a3d", fontSize:11, color:"#cbd5e1" };

function GCCResultsTable({ results, onSelect, selectedKey }) {
  return (
    <div style={{ overflowX:"auto", borderRadius:12, border:"1px solid #1a3a50", background:"#080f16" }}>
      <table style={{ width:"100%", borderCollapse:"collapse", minWidth:1500 }}>
        <thead>
          <tr>
            <th style={{...TH_STYLE, minWidth:150}}>Company / GCC</th>
            <th style={{...TH_STYLE, minWidth:160}}>Location &amp; Profile</th>
            <th style={{...TH_STYLE, minWidth:200}}>Capabilities</th>
            <th style={{...TH_STYLE, minWidth:220}}>Projects &amp; Initiatives</th>
            <th style={{...TH_STYLE, minWidth:210}}>Talent &amp; Leaders</th>
            <th style={{...TH_STYLE, minWidth:180}}>Financials</th>
            <th style={{...TH_STYLE, minWidth:210}}>Tech Stack</th>
            <th style={{...TH_STYLE, minWidth:90, textAlign:"center"}}>Deep Profile</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r, i) => {
            // v3: flat structure — profile fields are top-level on r
            const caps = Array.isArray(r.capabilities) ? r.capabilities : [];
            const projs = Array.isArray(r.projects) ? r.projects : [];
            const talent = Array.isArray(r.talent) ? r.talent : [];
            const fin = r.financials || {};
            const tech = r.techstack || {};
            const score = parseInt(tech.cloud_maturity_score) || 0;
            const leaders = talent.filter(t => t.type !== "Talent Insight").slice(0, 4);
            const activeProjs = [...projs.filter(p => p.status === "Active"), ...projs.filter(p => p.status !== "Active")].slice(0, 4);

            return (
              <tr key={r.company_name + r.gcc_location + i} style={{ background: i % 2 === 0 ? "transparent" : "#0a1520" }}>

                {/* Company / GCC */}
                <td style={TD_STYLE}>
                  <div style={{ fontWeight:700, color:"#fff", fontSize:12, lineHeight:1.4 }}>{r.company_name}</div>
                  {r.gcc_name && r.gcc_name !== "-" && (
                    <div style={{ fontSize:10, color:"#818cf8", marginTop:2 }}>{r.gcc_name}</div>
                  )}
                  {r.primary_focus && r.primary_focus !== "-" && (
                    <div style={{ fontSize:10, color:"#475569", marginTop:3, lineHeight:1.4 }}>{r.primary_focus}</div>
                  )}
                </td>

                {/* Location & Profile */}
                <td style={TD_STYLE}>
                  <div style={{ fontWeight:700, color:"#e2e8f0", fontSize:12, lineHeight:1.5 }}>
                    {r.gcc_location || "—"}
                  </div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:3, marginTop:4 }}>
                    {r.established_year && r.established_year !== "Unknown" && (
                      <span style={{ fontSize:10, color:"#64748b" }}>Est. {r.established_year}</span>
                    )}
                    {r.headcount && r.headcount !== "Unknown" && (
                      <span style={{ fontSize:10, color:"#34d399", marginLeft:6 }}>{r.headcount}</span>
                    )}
                  </div>
                  {r.operating_model && r.operating_model !== "Unknown" && (
                    <div style={{ marginTop:5 }}>
                      <Pill text={r.operating_model} bg="rgba(244,114,182,0.1)" color="#f472b6" />
                    </div>
                  )}
                </td>

                {/* Capabilities */}
                <td style={TD_STYLE}>
                  {caps.length === 0 ? <NoData label="No capabilities data" /> : (
                    <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
                      {caps.slice(0, 7).map((c, ci) => {
                        const isFallback = c.key_functions === "Requires manual verification";
                        return (
                          <div key={ci}>
                            <div style={{ fontSize:11, color: isFallback ? "#1e3a50" : "#cbd5e1", lineHeight:1.4, fontWeight:500, fontStyle: isFallback ? "italic" : "normal" }}>{c.capability_area}</div>
                            {c.description && isFallback && (
                              <div style={{ fontSize:10, color:"#1e3a50", lineHeight:1.3, fontStyle:"italic" }}>{c.description.slice(0,80)}</div>
                            )}
                            {c.key_functions && !isFallback && (
                              <div style={{ fontSize:10, color:"#475569", lineHeight:1.3 }}>{c.key_functions.slice(0,60)}{c.key_functions.length>60?"…":""}</div>
                            )}
                          </div>
                        );
                      })}
                      {caps.length > 7 && <span style={{ fontSize:10, color:"#334155" }}>+{caps.length-7} more</span>}
                    </div>
                  )}
                </td>

                {/* Projects & Initiatives */}
                <td style={TD_STYLE}>
                  {activeProjs.length === 0 ? <NoData label="No projects found" /> : (
                    <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                      {activeProjs.map((proj, pi) => {
                        const isFallback = proj.project_name === "No public projects found";
                        return (
                          <div key={pi} style={{ display:"flex", alignItems:"flex-start", gap:5 }}>
                            <span style={{ display:"inline-block", width:6, height:6, borderRadius:"50%", background: isFallback ? "#1e3a50" : (STATUS_C[proj.status] || "#64748b"), flexShrink:0, marginTop:3 }} />
                            <div style={{ minWidth:0 }}>
                              <div style={{ fontSize:11, color: isFallback ? "#1e3a50" : "#e2e8f0", fontWeight:600, lineHeight:1.4, fontStyle: isFallback ? "italic" : "normal" }}>{proj.project_name}</div>
                              {proj.description && (
                                <div style={{ fontSize:10, color:"#475569", lineHeight:1.4, marginTop:1 }}>
                                  {proj.description.slice(0,80)}{proj.description.length>80?"…":""}
                                </div>
                              )}
                              {proj.investment_value && proj.investment_value !== "Unknown" && proj.investment_value !== "-" && (
                                <span style={{ fontSize:10, color:"#34d399" }}>{proj.investment_value}</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </td>

                {/* Talent & Leaders */}
                <td style={TD_STYLE}>
                  {leaders.length === 0 && talent.length === 0 ? <NoData label="No leaders found" /> : (
                    <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                      {(leaders.length > 0 ? leaders : talent.slice(0,3)).map((l, li) => {
                        const arr = leaders.length > 0 ? leaders : talent.slice(0,3);
                        const isFallback = l.type === "Talent Insight" && l.name === "-";
                        return (
                          <div key={li} style={{ borderBottom: li < arr.length-1 ? "1px solid #0f2a3d" : "none", paddingBottom: li < arr.length-1 ? 4 : 0 }}>
                            {isFallback ? (
                              <div style={{ fontSize:10, color:"#1e3a50", fontStyle:"italic" }}>{l.insight}</div>
                            ) : (
                              <>
                                <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                                  <span style={{ fontSize:11, fontWeight:600, color:"#e2e8f0", flex:1 }}>{l.name || l.title || "—"}</span>
                                  {l.linkedin_url && l.linkedin_url !== "-" && (
                                    <a href={l.linkedin_url} target="_blank" rel="noreferrer" style={{ fontSize:9, color:"#3491E8", textDecoration:"none" }}>↗</a>
                                  )}
                                </div>
                                {l.title && <div style={{ fontSize:10, color:"#94a3b8", marginTop:1 }}>{l.title}</div>}
                                <div style={{ display:"flex", gap:3, marginTop:2, flexWrap:"wrap" }}>
                                  {l.seniority && l.seniority !== "N/A" && <Pill text={l.seniority} bg="rgba(244,114,182,0.08)" color={SEN_C[l.seniority]||"#94a3b8"} size={9} />}
                                  {l.function && <Pill text={l.function} bg="rgba(100,116,139,0.1)" color="#64748b" size={9} />}
                                </div>
                                {l.contact_hint && l.contact_hint !== "-" && (
                                  <div style={{ fontSize:9, color:"#334155", marginTop:2 }}>{l.contact_hint}</div>
                                )}
                                {l.insight && <div style={{ fontSize:10, color:"#475569", marginTop:2, lineHeight:1.3 }}>{l.insight.slice(0,80)}{l.insight.length>80?"…":""}</div>}
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </td>

                {/* Financials */}
                <td style={TD_STYLE}>
                  <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                    {[
                      ["Revenue", fin.parent_global_revenue, "#fbbf24"],
                      ["GCC Budget", fin.gcc_operational_budget || fin.gcc_cost_to_parent, "#34d399"],
                      ["Cost Arbitrage", fin.cost_arbitrage || fin.cost_arbitrage_estimate, "#3491E8"],
                      ["IP/Patents", fin.ip_patents_filed || fin.ip_patents_at_location, "#818cf8"],
                    ].map(([lbl, value, color]) => (
                      <div key={lbl}>
                        <div style={{ fontSize:9, color:"#334155", textTransform:"uppercase", letterSpacing:"0.04em" }}>{lbl}</div>
                        {value && value !== "-" ? (
                          <div style={{ fontSize:11, color: (value.includes("Not found") || value.includes("Unknown") || value.includes("unavailable")) ? "#1e3a50" : color, fontWeight:600, fontStyle: (value.includes("Not found") || value.includes("Unknown")) ? "italic" : "normal" }}>{value}</div>
                        ) : (
                          <div style={{ fontSize:10, color:"#1e3a50", fontStyle:"italic" }}>Not found</div>
                        )}
                      </div>
                    ))}
                    {fin.proprietary_platforms && fin.proprietary_platforms !== "-" && (
                      <div style={{ fontSize:10, color:"#94a3b8", marginTop:2, lineHeight:1.4 }}>
                        <span style={{ color:"#334155" }}>Platforms: </span>{fin.proprietary_platforms.slice(0,80)}{fin.proprietary_platforms.length>80?"…":""}
                      </div>
                    )}
                    {fin.financial_notes && fin.financial_notes !== "-" && (
                      <div style={{ fontSize:10, color:"#475569", marginTop:2, lineHeight:1.3 }}>{fin.financial_notes.slice(0,80)}{fin.financial_notes.length>80?"…":""}</div>
                    )}
                  </div>
                </td>

                {/* Tech Stack */}
                <td style={TD_STYLE}>
                  <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                    <div>
                      <span style={{ fontSize:9, color:"#334155", textTransform:"uppercase", letterSpacing:"0.04em" }}>Cloud </span>
                      {tech.cloud_providers && tech.cloud_providers !== "-" ? (
                        <span style={{ fontSize:11, color: tech.cloud_providers.includes("Unknown") ? "#1e3a50" : "#22d3ee", fontWeight:600, fontStyle: tech.cloud_providers.includes("Unknown") ? "italic" : "normal" }}>{tech.cloud_providers}</span>
                      ) : <span style={{ fontSize:10, color:"#1e3a50", fontStyle:"italic" }}>Not found</span>}
                    </div>
                    {score > 0 && (
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <div style={{ flex:1, background:"#0f2a3d", borderRadius:4, height:4 }}>
                          <div style={{ width:`${score}%`, height:4, borderRadius:4, background: score>=70?"#34d399":score>=45?"#fbbf24":"#E63946" }} />
                        </div>
                        <span style={{ fontSize:10, color:"#94a3b8", flexShrink:0 }}>{score}/100</span>
                      </div>
                    )}
                    <div>
                      <span style={{ fontSize:9, color:"#334155", textTransform:"uppercase", letterSpacing:"0.04em" }}>Automation </span>
                      {tech.automation_index && tech.automation_index !== "-" && tech.automation_index !== "Unknown" ? (
                        <Pill text={tech.automation_index} bg="rgba(34,211,238,0.08)" color={AUTO_C[tech.automation_index]||"#64748b"} size={9} />
                      ) : <span style={{ fontSize:10, color:"#1e3a50", fontStyle:"italic" }}>Unknown</span>}
                    </div>
                    <div>
                      <span style={{ fontSize:9, color:"#334155", textTransform:"uppercase", letterSpacing:"0.04em" }}>Maturity </span>
                      {tech.digital_maturity_level && tech.digital_maturity_level !== "-" && tech.digital_maturity_level !== "Unknown" ? (
                        <span style={{ fontSize:10, color:"#818cf8", fontWeight:600 }}>{tech.digital_maturity_level}</span>
                      ) : <span style={{ fontSize:10, color:"#1e3a50", fontStyle:"italic" }}>Unknown</span>}
                    </div>
                    {tech.ai_ml_platforms && tech.ai_ml_platforms !== "-" && (
                      <div style={{ fontSize:10, color:"#f472b6", lineHeight:1.4, marginTop:1 }}>
                        <span style={{ color:"#334155" }}>AI/ML: </span>{tech.ai_ml_platforms.slice(0,60)}{tech.ai_ml_platforms.length>60?"…":""}
                      </div>
                    )}
                    <div style={{ fontSize:10, color:"#cbd5e1", lineHeight:1.6, marginTop:2 }}>
                      {tech.programming_languages && tech.programming_languages !== "-" ? (
                        <div style={{ color:"#fbbf24" }}>• <span style={{ color:"#334155" }}>Lang:</span> {tech.programming_languages.slice(0,70)}{tech.programming_languages.length>70?"…":""}</div>
                      ) : <div style={{ color:"#1e3a50", fontStyle:"italic" }}>• Lang: not found</div>}
                      {(tech.frameworks_tools || tech.tech_vendors) ? (
                        <div style={{ color:"#94a3b8" }}>• <span style={{ color:"#334155" }}>Tools:</span> {(tech.frameworks_tools || tech.tech_vendors || "").slice(0,70)}</div>
                      ) : <div style={{ color:"#1e3a50", fontStyle:"italic" }}>• Tools: not found</div>}
                      {tech.devops_tools && tech.devops_tools !== "-" ? (
                        <div style={{ color:"#67e8f9" }}>• <span style={{ color:"#334155" }}>DevOps:</span> {tech.devops_tools.slice(0,60)}{tech.devops_tools.length>60?"…":""}</div>
                      ) : null}
                      {tech.enterprise_vendors && tech.enterprise_vendors !== "-" ? (
                        <div style={{ color:"#818cf8" }}>• <span style={{ color:"#334155" }}>Vendors:</span> {tech.enterprise_vendors.slice(0,60)}{tech.enterprise_vendors.length>60?"…":""}</div>
                      ) : null}
                    </div>
                    {tech.tech_highlights && tech.tech_highlights !== "-" && !tech.tech_highlights.includes("No tech stack data found") && (
                      <div style={{ fontSize:10, color:"#475569", lineHeight:1.3, marginTop:2 }}>{tech.tech_highlights.slice(0,100)}{tech.tech_highlights.length>100?"…":""}</div>
                    )}
                  </div>
                </td>

                {/* Deep Profile button */}
                <td style={{ ...TD_STYLE, textAlign: "center", verticalAlign: "middle" }}>
                  {(() => {
                    const key = `${r.company_name}||${r.gcc_location}`;
                    const isSelected = selectedKey === key;
                    return (
                      <button
                        onClick={() => onSelect && onSelect(r, key)}
                        style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 9px", borderRadius: 7, fontSize: 10, fontWeight: 600, cursor: "pointer", border: `1px solid ${isSelected ? ACC : "rgba(244,114,182,0.25)"}`, background: isSelected ? ACC_BG : "transparent", color: isSelected ? ACC : "#64748b", fontFamily: "inherit", transition: "all 0.15s" }}
                      >
                        <FileText size={10} /> {isSelected ? "Selected" : "Profile"}
                      </button>
                    );
                  })()}
                </td>

              </tr>
            );
          })}
        </tbody>
      </table>
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

  // ── Deep Profile (Table 2 & 3) state ───────────────────────────────────────
  const [profileTarget, setProfileTarget]   = useState(null); // {company_name, gcc_location, key}
  const [table2Text,    setTable2Text]      = useState("");
  const [table3Text,    setTable3Text]      = useState("");
  const [table2Status,  setTable2Status]    = useState("idle"); // idle | running | done | error
  const [table3Status,  setTable3Status]    = useState("idle");
  const [table2Msg,     setTable2Msg]       = useState("");
  const [table3Msg,     setTable3Msg]       = useState("");

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
        gcc_location_result: ev => {
          const entry = ev.result;
          newResults.push(entry);
          setResults(r => [...r, entry]);
        },
        complete: ev => {
          setStatus("done");
          setProgress(`Done — ${newResults.length} GCC location${newResults.length !== 1 ? "s" : ""} enriched`);
          const entry = { id: Date.now(), date: new Date().toISOString(), mode: "company", query: valid.map(r => r.name).join(", "), summary: `${newResults.length} GCC location${newResults.length !== 1 ? "s" : ""}`, results: newResults };
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
        gcc_location_result: ev => {
          const entry = ev.result;
          newResults.push(entry);
          setResults(r => [...r, entry]);
        },
        complete: ev => {
          setStatus("done");
          setProgress(`Done — ${newResults.length} GCC location${newResults.length !== 1 ? "s" : ""} enriched`);
          const entry = { id: Date.now(), date: new Date().toISOString(), mode: "industry", query: industry, summary: `${newResults.length} GCC location${newResults.length !== 1 ? "s" : ""}`, results: newResults };
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

  const handleSelectProfile = useCallback((row, key) => {
    if (profileTarget?.key === key) {
      setProfileTarget(null);
    } else {
      setProfileTarget({ company_name: row.company_name, gcc_location: row.gcc_location, key });
      setTable2Text(""); setTable2Status("idle"); setTable2Msg("");
      setTable3Text(""); setTable3Status("idle"); setTable3Msg("");
    }
  }, [profileTarget]);

  const runTable2 = useCallback(async () => {
    if (!profileTarget) return;
    setTable2Status("running"); setTable2Text(""); setTable2Msg("Researching operational profile…");
    try {
      const res = await fetch(`${API_URL}/api/gcc-profile`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_name: profileTarget.company_name, gcc_location: profileTarget.gcc_location }),
      });
      if (!res.ok || !res.body) throw new Error(`Server ${res.status}`);
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
            if (ev.type === "heartbeat") setTable2Msg(ev.message ?? "");
            else if (ev.type === "profile_text") { setTable2Text(ev.text); setTable2Status("done"); }
            else if (ev.type === "error") { setTable2Status("error"); setTable2Msg(ev.message); }
          } catch {}
        }
      }
      if (table2Status !== "done") setTable2Status("done");
    } catch (e) { setTable2Status("error"); setTable2Msg(e.message); }
  }, [profileTarget]);

  const runTable3 = useCallback(async () => {
    if (!profileTarget) return;
    setTable3Status("running"); setTable3Text(""); setTable3Msg("Building design profile…");
    try {
      const res = await fetch(`${API_URL}/api/gcc-design`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_name: profileTarget.company_name, gcc_location: profileTarget.gcc_location }),
      });
      if (!res.ok || !res.body) throw new Error(`Server ${res.status}`);
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
            if (ev.type === "heartbeat") setTable3Msg(ev.message ?? "");
            else if (ev.type === "design_text") { setTable3Text(ev.text); setTable3Status("done"); }
            else if (ev.type === "error") { setTable3Status("error"); setTable3Msg(ev.message); }
          } catch {}
        }
      }
      if (table3Status !== "done") setTable3Status("done");
    } catch (e) { setTable3Status("error"); setTable3Msg(e.message); }
  }, [profileTarget]);

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

      {/* Results — flat table (Table 1), one row per GCC location */}
      {displayResults.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 11, color: "#64748b" }}>
            {displayResults.length} GCC profile{displayResults.length !== 1 ? "s" : ""} · Click <strong style={{ color: ACC }}>Profile</strong> on any row to generate deep-dive Tables 2 &amp; 3
          </div>
          <GCCResultsTable results={displayResults} onSelect={handleSelectProfile} selectedKey={profileTarget?.key} />
        </div>
      )}

      {/* Deep Profile panel — shown when a GCC row is selected */}
      {profileTarget && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, borderTop: `2px solid ${ACC_BORDER}`, paddingTop: 20 }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{profileTarget.company_name}</div>
              <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{profileTarget.gcc_location}</div>
            </div>
            <button onClick={() => setProfileTarget(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#334155", padding: 4 }}><X size={14} /></button>
          </div>

          {/* Table 2 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: ACC }}>Table 2 — 8-Dimension Operational Profile</div>
                <div style={{ fontSize: 11, color: "#475569" }}>Headcount · Workflows · Partners · Rate Card · White-spaces · Leaders</div>
              </div>
              <button
                onClick={runTable2}
                disabled={table2Status === "running"}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: table2Status === "running" ? "default" : "pointer", border: "none", background: ACC, color: "#fff", opacity: table2Status === "running" ? 0.5 : 1, fontFamily: "inherit" }}
              >
                {table2Status === "running" ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Generating…</> : <><LayoutGrid size={13} /> {table2Text ? "Regenerate" : "Generate"} Table 2</>}
              </button>
            </div>
            {table2Status === "running" && (
              <div style={{ fontSize: 11, color: "#475569", display: "flex", alignItems: "center", gap: 6 }}>
                <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> {table2Msg}
              </div>
            )}
            {table2Status === "error" && <div style={{ fontSize: 11, color: "#E63946" }}>✕ {table2Msg}</div>}
            {table2Text && <MarkdownTableRenderer text={table2Text} caption="Operational Profile" tableType="t2" />}
          </div>

          {/* Table 3 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#818cf8" }}>Table 3 — 3-Pillar Operational Design Profile</div>
                <div style={{ fontSize: 11, color: "#475569" }}>Non-Payroll TCO · Sourcing Framework · Span of Control Ratios</div>
              </div>
              <button
                onClick={runTable3}
                disabled={table3Status === "running"}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: table3Status === "running" ? "default" : "pointer", border: "none", background: "#818cf8", color: "#fff", opacity: table3Status === "running" ? 0.5 : 1, fontFamily: "inherit" }}
              >
                {table3Status === "running" ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Generating…</> : <><LayoutGrid size={13} /> {table3Text ? "Regenerate" : "Generate"} Table 3</>}
              </button>
            </div>
            {table3Status === "running" && (
              <div style={{ fontSize: 11, color: "#475569", display: "flex", alignItems: "center", gap: 6 }}>
                <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> {table3Msg}
              </div>
            )}
            {table3Status === "error" && <div style={{ fontSize: 11, color: "#E63946" }}>✕ {table3Msg}</div>}
            {table3Text && <MarkdownTableRenderer text={table3Text} caption="Operational Design Profile" tableType="t3" />}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
