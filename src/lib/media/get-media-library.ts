import "server-only";

import { db } from "../../prisma/db";
import { CURATED_HISTORY } from "./curated-history";

export type MediaLibraryItem = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  url: string;
  thumbnailUrl: string | null;
  youtubeId: string | null;
  source: string;
  official: boolean;
  publishedAt: string | null;
  date: string | null;
  seasonId: string | null;
  seasonLabel: string | null;
  seasonYear: number | null;
  player: string | null;
  match: null | {
    id: string;
    opponent: string;
    opponentCrest: string | null;
    barcelonaCrest: string | null;
    competition: string;
    competitionCode: string;
    competitionLogo: string | null;
    score: string | null;
    kickoff: string;
  };
  archive: null | { opponent: string; score: string; competition: string; chapter: string };
  favourite: boolean;
  watchLater: boolean;
  featured: boolean;
  verifiedGoalMoments: number;
};

export type MediaLibraryData = {
  items: MediaLibraryItem[];
  featuredId: string | null;
  currentSeasonId: string | null;
  currentSeasonLabel: string | null;
};

export function youtubeIdFor(url: string, externalMediaId: string | null = null): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "youtu.be" || parsed.hostname.endsWith(".youtu.be")) return validId(parsed.pathname.split("/").filter(Boolean)[0]);
    if (parsed.hostname === "youtube.com" || parsed.hostname.endsWith(".youtube.com") || parsed.hostname === "youtube-nocookie.com") {
      return validId(parsed.searchParams.get("v") ?? parsed.pathname.split("/").filter(Boolean).at(-1)) ?? validId(externalMediaId);
    }
  } catch { /* An invalid external URL is link-only, never an iframe source. */ }
  return null;
}

function validId(value: string | null | undefined) {
  return value && /^[A-Za-z0-9_-]{11}$/.test(value) ? value : null;
}

export async function getMediaLibrary(): Promise<MediaLibraryData> {
  const [media, matches, seasons, players, saves, moments] = await Promise.all([
    db.orm.public.MediaItem.all(),
    db.orm.public.Match.include("homeTeam").include("awayTeam").include("competition").all(),
    db.orm.public.Season.all(),
    db.orm.public.Player.all(),
    db.orm.public.MediaSave.all(),
    db.orm.public.MediaMoment.all(),
  ]);
  const matchById = new Map(matches.map((match) => [match.id, match]));
  const seasonById = new Map(seasons.map((season) => [season.id, season]));
  const playerById = new Map(players.map((player) => [player.id, player]));
  const saveById = new Map(saves.map((save) => [save.mediaItemId, save]));
  const momentCount = new Map<string, number>();
  for (const moment of moments) momentCount.set(moment.mediaItemId, (momentCount.get(moment.mediaItemId) ?? 0) + 1);
  const current = seasons.find((season) => season.isCurrent);
  const items = media.map((item): MediaLibraryItem => {
    const match = item.matchId ? matchById.get(item.matchId) : null;
    const season = item.seasonId ? seasonById.get(item.seasonId) : null;
    const save = saveById.get(item.id);
    const archive = CURATED_HISTORY[item.url as keyof typeof CURATED_HISTORY] ?? null;
    const opponent = match ? (match.homeTeam.isBarcelona ? match.awayTeam : match.homeTeam) : null;
    const home = match?.homeTeam.isBarcelona ?? false;
    const score = match?.homeScore !== null && match?.awayScore !== null && match?.homeScore !== undefined && match?.awayScore !== undefined
      ? home ? `${match.homeScore}–${match.awayScore}` : `${match.awayScore}–${match.homeScore}` : null;
    let source = "External source";
    try {
      const host = new URL(item.url).hostname;
      if (host.endsWith("youtube.com") || host === "youtu.be") source = "YouTube";
      else if (host.endsWith("fcbarcelona.com")) source = "Barça Play";
      else if (host.endsWith("laliga.com")) source = "LaLiga";
      else if (host.endsWith("uefa.com")) source = "UEFA";
      else if (host === "as.com" || host.endsWith(".as.com")) source = "AS / LaLiga";
    } catch { /* Keep the link-only source label. */ }
    return {
      id: item.id, type: item.type, title: item.title, description: item.description, url: item.url,
      thumbnailUrl: item.thumbnailUrl, youtubeId: youtubeIdFor(item.url, item.externalMediaId), source,
      official: item.isOfficial, publishedAt: item.publishedAt?.toString() ?? null,
      date: match?.kickoff.toString() ?? archive?.date ?? item.publishedAt?.toString() ?? null,
      seasonId: item.seasonId, seasonLabel: season?.label ?? null, seasonYear: season?.startYear ?? null,
      player: item.playerId ? playerById.get(item.playerId)?.displayName ?? null : null,
      match: match && opponent ? { id: match.id, opponent: opponent.shortName ?? opponent.name, opponentCrest: opponent.crestUrl, barcelonaCrest: (home ? match.homeTeam : match.awayTeam).crestUrl, competition: match.competition.shortName ?? match.competition.name, competitionCode: match.competition.code, competitionLogo: match.competition.logoUrl, score, kickoff: match.kickoff.toString() } : null,
      archive: archive ? { opponent: archive.opponent, score: archive.score, competition: archive.competition, chapter: archive.chapter } : null,
      favourite: save?.favourite ?? false, watchLater: save?.watchLater ?? false,
      featured: item.featuredAt !== null, verifiedGoalMoments: momentCount.get(item.id) ?? 0,
    };
  }).sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || b.id.localeCompare(a.id));
  const featured = [...media].filter((item) => item.featuredAt).sort((a, b) => (b.featuredAt?.toString() ?? "").localeCompare(a.featuredAt?.toString() ?? ""))[0];
  const fallback = items.find((item) => item.seasonId === current?.id && item.type === "match_highlight") ?? items[0];
  return { items, featuredId: featured?.id ?? fallback?.id ?? null, currentSeasonId: current?.id ?? null, currentSeasonLabel: current?.label ?? null };
}
