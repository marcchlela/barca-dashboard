import { db } from "../../src/prisma/db.ts";

const matchId = process.argv[2];
if (!matchId) throw new Error("Usage: node tools/qa/inspect-live-fixture.mjs MATCH_ID");

const [match, runs, lineups, events, stats, playerStats, media, mappings, sources] = await Promise.all([
  db.orm.public.Match.where({ id: matchId }).first(),
  db.orm.public.GoalMediaSyncRun.where({ mode: "live-match-sync" }).orderBy((run) => run.startedAt.desc()).all(),
  db.orm.public.Lineup.where({ matchId }).all(),
  db.orm.public.MatchEvent.where({ matchId }).all(),
  db.orm.public.MatchStatistic.where({ matchId }).all(),
  db.orm.public.PlayerMatchStatistic.where({ matchId }).all(),
  db.orm.public.MediaItem.where({ matchId }).include("goalMoments").all(),
  db.orm.public.ProviderMapping.where({ entityType: "match", internalId: matchId }).all(),
  db.orm.public.DataSource.all(),
]);

console.log(JSON.stringify({
  match: match && { status: match.status, kickoff: match.kickoff.toString(), homeScore: match.homeScore, awayScore: match.awayScore },
  runs: runs.slice(0, 8).map((run) => ({ status: run.status, startedAt: run.startedAt.toString(), finishedAt: run.finishedAt?.toString(), error: run.error, result: run.result })),
  lineups: lineups.map((lineup) => ({ teamId: lineup.teamId, isConfirmed: lineup.isConfirmed, formation: lineup.formation })),
  eventCount: events.length,
  eventTypes: Object.fromEntries([...new Set(events.map((event) => event.type))].map((type) => [type, events.filter((event) => event.type === type).length])),
  events: events.map((event) => ({ type: event.type, minute: event.minute, teamId: event.teamId, primaryPlayerId: event.primaryPlayerId, confidence: event.confidence, source: sources.find((source) => source.id === event.dataSourceId)?.code, scorerName: event.rawData && typeof event.rawData === "object" && !Array.isArray(event.rawData) ? event.rawData.scorerName ?? null : null })),
  statisticCount: stats.length,
  playerStatisticCount: playerStats.length,
  playerRatings: playerStats.filter((stat) => stat.rating !== null).length,
  media: media.map((item) => ({ type: item.type, title: item.title, isOfficial: item.isOfficial, source: sources.find((source) => source.id === item.dataSourceId)?.code, verifiedGoals: item.goalMoments.length })),
  mappings: mappings.map((mapping) => ({ source: sources.find((source) => source.id === mapping.dataSourceId)?.code, providerId: mapping.providerId })),
}, null, 2));

process.exit(0);
