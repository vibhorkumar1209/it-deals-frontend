"use client";

import { Deal, SSEEvent } from "@/lib/types";
import DealCard from "./DealCard";
import {
  Loader2, CheckCircle2, AlertCircle, Download,
  TrendingUp, Database, AlertTriangle
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

export default function ResultsStream({
  deals, status, progress, totalSoFar, summary, onDownloadJSON, onDownloadCSV
}: Props) {
  if (status === "idle") return null;

  return (
    <div className="space-y-4">
      {/* Status bar */}
      <div className="flex items-center gap-3 p-4 rounded-xl border border-[#1a3a50] bg-[#0c1f2e]">
        {status === "running" && (
          <Loader2 className="w-4 h-4 text-[#3491E8] animate-spin shrink-0" />
        )}
        {status === "complete" && (
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
        )}
        {status === "error" && (
          <AlertCircle className="w-4 h-4 text-[#E63946] shrink-0" />
        )}
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

      {/* Summary stats (on complete) */}
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
            const colors = {
              High: "text-emerald-400",
              Medium: "text-yellow-400",
              Low: "text-red-400",
            };
            return count > 0 ? (
              <span key={level} className={`${colors[level]}`}>
                {count} {level}
              </span>
            ) : null;
          })}
        </div>
      )}

      {/* Deal cards grid */}
      {deals.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {deals.map((deal, i) => (
            <DealCard key={`${deal.source_url}-${i}`} deal={deal} index={i} />
          ))}
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
