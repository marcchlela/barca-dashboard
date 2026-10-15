import { db } from "../../src/prisma/db.ts";

const season = await db.orm.public.Season.where({ isCurrent: true }).first();
const competition = await db.orm.public.Competition.where({ code: "CL" }).first();
if (!season || !competition) throw new Error("Current season or Champions League competition is missing.");
const [standings, fixtures, runs] = await Promise.all([
  db.orm.public.StandingSnapshot.where({ seasonId: season.id, competitionId: competition.id }).all(),
  db.orm.public.CompetitionFixtureSnapshot.where({ seasonId: season.id, competitionId: competition.id }).all(),
  db.orm.public.GoalMediaSyncRun.where({ mode: "champions-refresh" }).orderBy((run) => run.startedAt.desc()).all(),
]);
const rounds = [...new Set(standings.map((row) => row.matchday))].sort((a, b) => a - b);
const teams = await db.orm.public.Team.all();
const teamById = new Map(teams.map((team) => [team.id, team]));
const latest = rounds.at(-1);
const barcelona = standings.find((row) => row.matchday === latest && teamById.get(row.teamId)?.isBarcelona);
const barcelonaFixtures = fixtures.filter((row) => /barcelona|barca/i.test(`${row.homeName} ${row.awayName}`))
  .map((row) => ({ matchday: row.matchday, status: row.status, home: row.homeName, away: row.awayName, score: `${row.homeScore ?? "-"}-${row.awayScore ?? "-"}` }));
console.log(JSON.stringify({
  season: season.label,
  latestRound: rounds.at(-1) ?? null,
  latestRoundTeams: standings.filter((row) => row.matchday === rounds.at(-1)).length,
  finishedFixtures: fixtures.filter((row) => row.status === "finished").length,
  barcelonaStanding: barcelona ? { played: barcelona.played, points: barcelona.points, position: barcelona.position } : null,
  barcelonaFixtures,
  lastRun: runs[0] ? { status: runs[0].status, at: runs[0].startedAt.toString(), error: runs[0].error } : null,
}, null, 2));
