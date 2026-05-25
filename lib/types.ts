export type RecordType =
  | "contract" | "partnership" | "implementation"
  | "vendor_selection" | "initiative" | "technology_announcement";

export interface Deal {
  // Core fields — always populated where possible
  company_name: string;
  vendor: string;
  deal_description: string;
  announcement_date: string;

  // Secondary fields — filled when available
  deal_title: string;
  record_type: RecordType;
  vendor_category: string;
  si_partner: string | null;
  scope_of_service: string;
  deal_value_usd: number | null;
  deal_duration: string | null;
  source_url: string;
  all_source_urls: string[];
  source_type: string;
  confidence_level: "High" | "Medium" | "Low";
  summary: string;
}

export interface SSEEvent {
  type: "progress" | "batch" | "complete" | "error" | "heartbeat" | "enriched";
  message?: string;
  deals?: Deal[];
  total_so_far?: number;
  total?: number;
  failures?: number;
  urls_attempted?: number;
  summary?: Record<string, unknown>;
}

export interface ScrapeRequest {
  company_name: string;
  company_aliases: string[];
  domain: string;
  secondary_domains: string[];
  linkedin_url: string;
  stock_ticker: string | null;
  exchange: string | null;
  industry_sector: string;
  hq_country: string;
  hq_city: string;
  search_year_range: { start: number; end: number };
  known_sources: string[];
  focus_deal_types: string[];
  min_deal_value_usd_million: number | null;
  run_linkedin: boolean;
  batch_size: number;
}
