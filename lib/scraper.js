const BASE = process.env.SCRAPER_API_URL;
const KEY  = process.env.SCRAPER_API_KEY ?? '';

async function scrapeGet(path) {
  if (!BASE) return null;
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: KEY ? { 'x-api-key': KEY } : {},
      signal: AbortSignal.timeout(20_000),
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

// Scrape up to maxPages news search result pages for the company
export async function scrapeNewsMentions(company, domain, sources) {
  if (!company) return [];
  const results = [];

  // Build search URLs for top sources
  const topSites = sources.flatMap(s =>
    s.sites.split(',').map(x => x.trim()).slice(0, 1)
  ).slice(0, 5);

  for (const site of topSites) {
    const searchUrl = `https://www.google.com/search?q=site:${site}+${encodeURIComponent(`"${company}" IT deal OR contract OR partnership`)}`;
    const data = await scrapeGet(`/scrape/web?url=${encodeURIComponent(searchUrl)}`);
    if (data?.bodyText) results.push({ site, text: data.bodyText.slice(0, 800) });
  }

  return results;
}
