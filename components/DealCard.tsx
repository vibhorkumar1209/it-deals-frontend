"use client";

import { Deal } from "@/lib/types";
import { ExternalLink, Calendar, DollarSign, Clock, Building2, Users } from "lucide-react";

const CONFIDENCE_COLORS = {
  High: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  Medium: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
  Low: "text-red-400 bg-red-400/10 border-red-400/30",
};

const CATEGORY_COLORS: Record<string, string> = {
  ERP: "bg-blue-500/20 text-blue-300",
  CRM: "bg-purple-500/20 text-purple-300",
  HCM_HR: "bg-pink-500/20 text-pink-300",
  SCM_PROCUREMENT: "bg-orange-500/20 text-orange-300",
  CLOUD: "bg-cyan-500/20 text-cyan-300",
  CYBER: "bg-red-500/20 text-red-300",
  ANALYTICS: "bg-indigo-500/20 text-indigo-300",
  ITSM: "bg-teal-500/20 text-teal-300",
  OUTSOURCING: "bg-gray-500/20 text-gray-300",
  OTHER: "bg-gray-500/20 text-gray-400",
};

interface Props {
  deal: Deal;
  index: number;
}

export default function DealCard({ deal, index }: Props) {
  return (
    <div
      className="rounded-xl border border-[#1a3a50] bg-[#0c1f2e] p-5 space-y-3
                 animate-fadeIn hover:border-[#3491E8]/40 transition-colors duration-200"
      style={{ animationDelay: `${(index % 5) * 80}ms` }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-white leading-snug flex-1">
          {deal.deal_title}
        </h3>
        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0
                      ${CONFIDENCE_COLORS[deal.confidence_level]}`}
        >
          {deal.confidence_level}
        </span>
      </div>

      {/* Tags row */}
      <div className="flex flex-wrap gap-2">
        {deal.vendor && (
          <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-[#3491E8]/20 text-[#3491E8]">
            {deal.vendor}
          </span>
        )}
        {deal.vendor_category && (
          <span
            className={`text-[11px] font-medium px-2 py-0.5 rounded
                        ${CATEGORY_COLORS[deal.vendor_category] || CATEGORY_COLORS.OTHER}`}
          >
            {deal.vendor_category.replace("_", " ")}
          </span>
        )}
        {deal.si_partner && (
          <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-[#1a3a50] text-slate-300">
            SI: {deal.si_partner}
          </span>
        )}
        <span className="text-[11px] px-2 py-0.5 rounded bg-[#1a3a50] text-slate-400">
          {deal.source_type.replace("_", " ")}
        </span>
      </div>

      {/* Summary */}
      {deal.summary && (
        <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">
          {deal.summary}
        </p>
      )}

      {/* Meta row */}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {deal.announcement_date && (
          <span className="flex items-center gap-1 text-[11px] text-slate-400">
            <Calendar className="w-3 h-3" />
            {deal.announcement_date}
          </span>
        )}
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
        {deal.hq_country && (
          <span className="flex items-center gap-1 text-[11px] text-slate-400">
            <Building2 className="w-3 h-3" />
            {deal.hq_country}
          </span>
        )}
      </div>

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
