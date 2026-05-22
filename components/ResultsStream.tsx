"use client";

import { Deal, SSEEvent } from "@/lib/types";
import {
  Loader2, CheckCircle2, AlertCircle, Download,
  TrendingUp, Database, AlertTriangle, ExternalLink,
  DollarSign, Clock
} from "lucide-react";

interface Props {
  deals: Deal[];
  status: "idle" | "running" | "complete" | "error";
  progress: string;
  totalSoFar: number;
  summary?: SSEEvent["summary"];
  onDownloadJSON: () => void;
  onDownloadCSV: () => void;
}

const CONFIDENCE_COLORS = {
  High:   "text-emerald-400 bg-emerald-400/10",
  Medium: "text-yellow-400 bg-yellow-400/10",
  Low:    "text-red-400 bg-red-400/10",
};

const RECORD_TYPE_STYLES: Record<string, { label: string; color: string }> = {
  contract:                { label: "Contract",        color: "bg-[#E63946]/20 text-[#E63946]" },
  partnership:             { label: "Partnership",     color: "bg-violet-500/20 text-violet-300" },
  implementation:          { label: "Implementation",  color: "bg-emerald-500/20 text-emerald-300" },
  vendor_selection:        { label: "Vendor Selected", color: "bg-[#3491E8]/20 text-[#3491E8]" },
  initiative:              { label: "Initiative",      color: "bg-amber-500/20 text-amber-300" },
  technology_announcement: { label: "Announcement",   color: "bg-slate-500/20 text-slate-300" },
};

export default function ResultsStream({
  deals, status, progress, totalSoFar, summary, onDownloadJSON, onDownloadCSV
}: Props) {
  if (status === "idle") return null;

  return (
    <div className="space-y-4">
      {/* Status bar */}
      <div className="flex items-center gap-3 p-4 rounded-xl border border-[#1a3a50] bg-[#0c1f2e]">
        {status === "running"  && <Loader2     className="w-4 h-4 text-[#3491E8] animate-spin shrink-0" />}
        {status === "complete" && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
        {status === "error"    && <AlertCircle  className="w-4 h-4 text-[#E63946] shrink-0" />}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-300 truncate">{progress}</p>
          {totalSoFar > 0 && (
            <p className="text-xs text-slate-500 mt-0.5">
              {totalSoFar} deal{totalSoFar !== 1 ? "s" : ""} found so far
            </p>
          )}
        </div>
        {status === "complete" && deals.length > 0 && (
          <div className="flex gap-2 shrink-0">
            <button
              onClick={onDownloadJSON}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg
                         bg-[#3491E8]/20 text-[#3491E8] hover:bg-[#3491E8]/30 transition-colors"
            >
              <Download className="w-3 h-3" /> JSON
            </button>
            <button
              onClick={onDownloadCSV}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg
                         bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
            >
              <Download className="w-3 h-3" /> CSV
            </button>
          </div>
        )}
      </div>

      {/* Summary stats */}
      {status === "complete" && summary && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-[#1a3a50] bg-[#0c1f2e] p-4 text-center">
            <TrendingUp className="w-5 h-5 text-[#3491E8] mx-auto mb-1" />
            <p className="text-2xl font-bold text-white">{deals.length}</p>
            <p className="text-xs text-slate-400">Deals Found</p>
          </div>
          <div className="rounded-xl border border-[#1a3a50] bg-[#0c1f2e] p-4 text-center">
            <Database className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-white">{String(summary.sources_attempted ?? 0)}</p>
            <p className="text-xs text-slate-400">Sources Scanned</p>
          </div>
          <div className="rounded-xl border border-[#1a3a50] bg-[#0c1f2e] p-4 text-center">
            <AlertTriangle className="w-5 h-5 text-yellow-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-white">{String(summary.failures ?? 0)}</p>
            <p className="text-xs text-slate-400">Fetch Failures</p>
          </div>
        </div>
      )}

      {/* Confidence breakdown */}
      {deals.length > 0 && (
        <div className="flex gap-3 text-xs">
          {(["High", "Medium", "Low"] as const).map(level => {
            const count = deals.filter(d => d.confidence_level === level).length;
            const colors = { High: "text-emerald-400", Medium: "text-yellow-400", Low: "text-red-400" };
            return count > 0 ? (
              <span key={level} className={colors[level]}>{count} {level}</span>
            ) : null;
          })}
        </div>
      )}

      {/* ── Deal Table ─────────────────────────────────────────────────────── */}
      {deals.length > 0 && (
        <div className="rounded-xl border border-[#1a3a50] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#0c3649] text-slate-300 text-left">
                  <th className="px-3 py-2.5 font-semibold whitespace-nowrap">#</th>
                  <th className="px-3 py-2.5 font-semibold whitespace-nowrap">Customer</th>
                  <th className="px-3 py-2.5 font-semibold whitespace-nowrap">Vendor</th>
                  <th className="px-3 py-2.5 font-semibold max-w-xs">Deal Description</th>
                  <th className="px-3 py-2.5 font-semibold whitespace-nowrap">Date</th>
                  <th className="px-3 py-2.5 font-semibold whitespace-nowrap">Type</th>
                  <th className="px-3 py-2.5 font-semibold whitespace-nowrap">SI Partner</th>
                  <th className="px-3 py-2.5 font-semibold whitespace-nowrap">Value</th>
                  <th className="px-3 py-2.5 font-semibold whitespace-nowrap">Duration</th>
                  <th className="px-3 py-2.5 font-semibold whitespace-nowrap">Confidence</th>
                  <th className="px-3 py-2.5 font-semibold whitespace-nowrap">Source</th>
                </tr>
              </thead>
              <tbody>
                {deals.map((deal, i) => {
                  const rt = RECORD_TYPE_STYLES[deal.record_type] || RECORD_TYPE_STYLES.technology_announcement;
                  return (
                    <tr
                      key={`${deal.source_url}-${i}`}
                      className={`border-t border-[#1a3a50] hover:bg-[#0c3649]/40 transition-colors
                                  ${i % 2 === 0 ? "bg-[#080f16]" : "bg-[#0c1f2e]"}`}
                    >
                      {/* # */}
                      <td className="px-3 py-2.5 text-slate-500 font-mono">{i + 1}</td>

                      {/* Customer */}
                      <td className="px-3 py-2.5 font-semibold text-white whitespace-nowrap">
                        {deal.company_name}
                      </td>

                      {/* Vendor */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {deal.vendor
                          ? <span className="text-[#3491E8] font-medium">{deal.vendor}</span>
                          : <span className="text-slate-600">—</span>}
                      </td>

                      {/* Deal Description — core field, wraps */}
                      <td className="px-3 py-2.5 text-slate-300 leading-relaxed max-w-xs">
                        <span className="line-clamp-3">
                          {deal.deal_description || deal.summary || "—"}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap">
                        {deal.announcement_date || "—"}
                      </td>

                      {/* Type badge */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${rt.color}`}>
                          {rt.label}
                        </span>
                      </td>

                      {/* SI Partner */}
                      <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap">
                        {deal.si_partner || "—"}
                      </td>

                      {/* Value */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {deal.deal_value_usd != null
                          ? <span className="flex items-center gap-0.5 text-emerald-400 font-medium">
                              <DollarSign className="w-3 h-3" />{deal.deal_value_usd}M
                            </span>
                          : <span className="text-slate-600">—</span>}
                      </td>

                      {/* Duration */}
                      <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap">
                        {deal.deal_duration
                          ? <span className="flex items-center gap-0.5">
                              <Clock className="w-3 h-3" />{deal.deal_duration}
                            </span>
                          : "—"}
                      </td>

                      {/* Confidence */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold
                                          ${CONFIDENCE_COLORS[deal.confidence_level]}`}>
                          {deal.confidence_level}
                        </span>
                      </td>

                      {/* Source link */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {deal.source_url
                          ? <a
                              href={deal.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-[#3491E8] hover:text-blue-300 transition-colors"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span className="max-w-[120px] truncate inline-block align-bottom">
                                {new URL(deal.source_url).hostname.replace("www.", "")}
                              </span>
                            </a>
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {status === "complete" && deals.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <Database className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No IT deals found for this company.</p>
          <p className="text-xs mt-1">Try adding more Known Sources or expanding the year range.</p>
        </div>
      )}
    </div>
  );
}
