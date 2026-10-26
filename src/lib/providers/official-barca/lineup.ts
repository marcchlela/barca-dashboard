import "server-only";

import { db } from "../../../prisma/db";
import { getOfficialSquadManifest } from "../../squad/official-squad";
import { opponentTokens } from "../../notifications/official-squad-core";
import { normalizedPersonName } from "../shared/normalization";
import type { MatchIdentityInput } from "../shared/match-identity";
import type { GoalLineupPlayer, GoalLineupSide } from "../goal-api/types";
import { extractOfficialStartingEleven } from "./lineup-core";

const INDEX = "https://www.fcbarcelona.com/en/football/first-team/news";
const LINEUP_SLUG = /(?:starting-xi|starting-eleven|confirmed-lineup|line-up|lineup|the-xi|the-11|eleven-to-face)/i;

function articleText(html: string) {
  const encoded = html.match(/"articleBody"\s*:\s*("(?:\\.|[^"\\])*")/i)?.[1];
  if (encoded) {
    try { return JSON.parse(encoded) as string; } catch { /* Use visible article text. */ }
  }
  return [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((row) => row[1].replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&"))
    .join("\n");
}

export async function fetchOfficialBarcelonaLineup(internal: MatchIdentityInput, matchId: string) {
  const home = /barcelona/i.test(internal.homeTeam.name);
  const opponent = home ? internal.awayTeam.name : internal.homeTeam.name;
  const tokens = opponentTokens(opponent);
  const indexResponse = await fetch(INDEX, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
  if (!indexResponse.ok) throw new Error(`Official news index returned HTTP ${indexResponse.status}.`);
  const index = await indexResponse.text();
  const links = [...new Set([...index.matchAll(/<a\s+[^>]*href="([^"]+)"/gi)].map((match) => match[1]))]
    .filter((path) => path.startsWith("/en/football/first-team/news/") && LINEUP_SLUG.test(path) &&
      (tokens.some((token) => path.toLowerCase().includes(token)) || (/\breal\b.*\bmadrid\b/i.test(opponent) && /clasico|classico/i.test(path))))
    .slice(0, 6);
  const dateParts = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(internal.kickoff));
  const dateFields = Object.fromEntries(dateParts.map((part) => [part.type, part.value]));
  const fixtureDate = `${dateFields.year}-${dateFields.month}-${dateFields.day}`;
  for (const path of links) {
    const url = new URL(path, INDEX).toString();
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
    if (!response.ok) continue;
    const html = await response.text();
    const date = html.match(/datePublished[^0-9]{0,40}(\d{4}-\d{2}-\d{2})/i)?.[1];
    if (date !== fixtureDate) continue;
    const names = extractOfficialStartingEleven(articleText(html));
    if (!names.length) continue;
    const match = await db.orm.public.Match.where({ id: matchId }).include("season").first();
    if (!match) return null;
    const teamId = home ? match.homeTeamId : match.awayTeamId;
    const members = await db.orm.public.SquadMembership.where({ seasonId: match.seasonId, teamId }).include("player").all();
    const manifest = getOfficialSquadManifest(match.season.label);
    const overrides = await db.orm.public.ManualOverride.where({ entityType: "match", entityId: matchId, fieldName: "matchdaySquad" }).first();
    const payload = overrides?.payload && typeof overrides.payload === "object" && !Array.isArray(overrides.payload) ? overrides.payload as Record<string, unknown> : null;
    const squad = Array.isArray(payload?.names) ? payload.names.filter((name): name is string => typeof name === "string") : [];
    const canonical = (name: string) => {
      const key = normalizedPersonName(name);
      const parts = key.split(" ").filter(Boolean);
      const candidates = members.filter(({ player }) => {
        const aliases = manifest?.players.find((item) => normalizedPersonName(item.displayName) === normalizedPersonName(player.displayName))?.aliases ?? [];
        return [player.displayName, ...aliases].some((alias) => {
          const candidate = normalizedPersonName(alias);
          const candidateParts = candidate.split(" ").filter(Boolean);
          return candidate === key || (parts.length >= 2 && parts[0].length === 1 &&
            candidateParts[0]?.startsWith(parts[0]) && candidateParts.at(-1) === parts.at(-1));
        });
      });
      return candidates.length === 1 ? candidates[0] : null;
    };
    const starters = names.map(canonical);
    if (starters.some((row) => !row) || new Set(starters.map((row) => row!.playerId)).size !== 11) continue;
    const squadMembers = squad.length >= 18 && squad.length <= 30 ? squad.map(canonical) : [];
    const bench = squadMembers.length === squad.length && squadMembers.every(Boolean)
      ? squadMembers.filter((row) => !starters.some((starter) => starter!.playerId === row!.playerId)) : [];
    const toPlayer = (row: NonNullable<(typeof starters)[number]>, role: GoalLineupPlayer["role"], index: number): GoalLineupPlayer => ({
      providerId: `official-barca:${row.playerId}`, legacyEventKey: null, name: row.player.displayName,
      shirtNumber: row.shirtNumber, matchPosition: null, primaryPosition: row.position,
      lineupOrdinal: role === "starter" ? index + 1 : null, role, imageUrl: row.player.portraitUrl,
    });
    const side: GoalLineupSide = {
      providerTeamId: `official-barca:${teamId}`, teamName: home ? internal.homeTeam.name : internal.awayTeam.name,
      formation: null, coachName: null,
      players: [...starters.map((row, index) => toPlayer(row!, "starter", index)), ...bench.map((row, index) => toPlayer(row!, "substitute", index))],
    };
    return { providerMatchId: url, requestCount: 2, home: home ? side : null, away: home ? null : side };
  }
  return null;
}
