"use client";

import { useState, useRef, useEffect } from "react";
import { Play, Download, Loader2, Plus, Trash2, Square, ExternalLink, ThumbsUp, ThumbsDown, Mail, Check, ChevronUp, ChevronDown } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4001";
const HIST_KEY = "intent_map_history";
const FEEDBACK_KEY = "intent_engine_feedback";
const MAX_HIST = 30;

// Light theme, per the Intent Engine design mockups.
const T = {
  bg: "#f5f7fb", card: "#ffffff", border: "#e2e8f0", text: "#0f172a", sub: "#475569", muted: "#94a3b8",
  blue: "#2563eb", blueSoft: "#eff6ff", blueLine: "#bfdbfe", navy: "#1e1b4b",
  green: "#16a34a", greenSoft: "#ecfdf5", greenLine: "#a7f3d0", amber: "#b45309", amberSoft: "#fffbeb", chip: "#f1f5f9",
};
const C = {
  card: { background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 18, boxShadow: "0 1px 2px rgba(15,23,42,0.04)" },
  label: { fontSize: 11, fontWeight: 700, color: T.sub, marginBottom: 6 },
  input: { width: "100%", boxSizing: "border-box", background: "#fff", border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 10px", color: T.text, fontSize: 13, outline: "none" },
  btn: { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", border: `1px solid ${T.border}`, background: "#fff", color: T.sub },
  primary: { display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none", background: T.blue, color: "#fff" },
};
// Mirrors DEFAULT_INTENTS in it-deals-api/intent_engine.py.
const DEFAULT_INTENTS = ["Leadership Change", "Tech Stack Adoption", "Hiring Surge", "Cloud Migration", "M&A", "Budget Expansion"];

const uid = () => Math.random().toString(36).slice(2);
const emptyTarget = () => ({ id: uid(), company_name: "", company_domain: "", company_linkedin_url: "", executive_name: "", executive_designation: "", executive_linkedin_url: "" });
const load = (k, d) => { try { const r = JSON.parse(localStorage.getItem(k) ?? "null"); return r ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

const itemsOf = r => r.top_5_triggers || r.top_5_mapped_signals || [];
const summaryOf = r => r.account_summary || r.executive_summary || {};
const hasLink = u => u && u !== "N/A";
const initials = n => (n || "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();

function ago(ym) {
  if (!ym || !/^\d{4}-\d{2}/.test(ym)) return ym || "";
  const [y, m] = ym.split("-").map(Number);
  const now = new Date();
  const months = (now.getFullYear() - y) * 12 + now.getMonth() + 1 - m;
  return months <= 0 ? "This month" : months === 1 ? "Last month" : `${months} months ago`;
}

// outlook-campaigns import format: core lead columns, then each data field as
// its own column (the importer keeps extra columns for templates).
export function intentCampaignRows(results) {
  return results.flatMap(r => (r.campaign_leads || []).map(l => ({
    email: l.email, first_name: l.first_name, last_name: l.last_name, company: l.company, title: l.title, linkedin_url: l.linkedin_url, ...l.data,
  })));
}

export function intentTriggerRows(results) {
  return results.flatMap(r => {
    const s = summaryOf(r);
    return itemsOf(r).map(x => ({
      Company: s.company_name, Executive: s.executive_name || "", "Intent Score": s.overall_intent_score, Rank: x.rank,
      Trigger: x.signal_title, Intent: x.matched_intent_category, "Category / Tier": x.signal_category || x.signal_tier,
      Date: x.date_or_timeframe, Confidence: x.confidence_score, Evidence: (x.evidence_bullets || []).join(" | "),
      "Source Type": x.source_type, Source: x.source_url,
      Executives: (x.recommended_executives || []).map(e => `${e.executive_name} (${e.designation})`).join("; "),
      "Outreach Angle": x.outreach_angle || (x.recommended_executives || []).map(e => `${e.executive_name}: ${e.outreach_angle}`).join(" | "),
    }));
  });
}

function downloadCsv(rows, name) {
  if (!rows.length) return;
  const headers = [...new Set(rows.flatMap(r => Object.keys(r)))];
  const esc = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [headers.map(esc).join(","), ...rows.map(r => headers.map(h => esc(r[h])).join(","))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = `${name}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}

// ── Small parts ──────────────────────────────────────────────────────────────
const Badge = ({ children, bg = T.chip, color = T.sub, line = "transparent", strong }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: strong ? 700 : 600, padding: "4px 10px", borderRadius: 8, background: bg, color, border: `1px solid ${line}`, whiteSpace: "nowrap" }}>{children}</span>
);
const RankBadge = ({ n }) => <Badge bg={T.blue} color="#fff" strong>Rank #{n}</Badge>;
const ConfBadge = ({ c }) => c === "High"
  ? <Badge bg={T.greenSoft} color={T.green} line={T.greenLine}><Check size={12} /> High Confidence</Badge>
  : <Badge bg={T.amberSoft} color={T.amber} line="#fde68a">Medium Confidence</Badge>;
const IntentBadge = ({ s }) => {
  const m = { High: [T.greenSoft, T.green, T.greenLine], Medium: [T.amberSoft, T.amber, "#fde68a"], Low: [T.chip, T.sub, T.border] }[s] || [T.chip, T.sub, T.border];
  return <Badge bg={m[0]} color={m[1]} line={m[2]} strong>{s} Intent</Badge>;
};
const Chip = ({ k, v }) => v ? <Badge><b style={{ color: T.text }}>{k}:</b>&nbsp;<span style={{ fontWeight: 500 }}>{v}</span></Badge> : null;
const LinkedIn = ({ url }) => hasLink(url)
  ? <a href={url} target="_blank" rel="noreferrer" title="LinkedIn" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: 4, background: "#0a66c2", color: "#fff", fontSize: 11, fontWeight: 800, textDecoration: "none", marginLeft: 6 }}>in</a>
  : null;
const Avatar = ({ name, size = 40 }) => (
  <div style={{ width: size, height: size, borderRadius: size / 2, background: T.blueSoft, color: T.blue, border: `1px solid ${T.blueLine}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.34, fontWeight: 700, flexShrink: 0 }}>{initials(name)}</div>
);

function SourceLine({ x }) {
  return (
    <div style={{ fontSize: 12, color: T.muted, marginTop: 10 }}>
      {hasLink(x.source_url)
        ? <a href={x.source_url} target="_blank" rel="noreferrer" style={{ color: T.blue, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 3 }}>{x.source_type} <ExternalLink size={11} /></a>
        : x.source_type && <span>{x.source_type}</span>}
      {x.source_type && " • "}{ago(x.date_or_timeframe)}
    </div>
  );
}

// Opens a draft in the default mail app; the engine never guesses addresses.
function DraftEmail({ name, angle, title, small }) {
  const first = (name || "").split(" ")[0];
  const href = `mailto:?subject=${encodeURIComponent(title || "")}&body=${encodeURIComponent(`Hi ${first},\n\n${angle}\n\n`)}`;
  return <a href={href} style={{ ...C.primary, background: T.navy, textDecoration: "none", padding: small ? "7px 12px" : "9px 16px", whiteSpace: "nowrap" }}><Mail size={13} /> Draft Email</a>;
}

// Thumbs up/down per signal, kept in this browser to tune targeting later.
function Feedback({ id }) {
  const [v, setV] = useState(null);
  useEffect(() => { setV(load(FEEDBACK_KEY, {})[id] ?? null); }, [id]);
  const set = val => { const all = load(FEEDBACK_KEY, {}); const nv = all[id] === val ? null : val; all[id] = nv; save(FEEDBACK_KEY, all); setV(nv); };
  const b = active => ({ ...C.btn, padding: 8, background: active ? T.blueSoft : "#fff", color: active ? T.blue : T.sub, borderColor: active ? T.blueLine : T.border });
  return (
    <div style={{ display: "flex", gap: 6 }}>
      <button style={b(v === "up")} onClick={() => set("up")} aria-label="Useful"><ThumbsUp size={15} /></button>
      <button style={b(v === "down")} onClick={() => set("down")} aria-label="Not useful"><ThumbsDown size={15} /></button>
    </div>
  );
}

function OutreachBox({ angle, name, title, fid, wide }) {
  return (
    <div style={{ background: wide ? T.blueSoft : T.greenSoft, border: `1px solid ${wide ? T.blueLine : T.greenLine}`, borderRadius: 10, padding: 14, display: "flex", flexDirection: wide ? "column" : "row", gap: 12, alignItems: wide ? "stretch" : "center" }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 4 }}>AI Outreach Angle</div>
        <div style={{ fontSize: 13, color: T.sub, lineHeight: 1.55 }}>“{angle}”</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <DraftEmail name={name} angle={angle} title={title} small={!wide} />
        {wide && <Feedback id={fid} />}
      </div>
    </div>
  );
}

// ── Exec-based view (design 2) ───────────────────────────────────────────────
function ExecSignalCard({ x, exec, featured, fid }) {
  const tier = (x.signal_tier || "").split(": ")[1] || x.signal_tier;
  const head = (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <RankBadge n={x.rank} />
      {featured && <ConfBadge c={x.confidence_score} />}
      <Badge>{tier}</Badge>
      <Badge>{x.matched_intent_category}</Badge>
      {!featured && <span style={{ marginLeft: "auto" }}><ConfBadge c={x.confidence_score} /></span>}
    </div>
  );
  const body = (
    <>
      <div style={{ fontSize: featured ? 20 : 17, fontWeight: 700, color: T.text, margin: "12px 0 8px" }}>{x.signal_title}</div>
      <div style={{ fontSize: 13, color: T.sub, lineHeight: 1.6 }}>
        <span style={{ fontWeight: 600, color: T.text }}>Evidence summary: </span>{(x.evidence_bullets || []).join(" ")}
      </div>
    </>
  );
  if (featured) {
    return (
      <div style={{ ...C.card, border: `2px solid ${T.blue}`, display: "grid", gridTemplateColumns: "minmax(0,1.6fr) minmax(260px,1fr)", gap: 20 }}>
        <div>{head}{body}<SourceLine x={x} /></div>
        <OutreachBox angle={x.outreach_angle} name={exec} title={x.signal_title} fid={fid} wide />
      </div>
    );
  }
  return (
    <div style={{ ...C.card, display: "flex", flexDirection: "column" }}>
      {head}{body}
      <div style={{ margin: "14px 0 0" }}><OutreachBox angle={x.outreach_angle} name={exec} title={x.signal_title} /></div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: "auto", paddingTop: 6 }}>
        <SourceLine x={x} /><Feedback id={fid} />
      </div>
    </div>
  );
}

function ExecView({ r }) {
  const s = summaryOf(r);
  const items = itemsOf(r);
  const inp = r._inputs || {};
  const key = `${s.company_domain}|${s.executive_name}`;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <div style={{ fontSize: 13, color: T.muted, marginBottom: 8 }}>Target profile</div>
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          <Avatar name={s.executive_name} size={60} />
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, fontSize: 22, fontWeight: 700, color: T.text }}>
              <span>{s.executive_name} — {s.executive_designation} at {s.company_name} (<span style={{ color: T.blue }}>{s.company_domain}</span>)</span>
              <LinkedIn url={inp.executive_linkedin_url} /><IntentBadge s={s.overall_intent_score} />
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
              <Chip k="Focus Dept" v={inp.focus_department} /><Chip k="Tech Stack" v={inp.focus_technologies} /><Chip k="Custom Intent" v={inp.custom_intent_notes} />
            </div>
          </div>
        </div>
      </div>
      <div style={{ background: T.blueSoft, border: `1px solid ${T.blueLine}`, borderRadius: 12, padding: "16px 20px" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 6 }}>Strategic Executive Summary</div>
        <div style={{ fontSize: 14, color: T.sub, lineHeight: 1.6 }}>{s.strategic_narrative}</div>
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: T.text }}>Top 5 Ranked Buying Signals</div>
      {items.length === 0
        ? <div style={{ ...C.card, color: T.muted, fontSize: 13 }}>No verified signal from the last 180 days maps to this executive's KPIs.</div>
        : <>
          <ExecSignalCard x={items[0]} exec={s.executive_name} featured fid={`${key}|${items[0].signal_title}`} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 16 }}>
            {items.slice(1).map(x => <ExecSignalCard key={x.rank} x={x} exec={s.executive_name} fid={`${key}|${x.signal_title}`} />)}
          </div>
        </>}
    </div>
  );
}

// ── Company-based view (design 1) ────────────────────────────────────────────
function CompanyTriggerCard({ x, domain }) {
  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: 12, padding: 18, display: "flex", gap: 18 }}>
      <div style={{ textAlign: "center", minWidth: 56, borderRight: `1px solid ${T.border}`, paddingRight: 16 }}>
        <div style={{ fontSize: 13, color: T.sub }}>Rank</div>
        <div style={{ fontSize: 26, fontWeight: 800, color: T.text }}>#{x.rank}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ flex: 1, fontSize: 18, fontWeight: 700, color: T.text }}>{x.signal_title}</div>
          <ConfBadge c={x.confidence_score} />
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "8px 0 10px" }}>
          <Badge>{x.signal_category}</Badge><Badge>{x.matched_intent_category}</Badge>
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 4 }}>Evidence</div>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: T.sub, lineHeight: 1.7 }}>{(x.evidence_bullets || []).map((b, i) => <li key={i}>{b}</li>)}</ul>
        <SourceLine x={x} />
        <div style={{ marginTop: 14, background: "#f8fafc", border: `1px solid ${T.border}`, borderRadius: 10, padding: "14px 16px" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 6 }}>Recommended Target Executives</div>
          {(x.recommended_executives || []).length === 0
            ? <div style={{ fontSize: 13, color: T.muted }}>No verified owner found for this trigger.</div>
            : x.recommended_executives.map((e, i) => (
              <div key={i} style={{ display: "flex", gap: 14, alignItems: "center", padding: "10px 0", borderTop: i ? `1px solid ${T.border}` : "none" }}>
                <Avatar name={e.executive_name} size={48} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, color: T.text, display: "flex", alignItems: "center", flexWrap: "wrap" }}>
                    <b>{e.executive_name}</b>&nbsp;<span style={{ color: T.sub }}>- {e.designation}</span><LinkedIn url={e.linkedin_url} />
                  </div>
                  <div style={{ fontSize: 13, color: T.sub, marginTop: 3 }}>Ownership rationale: {e.ownership_rationale}</div>
                  <div style={{ fontSize: 13, color: T.text, marginTop: 3 }}>→ {e.outreach_angle}</div>
                </div>
                <DraftEmail name={e.executive_name} angle={e.outreach_angle} title={x.signal_title} />
              </div>))}
        </div>
      </div>
    </div>
  );
}

function CompanyView({ r }) {
  const s = summaryOf(r);
  const items = itemsOf(r);
  const inp = r._inputs || {};
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={C.card}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ width: 40, height: 40, borderRadius: 8, background: T.blue, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14 }}>{(s.company_name || "?").slice(0, 2)}</div>
          <div style={{ flex: 1, fontSize: 22, fontWeight: 700, color: T.text }}>{s.company_name} ({s.company_domain})</div>
          <IntentBadge s={s.overall_intent_score} />
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          <Chip k="Focus Dept" v={s.focus_department || inp.focus_department} /><Chip k="Tech Stack" v={inp.focus_technologies} /><Chip k="Custom Intent" v={inp.custom_intent_notes} />
        </div>
        {s.strategic_narrative && <div style={{ fontSize: 14, color: T.sub, marginTop: 12, lineHeight: 1.6 }}>{s.strategic_narrative}</div>}
      </div>
      <div style={C.card}>
        <div style={{ fontSize: 20, fontWeight: 700, color: T.text, marginBottom: 14 }}>Top 5 Account Buying Triggers</div>
        {items.length === 0
          ? <div style={{ fontSize: 13, color: T.muted }}>No verified trigger from the last 180 days matched the focus.</div>
          : <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>{items.map(x => <CompanyTriggerCard key={x.rank} x={x} domain={s.company_domain} />)}</div>}
      </div>
    </div>
  );
}

// Tracked-accounts sidebar (design 1) when a run has several targets.
// Light surface of its own, so the view stays readable inside dark pages (Report History).
export function IntentEngineResults({ results }) {
  return <div style={{ background: T.bg, color: T.text, colorScheme: "light", borderRadius: 12, padding: 16 }}><ResultsBody results={results} /></div>;
}

function ResultsBody({ results }) {
  const [sel, setSel] = useState(0);
  const [open, setOpen] = useState(true);
  const cur = results[Math.min(sel, results.length - 1)];
  if (!cur) return null;
  const View = cur.intent_mode === "EXEC_BASED" ? ExecView : CompanyView;
  if (results.length === 1) return <View r={cur} />;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(180px, 240px) minmax(0, 1fr)", gap: 18 }}>
      <div style={{ ...C.card, padding: 8, alignSelf: "start" }}>
        <button onClick={() => setOpen(o => !o)} style={{ display: "flex", alignItems: "center", width: "100%", padding: "10px 12px", borderRadius: 8, border: "none", background: T.chip, color: T.text, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
          <span style={{ flex: 1, textAlign: "left" }}>Tracked {cur.intent_mode === "EXEC_BASED" ? "Profiles" : "Accounts"}</span>{open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {open && results.map((r, i) => { const s = summaryOf(r); return (
          <button key={i} onClick={() => setSel(i)} style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 12px 10px 16px", border: "none", borderLeft: `2px solid ${i === sel ? T.blue : T.border}`, background: i === sel ? T.blueSoft : "transparent", cursor: "pointer", marginTop: 4 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{s.executive_name || s.company_name}</div>
            <div style={{ fontSize: 12, color: T.muted }}>{s.executive_name ? `${s.company_name} · ` : ""}{s.company_domain}</div>
          </button>); })}
      </div>
      <View r={cur} />
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export function IntentEngineContent() {
  const [mode, setMode] = useState("COMPANY_BASED");
  const [dept, setDept] = useState("IT");
  const [techs, setTechs] = useState("");
  const [intents, setIntents] = useState(DEFAULT_INTENTS);
  const [extraIntent, setExtraIntent] = useState("");
  const [notes, setNotes] = useState("");
  const [targets, setTargets] = useState([emptyTarget()]);
  const [forceRefresh, setForceRefresh] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");
  const [statusBy, setStatusBy] = useState({});
  const [errors, setErrors] = useState({});
  const [results, setResults] = useState([]);
  const abortRef = useRef(null);

  const exec = mode === "EXEC_BASED";
  const valid = targets.filter(t => t.company_name.trim() && t.company_domain.trim() && (!exec || (t.executive_name.trim() && t.executive_designation.trim())));
  const canRun = !running && valid.length && dept.trim();
  const setT = (id, k, v) => setTargets(p => p.map(t => t.id === id ? { ...t, [k]: v } : t));
  const toggleIntent = i => setIntents(p => p.includes(i) ? p.filter(x => x !== i) : [...p, i]);
  const allIntents = [...new Set([...DEFAULT_INTENTS, ...intents])];
  const leads = intentCampaignRows(results);

  async function run() {
    setRunning(true); setResults([]); setErrors({}); setStatusBy({}); setProgress("Connecting to Intent Engine…");
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const got = [];
    const sent = valid.map(({ id, ...t }) => Object.fromEntries(Object.entries(t).map(([k, v]) => [k, v.trim()])));
    const linkByExec = Object.fromEntries(sent.map(t => [`${t.company_name}|${t.executive_name}`, t.executive_linkedin_url]));
    try {
      const res = await fetch(`${API_URL}/api/intent-engine`, {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: ctrl.signal,
        body: JSON.stringify({
          intent_mode: mode, focus_department: dept.trim(), focus_technologies: techs, predefined_intents: intents,
          custom_intent_notes: notes.trim(), force_refresh: forceRefresh,
          targets: sent.map(t => exec ? t : { company_name: t.company_name, company_domain: t.company_domain, company_linkedin_url: t.company_linkedin_url }),
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
          let evt;
          try { evt = JSON.parse(line.slice(6)); } catch { continue; }
          if (evt.type === "heartbeat") setProgress(evt.message);
          else if (evt.type === "target_status") setStatusBy(p => ({ ...p, [evt.target]: evt.status }));
          else if (evt.type === "target_result") {
            const s = summaryOf(evt.result);
            const r = { ...evt.result, _inputs: { focus_department: dept.trim(), focus_technologies: techs.trim(), custom_intent_notes: notes.trim(),
              executive_linkedin_url: linkByExec[`${s.company_name}|${s.executive_name}`] || "" } };
            got.push(r);
            setResults(p => [...p, r]);
            setStatusBy(p => ({ ...p, [evt.target]: "done" }));
          } else if (evt.type === "target_error") {
            setErrors(p => ({ ...p, [evt.target]: evt.message }));
            setStatusBy(p => ({ ...p, [evt.target]: "error" }));
          } else if (evt.type === "complete") {
            setProgress(`Complete — ${evt.total} target(s)`);
            if (got.length) {
              save(HIST_KEY, [{ id: Date.now(), date: new Date().toISOString(), run_id: evt.run_id, usage: evt.usage, engine_version: 2,
                companies: [...new Set(sent.map(t => t.company_name))].join(", "), intent_mode: mode, results: got,
              }, ...load(HIST_KEY, [])].slice(0, MAX_HIST));
            }
          } else if (evt.type === "error") setProgress(`Error: ${evt.message}`);
        }
      }
    } catch (e) {
      setProgress(e.name === "AbortError" ? "Stopped." : `Error: ${e.message}`);
    } finally {
      setRunning(false);
    }
  }

  const pending = Object.entries(statusBy).filter(([, s]) => !["done", "error"].includes(s));
  const seg = (m, label) => (
    <button onClick={() => setMode(m)} style={{ padding: "9px 22px", borderRadius: 999, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600,
      background: mode === m ? T.blue : "transparent", color: mode === m ? "#fff" : T.sub, boxShadow: mode === m ? "0 1px 3px rgba(37,99,235,0.35)" : "none" }}>{label}</button>
  );

  return (
    <div style={{ background: T.bg, color: T.text, borderRadius: 14, padding: 20, display: "flex", flexDirection: "column", gap: 18, colorScheme: "light" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div style={{ fontSize: 22, fontWeight: 700, flex: 1 }}>{exec ? "Target Profile" : "Target Account"}</div>
        <div style={{ display: "inline-flex", padding: 4, borderRadius: 999, background: "#e2e8f0" }}>
          {seg("COMPANY_BASED", "Company-Based Intent")}{seg("EXEC_BASED", "Exec-Based Intent")}
        </div>
      </div>

      <div style={{ ...C.card, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
        <div><div style={C.label}>Focus department(s) *</div><input style={C.input} value={dept} onChange={e => setDept(e.target.value)} placeholder="e.g. Data Engineering" /></div>
        <div><div style={C.label}>Focus technologies</div><input style={C.input} value={techs} onChange={e => setTechs(e.target.value)} placeholder="e.g. Snowflake, dbt" /></div>
        <div style={{ gridColumn: "1 / -1" }}>
          <div style={C.label}>Pre-defined intent triggers</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {allIntents.map(i => { const on = intents.includes(i); return (
              <button key={i} onClick={() => toggleIntent(i)} style={{ ...C.btn, padding: "5px 12px", fontSize: 12, borderRadius: 999, background: on ? T.blueSoft : "#fff", color: on ? T.blue : T.muted, borderColor: on ? T.blueLine : T.border }}>{on && <Check size={12} />}{i}</button>); })}
            <input style={{ ...C.input, width: 180, padding: "5px 10px", borderRadius: 999 }} value={extraIntent} onChange={e => setExtraIntent(e.target.value)} placeholder="+ Add trigger (Enter)"
              onKeyDown={e => { if (e.key === "Enter" && extraIntent.trim()) { setIntents(p => [...new Set([...p, extraIntent.trim()])]); setExtraIntent(""); } }} />
          </div>
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <div style={C.label}>Custom intent criteria</div>
          <textarea style={{ ...C.input, minHeight: 56, resize: "vertical", fontFamily: "inherit" }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Cloud Migration off legacy data warehouses" />
        </div>
      </div>

      <div style={C.card}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>{exec ? "Executive profiles" : "Target accounts"}</div>
        {targets.map(t => (
          <div key={t.id} style={{ border: `1px solid ${T.border}`, borderRadius: 10, padding: 12, marginBottom: 10, background: "#fbfcfe" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 8 }}>
              <input style={C.input} placeholder="Company name *" value={t.company_name} onChange={e => setT(t.id, "company_name", e.target.value)} />
              <input style={C.input} placeholder="Domain * (acme.io)" value={t.company_domain} onChange={e => setT(t.id, "company_domain", e.target.value)} />
              <input style={C.input} placeholder="Company LinkedIn URL" value={t.company_linkedin_url} onChange={e => setT(t.id, "company_linkedin_url", e.target.value)} />
              <button style={{ ...C.btn, padding: "6px 9px" }} disabled={targets.length === 1} onClick={() => setTargets(p => p.filter(x => x.id !== t.id))} aria-label="Remove"><Trash2 size={14} /></button>
            </div>
            {exec && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 8, marginTop: 8 }}>
              <input style={C.input} placeholder="Executive name *" value={t.executive_name} onChange={e => setT(t.id, "executive_name", e.target.value)} />
              <input style={C.input} placeholder="Designation *" value={t.executive_designation} onChange={e => setT(t.id, "executive_designation", e.target.value)} />
              <input style={C.input} placeholder="Executive LinkedIn URL" value={t.executive_linkedin_url} onChange={e => setT(t.id, "executive_linkedin_url", e.target.value)} />
              <span style={{ width: 34 }} />
            </div>}
          </div>
        ))}
        <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
          <button style={C.btn} disabled={targets.length >= 50} onClick={() => setTargets(p => [...p, emptyTarget()])}><Plus size={14} /> Add {exec ? "profile" : "account"}</button>
          <label style={{ fontSize: 12, color: T.sub, display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={forceRefresh} onChange={e => setForceRefresh(e.target.checked)} /> Ignore 30-day cache
          </label>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        {running
          ? <button style={{ ...C.btn, color: "#dc2626", borderColor: "#fecaca" }} onClick={() => abortRef.current?.abort()}><Square size={13} /> Stop</button>
          : <button style={{ ...C.primary, opacity: canRun ? 1 : 0.45, cursor: canRun ? "pointer" : "not-allowed" }} disabled={!canRun} onClick={run}><Play size={13} /> Run Intent Engine</button>}
        <button style={{ ...C.btn, opacity: results.length ? 1 : 0.5 }} disabled={!results.length} onClick={() => downloadCsv(intentTriggerRows(results), "intent_triggers")}><Download size={13} /> Triggers CSV</button>
        <button style={{ ...C.btn, opacity: leads.length ? 1 : 0.5 }} disabled={!leads.length} onClick={() => downloadCsv(leads, "intent_campaign_leads")}
          title="Import into outlook-campaigns; templates can use {{ intent_hook }}, {{ intent_trigger }}"><Download size={13} /> Campaign leads CSV ({leads.length})</button>
        {running && <Loader2 size={16} style={{ color: T.blue, animation: "spin 1s linear infinite" }} />}
        <span style={{ fontSize: 13, color: T.sub }}>{progress}</span>
      </div>

      {pending.length > 0 && <div style={{ fontSize: 12, color: T.muted }}>{pending.map(([n, s]) => `${n}: ${s}`).join(" · ")}</div>}
      {Object.entries(errors).map(([n, m]) => <div key={n} style={{ fontSize: 13, color: "#dc2626" }}>{n}: {m}</div>)}

      {results.length > 0
        ? <IntentEngineResults results={results} />
        : !running && <div style={{ ...C.card, textAlign: "center", color: T.muted, fontSize: 13 }}>Pick a mode, add targets and run. Each target returns its top 5 verified triggers from the last 180 days.</div>}
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}
