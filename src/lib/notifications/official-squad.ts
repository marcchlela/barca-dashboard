import "server-only";

import { db } from "../../prisma/db";
import { getOfficialSquadManifest } from "../squad/official-squad";
import { candidateSquadLinks, extractOfficialSquadNames, matchingSquadLinks } from "./official-squad-core";

const INDEX_URL = "https://www.fcbarcelona.com/en/football/first-team/news";
const INTERVAL_MS = 30 * 60_000;

type Article = { url: string; published: string; names: string[] };

function personKey(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function publishedNameMatches(publishedName: string, candidateName: string) {
  const published = personKey(publishedName);
  const candidate = personKey(candidateName);
  return candidate === published || candidate.startsWith(`${published} `) || candidate.endsWith(` ${published}`);
}

const OFFICIAL_RESERVE_POSITIONS: Record<string, "goalkeeper" | "defender" | "midfielder" | "forward"> = {
  "alex campos": "defender",
};

async function persistOfficialSquad(input: { matchId: string; url: string; published: string; names: string[] }) {
  const match = await db.orm.public.Match.where({ id: input.matchId }).include("homeTeam").include("awayTeam").include("season").first();
  if (!match) return;
  const teamSide = match.homeTeam.isBarcelona ? "home" : match.awayTeam.isBarcelona ? "away" : null;
  if (!teamSide) return;
  const teamId = teamSide === "home" ? match.homeTeamId : match.awayTeamId;
  const memberships = await db.orm.public.SquadMembership.where({ seasonId: match.seasonId, teamId }).include("player").all();
  const manifest = getOfficialSquadManifest(match.season.label);
  const players = input.names.map((publishedName) => {
    const wanted = personKey(publishedName);
    const wantedParts = wanted.split(" ");
    const officialMatches = manifest?.players.filter((player) =>
      [player.displayName, ...player.aliases].some((alias) => publishedNameMatches(publishedName, alias))) ?? [];
    if (officialMatches.length === 1) return {
      name: officialMatches[0].displayName,
      position: officialMatches[0].position,
    };
    const matches = memberships.filter(({ player }) => {
      const candidate = personKey(player.displayName);
      const parts = candidate.split(" ");
      return candidate === wanted || candidate.endsWith(` ${wanted}`) || wanted.endsWith(` ${candidate}`) ||
        (wantedParts.length === 2 && wantedParts[0].length === 1 && parts[0]?.startsWith(wantedParts[0]) && parts.at(-1) === wantedParts.at(-1));
    });
    const membership = matches.length === 1 ? matches[0] : null;
    const position = membership?.position && membership.position !== "unknown"
      ? membership.position
      : membership?.player.primaryPosition ?? OFFICIAL_RESERVE_POSITIONS[wanted] ?? "unknown";
    return { name: membership?.player.displayName ?? publishedName, position };
  });
  const payload = { teamSide, sourceUrl: input.url, publishedAt: input.published, names: players.map((player) => player.name), players };
  const existing = await db.orm.public.ManualOverride.where({ entityType: "match", entityId: input.matchId, fieldName: "matchdaySquad" }).first();
  if (existing) await db.orm.public.ManualOverride.where({ id: existing.id }).update({ payload, sourceUrl: input.url, confidence: "exact_provider", reason: "Official FC Barcelona matchday squad announcement" });
  else await db.orm.public.ManualOverride.create({ entityType: "match", entityId: input.matchId, fieldName: "matchdaySquad", payload, sourceUrl: input.url, confidence: "exact_provider", reason: "Official FC Barcelona matchday squad announcement" });
}

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
    const saved = articleCursor.snapshot as Record<string, unknown>;
    const names = Array.isArray(saved.names) ? saved.names.filter((name): name is string => typeof name === "string") : [];
    if (names.length) {
      const article = { url, published: String(saved.published), names } satisfies Article;
      await persistOfficialSquad({ matchId: input.matchId, ...article });
      return article;
    }
  }
  try {
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(12_000), headers: { Accept: "text/html" } });
    if (!response.ok) return null;
    const html = await response.text();
    const date = html.match(/datePublished[^0-9]{0,40}(\d{4}-\d{2}-\d{2})/i)?.[1];
    if (!date) return null;
    const names = extractOfficialSquadNames(html);
    if (!names.length) return null;
    const publication = Date.parse(`${date}T00:00:00Z`);
    const kickoff = Date.parse(input.kickoff);
    if (publication < kickoff - 4 * 86_400_000 || publication > kickoff + 86_400_000) return null;
    const state = { url, published: date, names };
    if (articleCursor) await db.orm.public.NotificationCursor.where({ key: articleCursorKey }).update({ snapshot: state });
    else await db.orm.public.NotificationCursor.create({ key: articleCursorKey, snapshot: state });
    await persistOfficialSquad({ matchId: input.matchId, ...state });
    return state satisfies Article;
  } catch { return null; }
}
