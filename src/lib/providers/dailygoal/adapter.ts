/** Public JSON-LD only. No DailyGoal private endpoints or DOM class selectors. */
export type DailyGoalClip = {
  scorer: string;
  minute: number;
  addedMinute: number | null;
  kind: "goal" | "penalty_goal" | "own_goal";
  startOffset: number;
  permalink: string;
};

export type DailyGoalFixture = {
  url: string;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  date: string;
  competition: string;
};

export type DailyGoalMatch = DailyGoalFixture & {
  videoId: string;
  clips: DailyGoalClip[];
  warnings: string[];
};

const hosts = new Set(["dailygoal.tv", "www.dailygoal.tv"]);
const videoIdPattern = /^[A-Za-z0-9_-]{11}$/;
let lastRequest = 0;
let blockedUntil = 0;
const cache = new Map<string, { at: number; value: DailyGoalMatch }>();
const htmlCache = new Map<string, { at: number; value: string }>();
const listingCache = new Map<string, { at: number; value: string[] }>();
export const BARCELONA_DAILYGOAL_URL = "https://dailygoal.tv/team/13/barcelona";

export function dailyGoalUrl(input: string): URL {
  const url = new URL(input);
  if (url.protocol !== "https:" || !hosts.has(url.hostname) || !/^\/m\/[A-Za-z0-9_-]+\/[a-z0-9-]+\/?$/.test(url.pathname) || url.username || url.password || url.port) {
    throw new Error("Use an HTTPS DailyGoal match URL.");
  }
  url.search = "";
  url.hash = "";
  return url;
}

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function typed(value: unknown, kind: string): boolean {
  const type = object(value)?.["@type"];
  return type === kind || (Array.isArray(type) && type.includes(kind));
}

function youtubeId(input: unknown): string | null {
  if (typeof input !== "string") return null;
  try {
    const url = new URL(input);
    if (url.protocol !== "https:") return null;
    let id: string | null = null;
    if (url.hostname === "youtu.be") id = url.pathname.split("/")[1] ?? null;
    if (url.hostname === "youtube.com" || url.hostname === "www.youtube.com" || url.hostname === "www.youtube-nocookie.com") {
      id = url.pathname.startsWith("/embed/") ? url.pathname.split("/")[2] : url.searchParams.get("v");
    }
    return id && videoIdPattern.test(id) ? id : null;
  } catch { return null; }
}

function jsonLdBlocks(html: string): Record<string, unknown>[] {
  const blocks: Record<string, unknown>[] = [];
  for (const script of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    if (!/\btype\s*=\s*["']application\/ld\+json["']/i.test(script[1])) continue;
    try {
      const parsed = JSON.parse(script[2]);
      const values = Array.isArray(parsed) ? parsed : [parsed];
      for (const value of values) {
        const node = object(value);
        if (node) blocks.push(node);
        const graph = node?.["@graph"];
        if (Array.isArray(graph)) for (const item of graph) { const child = object(item); if (child) blocks.push(child); }
      }
    } catch { /* Another JSON-LD block must not poison the valid ones. */ }
  }
  return blocks;
}

/** Fixture metadata remains inspectable even before DailyGoal publishes a film. */
export function parseDailyGoalFixtureHtml(html: string, inputUrl: string): DailyGoalFixture {
  const url = dailyGoalUrl(inputUrl).toString();
  const events = jsonLdBlocks(html).filter((value) => typed(value, "SportsEvent"));
  if (events.length !== 1) throw new Error("A unique SportsEvent JSON-LD block is required.");
  const event = events[0];
  const home = object(event.homeTeam)?.name;
  const away = object(event.awayTeam)?.name;
  const name = event.name;
  const score = typeof name === "string" ? name.match(/(\d{1,2})\s*[-–:]\s*(\d{1,2})/) : null;
  const date = event.startDate;
  const competition = object(event.organizer)?.name;
  const completed = event.eventStatus === "https://schema.org/EventCompleted";
  if (typeof home !== "string" || typeof away !== "string" || typeof competition !== "string" || !competition.trim() || !completed || !score || typeof date !== "string" || !Number.isFinite(Date.parse(date))) {
    throw new Error("DailyGoal completed-fixture metadata is incomplete.");
  }
  const eventUrl = typeof event.url === "string" ? dailyGoalUrl(event.url).toString() : null;
  if (eventUrl !== url) throw new Error("JSON-LD fixture URL contradicts the requested page.");
  return { url, home, away, homeScore: Number(score[1]), awayScore: Number(score[2]), date, competition };
}

export function parseDailyGoalHtml(html: string, inputUrl: string): DailyGoalMatch {
  const fixture = parseDailyGoalFixtureHtml(html, inputUrl);
  const { url } = fixture;
  const videos = jsonLdBlocks(html).filter((value) => typed(value, "VideoObject"));
  if (videos.length !== 1) throw new Error("A unique VideoObject JSON-LD block is required.");
  const video = videos[0];
  const videoId = youtubeId(video.embedUrl);
  if (!videoId) throw new Error("DailyGoal YouTube metadata is incomplete.");
  const videoUrl = typeof video.url === "string" ? dailyGoalUrl(video.url).toString() : null;
  if (videoUrl !== url) throw new Error("JSON-LD video URL contradicts the requested page.");
  const parts = Array.isArray(video.hasPart) ? video.hasPart : [];
  if (!parts.length || parts.length > 30) throw new Error("No usable goal clips were published in JSON-LD.");
  const clips: DailyGoalClip[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();
  for (const [index, part] of parts.entries()) {
    if (!typed(part, "Clip")) { warnings.push(`Clip ${index + 1}: missing Clip type.`); continue; }
    const value = object(part)!;
    const label = value.name;
    const found = typeof label === "string" ? label.match(/^(Goal|Own Goal|Penalty(?: Goal)?):\s*(.+?)\s+(\d{1,3})(?:\+(\d{1,2}))?['’](?:\s*\((penalty|own goal|og)\))?\s*-/i) : null;
    const seconds = value.startOffset;
    let permalink: URL;
    try { permalink = new URL(String(value.url)); } catch { warnings.push(`Clip ${index + 1}: invalid permalink.`); continue; }
    let samePage = false;
    try { samePage = dailyGoalUrl(permalink.toString()).toString() === url; } catch { /* Unsafe clip URL is rejected below. */ }
    if (!found || typeof seconds !== "number" || !Number.isInteger(seconds) || seconds < 0 || seconds > 21600 || !samePage || !/^\d+$/.test(permalink.searchParams.get("i") ?? "")) {
      warnings.push(`Clip ${index + 1}: missing or contradictory name, offset, or permalink.`);
      continue;
    }
    if (seen.has(permalink.toString())) { warnings.push(`Clip ${index + 1}: duplicate permalink.`); continue; }
    seen.add(permalink.toString());
    const marker = `${found[1]} ${found[5] ?? ""}`.toLowerCase();
    clips.push({ scorer: found[2].trim(), minute: Number(found[3]), addedMinute: found[4] ? Number(found[4]) : null, kind: marker.includes("penalty") ? "penalty_goal" : marker.includes("own goal") || marker.includes("og") ? "own_goal" : "goal", startOffset: seconds, permalink: permalink.toString() });
  }
  if (!clips.length) throw new Error("No valid goal clips were published in JSON-LD.");
  return { ...fixture, videoId, clips, warnings };
}

async function fetchPublicHtml(url: string): Promise<string> {
  if (Date.now() < blockedUntil) throw new Error("DailyGoal returned 403/429 earlier; importing stopped until the source cooldown expires.");
  const cached = htmlCache.get(url);
  if (cached && Date.now() - cached.at < 60_000) return cached.value;
  const wait = 2000 - (Date.now() - lastRequest);
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastRequest = Date.now();
  const response = await fetch(url, { redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(12_000), headers: { Accept: "text/html", "User-Agent": "BarcaDashboardDailyGoalMetadata/1.0" } });
  if (response.status === 403 || response.status === 429) {
    const retryAfter = response.headers.get("retry-after");
    const seconds = retryAfter && /^\d+$/.test(retryAfter) ? Number(retryAfter) : null;
    const date = retryAfter && seconds === null ? Date.parse(retryAfter) : NaN;
    blockedUntil = Math.max(Date.now() + 24 * 3_600_000, seconds !== null && Number.isFinite(seconds) ? Date.now() + seconds * 1000 : Number.isFinite(date) ? date : 0);
    throw new Error(`DailyGoal returned ${response.status}; importing stopped.`);
  }
  if (!response.ok || response.status >= 300) throw new Error(`DailyGoal returned ${response.status}.`);
  if (!(response.headers.get("content-type") ?? "").toLowerCase().includes("text/html")) throw new Error("DailyGoal did not return HTML.");
  const limit = 1_500_000;
  if (Number(response.headers.get("content-length") ?? 0) > limit) throw new Error("DailyGoal page is too large.");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("DailyGoal response has no body.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) { await reader.cancel(); throw new Error("DailyGoal page is too large."); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let cursor = 0;
  for (const chunk of chunks) { bytes.set(chunk, cursor); cursor += chunk.byteLength; }
  const html = new TextDecoder().decode(bytes);
  if (htmlCache.size >= 128) htmlCache.delete(htmlCache.keys().next().value!);
  htmlCache.set(url, { at: Date.now(), value: html });
  return html;
}

/** Only real links published on the public Barcelona page; no guessed IDs or slugs. */
export function parseBarcelonaMatchLinks(html: string): string[] {
  const links = new Set<string>();
  for (const anchor of html.matchAll(/<a\b([^>]*)>/gi)) {
    const href = anchor[1].match(/\bhref\s*=\s*(["'])(.*?)\1/i)?.[2];
    if (!href) continue;
    try {
      const url = dailyGoalUrl(new URL(href, BARCELONA_DAILYGOAL_URL).toString());
      links.add(url.toString());
    } catch { /* Ignore non-match and off-host links. */ }
  }
  return [...links];
}

export async function discoverBarcelonaMatchLinks(): Promise<string[]> {
  const cached = listingCache.get(BARCELONA_DAILYGOAL_URL);
  if (cached && Date.now() - cached.at < 5 * 60_000) return cached.value;
  const links = parseBarcelonaMatchLinks(await fetchPublicHtml(BARCELONA_DAILYGOAL_URL));
  listingCache.set(BARCELONA_DAILYGOAL_URL, { at: Date.now(), value: links });
  return links;
}

export async function fetchDailyGoalMatch(input: string): Promise<DailyGoalMatch> {
  const url = dailyGoalUrl(input).toString();
  const cached = cache.get(url);
  if (cached && Date.now() - cached.at < 60_000) return cached.value;
  const result = parseDailyGoalHtml(await fetchPublicHtml(url), url);
  if (cache.size >= 128) cache.delete(cache.keys().next().value!);
  cache.set(url, { at: Date.now(), value: result });
  return result;
}

export async function fetchDailyGoalFixture(input: string): Promise<DailyGoalFixture> {
  const url = dailyGoalUrl(input).toString();
  return parseDailyGoalFixtureHtml(await fetchPublicHtml(url), url);
}
