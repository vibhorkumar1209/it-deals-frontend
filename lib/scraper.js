const BASE = process.env.SCRAPER_API_URL;
const KEY  = process.env.SCRAPER_API_KEY ?? '';

async function scrapeGet(path) {
  if (!BASE) return null;
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: KEY ? { 'x-api-key': KEY } : {},
      signal: AbortSignal.timeout(90_000),  // Vercel Pro: 90s per scrape call
    });
    const json = await res.json();
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

export async function scrapeCompanyWeb(domain) {
  if (!domain) return null;
  const url = domain.startsWith('http') ? domain : `https://${domain}`;
  return scrapeGet(`/scrape/web?url=${encodeURIComponent(url)}`);
}

export async function scrapeLinkedInCompany(linkedinUrl) {
  if (!linkedinUrl || !linkedinUrl.includes('linkedin.com/company/')) return null;
  return scrapeGet(`/scrape/linkedin/company?url=${encodeURIComponent(linkedinUrl)}`);
}

// Scrape news mentions in parallel — Vercel Pro allows full parallel fetches
export async function scrapeNewsMentions(company, domain, sources) {
  if (!company) return [];

  // Up to 10 sites, 2 per source category — broader coverage vs Hobby (5 sequential)
  const topSites = sources.flatMap(s =>
    s.sites.split(',').map(x => x.trim()).slice(0, 2)
  ).slice(0, 20);

  const queries = topSites.map(site => ({
    site,
    url: `https://www.google.com/search?q=site:${site}+${encodeURIComponent(`"${company}" IT deal OR contract OR technology OR digital transformation`)}`,
  }));

  // Run all scrapes in parallel
  const results = await Promise.allSettled(
    queries.map(async ({ site, url }) => {
      const data = await scrapeGet(`/scrape/web?url=${encodeURIComponent(url)}`);
      if (data?.bodyText) return { site, text: data.bodyText.slice(0, 1200) };
      return null;
    })
  );

  return results
    .filter(r => r.status === 'fulfilled' && r.value !== null)
    .map(r => r.value);
}
