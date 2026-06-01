import Anthropic from "@anthropic-ai/sdk";
import { VENDORS, SI_PARTNERS } from "../../../lib/vendors.js";
import { SOURCES, DEAL_TYPES } from "../../../lib/sources.js";

export const runtime = "edge";          // 30s limit vs 10s for Node.js serverless
export const maxDuration = 30;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request) {
  try {
    const body = await request.json();
    const { company, domain, linkedin, yearStart, yearEnd, activeSources } = body;

    if (!company) {
      return Response.json({ error: "Company name is required" }, { status: 400 });
    }

    const sourceLines = SOURCES
      .filter((s) => !activeSources || activeSources.includes(s.cat))
      .map((s) => `  ${s.cat}: ${s.sites}`)
      .join("\n");

    const vendorsSample = VENDORS.slice(0, 80).join(", ");
    const siSample = SI_PARTNERS.slice(0, 30).join(", ");

    const systemPrompt = `You are a senior IT market intelligence analyst. Find all publicly announced IT deals, technology contracts, and digital transformation programs for a given company.

Return ONLY a valid JSON array — no preamble, no explanation, no markdown fences. Just the raw JSON array.

VENDOR LIST (normalise extracted names against these):
${vendorsSample}

SI PARTNER LIST: ${siSample}

DEAL TYPE CATEGORIES: ${DEAL_TYPES.join(", ")}

CONFIDENCE RULES:
- High: deal value explicitly stated AND date confirmed AND vendor named AND primary source
- Medium: vendor + date confirmed; value missing; secondary source
- Low: inferred from context; not formally announced

OUTPUT SCHEMA — return an array with EXACTLY these fields:
[{
  "customer": "exact company name",
  "vendor": "normalised vendor name",
  "deal_description": "1–2 sentence factual description",
  "date": "YYYY-MM or YYYY if month unknown",
  "type": "one of the DEAL_TYPES above",
  "si_partner": "SI partner name or null",
  "value": "$XM or $XB or null — NEVER fabricate",
  "duration": "e.g. 3 years / through 2027 / null",
  "confidence": "High | Medium | Low",
  "source": "direct article URL if available, else publication name"
}]

RULES:
1. Return ONLY valid JSON array — nothing else
2. Never fabricate deal values — use null if unknown
3. Include 8–20 deals covering the full requested time period
4. Most recent deals first
5. Normalise vendor names (e.g. Salesforce.com → Salesforce)
6. Include only confirmed or credibly reported deals`;

    const userPrompt = `Find all IT deals for:

Company: ${company}
Domain: ${domain || "not provided"}
LinkedIn: ${linkedin || "not provided"}
Time period: ${yearStart} to ${yearEnd}

Priority sources:
${sourceLines}

Also check: company IR/newsroom, business news (Reuters, Bloomberg, ET), vendor press releases, SEC filings, LinkedIn announcements.

Return all confirmed IT deals as a JSON array.`;

    // Stream from Anthropic and collect full text — avoids Vercel's 10s non-streaming timeout
    let fullText = "";
    const stream = client.messages.stream({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta?.type === "text_delta"
      ) {
        fullText += event.delta.text;
      }
    }

    let raw = fullText.trim();
    raw = raw.replace(/^```json\s*/m, "").replace(/^```\s*/m, "").replace(/\s*```$/m, "");
    const start = raw.indexOf("[");
    const end = raw.lastIndexOf("]");
    if (start === -1 || end === -1) throw new Error("No JSON array in response");
    raw = raw.slice(start, end + 1);

    const deals = JSON.parse(raw);
    if (!Array.isArray(deals)) throw new Error("Response is not an array");

    return Response.json({ deals });
  } catch (err) {
    console.error("Search API error:", err);
    return Response.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
