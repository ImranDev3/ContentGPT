// Web search for copyright-free context.
//
// Default provider: DuckDuckGo Instant Answer API (free, no API key).
// Optional upgrade: Google Programmable Search (CSE) when GOOGLE_API_KEY
// and GOOGLE_CSE_ID are set in env.

import { env } from './env.js';

export interface WebSnippet {
  title: string;
  url: string;
  snippet: string;
}

const UA = 'ContentGPT/0.1 (https://github.com/ImranDev3/ContentGPT)';

interface DDGResponse {
  AbstractText?: string;
  AbstractURL?: string;
  Heading?: string;
  RelatedTopics?: Array<
    | { Text?: string; FirstURL?: string; Topics?: DDGTopic[] }
    | string
  >;
}
interface DDGTopic {
  Text?: string;
  FirstURL?: string;
  Topics?: DDGTopic[];
}

async function ddgSearch(query: string, limit: number): Promise<WebSnippet[]> {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1&t=contentgpt_${Date.now()}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as DDGResponse;
    const out: WebSnippet[] = [];

    if (json.AbstractText && json.AbstractURL) {
      out.push({
        title: json.Heading ?? query,
        url: json.AbstractURL,
        snippet: json.AbstractText,
      });
    }

    const walk = (t: DDGTopic) => {
      if (out.length >= limit) return;
      if (t.Text && t.FirstURL) {
        const sep = t.Text.indexOf(' - ');
        const title = sep > 0 ? t.Text.slice(0, sep) : t.Text.slice(0, 80);
        const snippet = sep > 0 ? t.Text.slice(sep + 3) : t.Text;
        out.push({ title, url: t.FirstURL, snippet });
      }
      if (t.Topics) for (const child of t.Topics) walk(child);
    };
    if (Array.isArray(json.RelatedTopics)) {
      for (const t of json.RelatedTopics) {
        if (typeof t === 'string') continue;
        if (out.length >= limit) break;
        walk(t);
        if (t.Topics) for (const c of t.Topics) walk(c);
      }
    }
    return out.slice(0, limit);
  } catch {
    return [];
  }
}

async function googleSearch(query: string, limit: number): Promise<WebSnippet[]> {
  const key = env.GOOGLE_API_KEY;
  const cx = env.GOOGLE_CSE_ID;
  if (!key || !cx) return [];
  try {
    const url = `https://www.googleapis.com/customsearch/v1?key=${key}&cx=${cx}&q=${encodeURIComponent(query)}&num=${limit}&safe=active`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = (await res.json()) as { items?: Array<{ title?: string; link?: string; snippet?: string }> };
    return (json.items ?? []).map((it) => ({
      title: it.title ?? '',
      url: it.link ?? '',
      snippet: it.snippet ?? '',
    }));
  } catch {
    return [];
  }
}

export async function getWebSearch(query: string, limit = 3): Promise<WebSnippet[]> {
  // Prefer Google when configured; otherwise fall back to DDG.
  const google = await googleSearch(query, limit);
  if (google.length > 0) return google;
  return ddgSearch(query, limit);
}
