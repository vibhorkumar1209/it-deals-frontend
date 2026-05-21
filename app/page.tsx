"use client";

import { useState, useCallback } from "react";
import { Deal, ScrapeRequest, SSEEvent } from "@/lib/types";
import SearchForm from "@/components/SearchForm";
import ResultsStream from "@/components/ResultsStream";
import { Radar } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4001";

type Status = "idle" | "running" | "complete" | "error";

function downloadJSON(deals: Deal[], company: string) {
  const blob = new Blob([JSON.stringify(deals, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `it-deals-${company.replace(/\s+/g, "-").toLowerCase()}.json`;
  a.click();
}

function downloadCSV(deals: Deal[], company: string) {
  if (!deals.length) return;
  const fields = Object.keys(deals[0]) as (keyof Deal)[];
  const rows = [
    fields.join(","),
    ...deals.map(d =>
      fields.map(f => {
        const v = d[f];
        const s = Array.isArray(v) ? v.join("; ") : String(v ?? "");
        return `"${s.replace(/"/g, '""')}"`;
      }).join(",")
    ),
  ];
  const blob = new Blob(["﻿" + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `it-deals-${company.replace(/\s+/g, "-").toLowerCase()}.csv`;
  a.click();
}

export default function HomePage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState("");
  const [totalSoFar, setTotalSoFar] = useState(0);
  const [summary, setSummary] = useState<SSEEvent["summary"]>();
  const [company, setCompany] = useState("");
  const [lastReq, setLastReq] = useState<ScrapeRequest | null>(null);
  const [cachedUrlCount, setCachedUrlCount] = useState<number | null>(null);

  const _streamSSE = useCallback(async (url: string, body: object) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok || !res.body) {
      throw new Error(`API error: ${res.status} ${res.statusText}`);
    }

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
        try {
          const event: SSEEvent = JSON.parse(line.slice(6));
          if (event.type === "progress" || event.type === "heartbeat") {
            setProgress(event.message ?? "");
          } else if (event.type === "batch") {
            setDeals(prev => [...prev, ...(event.deals ?? [])]);
            setTotalSoFar(event.total_so_far ?? 0);
            setProgress(`Extracting deals... ${event.total_so_far} found`);
          } else if (event.type === "complete") {
            setStatus("complete");
            setSummary(event.summary);
            setProgress(
              event.total === 0
                ? "Scan complete — no IT deals found."
                : `Scan complete — ${event.total} deal${event.total !== 1 ? "s" : ""} extracted.`
            );
            // Check if we now have a cache
            fetch(`${API_URL}/api/cached-urls/${encodeURIComponent(company || "")}`)
              .then(r => r.ok ? r.json() : null)
              .then(d => d && setCachedUrlCount(d.url_count))
              .catch(() => {});
          } else if (event.type === "error") {
            setStatus("error");
            setProgress(`Error: ${event.message}`);
          }
        } catch { /* malformed line */ }
      }
    }
  }, [company]);

  const handleSubmit = useCallback(async (req: ScrapeRequest) => {
    setDeals([]);
    setStatus("running");
    setProgress("Connecting to intelligence engine...");
    setTotalSoFar(0);
    setSummary(undefined);
    setCompany(req.company_name);
    setLastReq(req);
    setCachedUrlCount(null);

    try {
      await _streamSSE(`${API_URL}/api/scrape`, req);
      if (status === "running") setStatus("complete");
    } catch (err) {
      setStatus("error");
      setProgress(`Connection failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [status, _streamSSE]);

  const handleReExtract = useCallback(async () => {
    if (!lastReq) return;
    setDeals([]);
    setStatus("running");
    setProgress("Re-extracting from cached URLs...");
    setTotalSoFar(0);
    setSummary(undefined);
    setCachedUrlCount(null);
    try {
      await _streamSSE(`${API_URL}/api/extract`, {
        company_name: lastReq.company_name,
        company_aliases: lastReq.company_aliases,
        domain: lastReq.domain,
        focus_deal_types: lastReq.focus_deal_types,
        min_deal_value_usd_million: lastReq.min_deal_value_usd_million,
        batch_size: lastReq.batch_size,
        urls: [], // empty = use cache
      });
      if (status === "running") setStatus("complete");
    } catch (err) {
      setStatus("error");
      setProgress(`Re-extract failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [lastReq, status, _streamSSE]);

  return (
    <div className="min-h-screen bg-[#080f16]">
      {/* Header */}
      <header className="border-b border-[#1a3a50] bg-[#080f16]/90 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#3491E8]/20 flex items-center justify-center">
            <Radar className="w-4 h-4 text-[#3491E8]" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight">IT Deals Intelligence</h1>
            <p className="text-[11px] text-slate-500">ERP · CRM · Cloud · Cyber · Outsourcing</p>
          </div>
          <div className="ml-auto">
            <span className="text-[11px] px-2 py-1 rounded-full bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">
              Live
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Hero */}
        {status === "idle" && (
          <div className="text-center py-6 space-y-2">
            <h2 className="text-3xl font-bold text-white">
              Find every IT deal for any company
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto text-sm">
              Enter a company name and domain. The engine scrapes press releases, SEC filings,
              news aggregators, and LinkedIn to surface all technology contracts — ERP, cloud,
              cyber, outsourcing and more — over the last 5 years.
            </p>
          </div>
        )}

        {/* Search form */}
        <div className="rounded-2xl border border-[#1a3a50] bg-[#0c1f2e] p-6">
          {status !== "idle" && (
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white">
                {company} — IT Deal Scan
              </h2>
              {status !== "running" && (
                <div className="flex items-center gap-3">
                  {cachedUrlCount !== null && status === "complete" && (
                    <button
                      onClick={handleReExtract}
                      className="text-xs px-3 py-1 rounded-full bg-[#3491E8]/20 text-[#3491E8]
                                 border border-[#3491E8]/30 hover:bg-[#3491E8]/30 transition-colors"
                    >
                      ⚡ Re-extract ({cachedUrlCount} cached URLs)
                    </button>
                  )}
                  <button
                    onClick={() => { setStatus("idle"); setDeals([]); setCachedUrlCount(null); }}
                    className="text-xs text-slate-400 hover:text-white transition-colors"
                  >
                    New search
                  </button>
                </div>
              )}
            </div>
          )}
          {status !== "running" && (
            <SearchForm onSubmit={handleSubmit} loading={false} />
          )}
          {status === "running" && (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <div className="w-2 h-2 rounded-full bg-[#3491E8] animate-pulse" />
              Scan in progress — results appear below as found
            </div>
          )}
        </div>

        {/* Results */}
        <ResultsStream
          deals={deals}
          status={status}
          progress={progress}
          totalSoFar={totalSoFar}
          summary={summary}
          onDownloadJSON={() => downloadJSON(deals, company)}
          onDownloadCSV={() => downloadCSV(deals, company)}
        />
      </main>

      <footer className="border-t border-[#1a3a50] mt-16 py-6 text-center text-xs text-slate-600">
        IT Deals Intelligence · RefractOne Market Intelligence Practice
      </footer>
    </div>
  );
}
