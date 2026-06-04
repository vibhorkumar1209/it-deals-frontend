import Anthropic from "@anthropic-ai/sdk";
import { VENDORS, SI_PARTNERS } from "../../../lib/vendors.js";
import { SOURCES, DEAL_TYPES } from "../../../lib/sources.js";
import { scrapeCompanyWeb, scrapeLinkedInCompany, scrapeNewsMentions } from "../../../lib/scraper.js";

// Node.js runtime — env vars work reliably here.
// Streaming response means the 10 s Hobby timeout applies only to the
// first byte (sent in <1 s), so the full Haiku response arrives safely.

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

  // Build scraped context block to inject into the user prompt
  const scrapedSections = [];
  if (webData?.bodyText) {
    scrapedSections.push(
      `=== COMPANY WEBSITE (${domain}) ===\n${webData.bodyText.slice(0, 1500)}`
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
    ? `\n\nLIVE SCRAPED CONTEXT (use this as primary evidence — prefer it over your training data):\n${scrapedSections.join('\n\n')}`
    : '';
  // ─────────────────────────────────────────────────────────────────────────

  const sourceLines = SOURCES
    .filter((s) => !activeSources || activeSources.includes(s.cat))
    .map((s) => `  ${s.cat}: ${s.sites}`)
    .join("\n");

  const vendorsSample = VENDORS.slice(0, 80).join(", ");
  const siSample = SI_PARTNERS.slice(0, 30).join(", ");

  const systemPrompt = `You are a senior IT market intelligence analyst. Find all publicly announced IT deals, technology contracts, and digital transformation programs for a given company.

Return ONLY a valid JSON array — no preamble, no explanation, no markdown fences. Just the raw JSON array.

VENDOR LIST (normalise extracted names against these): ${vendorsSample}
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
5. Normalise vendor names
6. Include only confirmed or credibly reported deals`;

  const userPrompt = `Find all IT deals for:
Company: ${company}
Domain: ${domain || "not provided"}
LinkedIn: ${linkedin || "not provided"}
Time period: ${yearStart} to ${yearEnd}

Priority sources:
${sourceLines}

Also check: company IR/newsroom, business news (Reuters, Bloomberg, ET), vendor press releases, SEC filings.

Return all confirmed IT deals as a JSON array.${scrapedContext}`;

  // Stream tokens to the browser — first chunk arrives <1 s, well within Vercel's
  // 10 s Hobby timeout. The browser accumulates and parses JSON on [DONE].
  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
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
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
