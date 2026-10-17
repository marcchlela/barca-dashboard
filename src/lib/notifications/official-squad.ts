import "server-only";

import { db } from "../../prisma/db";
import { candidateSquadLinks, matchingSquadLinks } from "./official-squad-core";

const INDEX_URL = "https://www.fcbarcelona.com/en/football/first-team/news";
const INTERVAL_MS = 30 * 60_000;

type Article = { url: string; published: string };

export async function discoverOfficialSquad(input: { matchId: string; opponent: string; kickoff: string; now: number }) {
  const cacheKey = "official-squad-news-index";
  const cursor = await db.orm.public.NotificationCursor.where({ key: cacheKey }).first();
  const cached = cursor?.snapshot && typeof cursor.snapshot === "object" && !Array.isArray(cursor.snapshot) ? cursor.snapshot as Record<string, unknown> : null;
  const lastChecked = typeof cached?.checkedAt === "string" ? Date.parse(cached.checkedAt) : 0;
  let links = Array.isArray(cached?.links) ? cached.links.filter((value): value is string => typeof value === "string") : [];
  if (input.now - lastChecked >= INTERVAL_MS) {
    const defer = async (minutes: number) => {
      const state = { checkedAt: new Date(input.now + minutes * 60_000 - INTERVAL_MS).toISOString(), links };
      if (cursor) await db.orm.public.NotificationCursor.where({ key: cacheKey }).update({ snapshot: state });
      else await db.orm.public.NotificationCursor.create({ key: cacheKey, snapshot: state });
    };
    try {
      const response = await fetch(INDEX_URL, { cache: "no-store", signal: AbortSignal.timeout(12_000), headers: { Accept: "text/html" } });
      if (response.status === 403 || response.status === 429) {
        await defer(response.status === 403 ? 24 * 60 : 4 * 60);
        return null;
      }
      if (!response.ok) { await defer(15); return null; }
      const html = await response.text();
      links = [...new Set(candidateSquadLinks(html))].slice(0, 30);
      const state = { checkedAt: new Date(input.now).toISOString(), links };
      if (cursor) await db.orm.public.NotificationCursor.where({ key: cacheKey }).update({ snapshot: state });
      else await db.orm.public.NotificationCursor.create({ key: cacheKey, snapshot: state });
    } catch { await defer(15); return null; }
  }
  const matches = matchingSquadLinks(links, input.opponent);
  if (matches.length !== 1) return null;
  const url = new URL(matches[0], INDEX_URL).toString();
  const articleCursorKey = `official-squad:${input.matchId}`;
  const articleCursor = await db.orm.public.NotificationCursor.where({ key: articleCursorKey }).first();
  if (articleCursor?.snapshot && typeof articleCursor.snapshot === "object" && !Array.isArray(articleCursor.snapshot) &&
    (articleCursor.snapshot as Record<string, unknown>).url === url) {
    return { url, published: String((articleCursor.snapshot as Record<string, unknown>).published) } satisfies Article;
  }
  try {
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(12_000), headers: { Accept: "text/html" } });
    if (!response.ok) return null;
    const html = await response.text();
    const date = html.match(/datePublished[^0-9]{0,40}(\d{4}-\d{2}-\d{2})/i)?.[1];
    if (!date) return null;
    const publication = Date.parse(`${date}T00:00:00Z`);
    const kickoff = Date.parse(input.kickoff);
    if (publication < kickoff - 4 * 86_400_000 || publication > kickoff + 86_400_000) return null;
    const state = { url, published: date };
    if (articleCursor) await db.orm.public.NotificationCursor.where({ key: articleCursorKey }).update({ snapshot: state });
    else await db.orm.public.NotificationCursor.create({ key: articleCursorKey, snapshot: state });
    return state satisfies Article;
  } catch { return null; }
}
