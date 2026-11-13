"use client";
// Report History opens a saved report inside its own module page, the way
// AI Insights does: the reports page stashes the entry, sends the user to
// /enrich, and the module picks it up on mount.
import { useEffect } from "react";

const KEY = "pending_report_restore";

// Report History module key → enrich tab (and Deal Finder sub-tab).
export const RESTORE_TABS = {
  it_deal_finder: { tab: "deals", sub: "company" },
  it_deals_by_industry: { tab: "deals", sub: "industry" },
  tech_stack_finder: { tab: "techstack" },
  gcc_intelligence: { tab: "gcc" },
  aftermarket_intelligence: { tab: "aftermarket" },
  signal_intelligence: { tab: "signals" },
  compkill: { tab: "competitive" },
  intent_map: { tab: "intent" },
};

export function setPendingRestore(module, entry) {
  try { sessionStorage.setItem(KEY, JSON.stringify({ module, entry })); return true; } catch { return false; }
}

export function peekPendingRestore() {
  try { return JSON.parse(sessionStorage.getItem(KEY) || "null"); } catch { return null; }
}

// Runs apply(entry) once, if the pending report belongs to this module.
export function useRestore(module, apply) {
  useEffect(() => {
    const p = peekPendingRestore();
    if (!p || p.module !== module) return;
    try { sessionStorage.removeItem(KEY); } catch {}
    apply(p.entry);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
