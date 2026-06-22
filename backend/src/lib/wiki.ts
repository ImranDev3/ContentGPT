// Wikipedia REST client. Used by the chat route to inject public-domain
// context when the copyright-free toggle is enabled.
//
// Endpoints used (both free, no key):
//   - https://en.wikipedia.org/api/rest_v1/page/summary/{title} → short extract
//   - https://en.wikipedia.org/w/api.php?action=opensearch&search=… → title suggestions
//   - https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=… → search results

const SUMMARY_BASE = 'https://en.wikipedia.org/api/rest_v1/page/summary';
const OPENSEARCH = 'https://en.wikipedia.org/w/api.php';
const UA = 'ContentGPT/0.1 (https://github.com/ImranDev3/ContentGPT)';

export interface WikiSummary {
  title: string;
  extract: string;
  url: string;
}

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with',
  'is', 'are', 'be', 'this', 'that', 'it', 'as', 'by', 'at', 'from',
  'how', 'what', 'why', 'when', 'where', 'who', 'tell', 'me', 'about',
  'can', 'you', 'i', 'we', 'they', 'he', 'she', 'write', 'explain',
  'describe', 'give', 'show', 'make', 'do',
]);

// Extract up to N candidate search terms (capitalised or distinctive words)
// from a freeform user prompt. The first sentence is weighted more heavily.
export function extractSearchTerms(prompt: string, max = 3): string[] {
  const first = prompt.split(/[.!?\n]/)[0] ?? prompt;
  const text = `${first} ${prompt}`;
  const candidates = new Map<string, number>();

  for (const raw of text.split(/[^A-Za-z0-9\s-]+/)) {
    const word = raw.trim();
    if (!word || word.length < 3) continue;
    if (STOPWORDS.has(word.toLowerCase())) continue;
    const score = (candidates.get(word) ?? 0) + 1;
    candidates.set(word, score);
  }

  return [...candidates.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, max)
    .map(([w]) => w);
}

async function fetchSummary(title: string): Promise<WikiSummary | null> {
  try {
    const url = `${SUMMARY_BASE}/${encodeURIComponent(title.replace(/ /g, '_'))}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      title?: string;
      extract?: string;
      content_urls?: { desktop?: { page?: string } };
    };
    if (!json.extract || !json.title) return null;
    return {
      title: json.title,
      extract: json.extract,
      url: json.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
    };
  } catch {
    return null;
  }
}

async function opensearch(query: string, limit = 3): Promise<string[]> {
  try {
    const url = `${OPENSEARCH}?action=opensearch&format=json&limit=${limit}&search=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (!res.ok) return [];
    const json = (await res.json()) as unknown[];
    if (!Array.isArray(json) || !Array.isArray(json[1])) return [];
    return json[1] as string[];
  } catch {
    return [];
  }
}

// Resolve a prompt to up to `limit` Wikipedia summaries, fetched in parallel.
// Order: try each extracted term as a direct title; on miss, opensearch for it.
export async function getWikiContext(prompt: string, limit = 3): Promise<WikiSummary[]> {
  const terms = extractSearchTerms(prompt, limit);
  if (terms.length === 0) return [];

  const direct = await Promise.all(terms.map((t) => fetchSummary(t)));
  const directHits = direct.filter((s): s is WikiSummary => s !== null);

  if (directHits.length >= limit) {
    return directHits.slice(0, limit);
  }

  // Backfill: opensearch the first term we missed, then summarise the top result.
  for (let i = 0; i < terms.length && directHits.length < limit; i++) {
    if (direct[i] !== null) continue;
    const suggestions = await opensearch(terms[i]!, 1);
    const next = suggestions[0];
    if (!next) continue;
    const summary = await fetchSummary(next);
    if (summary) directHits.push(summary);
  }

  return directHits.slice(0, limit);
}
