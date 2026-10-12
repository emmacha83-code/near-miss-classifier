import { HttpError } from "./api";
import { TimeoutError, fetchWithTimeout } from "./http";
import type { NewsItem } from "./types";

const MAX_ITEMS = 20;

function clean(s: string): string {
  return s
    .replace(/<[^>]*>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

type NaverItem = {
  title?: string;
  originallink?: string;
  link?: string;
  description?: string;
};

async function searchNaver(
  query: string,
  display: number,
  id: string,
  secret: string,
): Promise<NewsItem[]> {
  const url = `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(
    query,
  )}&display=${display}&sort=date`;
  let res: Response;
  try {
    res = await fetchWithTimeout(
      url,
      { headers: { "X-Naver-Client-Id": id, "X-Naver-Client-Secret": secret } },
      15_000,
    );
  } catch (e) {
    throw new HttpError(
      e instanceof TimeoutError
        ? "네이버 검색이 15초 안에 답하지 않았어요. 잠시 후 다시 시도해 주세요."
        : "네이버 검색에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요.",
      502,
    );
  }
  if (!res.ok) {
    throw new HttpError(
      res.status === 401 || res.status === 403
        ? "네이버 검색 API 키가 올바르지 않습니다. .env의 NAVER_CLIENT_ID, NAVER_CLIENT_SECRET을 확인해 주세요."
        : "뉴스를 검색하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      502,
    );
  }
  const data = (await res.json()) as { items?: NaverItem[] };
  return (data.items ?? [])
    .map((it) => ({
      title: clean(it.title ?? ""),
      summary: clean(it.description ?? ""),
      link: (it.originallink || it.link || "").trim(),
    }))
    .filter((it) => it.title && it.link.startsWith("http"));
}

const xmlText = (s: string) =>
  clean(s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1"));

function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? m[1] : "";
}

// 구글 뉴스 검색(RSS): 키가 필요 없습니다. 제목과 링크, 언론사만 오고 요약은 거의 없습니다.
async function searchGoogle(query: string, limit: number): Promise<NewsItem[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(
    query,
  )}&hl=ko&gl=KR&ceid=KR:ko`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new HttpError("구글 뉴스에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요.", 502);
  }
  if (!res.ok) {
    throw new HttpError("구글 뉴스를 검색하지 못했습니다. 잠시 후 다시 시도해 주세요.", 502);
  }
  const xml = await res.text();
  const out: NewsItem[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const title = xmlText(tag(m[1], "title"));
    const link = xmlText(tag(m[1], "link"));
    const press = xmlText(tag(m[1], "source"));
    if (!title || !link.startsWith("http")) continue;
    out.push({ title, summary: press ? `언론사: ${press}` : "", link });
    if (out.length >= limit) break;
  }
  return out;
}

export type NewsSource = "naver" | "google";

export async function searchNews(
  keywords: string[],
): Promise<{ items: NewsItem[]; source: NewsSource; skippedKeywords: string[] }> {
  // 네이버 키가 .env에 있으면 네이버(제목+요약)를, 없으면 구글 뉴스를 씁니다.
  const id = process.env.NAVER_CLIENT_ID;
  const secret = process.env.NAVER_CLIENT_SECRET;
  const source: NewsSource = id && secret ? "naver" : "google";

  const display = Math.min(MAX_ITEMS, Math.max(10, Math.ceil(MAX_ITEMS / keywords.length)));
  // 고른 검색어 중 일부만 검색에 실패해도 나머지 검색어의 결과는 살립니다. 전부 실패하면 첫 오류를 그대로 알립니다.
  const settled = await Promise.allSettled(
    keywords.map((k) =>
      id && secret ? searchNaver(k, display, id, secret) : searchGoogle(k, display),
    ),
  );
  const firstError = settled.find((s) => s.status === "rejected");
  if (firstError && firstError.status === "rejected" && settled.every((s) => s.status === "rejected")) {
    throw firstError.reason;
  }
  const lists = settled.flatMap((s) => (s.status === "fulfilled" ? [s.value] : []));
  const skippedKeywords = keywords.filter((_, i) => settled[i].status === "rejected");

  // 키워드마다 번갈아 가져오고, 같은 링크는 한 번만 담습니다.
  const seen = new Set<string>();
  const items: NewsItem[] = [];
  for (let i = 0; items.length < MAX_ITEMS; i++) {
    let any = false;
    for (const list of lists) {
      const it = list[i];
      if (!it) continue;
      any = true;
      if (seen.has(it.link)) continue;
      seen.add(it.link);
      items.push(it);
      if (items.length >= MAX_ITEMS) break;
    }
    if (!any) break;
  }
  return { items, source, skippedKeywords };
}
