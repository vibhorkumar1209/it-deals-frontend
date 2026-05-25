"use client";

import { useState, useCallback } from "react";
import { Plus, Trash2, Play, Download, ChevronRight, ChevronLeft, Loader2, CheckCircle2, Zap } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4001";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SchemaField {
  key: string;
  label: string;
  type: "string" | "number" | "date" | "boolean";
  description: string;
}

interface EnrichInput {
  company_name: string;
  domain: string;
}

interface EnrichRow {
  company_name: string;
  domain: string;
  _status: "ok" | "no_result";
  [key: string]: string;
}

// ── Presets ───────────────────────────────────────────────────────────────────

const PRESETS = [
  {
    label: "IT Deal Details",
    goal: "Find all IT technology deals, vendor contracts, outsourcing agreements, and digital transformation initiatives signed by this company in the last 5 years.",
    fields: [
      { key: "vendor",       label: "Vendor Name",    type: "string", description: "Technology vendor or service provider" },
      { key: "deal_type",    label: "Deal Type",      type: "string", description: "ERP / Cloud / Outsourcing / Cybersecurity etc." },
      { key: "deal_value",   label: "Deal Value",     type: "string", description: "Contract value in USD millions if known" },
      { key: "date_signed",  label: "Date Signed",    type: "date",   description: "Announcement or signing date" },
      { key: "description",  label: "Description",    type: "string", description: "One-line description of what was agreed" },
      { key: "source",       label: "Source URL",     type: "string", description: "URL of press release or news article" },
    ] as SchemaField[],
  },
  {
    label: "Vendor Intelligence",
    goal: "Research the company's key technology vendors, software products in use, and known IT infrastructure stack.",
    fields: [
      { key: "erp_vendor",    label: "ERP System",      type: "string", description: "Core ERP platform in use" },
      { key: "crm_vendor",    label: "CRM System",      type: "string", description: "CRM platform in use" },
      { key: "cloud_provider",label: "Cloud Provider",  type: "string", description: "Primary cloud: AWS / Azure / GCP" },
      { key: "core_banking",  label: "Core Banking",    type: "string", description: "Core banking system if applicable" },
      { key: "si_partner",    label: "SI Partner",      type: "string", description: "Primary system integrator / IT services partner" },
    ] as SchemaField[],
  },
  {
    label: "Company Firmographics",
    goal: "Research key firmographic details for the company including employee count, revenue, headquarters, and industry.",
    fields: [
      { key: "hq",           label: "Headquarters",  type: "string", description: "City and country" },
      { key: "employees",    label: "Employees",     type: "number", description: "Approximate headcount" },
      { key: "revenue",      label: "Revenue (USD)", type: "string", description: "Annual revenue" },
      { key: "industry",     label: "Industry",      type: "string", description: "Primary industry sector" },
      { key: "founded",      label: "Founded",       type: "string", description: "Year founded" },
    ] as SchemaField[],
  },
];

// ── Styles ────────────────────────────────────────────────────────────────────

const inp = "w-full bg-[#0a1c2a] border border-[#1a3a50] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#3491E8] transition-colors";
const btn = "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors";

// ── Component ─────────────────────────────────────────────────────────────────

export default function EnrichPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [goal, setGoal] = useState(PRESETS[0].goal);
  const [fields, setFields] = useState<SchemaField[]>(PRESETS[0].fields);
  const [inputs, setInputs] = useState<EnrichInput[]>([
    { company_name: "", domain: "" },
  ]);
  const [rawInputText, setRawInputText] = useState("");
  const [inputMode, setInputMode] = useState<"table" | "paste">("table");

  const [status, setStatus] = useState<"idle" | "running" | "complete" | "error">("idle");
  const [progress, setProgress] = useState("");
  const [rows, setRows] = useState<EnrichRow[]>([]);

  // ── Step 1: Goal & Schema ─────────────────────────────────────────────────

  const applyPreset = (p: typeof PRESETS[0]) => {
    setGoal(p.goal);
    setFields(p.fields);
  };

  const addField = () =>
    setFields(f => [...f, { key: `field_${f.length + 1}`, label: "", type: "string", description: "" }]);

  const removeField = (i: number) =>
    setFields(f => f.filter((_, idx) => idx !== i));

  const updateField = (i: number, patch: Partial<SchemaField>) =>
    setFields(f => f.map((fi, idx) => idx === i ? { ...fi, ...patch } : fi));

  // ── Step 2: Inputs ────────────────────────────────────────────────────────

  const parsedInputs: EnrichInput[] = inputMode === "paste"
    ? rawInputText.trim().split("\n").flatMap(line => {
        const parts = line.split(/[,\t]/);
        if (parts.length >= 2) return [{ company_name: parts[0].trim(), domain: parts[1].trim() }];
        return [];
      })
    : inputs.filter(r => r.company_name && r.domain);

  // ── Step 3: Run ───────────────────────────────────────────────────────────

  const run = useCallback(async () => {
    setStatus("running");
    setRows([]);
    setProgress("Connecting…");

    const body = { goal, schema_fields: fields, inputs: parsedInputs };

    try {
      const res = await fetch(`${API_URL}/api/enrich-task`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok || !res.body) throw new Error(`${res.status}`);

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const ev = JSON.parse(line.slice(6));
            if (ev.type === "progress" || ev.type === "heartbeat") {
              setProgress(ev.message ?? "");
            } else if (ev.type === "row") {
              setRows(prev => [...prev, ev.row]);
              setProgress(`✅ ${ev.index + 1}/${ev.total} companies researched`);
            } else if (ev.type === "complete") {
              setStatus("complete");
              setProgress(`Done — ${ev.succeeded}/${ev.total} companies enriched`);
            } else if (ev.type === "error") {
              setStatus("error");
              setProgress(ev.message ?? "Error");
            }
          } catch { /* skip */ }
        }
      }
    } catch (e) {
      setStatus("error");
      setProgress(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [goal, fields, parsedInputs]);

  // ── Download ──────────────────────────────────────────────────────────────

  const downloadCSV = () => {
    if (!rows.length) return;
    const keys = ["company_name", "domain", ...fields.map(f => f.key)];
    const header = ["Company", "Domain", ...fields.map(f => f.label)];
    const csv = [
      header.join(","),
      ...rows.map(r => keys.map(k => `"${(r[k] ?? "").replace(/"/g, '""')}"`).join(",")),
    ].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }));
    a.download = "enrichment-results.csv";
    a.click();
  };

  const downloadJSON = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" }));
    a.download = "enrichment-results.json";
    a.click();
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#080f16]">
      {/* Header */}
      <header className="border-b border-[#1a3a50] bg-[#080f16]/90 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#3491E8]/20 flex items-center justify-center">
            <Zap className="w-4 h-4 text-[#3491E8]" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white">Web Enrichment Tasks</h1>
            <p className="text-[11px] text-slate-500">Define goal · Configure schema · Run across multiple companies</p>
          </div>
          <a href="/" className="ml-auto text-xs text-slate-500 hover:text-slate-300 transition-colors">
            ← IT Deal Scan
          </a>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">

        {/* Step indicator */}
        <div className="flex items-center gap-2 text-xs">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex items-center gap-2">
              <button
                onClick={() => status === "idle" && setStep(s as 1|2|3)}
                className={`w-6 h-6 rounded-full font-bold flex items-center justify-center transition-colors
                  ${step === s ? "bg-[#3491E8] text-white" : step > s ? "bg-emerald-500/30 text-emerald-400" : "bg-[#1a3a50] text-slate-500"}`}
              >
                {step > s ? "✓" : s}
              </button>
              <span className={step === s ? "text-white" : "text-slate-500"}>
                {s === 1 ? "Goal & Schema" : s === 2 ? "Companies" : "Run & Results"}
              </span>
              {s < 3 && <ChevronRight className="w-3 h-3 text-slate-600" />}
            </div>
          ))}
        </div>

        {/* ── Step 1: Goal & Schema ── */}
        {step === 1 && (
          <div className="space-y-5">
            {/* Presets */}
            <div className="rounded-2xl border border-[#1a3a50] bg-[#0c1f2e] p-5 space-y-4">
              <h2 className="text-sm font-semibold text-white">Quick-start presets</h2>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map(p => (
                  <button
                    key={p.label}
                    onClick={() => applyPreset(p)}
                    className="text-xs px-3 py-1.5 rounded-full border border-[#1a3a50] text-slate-400
                               hover:border-[#3491E8]/60 hover:text-[#3491E8] transition-colors"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Enrichment goal */}
            <div className="rounded-2xl border border-[#1a3a50] bg-[#0c1f2e] p-5 space-y-3">
              <h2 className="text-sm font-semibold text-white">Enrichment goal</h2>
              <p className="text-xs text-slate-500">Describe what Parallel.ai should research for each company.</p>
              <textarea
                className={`${inp} h-24 resize-none`}
                value={goal}
                onChange={e => setGoal(e.target.value)}
                placeholder="e.g. Find all IT deals and technology contracts signed in the last 5 years…"
              />
            </div>

            {/* Schema fields */}
            <div className="rounded-2xl border border-[#1a3a50] bg-[#0c1f2e] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">Output schema</h2>
                <button onClick={addField} className="flex items-center gap-1 text-xs text-[#3491E8] hover:text-blue-300 transition-colors">
                  <Plus className="w-3 h-3" /> Add field
                </button>
              </div>

              <div className="space-y-2">
                {fields.map((f, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <input
                      className={`${inp} col-span-3`}
                      placeholder="Field key"
                      value={f.key}
                      onChange={e => updateField(i, { key: e.target.value.replace(/\s+/g, "_").toLowerCase() })}
                    />
                    <input
                      className={`${inp} col-span-3`}
                      placeholder="Display label"
                      value={f.label}
                      onChange={e => updateField(i, { label: e.target.value })}
                    />
                    <select
                      className={`${inp} col-span-2`}
                      value={f.type}
                      onChange={e => updateField(i, { type: e.target.value as SchemaField["type"] })}
                    >
                      <option value="string">Text</option>
                      <option value="number">Number</option>
                      <option value="date">Date</option>
                      <option value="boolean">Yes/No</option>
                    </select>
                    <input
                      className={`${inp} col-span-3`}
                      placeholder="Description (helps AI)"
                      value={f.description}
                      onChange={e => updateField(i, { description: e.target.value })}
                    />
                    <button onClick={() => removeField(i)} className="col-span-1 text-slate-600 hover:text-[#E63946] transition-colors flex justify-center">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setStep(2)}
                disabled={!goal.trim() || fields.length === 0}
                className={`${btn} bg-[#3491E8] text-white hover:bg-[#2a7dd4] disabled:opacity-40`}
              >
                Next: Add Companies <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Inputs ── */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-[#1a3a50] bg-[#0c1f2e] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">Companies to enrich</h2>
                <div className="flex gap-2">
                  <button onClick={() => setInputMode("table")}
                    className={`text-xs px-3 py-1 rounded-full transition-colors
                      ${inputMode === "table" ? "bg-[#3491E8]/20 text-[#3491E8] border border-[#3491E8]/40" : "text-slate-500 hover:text-slate-300"}`}>
                    Row entry
                  </button>
                  <button onClick={() => setInputMode("paste")}
                    className={`text-xs px-3 py-1 rounded-full transition-colors
                      ${inputMode === "paste" ? "bg-[#3491E8]/20 text-[#3491E8] border border-[#3491E8]/40" : "text-slate-500 hover:text-slate-300"}`}>
                    Paste CSV
                  </button>
                </div>
              </div>

              {inputMode === "table" && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-500 font-medium px-1">
                    <span>Company Name</span><span>Domain</span>
                  </div>
                  {inputs.map((inp_, i) => (
                    <div key={i} className="grid grid-cols-2 gap-2 items-center">
                      <input className={inp} placeholder="e.g. HDFC Bank" value={inp_.company_name}
                        onChange={e => setInputs(prev => prev.map((r, idx) => idx === i ? { ...r, company_name: e.target.value } : r))} />
                      <div className="flex gap-2">
                        <input className={`${inp} flex-1`} placeholder="e.g. hdfcbank.com" value={inp_.domain}
                          onChange={e => setInputs(prev => prev.map((r, idx) => idx === i ? { ...r, domain: e.target.value } : r))} />
                        <button onClick={() => setInputs(prev => prev.filter((_, idx) => idx !== i))}
                          className="text-slate-600 hover:text-[#E63946] transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  <button onClick={() => setInputs(prev => [...prev, { company_name: "", domain: "" }])}
                    className="flex items-center gap-1 text-xs text-[#3491E8] hover:text-blue-300 transition-colors mt-1">
                    <Plus className="w-3 h-3" /> Add company
                  </button>
                </div>
              )}

              {inputMode === "paste" && (
                <div className="space-y-2">
                  <p className="text-xs text-slate-500">One company per line: <code className="text-slate-400">Company Name, domain.com</code></p>
                  <textarea
                    className={`${inp} h-40 resize-none font-mono text-xs`}
                    placeholder={"HDFC Bank, hdfcbank.com\nICICI Bank, icicibank.com\nAxis Bank, axisbank.com"}
                    value={rawInputText}
                    onChange={e => setRawInputText(e.target.value)}
                  />
                  {parsedInputs.length > 0 && (
                    <p className="text-xs text-emerald-400">✓ {parsedInputs.length} companies parsed</p>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-between">
              <button onClick={() => setStep(1)} className={`${btn} border border-[#1a3a50] text-slate-400 hover:text-white`}>
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={parsedInputs.length === 0}
                className={`${btn} bg-[#3491E8] text-white hover:bg-[#2a7dd4] disabled:opacity-40`}
              >
                Next: Run Task <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Run & Results ── */}
        {step === 3 && (
          <div className="space-y-5">
            {/* Summary card */}
            <div className="rounded-2xl border border-[#1a3a50] bg-[#0c1f2e] p-5 space-y-3">
              <h2 className="text-sm font-semibold text-white">Task summary</h2>
              <div className="grid grid-cols-3 gap-4 text-xs">
                <div>
                  <p className="text-slate-500 mb-1">Companies</p>
                  <p className="text-white font-semibold">{parsedInputs.length}</p>
                </div>
                <div>
                  <p className="text-slate-500 mb-1">Output fields</p>
                  <p className="text-white font-semibold">{fields.length}</p>
                </div>
                <div>
                  <p className="text-slate-500 mb-1">Research engine</p>
                  <p className="text-[#3491E8] font-semibold">Parallel.ai</p>
                </div>
              </div>
              <div className="border-t border-[#1a3a50] pt-3">
                <p className="text-xs text-slate-400 line-clamp-2">{goal}</p>
              </div>
            </div>

            {/* Status bar */}
            {status !== "idle" && (
              <div className="flex items-center gap-3 p-4 rounded-xl border border-[#1a3a50] bg-[#0c1f2e]">
                {status === "running"  && <Loader2 className="w-4 h-4 text-[#3491E8] animate-spin shrink-0" />}
                {status === "complete" && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                <p className="text-sm text-slate-300">{progress}</p>
                {status === "complete" && (
                  <div className="ml-auto flex gap-2">
                    <button onClick={downloadCSV}
                      className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors flex items-center gap-1">
                      <Download className="w-3 h-3" /> CSV
                    </button>
                    <button onClick={downloadJSON}
                      className="text-xs px-3 py-1.5 rounded-lg bg-[#3491E8]/20 text-[#3491E8] hover:bg-[#3491E8]/30 transition-colors flex items-center gap-1">
                      <Download className="w-3 h-3" /> JSON
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Results table */}
            {rows.length > 0 && (
              <div className="rounded-xl border border-[#1a3a50] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-[#0c3649] text-slate-300 text-left">
                        <th className="px-3 py-2.5 font-semibold whitespace-nowrap">#</th>
                        <th className="px-3 py-2.5 font-semibold whitespace-nowrap">Company</th>
                        <th className="px-3 py-2.5 font-semibold whitespace-nowrap">Domain</th>
                        {fields.map(f => (
                          <th key={f.key} className="px-3 py-2.5 font-semibold whitespace-nowrap">{f.label}</th>
                        ))}
                        <th className="px-3 py-2.5 font-semibold whitespace-nowrap">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, i) => (
                        <tr key={i}
                          className={`border-t border-[#1a3a50] hover:bg-[#0c3649]/40 transition-colors
                                      ${i % 2 === 0 ? "bg-[#080f16]" : "bg-[#0c1f2e]"}`}>
                          <td className="px-3 py-2.5 text-slate-500 font-mono">{i + 1}</td>
                          <td className="px-3 py-2.5 font-semibold text-white whitespace-nowrap">{row.company_name}</td>
                          <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap">{row.domain}</td>
                          {fields.map(f => (
                            <td key={f.key} className="px-3 py-2.5 text-slate-300 max-w-xs">
                              <span className="line-clamp-2">{row[f.key] || <span className="text-slate-600">—</span>}</span>
                            </td>
                          ))}
                          <td className="px-3 py-2.5">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold
                              ${row._status === "ok" ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-500/20 text-slate-500"}`}>
                              {row._status === "ok" ? "Enriched" : "No data"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex justify-between">
              <button onClick={() => { setStep(2); setStatus("idle"); setRows([]); }}
                disabled={status === "running"}
                className={`${btn} border border-[#1a3a50] text-slate-400 hover:text-white disabled:opacity-40`}>
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <button
                onClick={run}
                disabled={status === "running" || parsedInputs.length === 0}
                className={`${btn} bg-[#3491E8] text-white hover:bg-[#2a7dd4] disabled:opacity-40`}
              >
                {status === "running"
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Running…</>
                  : <><Play className="w-4 h-4" /> {status === "complete" ? "Run again" : "Run enrichment"}</>}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
