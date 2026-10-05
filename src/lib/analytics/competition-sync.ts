import "server-only";

import { Temporal } from "temporal-polyfill";
import { db } from "../../prisma/db";
import { getChampionsLeagueMatches, getChampionsLeagueStandings } from "../providers/football-data/client";
import { GoalApiClient } from "../providers/goal-api/client";
import { asArray, asObject, numberValue, stringValue } from "../providers/shared/json";
import type { FootballDataMatch } from "../providers/football-data/types";

type Code = "CL" | "CDR" | "SSC";
type Fixture = {
  sourceCode: string; providerId: string; stage: string | null; round: string | null;
  matchday: number | null; leg: number | null; kickoff: string | null; status: string;
  homeProviderId: string | null; awayProviderId: string | null;
  homeName: string; awayName: string; homeCrestUrl: string | null; awayCrestUrl: string | null;
  homeScore: number | null; awayScore: number | null;
  homePenaltyScore: number | null; awayPenaltyScore: number | null;
};

const GOAL_LEAGUES = {
  CDR: "cmr77dvnt006mrx06cxed28bn",
  SSC: "cmr77dvnt006prx0648jqzs27",
} as const;
const CUP_DETAILS = {
  CDR: { name: "Copa del Rey", type: "cup" as const },
  SSC: { name: "Spanish Super Cup", type: "super_cup" as const },
};

function normalizeTeam(name: string) {
  return name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/\b(fc|cf|club|football)\b/g, "").replace(/[^a-z0-9]/g, "");
}

function canonicalStatus(status: string) {
  if (["finished", "awarded"].includes(status)) return "finished" as const;
  if (["in_play", "live"].includes(status)) return "live" as const;
  if (status === "postponed") return "postponed" as const;
  if (status === "cancelled") return "cancelled" as const;
  return "scheduled" as const;
}

function goalFixture(value: unknown, seasonLabel: string): Fixture | null {
  const row = asObject(value);
  if (!row || stringValue(row, "leagueYear") !== seasonLabel) return null;
  const home = asObject(row.homeTeam) ?? asObject(row.home) ?? {};
  const away = asObject(row.awayTeam) ?? asObject(row.away) ?? {};
  const id = stringValue(row, "id", "fixtureId", "apiId");
  const homeName = stringValue(home, "name", "teamName") ?? stringValue(row, "homeTeamName", "homeName");
  const awayName = stringValue(away, "name", "teamName") ?? stringValue(row, "awayTeamName", "awayName");
  if (!id || !homeName || !awayName) throw new Error("Current-season GOAL fixture has no stable ID or named participants.");
  const score = asObject(row.score) ?? {};
  const penalty = asObject(row.penalties) ?? asObject(score.penalties) ?? {};
  const kickoff = stringValue(row, "kickoffUtc");
  if (kickoff && !Number.isFinite(Date.parse(kickoff))) throw new Error(`Invalid fixture kickoff ${id}`);
  return {
    sourceCode: "goal-api", providerId: id,
    stage: stringValue(row, "stageName", "fkStageKey"),
    round: stringValue(row, "matchRound", "round"), matchday: numberValue(row, "matchday"),
    leg: numberValue(row, "leg"), kickoff, status: (stringValue(row, "matchStatus", "status") ?? "SCHEDULED").toLowerCase(),
    homeProviderId: stringValue(home, "id", "teamId", "apiId") ?? stringValue(row, "homeTeamId"),
    awayProviderId: stringValue(away, "id", "teamId", "apiId") ?? stringValue(row, "awayTeamId"),
    homeName, awayName,
    homeCrestUrl: stringValue(home, "badge", "logo", "logoUrl", "crest") ?? stringValue(row, "teamHomeBadge", "homeTeamLogo"),
    awayCrestUrl: stringValue(away, "badge", "logo", "logoUrl", "crest") ?? stringValue(row, "teamAwayBadge", "awayTeamLogo"),
    homeScore: numberValue(row, "homeTeamScore", "homeScore", "scoreHome") ?? numberValue(score, "home"),
    awayScore: numberValue(row, "awayTeamScore", "awayScore", "scoreAway") ?? numberValue(score, "away"),
    homePenaltyScore: numberValue(row, "homeTeamPenaltyScore", "homePenaltyScore") ?? numberValue(penalty, "home"),
    awayPenaltyScore: numberValue(row, "awayTeamPenaltyScore", "awayPenaltyScore") ?? numberValue(penalty, "away"),
  };
}

function footballFixture(row: FootballDataMatch): Fixture {
  return {
    sourceCode: "football-data-org", providerId: String(row.id), stage: row.stage,
    round: row.group, matchday: row.matchday, leg: null, kickoff: row.utcDate,
    status: row.status.toLowerCase(),
    homeProviderId: row.homeTeam.id ? String(row.homeTeam.id) : null,
    awayProviderId: row.awayTeam.id ? String(row.awayTeam.id) : null,
    homeName: row.homeTeam.name, awayName: row.awayTeam.name,
    homeCrestUrl: row.homeTeam.crest, awayCrestUrl: row.awayTeam.crest,
    homeScore: row.score.fullTime.home, awayScore: row.score.fullTime.away,
    homePenaltyScore: null, awayPenaltyScore: null,
  };
}

async function fetchCup(code: "CDR" | "SSC", seasonLabel: string) {
  const client = new GoalApiClient();
  const fixtures: Fixture[] = [];
  let total = 0;
  let logoUrl: string | null = null;
  for (let offset = 0; offset < 800; offset += 100) {
    const response = await client.get(`/leagues/${GOAL_LEAGUES[code]}/fixtures?limit=100&offset=${offset}`);
    const rows = asArray(response.data, "fixtures", "items", "results");
    const pagination = asObject(response.pagination);
    total = numberValue(pagination, "total") ?? rows.length;
    for (const row of rows) {
      const fixture = goalFixture(row, seasonLabel);
      if (fixture) {
        fixtures.push(fixture);
        logoUrl ??= stringValue(asObject(row), "leagueLogo") ?? stringValue(asObject(asObject(row)?.league), "logo");
      }
    }
    if (!rows.length || offset + rows.length >= total) break;
    if (offset >= 700) throw new Error(`${code} fixture pagination exceeded the eight-request cap.`);
  }
  return { fixtures, requests: client.requestCount, providerTotal: total, logoUrl };
}

export async function syncCompetitionFixtures(code: Code, dryRun: boolean) {
  const season = await db.orm.public.Season.where({ isCurrent: true }).first();
  if (!season || season.startYear !== 2026) throw new Error("Expected current 2026/27 season.");
  let fixtures: Fixture[];
  let requests = 0;
  let providerTotal = 0;
  let leagueTable: Awaited<ReturnType<typeof getChampionsLeagueStandings>> | null = null;
  let cupLogo: string | null = null;
  if (code === "CL") {
    const [matches, standings] = await Promise.all([
      getChampionsLeagueMatches(season.startYear), getChampionsLeagueStandings(season.startYear),
    ]);
    if (matches.competition?.code !== "CL" || matches.matches.some((m) => m.season.startDate.slice(0, 4) !== "2026") ||
      standings.competition.code !== "CL" || standings.season.startDate.slice(0, 4) !== "2026") {
      throw new Error("Champions League provider season or competition mismatch.");
    }
    fixtures = matches.matches.map(footballFixture);
    providerTotal = fixtures.length;
    leagueTable = standings;
    requests = 2;
  } else {
    const cup = await fetchCup(code, code === "SSC" ? "2027" : `${season.startYear}/${season.endYear}`);
    fixtures = cup.fixtures;
    requests = cup.requests;
    providerTotal = cup.providerTotal;
    cupLogo = cup.logoUrl;
  }
  const ids = new Set(fixtures.map((f) => f.providerId));
  if (ids.size !== fixtures.length) throw new Error(`${code} contains duplicate fixture IDs.`);
  const existingCompetition = await db.orm.public.Competition.where({ code }).first();
  const existing = existingCompetition ? await db.orm.public.CompetitionFixtureSnapshot.where({ seasonId: season.id, competitionId: existingCompetition.id }).all() : [];
  const oldById = new Map(existing.map((row) => [`${row.sourceCode}:${row.providerId}`, row]));
  const changed = fixtures.filter((fixture) => {
    const old = oldById.get(`${fixture.sourceCode}:${fixture.providerId}`);
    return !old || ["status", "homeScore", "awayScore", "homePenaltyScore", "awayPenaltyScore", "homeName", "awayName", "homeCrestUrl", "awayCrestUrl", "stage", "round", "kickoff", "matchday", "leg"].some((key) =>
      key === "kickoff" ? (old.kickoff?.toString() ?? null) !== (fixture.kickoff ? Temporal.Instant.from(fixture.kickoff).toString() : null) :
        old[key as keyof typeof old] !== fixture[key as keyof Fixture]);
  });
  const table = leagueTable?.standings.find((item) => item.type === "TOTAL")?.table ?? [];
  if (code === "CL" && (table.length !== 36 || new Set(table.map((row) => row.team.id)).size !== 36 ||
      new Set(table.map((row) => row.position)).size !== 36 || table.some((row) => row.position < 1 || row.position > 36))) {
    throw new Error("Champions League league-stage table must have 36 unique clubs and positions.");
  }
  if (dryRun) return { dryRun, code, season: season.label, requests, providerTotal, currentSeasonFixtures: fixtures.length,
    changed: changed.length, standingsTeams: table.length, sample: fixtures.slice(0, 3) };

  const competition = existingCompetition ?? await db.orm.public.Competition.create({
    code, name: code === "CL" ? "UEFA Champions League" : CUP_DETAILS[code].name,
    shortName: code === "CL" ? "Champions League" : CUP_DETAILS[code].name,
    type: code === "CL" ? "continental" : CUP_DETAILS[code].type,
    country: code === "CL" ? "Europe" : "Spain", logoUrl: code === "CL" ? leagueTable?.competition.emblem ?? null : cupLogo,
  });
  if (existingCompetition && !existingCompetition.logoUrl && cupLogo) {
    await db.orm.public.Competition.where({ id: competition.id }).update({ logoUrl: cupLogo });
  }
  for (const fixture of changed) {
    const old = oldById.get(`${fixture.sourceCode}:${fixture.providerId}`);
    const values = { ...fixture, kickoff: fixture.kickoff ? Temporal.Instant.from(fixture.kickoff) : null };
    if (old) await db.orm.public.CompetitionFixtureSnapshot.where({ id: old.id }).update(values);
    else await db.orm.public.CompetitionFixtureSnapshot.create({ seasonId: season.id, competitionId: competition.id, ...values });
  }
  let standingRowsChanged = 0;
  if (code === "CL" && leagueTable) {
    const source = await db.orm.public.DataSource.where({ code: "football-data-org" }).first();
    if (!source) throw new Error("football-data.org source missing. Sync fixture spine first.");
    const mappings = await db.orm.public.ProviderMapping.where({ dataSourceId: source.id, entityType: "team" }).all();
    const map = new Map(mappings.map((item) => [item.providerId, item.internalId]));
    const matchday = leagueTable.season.currentMatchday ?? 0;
    const previous = await db.orm.public.StandingSnapshot.where({ seasonId: season.id, competitionId: competition.id, matchday }).all();
    for (const row of table) {
      const providerId = String(row.team.id);
      let teamId = map.get(providerId);
      if (!teamId) {
        const team = await db.orm.public.Team.upsert({
          create: { code: `FD-${providerId}`, name: row.team.name, shortName: row.team.shortName, crestUrl: row.team.crest },
          update: { name: row.team.name, shortName: row.team.shortName, crestUrl: row.team.crest }, conflictOn: { code: `FD-${providerId}` },
        });
        teamId = team.id;
        await db.orm.public.ProviderMapping.create({ dataSourceId: source.id, entityType: "team", providerId, internalId: teamId });
      }
      const values = { position: row.position, played: row.playedGames, won: row.won, drawn: row.draw, lost: row.lost,
        goalsFor: row.goalsFor, goalsAgainst: row.goalsAgainst, goalDifference: row.goalDifference, points: row.points,
        basis: "official_current", dataSourceId: source.id };
      const old = previous.find((item) => item.teamId === teamId);
      if (old && Object.entries(values).every(([key, value]) => old[key as keyof typeof old] === value)) continue;
      if (old) await db.orm.public.StandingSnapshot.where({ id: old.id }).update(values);
      else await db.orm.public.StandingSnapshot.create({ seasonId: season.id, competitionId: competition.id, teamId, matchday, ...values });
      standingRowsChanged++;
    }
  }
  // Promote only fixtures whose two participants each resolve to exactly one
  // canonical identity. Ambiguous names stay in the competition snapshot.
  const teams = await db.orm.public.Team.all();
  const barcelona = teams.find((team) => team.isBarcelona);
  const canonicalMatches = await db.orm.public.Match.where({ seasonId: season.id, competitionId: competition.id }).all();
  const source = await db.orm.public.DataSource.where({ code: code === "CL" ? "football-data-org" : "goal-api" }).first();
  const mappings = source ? await db.orm.public.ProviderMapping.where({ dataSourceId: source.id, entityType: "match" }).all() : [];
  let promoted = 0;
  let linked = 0;
  for (const fixture of fixtures) {
    const homeBarca = normalizeTeam(fixture.homeName) === "barcelona";
    const awayBarca = normalizeTeam(fixture.awayName) === "barcelona";
    if (!barcelona || homeBarca === awayBarca || !fixture.kickoff) continue;
    const opponentName = homeBarca ? fixture.awayName : fixture.homeName;
    const opponentCandidates = teams.filter((team) => normalizeTeam(team.name) === normalizeTeam(opponentName) ||
      (team.shortName && normalizeTeam(team.shortName) === normalizeTeam(opponentName)));
    const unique = [...new Set(opponentCandidates.map((team) => team.id))];
    if (unique.length !== 1) continue;
    const homeTeamId = homeBarca ? barcelona.id : unique[0];
    const awayTeamId = awayBarca ? barcelona.id : unique[0];
    const mapped = mappings.find((item) => item.providerId === fixture.providerId);
    let match = mapped ? canonicalMatches.find((item) => item.id === mapped.internalId) : null;
    match ??= canonicalMatches.find((item) => item.homeTeamId === homeTeamId && item.awayTeamId === awayTeamId &&
      Math.abs(Date.parse(item.kickoff.toString()) - Date.parse(fixture.kickoff!)) < 12 * 60 * 60 * 1000) ?? null;
    if (!match) {
      match = await db.orm.public.Match.create({ seasonId: season.id, competitionId: competition.id,
        homeTeamId, awayTeamId, kickoff: Temporal.Instant.from(fixture.kickoff),
        status: canonicalStatus(fixture.status), matchday: fixture.matchday,
        stage: fixture.stage, round: fixture.round, leg: fixture.leg,
        neutralVenue: code === "SSC", homeScore: fixture.homeScore, awayScore: fixture.awayScore,
        homePenaltyScore: fixture.homePenaltyScore, awayPenaltyScore: fixture.awayPenaltyScore });
      canonicalMatches.push(match);
      promoted++;
    } else linked++;
    if (source && !mapped) {
      await db.orm.public.ProviderMapping.create({ dataSourceId: source.id, entityType: "match", providerId: fixture.providerId, internalId: match.id });
      mappings.push({ id: "", dataSourceId: source.id, entityType: "match", providerId: fixture.providerId, internalId: match.id, metadata: null, createdAt: match.createdAt, updatedAt: match.updatedAt });
    }
    const snapshot = await db.orm.public.CompetitionFixtureSnapshot.where({ sourceCode: fixture.sourceCode, providerId: fixture.providerId }).first();
    if (snapshot && snapshot.canonicalMatchId !== match.id) await db.orm.public.CompetitionFixtureSnapshot.where({ id: snapshot.id }).update({ canonicalMatchId: match.id });
  }
  return { dryRun, code, season: season.label, requests, providerTotal, currentSeasonFixtures: fixtures.length,
    changed: changed.length, unchanged: fixtures.length - changed.length, standingsTeams: table.length, standingRowsChanged, promoted, linked };
}
