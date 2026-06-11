import Anthropic from "@anthropic-ai/sdk";
import { VENDORS, SI_PARTNERS } from "../../../lib/vendors.js";
import { SOURCES, DEAL_TYPES } from "../../../lib/sources.js";
import { scrapeCompanyWeb, scrapeLinkedInCompany, scrapeNewsMentions } from "../../../lib/scraper.js";

// Vercel Pro: 300s function timeout, no streaming workarounds needed
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY is not configured on the server." },
      { status: 500 }
    );
  }

  const body = await request.json();
  const { company, domain, linkedin, yearStart, yearEnd, activeSources } = body;

  if (!company) {
    return Response.json({ error: "Company name is required" }, { status: 400 });
  }

  const client = new Anthropic({ apiKey });

  // ── Scrape live context in parallel ──────────────────────────────────────
  const filteredSources = SOURCES.filter(
    (s) => !activeSources || activeSources.includes(s.cat)
  );
  const [webData, linkedinData, newsMentions] = await Promise.all([
    scrapeCompanyWeb(domain),
    scrapeLinkedInCompany(linkedin),
    scrapeNewsMentions(company, domain, filteredSources),
  ]);

  const scrapedSections = [];
  if (webData?.bodyText) {
    scrapedSections.push(
      `=== COMPANY WEBSITE (${domain}) ===\n${webData.bodyText.slice(0, 3000)}`
    );
  }
  if (linkedinData?.about) {
    scrapedSections.push(
      `=== LINKEDIN COMPANY PAGE ===\nName: ${linkedinData.name}\nAbout: ${linkedinData.about}\nIndustry: ${linkedinData.industry}`
    );
  }
  if (newsMentions.length > 0) {
    const newsBlock = newsMentions
      .map((n) => `[${n.site}]: ${n.text}`)
      .join('\n\n');
    scrapedSections.push(`=== NEWS MENTIONS (live scraped) ===\n${newsBlock}`);
  }
  const scrapedContext = scrapedSections.length > 0
    ? `\n\nLIVE SCRAPED CONTEXT (use this as primary evidence — prefer over training data):\n${scrapedSections.join('\n\n')}`
    : '';
  // ─────────────────────────────────────────────────────────────────────────

  const sourceLines = SOURCES
    .filter((s) => !activeSources || activeSources.includes(s.cat))
    .map((s) => `  ${s.cat}: ${s.sites}`)
    .join("\n");

  const vendorsSample = VENDORS.slice(0, 120).join(", ");
  const siSample = SI_PARTNERS.slice(0, 50).join(", ");

  const systemPrompt = `You are a senior IT market intelligence analyst specialising in enterprise technology deals. Find all publicly announced IT deals, technology contracts, and digital transformation programs for the given company.

Return ONLY a valid JSON array — no preamble, no explanation, no markdown fences.

VENDOR LIST (normalise extracted names against these): ${vendorsSample}
SI PARTNER LIST: ${siSample}
DEAL TYPE CATEGORIES: ${DEAL_TYPES.join(", ")}

CONFIDENCE RULES:
- High: deal value explicitly stated AND date confirmed AND vendor named AND sourced from primary press release or filing
- Medium: vendor + date confirmed; value missing or estimated; secondary source
- Low: inferred from context, job postings, or unconfirmed reports

OUTPUT SCHEMA — return an array with EXACTLY these fields:
[{
  "customer": "exact company name",
  "vendor": "normalised vendor name from VENDOR LIST",
  "deal_description": "2–3 sentence factual description including scope, modules, and business outcome",
  "date": "YYYY-MM or YYYY if month unknown",
  "type": "one of the DEAL_TYPES above",
  "si_partner": "SI/consulting partner name or null",
  "value": "$XM or $XB or null — NEVER fabricate",
  "duration": "e.g. 3 years / through 2027 / null",
  "confidence": "High | Medium | Low",
  "source": "direct article URL if available, else publication name"
}]

RULES:
1. Return ONLY valid JSON array — nothing else
2. Never fabricate deal values — use null if unknown
3. Include 15–30 deals covering the full requested time period — aim for comprehensive coverage
4. Most recent deals first
5. Normalise vendor names against the VENDOR LIST
6. Include only confirmed or credibly reported deals
7. Include SI/implementation partner if mentioned in the source`;

  const userPrompt = `Find ALL IT deals for:
Company: ${company}
Domain: ${domain || "not provided"}
LinkedIn: ${linkedin || "not provided"}
Time period: ${yearStart} to ${yearEnd}

Priority sources to search:
${sourceLines}

Also check:
- Company IR/newsroom and press releases
- Business/financial news: Reuters, Bloomberg, Financial Times, Economic Times
- Vendor press releases and case studies
- SEC/regulatory filings mentioning technology contracts
- LinkedIn job postings signalling new system deployments
- Industry analyst reports (Gartner, IDC, Forrester)

Return all confirmed IT deals as a comprehensive JSON array.${scrapedContext}`;

  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = client.messages.stream({
          model: "claude-sonnet-4-6",
          max_tokens: 8192,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        });

        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta?.type === "text_delta"
          ) {
            const chunk = `data: ${JSON.stringify({ text: event.delta.text })}\n\n`;
            controller.enqueue(encoder.encode(chunk));
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        const errChunk = `data: ${JSON.stringify({ error: err.message })}\n\n`;
        controller.enqueue(encoder.encode(errChunk));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store, no-cache",
      "X-Accel-Buffering": "no",
      "Connection": "keep-alive",
    },
  });
}
