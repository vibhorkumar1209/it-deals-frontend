"use client";

import { Deal } from "@/lib/types";
import { ExternalLink, Calendar, DollarSign, Clock, Building2, Package } from "lucide-react";

const CONFIDENCE_COLORS = {
  High:   "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  Medium: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
  Low:    "text-red-400 bg-red-400/10 border-red-400/30",
};

const RECORD_TYPE_STYLES: Record<string, { label: string; color: string }> = {
  contract:                { label: "Contract",        color: "bg-[#E63946]/20 text-[#E63946] border border-[#E63946]/30" },
  partnership:             { label: "Partnership",     color: "bg-violet-500/20 text-violet-300 border border-violet-500/30" },
  implementation:          { label: "Implementation",  color: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" },
  vendor_selection:        { label: "Vendor Selected", color: "bg-[#3491E8]/20 text-[#3491E8] border border-[#3491E8]/30" },
  initiative:              { label: "Initiative",      color: "bg-amber-500/20 text-amber-300 border border-amber-500/30" },
  technology_announcement: { label: "Announcement",   color: "bg-slate-500/20 text-slate-300 border border-slate-500/30" },
};

const CATEGORY_COLORS: Record<string, string> = {
  ERP:              "bg-blue-500/20 text-blue-300",
  CRM:              "bg-purple-500/20 text-purple-300",
  HCM_HR:           "bg-pink-500/20 text-pink-300",
  SCM_PROCUREMENT:  "bg-orange-500/20 text-orange-300",
  CLOUD:            "bg-cyan-500/20 text-cyan-300",
  CYBER:            "bg-red-500/20 text-red-300",
  ANALYTICS:        "bg-indigo-500/20 text-indigo-300",
  ITSM:             "bg-teal-500/20 text-teal-300",
  OUTSOURCING:      "bg-gray-500/20 text-gray-300",
  FRAMEWORK_LISTED: "bg-lime-500/20 text-lime-300",
  MANAGED_SERVICES_INDIA: "bg-amber-500/20 text-amber-300",
  OTHER:            "bg-gray-500/20 text-gray-400",
};

interface Props {
  deal: Deal;
  index: number;
}

export default function DealCard({ deal, index }: Props) {
  const rt = RECORD_TYPE_STYLES[deal.record_type] || RECORD_TYPE_STYLES.technology_announcement;

  return (
    <div
      className="rounded-xl border border-[#1a3a50] bg-[#0c1f2e] p-5 space-y-3
                 animate-fadeIn hover:border-[#3491E8]/40 transition-colors duration-200"
      style={{ animationDelay: `${(index % 5) * 80}ms` }}
    >
      {/* ── Core fields ─────────────────────────────────────────────────── */}

      {/* Row 1: Customer / Vendor / Date + confidence */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 flex-1 min-w-0">
          {/* Customer name */}
          <span className="flex items-center gap-1 text-sm font-semibold text-white">
            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            {deal.company_name}
          </span>
          {deal.vendor && (
            <>
              <span className="text-slate-500 text-xs">→</span>
              <span className="flex items-center gap-1 text-sm font-semibold text-[#3491E8]">
                <Package className="w-3.5 h-3.5 shrink-0" />
                {deal.vendor}
              </span>
            </>
          )}
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0
                          ${CONFIDENCE_COLORS[deal.confidence_level]}`}>
          {deal.confidence_level}
        </span>
      </div>

      {/* Row 2: Deal description (core) */}
      {deal.deal_description && (
        <p className="text-xs text-slate-200 leading-relaxed border-l-2 border-[#3491E8]/40 pl-3">
          {deal.deal_description}
        </p>
      )}

      {/* Row 3: Date (core) */}
      {deal.announcement_date && (
        <div className="flex items-center gap-1 text-[11px] text-slate-400">
          <Calendar className="w-3 h-3" />
          {deal.announcement_date}
        </div>
      )}

      {/* ── Secondary fields ─────────────────────────────────────────────── */}

      {/* Tags */}
      <div className="flex flex-wrap gap-2">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${rt.color}`}>
          {rt.label}
        </span>
        {deal.vendor_category && (
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded
                            ${CATEGORY_COLORS[deal.vendor_category] || CATEGORY_COLORS.OTHER}`}>
            {deal.vendor_category.replace(/_/g, " ")}
          </span>
        )}
        {deal.si_partner && (
          <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-[#1a3a50] text-slate-300">
            SI: {deal.si_partner}
          </span>
        )}
        {deal.source_type && (
          <span className="text-[11px] px-2 py-0.5 rounded bg-[#1a3a50] text-slate-400">
            {deal.source_type.replace(/_/g, " ")}
          </span>
        )}
      </div>

      {/* Value / Duration */}
      {(deal.deal_value_usd != null || deal.deal_duration) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {deal.deal_value_usd != null && (
            <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
              <DollarSign className="w-3 h-3" />
              ${deal.deal_value_usd}M
            </span>
          )}
          {deal.deal_duration && (
            <span className="flex items-center gap-1 text-[11px] text-slate-400">
              <Clock className="w-3 h-3" />
              {deal.deal_duration}
            </span>
          )}
        </div>
      )}

      {/* Source link */}
      {deal.source_url && (
        <a
          href={deal.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[11px] text-[#3491E8] hover:text-blue-300
                     transition-colors truncate"
        >
          <ExternalLink className="w-3 h-3 shrink-0" />
          <span className="truncate">{deal.source_url}</span>
        </a>
      )}
    </div>
  );
}
