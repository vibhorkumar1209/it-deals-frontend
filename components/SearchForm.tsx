"use client";

import { useState } from "react";
import { ScrapeRequest } from "@/lib/types";
import { Search, ChevronDown, ChevronUp } from "lucide-react";

const DEAL_TYPES = [
  "ERP", "CRM", "HCM", "SCM", "cloud_migration", "managed_services",
  "cybersecurity", "digital_transformation", "infrastructure",
  "analytics", "AI_ML", "outsourcing", "SaaS", "SI_contract",
];

interface Props {
  onSubmit: (req: ScrapeRequest) => void;
  loading: boolean;
}

export default function SearchForm({ onSubmit, loading }: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [form, setForm] = useState({
    company_name: "",
    domain: "",
    linkedin_url: "",
    company_aliases: "",
    secondary_domains: "",
    stock_ticker: "",
    industry_sector: "",
    hq_country: "",
    hq_city: "",
    known_sources: "",
    min_deal_value: "",
    year_start: "2020",
    year_end: "2025",
    run_linkedin: false,
    focus_deal_types: DEAL_TYPES,
  });

  const toggle = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const toggleDealType = (t: string) => {
    setForm(f => ({
      ...f,
      focus_deal_types: f.focus_deal_types.includes(t)
        ? f.focus_deal_types.filter(x => x !== t)
        : [...f.focus_deal_types, t],
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.company_name.trim() || !form.domain.trim()) return;
    onSubmit({
      company_name: form.company_name.trim(),
      company_aliases: form.company_aliases.split(",").map(s => s.trim()).filter(Boolean),
      domain: form.domain.trim(),
      secondary_domains: form.secondary_domains.split(",").map(s => s.trim()).filter(Boolean),
      linkedin_url: form.linkedin_url.trim(),
      stock_ticker: form.stock_ticker.trim() || null,
      exchange: null,
      industry_sector: form.industry_sector.trim(),
      hq_country: form.hq_country.trim(),
      hq_city: form.hq_city.trim(),
      search_year_range: {
        start: parseInt(form.year_start),
        end: parseInt(form.year_end),
      },
      known_sources: form.known_sources.split("\n").map(s => s.trim()).filter(Boolean),
      focus_deal_types: form.focus_deal_types,
      min_deal_value_usd_million: form.min_deal_value ? parseFloat(form.min_deal_value) : null,
      run_linkedin: form.run_linkedin,
      batch_size: 5,
    });
  };

  const inp = "w-full bg-[#0a1c2a] border border-[#1a3a50] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#3491E8] transition-colors";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Core fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">
            Company Name <span className="text-[#E63946]">*</span>
          </label>
          <input
            className={inp}
            placeholder="e.g. Microsoft Corporation"
            value={form.company_name}
            onChange={e => toggle("company_name", e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">
            Company Domain <span className="text-[#E63946]">*</span>
          </label>
          <input
            className={inp}
            placeholder="e.g. microsoft.com"
            value={form.domain}
            onChange={e => toggle("domain", e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">LinkedIn URL</label>
          <input
            className={inp}
            placeholder="https://linkedin.com/company/..."
            value={form.linkedin_url}
            onChange={e => toggle("linkedin_url", e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">
            Company Aliases <span className="text-slate-500 text-[11px]">(comma-separated)</span>
          </label>
          <input
            className={inp}
            placeholder="e.g. MSFT, Microsoft Corp"
            value={form.company_aliases}
            onChange={e => toggle("company_aliases", e.target.value)}
          />
        </div>
      </div>

      {/* Year range */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">From Year</label>
          <input
            type="number" min="2015" max="2025"
            className={inp}
            value={form.year_start}
            onChange={e => toggle("year_start", e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">To Year</label>
          <input
            type="number" min="2015" max="2025"
            className={inp}
            value={form.year_end}
            onChange={e => toggle("year_end", e.target.value)}
          />
        </div>
      </div>

      {/* Known Sources */}
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1">
          Known Sources <span className="text-slate-500 text-[11px]">(one URL per line)</span>
        </label>
        <textarea
          className={`${inp} h-20 resize-none`}
          placeholder={"https://investor.company.com/press-releases\nhttps://www.businesswire.com/news/..."}
          value={form.known_sources}
          onChange={e => toggle("known_sources", e.target.value)}
        />
      </div>

      {/* Advanced toggle */}
      <button
        type="button"
        onClick={() => setShowAdvanced(v => !v)}
        className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
      >
        {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        Advanced options
      </button>

      {showAdvanced && (
        <div className="space-y-4 pt-1 border-t border-[#1a3a50]">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Stock Ticker</label>
              <input className={inp} placeholder="e.g. MSFT" value={form.stock_ticker} onChange={e => toggle("stock_ticker", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">HQ Country</label>
              <input className={inp} placeholder="e.g. US" value={form.hq_country} onChange={e => toggle("hq_country", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Min Deal Value ($M)</label>
              <input type="number" className={inp} placeholder="e.g. 10" value={form.min_deal_value} onChange={e => toggle("min_deal_value", e.target.value)} />
            </div>
          </div>

          {/* Deal types */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">Focus Deal Types</label>
            <div className="flex flex-wrap gap-2">
              {DEAL_TYPES.map(t => (
                <button
                  key={t} type="button"
                  onClick={() => toggleDealType(t)}
                  className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors
                    ${form.focus_deal_types.includes(t)
                      ? "bg-[#3491E8]/20 border-[#3491E8]/60 text-[#3491E8]"
                      : "bg-transparent border-[#1a3a50] text-slate-500 hover:border-slate-500"}`}
                >
                  {t.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="w-3.5 h-3.5 accent-[#3491E8]"
              checked={form.run_linkedin}
              onChange={e => toggle("run_linkedin", e.target.checked)}
            />
            <span className="text-xs text-slate-400">Include LinkedIn posts (requires credentials in API)</span>
          </label>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={loading || !form.company_name || !form.domain}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm
                   bg-[#3491E8] hover:bg-[#2a7dd4] disabled:opacity-40 disabled:cursor-not-allowed
                   text-white transition-colors duration-200"
      >
        <Search className="w-4 h-4" />
        {loading ? "Scanning for deals..." : "Find IT Deals"}
      </button>
    </form>
  );
}
