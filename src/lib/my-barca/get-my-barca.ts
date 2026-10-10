import "server-only";

import { db } from "../../prisma/db";

export async function getMyBarca(userId: string) {
  const [seasons, barcelona, diaries, favourites, favouriteMatches, players, media] = await Promise.all([
    db.orm.public.Season.all(),
    db.orm.public.Team.where({ isBarcelona: true }).first(),
    db.orm.public.MatchDiaryEntry.where({ userId }).all(),
    db.orm.public.FavouritePlayer.where({ userId }).all(),
    db.orm.public.FavouriteMatch.where({ userId }).all(),
    db.orm.public.Player.all(),
    db.orm.public.MediaItem.all(),
  ]);
  if (!barcelona) throw new Error("FC Barcelona is missing from the canonical database.");

  const matches = await db.orm.public.Match
    .include("homeTeam")
    .include("awayTeam")
    .include("competition")
    .all();
  const diaryByMatch = new Map(diaries.map((entry) => [entry.matchId, entry]));
  const playerById = new Map(players.map((player) => [player.id, player]));
  const goalIds = [...new Set(diaries.map((entry) => entry.favouriteGoalEventId).filter((id): id is string => id !== null))];
  const goals = await Promise.all(goalIds.map((id) => db.orm.public.MatchEvent.where({ id }).first()));
  const goalById = new Map(goals.filter((goal) => goal !== null).map((goal) => [goal.id, goal]));
  const highlightedMatchIds = new Set(media.filter((item) => item.isOfficial && item.type === "match_highlight" && item.matchId).map((item) => item.matchId));

  const finished = matches
    .filter((match) => match.status === "finished" && (match.homeTeamId === barcelona.id || match.awayTeamId === barcelona.id))
    .sort((a, b) => b.kickoff.toString().localeCompare(a.kickoff.toString()));
  const entries = finished.map((match) => {
    const diary = diaryByMatch.get(match.id);
    const home = match.homeTeamId === barcelona.id;
    const opponent = home ? match.awayTeam : match.homeTeam;
    const favouritePlayer = diary?.favouritePlayerId ? playerById.get(diary.favouritePlayerId) : null;
    const goal = diary?.favouriteGoalEventId ? goalById.get(diary.favouriteGoalEventId) : null;
    const goalScorer = goal?.primaryPlayerId ? playerById.get(goal.primaryPlayerId) : null;
    return {
      id: match.id,
      seasonId: match.seasonId,
      kickoff: match.kickoff.toString(),
      competition: { code: match.competition.code, name: match.competition.shortName ?? match.competition.name, logoUrl: match.competition.logoUrl },
      opponent: { name: opponent.shortName ?? opponent.name, crestUrl: opponent.crestUrl },
      home,
      result: home ? `${match.homeScore ?? "–"}–${match.awayScore ?? "–"}` : `${match.awayScore ?? "–"}–${match.homeScore ?? "–"}`,
      watched: diary?.watched ?? false,
      watchType: diary?.watchType ?? null,
      watchedAt: diary?.watchedAt?.toString() ?? (diary?.watched && diary.watchType === "live" ? match.kickoff.toString() : null),
      rating: diary?.rating ?? null,
      notes: diary?.notes ?? null,
      hasDiary: Boolean(diary),
      favouritePlayer: favouritePlayer ? { id: favouritePlayer.id, name: favouritePlayer.displayName, portraitUrl: favouritePlayer.portraitUrl } : null,
      favouriteGoal: goal && goal.matchId === match.id ? { id: goal.id, type: goal.type, minute: goal.minute, scorer: goalScorer?.displayName ?? null } : null,
      hasMatchHighlights: highlightedMatchIds.has(match.id),
    };
  });

  const availableSeasonIds = new Set(entries.map((entry) => entry.seasonId));
  const seasonOptions = seasons
    .filter((season) => season.isCurrent || availableSeasonIds.has(season.id))
    .sort((a, b) => b.startYear - a.startYear)
    .map((season) => ({ id: season.id, label: season.label, isCurrent: season.isCurrent }));
  const currentSeasonId = seasonOptions.find((season) => season.isCurrent)?.id ?? seasonOptions[0]?.id ?? "";
  const favouritePlayers = favourites
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((favourite) => playerById.get(favourite.playerId))
    .filter((player) => player !== undefined)
    .map((player) => ({ id: player.id, name: player.displayName, portraitUrl: player.portraitUrl, position: player.primaryPosition }));

  return { seasonOptions, currentSeasonId, entries, barcaCrest: barcelona.crestUrl, favouritePlayers, favouriteMatches: favouriteMatches.map(({ seasonId, matchId, slot }) => ({ seasonId, matchId, slot })) };
}

export type MyBarcaData = Awaited<ReturnType<typeof getMyBarca>>;
