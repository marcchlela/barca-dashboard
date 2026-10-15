type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : null;
}

function stringValue(value: JsonObject | null, ...keys: string[]) {
  for (const key of keys) {
    const candidate = value?.[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    if (typeof candidate === "number" && Number.isFinite(candidate)) return String(candidate);
  }
  return null;
}

function plain(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, " ").trim();
}

function teamTokens(name: string) {
  const ignored = new Set(["fc", "cf", "club", "sk", "de", "futbol", "football", "real"]);
  return plain(name).split(" ").filter((token) => token.length >= 3 && !ignored.has(token));
}

export type BeinHighlightCandidate = {
  externalId: string;
  title: string;
  url: string;
  thumbnailUrl: string | null;
  publishedAt: string | null;
};

export const BEIN_YOUTUBE_CHANNEL_ID = "UCJUCcJUeh0Cz2xyKwkw5Q1w";

export function normalizeBeinYoutubeHighlight(value: unknown): BeinHighlightCandidate | null {
  const row = asObject(value);
  const id = asObject(row?.id);
  const snippet = asObject(row?.snippet);
  const videoId = stringValue(id, "videoId") ?? stringValue(row, "videoId", "id");
  const title = stringValue(snippet, "title") ?? stringValue(row, "title");
  const channelId = stringValue(snippet, "channelId") ?? stringValue(row, "channelId");
  if (!videoId || !title || channelId !== BEIN_YOUTUBE_CHANNEL_ID) return null;
  if (!/(highlight|highlights|summary|ملخص)/i.test(title) || !/(barcelona|barca|برشلونة)/i.test(title)) return null;
  const thumbnails = asObject(snippet?.thumbnails);
  const high = asObject(thumbnails?.high) ?? asObject(thumbnails?.medium) ?? asObject(thumbnails?.default);
  const publishedAt = stringValue(snippet, "publishedAt") ?? stringValue(row, "publishedAt");
  return {
    externalId: videoId,
    title,
    url: `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
    thumbnailUrl: stringValue(high, "url"),
    publishedAt: publishedAt && Number.isFinite(Date.parse(publishedAt)) ? new Date(publishedAt).toISOString() : null,
  };
}

export function normalizeBeinHighlight(value: unknown, fixture: { home: string; away: string }): BeinHighlightCandidate | null {
  const row = asObject(value);
  if (!row) return null;
  const title = stringValue(row, "title", "name", "headline");
  const urlValue = stringValue(row, "url", "videoUrl", "embedUrl", "link");
  if (!title || !urlValue) return null;
  let url: URL;
  try { url = new URL(urlValue); } catch { return null; }
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (url.protocol !== "https:" || host !== "beinsports.com" || !url.pathname.toLowerCase().startsWith("/ar-mena/")) return null;
  const normalizedTitle = plain(title);
  if (!/(highlight|highlights|summary|ملخص)/i.test(title)) return null;
  const barca = /barcelona|barca|برشلونة/.test(normalizedTitle);
  // The endpoint is already scoped to the independently validated provider
  // fixture. Arabic titles cannot be reliably compared to an English team
  // name, so the exact fixture mapping supplies the opponent check there.
  const opponent = /[\u0600-\u06ff]/.test(title) || teamTokens(fixture.home === "FC Barcelona" ? fixture.away : fixture.home).some((token) => normalizedTitle.includes(token));
  if (!barca || !opponent) return null;
  const publishedAt = stringValue(row, "publishedAt", "published_at", "createdAt", "created_at");
  return {
    externalId: stringValue(row, "id", "videoId", "externalId") ?? url.toString(),
    title,
    url: url.toString(),
    thumbnailUrl: stringValue(row, "thumbnailUrl", "thumbnail", "imageUrl", "image"),
    publishedAt: publishedAt && Number.isFinite(Date.parse(publishedAt)) ? new Date(publishedAt).toISOString() : null,
  };
}
