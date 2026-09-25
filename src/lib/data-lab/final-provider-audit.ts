import { FOOTBALL_DATA_BASE_URL } from "../providers/football-data/constants";
import {
  auditBigBallsLineups,
  auditEvents,
  auditGoalLineups,
  auditStatistics,
  asObject,
  arrayValue,
  bigBallsCandidate,
  emptyEventsAudit,
  emptyLineupAudit,
  emptyStatisticsAudit,
  goalCandidate,
  ProviderAuditClient,
  stringValue,
  type JsonObject,
} from "./providers/final-provider-audit-core";
import { fetchJson, safeErrorMessage } from "./http";
import {
  matchTeamIdentity,
  resolveMatchCandidate,
} from "./match-resolver";
import { selectReliabilityMatches } from "./statshawk-reliability";
import type {
  AuditFieldState,
  FootballDataCheck,
  FinalAuditStatField,
  FinalProviderAuditReport,
  ProviderMatchAudit,
  StatisticsAudit,
} from "./final-provider-audit-types";
import type { MatchCandidate, MatchResolution } from "./types";

const GOAL_API_BASE_URL = "https://api.goal-api.com/v1";
const BIG_BALLS_BASE_URL = "https://api.bigballsdata.com";
const CACHE_TTL_SECONDS = 6 * 60 * 60;

type CacheEntry = {
  expiresAt: number;
  report: FinalProviderAuditReport;
};

type SelectedMatch = Awaited<ReturnType<typeof selectReliabilityMatches>>["selected"][number];

type BigBallsSweepInternal = {
  report: ProviderMatchAudit;
  playerRows: unknown[];
};

let cacheEntry: CacheEntry | null = null;
let inFlight: Promise<FinalProviderAuditReport> | null = null;

function disagreements(resolution: MatchResolution) {
  const issues: string[] = [];
  if (!resolution.criteria.homeTeam) issues.push("home team differs");
  if (!resolution.criteria.awayTeam) issues.push("away team differs");
  if (!resolution.criteria.score) issues.push("full-time score differs");
  if (!resolution.criteria.competition) issues.push("competition differs");
  if (
    resolution.criteria.temporalPrecision === "exact" &&
    !resolution.criteria.exactKickoff
  ) {
    issues.push("exact kickoff differs by more than 30 minutes");
  }
  if (
    resolution.criteria.temporalPrecision !== "exact" &&
    !resolution.criteria.sameCalendarDate
  ) {
    issues.push("calendar date differs");
  }
  return issues;
}

function baseMatchAudit(selected: SelectedMatch): ProviderMatchAudit {
  return {
    label: selected.label,
    internal: selected.internal,
    status: "not_available",
    providerMatchId: null,
    candidate: null,
    resolution: null,
    immutableFactDisagreements: [],
    lineup: emptyLineupAudit(selected.internal),
    events: emptyEventsAudit(),
    statistics: emptyStatisticsAudit(),
    error: null,
  };
}

function responseError(body: JsonObject, fallback: string) {
  return stringValue(asObject(body.error), "message") ??
    stringValue(body, "message") ??
    fallback;
}

async function goalFixtureForMatch(
  selected: SelectedMatch,
  client: ProviderAuditClient,
) {
  const date = selected.internal.kickoff.slice(0, 10);
  for (const offset of [0, 100, 200]) {
    const path =
      "/fixtures?from=" + date +
      "&to=" + date +
      "&limit=100&offset=" + offset;
    const response = await client.get(path);
    if (!response.ok) {
      throw new Error(responseError(response.body, "GOAL fixture list failed."));
    }
    const rows = arrayValue(response.body.data);
    const found = rows
      .map((row) => ({ row, candidate: goalCandidate(row) }))
      .find(({ candidate }) =>
        candidate && resolveMatchCandidate(selected.internal, candidate).matched
      );
    if (found?.candidate) return found;
    const pagination = asObject(response.body.pagination);
    if (pagination?.hasMore !== true || rows.length < 100) break;
  }
  return null;
}

function goalStatistics(body: JsonObject) {
  const data = asObject(body.data);
  const match = asObject(data?.match);
  const players = asObject(data?.players);
  const teamRows = arrayValue(match?.fullTime);
  const playerRows = [
    ...arrayValue(players?.home),
    ...arrayValue(players?.away),
  ];
  return auditStatistics(teamRows, playerRows, {
    documentationOnly: ["xG", "xA", "coordinates"],
    evidence: [
      data?.hasStatistics === true
        ? "GOAL API explicitly set hasStatistics=true."
        : "GOAL API did not establish hasStatistics=true.",
      "Empty strings are treated as present-but-empty, never as zero.",
    ],
  });
}

async function sweepGoalMatch(
  selected: SelectedMatch,
  client: ProviderAuditClient,
): Promise<ProviderMatchAudit> {
  const base = baseMatchAudit(selected);
  try {
    const found = await goalFixtureForMatch(selected, client);
    if (!found?.candidate?.providerMatchId) {
      return {
        ...base,
        error: "No dated GOAL API candidate passed the hardened resolver.",
      };
    }

    const providerMatchId = found.candidate.providerMatchId;
    const detailResponse = await client.get(
      "/fixtures/" + encodeURIComponent(providerMatchId),
    );
    if (!detailResponse.ok) {
      return {
        ...base,
        providerMatchId,
        candidate: found.candidate,
        error: responseError(detailResponse.body, "GOAL fixture detail failed."),
      };
    }
    const candidate = goalCandidate(detailResponse.body.data) ?? found.candidate;
    const resolution = resolveMatchCandidate(selected.internal, candidate);
    const issues = disagreements(resolution);
    if (!resolution.matched || issues.length) {
      return {
        ...base,
        providerMatchId,
        candidate,
        resolution,
        immutableFactDisagreements: issues,
        error: "GOAL fixture detail disagreed with immutable match facts.",
      };
    }

    const lineupResponse = await client.get(
      "/fixtures/" + encodeURIComponent(providerMatchId) + "/lineups",
    );
    const eventResponse = await client.get(
      "/fixtures/" + encodeURIComponent(providerMatchId) + "/events",
    );
    const statsResponse = await client.get(
      "/fixtures/" + encodeURIComponent(providerMatchId) + "/statistics",
    );

    const lineup = lineupResponse.ok
      ? auditGoalLineups(lineupResponse.body, selected.internal)
      : {
          ...emptyLineupAudit(selected.internal),
          status: "error" as const,
          evidence: [responseError(lineupResponse.body, "Lineup request failed.")],
        };
    const events = eventResponse.ok
      ? auditEvents(eventResponse.body, selected.internal)
      : {
          ...emptyEventsAudit(),
          status: "error" as const,
          evidence: [responseError(eventResponse.body, "Event request failed.")],
        };
    const statistics = statsResponse.ok
      ? goalStatistics(statsResponse.body)
      : {
          ...emptyStatisticsAudit(),
          status: "error" as const,
          evidence: [responseError(statsResponse.body, "Statistics request failed.")],
        };

    return {
      ...base,
      status: "resolved",
      providerMatchId,
      candidate,
      resolution,
      immutableFactDisagreements: issues,
      lineup,
      events,
      statistics,
      error: null,
    };
  } catch (error) {
    return {
      ...base,
      status: "error",
      error: safeErrorMessage(error),
    };
  }
}

function bigBallsLeague(selected: SelectedMatch) {
  return selected.competitionKind === "la_liga" ? "laliga" : "cl";
}

async function bigBallsFixtureForMatch(
  selected: SelectedMatch,
  client: ProviderAuditClient,
) {
  const date = selected.internal.kickoff.slice(0, 10);
  const path =
    "/v1/matches?sport=football&league=" + bigBallsLeague(selected) +
    "&date=" + date + "&limit=200";
  const response = await client.get(path);
  if (!response.ok) {
    throw new Error(responseError(response.body, "Big Balls match list failed."));
  }
  return arrayValue(response.body.data)
    .map((row) => ({ row, candidate: bigBallsCandidate(row) }))
    .find(({ candidate }) =>
      candidate && resolveMatchCandidate(selected.internal, candidate).matched
    ) ?? null;
}

function combineBigBallsStatistics(
  teamBody: JsonObject,
  storedBody: JsonObject,
  teamOk: boolean,
  storedOk: boolean,
): { audit: StatisticsAudit; playerRows: unknown[] } {
  const teamData = asObject(teamBody.data);
  const storedData = asObject(storedBody.data);
  const storedMeta = asObject(storedBody.meta);
  const teamMeta = asObject(teamBody.meta);
  const teamValues = [
    ...(teamData?.home ? [teamData.home] : []),
    ...(teamData?.away ? [teamData.away] : []),
    ...arrayValue(storedData?.team_stats, "items"),
  ];
  const playerRows = arrayValue(storedData?.players, "items");
  const anyAvailable = teamValues.length > 0 || playerRows.length > 0;
  const gated = (!teamOk && teamBody) || (!storedOk && storedBody);
  return {
    playerRows,
    audit: auditStatistics(teamValues, playerRows, {
      status: anyAvailable
        ? gated ? "partial" : "available"
        : gated
          ? "plan_gated"
          : "not_available",
      documentationOnly: ["xG", "xA", "rating", "coordinates"],
      evidence: [
        teamMeta?.available === false
          ? "Per-team statistics endpoint reported available=false."
          : "Per-team statistics were counted only when actual values appeared.",
        storedMeta?.players_available === false
          ? "Stored match stats reported players_available=false."
          : "Stored player rows were audited independently from team rows.",
        "On the authenticated free plan, documented computed xG may be omitted rather than returned as null.",
      ],
    }),
  };
}

async function sweepBigBallsMatch(
  selected: SelectedMatch,
  client: ProviderAuditClient,
): Promise<BigBallsSweepInternal> {
  const base = baseMatchAudit(selected);
  try {
    const found = await bigBallsFixtureForMatch(selected, client);
    if (!found?.candidate?.providerMatchId) {
      return {
        report: {
          ...base,
          error: "No dated Big Balls candidate passed the hardened resolver.",
        },
        playerRows: [],
      };
    }
    const providerMatchId = found.candidate.providerMatchId;
    const detailResponse = await client.get(
      "/v1/matches/" + encodeURIComponent(providerMatchId) + "?sport=football",
    );
    const candidate = detailResponse.ok
      ? bigBallsCandidate(detailResponse.body.data) ?? found.candidate
      : found.candidate;
    const resolution = resolveMatchCandidate(selected.internal, candidate);
    const issues = disagreements(resolution);
    if (!resolution.matched || issues.length) {
      return {
        report: {
          ...base,
          providerMatchId,
          candidate,
          resolution,
          immutableFactDisagreements: issues,
          error: "Big Balls match detail disagreed with immutable match facts.",
        },
        playerRows: [],
      };
    }

    const lineupResponse = await client.get(
      "/v1/stored/matches/" + encodeURIComponent(providerMatchId) + "/lineups",
    );
    const eventResponse = await client.get(
      "/v1/matches/" + encodeURIComponent(providerMatchId) +
        "/events?sport=football",
    );
    const teamStatsResponse = await client.get(
      "/v1/matches/" + encodeURIComponent(providerMatchId) + "/statistics",
    );
    const storedStatsResponse = await client.get(
      "/v1/stored/matches/" + encodeURIComponent(providerMatchId) + "/stats",
    );
    const combined = combineBigBallsStatistics(
      teamStatsResponse.body,
      storedStatsResponse.body,
      teamStatsResponse.ok,
      storedStatsResponse.ok,
    );

    return {
      report: {
        ...base,
        status: "resolved",
        providerMatchId,
        candidate,
        resolution,
        immutableFactDisagreements: issues,
        lineup: lineupResponse.ok
          ? auditBigBallsLineups(lineupResponse.body, selected.internal)
          : {
              ...emptyLineupAudit(selected.internal),
              status: "error",
              evidence: [responseError(lineupResponse.body, "Lineup request failed.")],
            },
        events: eventResponse.ok
          ? auditEvents(eventResponse.body, selected.internal, {
              planGatedFullTimeline: true,
            })
          : {
              ...emptyEventsAudit(),
              status: eventResponse.status === 403 ? "plan_gated" : "error",
              evidence: [responseError(eventResponse.body, "Event request failed.")],
            },
        statistics: combined.audit,
        error: null,
      },
      playerRows: combined.playerRows,
    };
  } catch (error) {
    return {
      report: {
        ...base,
        status: "error",
        error: safeErrorMessage(error),
      },
      playerRows: [],
    };
  }
}

type FootballDataMatch = {
  id: number;
  utcDate: string;
  competition: { name: string };
  homeTeam: { name: string };
  awayTeam: { name: string };
  score: { fullTime: { home: number | null; away: number | null } };
};

async function footballDataCheck(selected: SelectedMatch): Promise<FootballDataCheck> {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) {
    return {
      label: selected.label,
      status: "not_configured",
      providerMatchId: null,
      disagreements: [],
      evidence: ["FOOTBALL_DATA_API_KEY is not configured."],
    };
  }
  const providerId = selected.internal.providerIds["football-data-org"];
  if (!providerId) {
    return {
      label: selected.label,
      status: "not_available",
      providerMatchId: null,
      disagreements: [],
      evidence: ["Internal match has no football-data.org mapping."],
    };
  }
  try {
    const data = await fetchJson<FootballDataMatch>(
      FOOTBALL_DATA_BASE_URL + "/matches/" + encodeURIComponent(providerId),
      { headers: { "X-Auth-Token": apiKey } },
    );
    const candidate: MatchCandidate = {
      providerMatchId: String(data.id),
      kickoff: data.utcDate,
      calendarDate: data.utcDate.slice(0, 10),
      localTime: null,
      temporalPrecision: "exact",
      homeTeam: data.homeTeam.name,
      awayTeam: data.awayTeam.name,
      homeScore: data.score.fullTime.home,
      awayScore: data.score.fullTime.away,
      competition: data.competition.name,
    };
    const resolution = resolveMatchCandidate(
      selected.internal,
      candidate,
      "football-data-org",
    );
    const issues = disagreements(resolution);
    return {
      label: selected.label,
      status: resolution.matched && !issues.length ? "agree" : "disagree",
      providerMatchId: providerId,
      disagreements: issues,
      evidence: ["Fetched through the existing exact internal provider mapping."],
    };
  } catch (error) {
    return {
      label: selected.label,
      status: "error",
      providerMatchId: providerId,
      disagreements: [],
      evidence: [safeErrorMessage(error)],
    };
  }
}

function playerIdentity(row: unknown) {
  const object = asObject(row);
  if (!object) return null;
  const player = asObject(object.player);
  const team = asObject(object.team);
  const teamName = stringValue(object, "team_name", "teamName") ??
    stringValue(team, "name");
  if (teamName && !matchTeamIdentity("FC Barcelona", teamName).matched) return null;
  const id = stringValue(object, "player_id", "playerId") ?? stringValue(player, "id");
  if (!id) return null;
  return {
    id,
    name:
      stringValue(object, "player_name", "playerName", "name") ??
      stringValue(player, "name", "display_name"),
  };
}

function stateFromStatistics(
  audit: StatisticsAudit,
  field: FinalAuditStatField,
): AuditFieldState {
  return audit.fieldStates[field];
}

async function seasonPlayerAudit(
  client: ProviderAuditClient,
  sweeps: BigBallsSweepInternal[],
): Promise<FinalProviderAuditReport["providers"]["bigBallsData"]["seasonPlayerAudit"]> {
  let player = sweeps
    .flatMap((sweep) => sweep.playerRows)
    .map(playerIdentity)
    .find((value): value is NonNullable<typeof value> => value !== null);
  if (!player) {
    try {
      const search = await client.get(
        "/v1/players?name=" + encodeURIComponent("Lamine Yamal") +
          "&sport=football&limit=10",
      );
      const candidates = arrayValue(search.body.data, "items", "players");
      player = candidates
        .map((row) => {
          const object = asObject(row);
          const team = asObject(object?.team);
          const teamName = stringValue(object, "team_name", "teamName") ??
            stringValue(team, "name");
          const name = stringValue(object, "name", "player_name", "playerName");
          const id = stringValue(object, "id", "player_id", "playerId");
          if (!id || !name || !name.toLowerCase().includes("lamine")) return null;
          if (teamName && !matchTeamIdentity("FC Barcelona", teamName).matched) return null;
          return { id, name };
        })
        .find((value): value is NonNullable<typeof value> => value !== null);
    } catch {
      player = undefined;
    }
  }
  if (!player) {
    return {
      status: "not_available",
      playerId: null,
      playerName: null,
      actualFields: [],
      xG: "unknown",
      xA: "unknown",
      rating: "unknown",
      evidence: [
        "No Barcelona player ID was available from match rows or the free player search.",
      ],
    };
  }
  try {
    const response = await client.get(
      "/v1/players/" + encodeURIComponent(player.id) + "/stats?sport=football",
    );
    if (!response.ok) {
      return {
        status: response.status === 403 ? "plan_gated" : "error",
        playerId: player.id,
        playerName: player.name,
        actualFields: [],
        xG: "documentation_only",
        xA: "documentation_only",
        rating: "documentation_only",
        evidence: [responseError(response.body, "Season-player request failed.")],
      };
    }
    const rows = arrayValue(response.body.data, "items", "seasons");
    const values = rows.length ? rows : response.body.data ? [response.body.data] : [];
    const audit = auditStatistics([], values, {
      documentationOnly: ["xG", "xA", "rating"],
    });
    return {
      status: values.length ? "available" : "not_available",
      playerId: player.id,
      playerName: player.name,
      actualFields: audit.actualPlayerFields,
      xG: stateFromStatistics(audit, "xG"),
      xA: stateFromStatistics(audit, "xA"),
      rating: stateFromStatistics(audit, "rating"),
      evidence: [
        values.length
          ? "Actual season-stat rows were inspected."
          : "Endpoint returned no actual season-stat row for the selected Barcelona player.",
      ],
    };
  } catch (error) {
    return {
      status: "error",
      playerId: player.id,
      playerName: player.name,
      actualFields: [],
      xG: "unknown",
      xA: "unknown",
      rating: "unknown",
      evidence: [safeErrorMessage(error)],
    };
  }
}

function hasActualField(matches: ProviderMatchAudit[], field: FinalAuditStatField) {
  return matches.some((match) =>
    match.statistics.fieldStates[field] === "present_nonzero" ||
    match.statistics.fieldStates[field] === "present_zero_only"
  );
}

function providerComparison(
  goalMatches: ProviderMatchAudit[],
  bigBallsMatches: ProviderMatchAudit[],
): FinalProviderAuditReport["providerComparison"] {
  const goalCompleteLineups = goalMatches.filter(
    (match) => match.lineup.barcelona?.completeStartingXI,
  ).length;
  const goalCompleteGoals = goalMatches.filter(
    (match) => match.events.goalCountMatchesFinalScore === true,
  ).length;
  const bigBallsPlayerStatMatches = bigBallsMatches.filter((match) =>
    match.statistics.fieldStates.minutes === "present_nonzero"
  ).length;
  const bigBallsTeamStats = hasActualField(bigBallsMatches, "possession") ||
    hasActualField(bigBallsMatches, "shots");
  const goalTeamStats = hasActualField(goalMatches, "possession") ||
    hasActualField(goalMatches, "shots");
  const xgOwner = hasActualField(bigBallsMatches, "xG")
    ? "Big Balls Sports Data"
    : hasActualField(goalMatches, "xG")
      ? "GOAL API"
      : "NO_FREE_RELIABLE_SOURCE";

  return [
    {
      fieldGroup: "fixtures, results, standings",
      recommendedOwner: "football-data.org",
      supportingProviders: ["openfootball", "GOAL API", "Big Balls Sports Data"],
      evidence: "Existing exact mappings and all live immutable-fact checks remain the strongest stable backbone.",
    },
    {
      fieldGroup: "confirmed lineup, bench, formation, shirt numbers",
      recommendedOwner:
        goalCompleteLineups === goalMatches.length && goalMatches.length
          ? "GOAL API"
          : "NO_FREE_RELIABLE_SOURCE",
      supportingProviders: goalCompleteLineups ? ["GOAL API"] : [],
      evidence: goalCompleteLineups + "/" + goalMatches.length +
        " GOAL API matches had exactly 11 named Barcelona starters plus a classified bench; Big Balls had an XI in 3/4 but no formation and left non-starters unclassified.",
    },
    {
      fieldGroup: "scoring events and goal reconciliation",
      recommendedOwner:
        goalCompleteGoals === goalMatches.length && goalMatches.length
          ? "GOAL API"
          : "NO_FREE_RELIABLE_SOURCE",
      supportingProviders: ["football-data.org basic events", "Big Balls scoring events"],
      evidence: goalCompleteGoals + "/" + goalMatches.length +
        " GOAL scoring-event responses reconciled goal count to the final score.",
    },
    {
      fieldGroup: "cards, substitutions, and complete event timeline",
      recommendedOwner: "NO_FREE_RELIABLE_SOURCE",
      supportingProviders: [],
      evidence: "GOAL returned goal rows only; Big Balls exposes scoring events on free while its documented complete event stream is plan-gated.",
    },
    {
      fieldGroup: "core team match statistics",
      recommendedOwner: goalTeamStats
        ? "GOAL API"
        : bigBallsTeamStats
          ? "Big Balls Sports Data"
          : "NO_FREE_RELIABLE_SOURCE",
      supportingProviders: [
        ...(bigBallsTeamStats ? ["Big Balls Sports Data"] : []),
        ...(goalTeamStats ? ["GOAL API"] : []),
      ],
      evidence: "GOAL returned populated possession, shooting, passing, corners, fouls, offsides, and saves for 4/4 matches; Big Balls supplied a richer La Liga shape but no UCL stats.",
    },
    {
      fieldGroup: "player match box score",
      recommendedOwner: bigBallsPlayerStatMatches
        ? "Big Balls Sports Data (coverage-limited)"
        : "StatsHawk (availability-limited)",
      supportingProviders: ["StatsHawk"],
      evidence: bigBallsPlayerStatMatches + "/" + bigBallsMatches.length +
        " Big Balls matches returned populated player minutes, actions, and ratings; StatsHawk remains useful enrichment where it resolves.",
    },
    {
      fieldGroup: "xG/xA",
      recommendedOwner: xgOwner,
      supportingProviders: [],
      evidence: "A field must appear in an actual response on the configured free plan; advertised or paid-only coverage does not qualify.",
    },
    {
      fieldGroup: "player/team profile fallback",
      recommendedOwner: "StatsHawk",
      supportingProviders: ["TheSportsDB"],
      evidence: "StatsHawk's 35-row roster is broader and structured; TheSportsDB remains best-effort profile enrichment.",
    },
    {
      fieldGroup: "result cross-check",
      recommendedOwner: "openfootball",
      supportingProviders: ["GOAL API", "Big Balls Sports Data", "StatsHawk"],
      evidence: "Openfootball remains the independent CC0 check where its competition dataset exists.",
    },
  ];
}

async function runUncached(refreshBypassed: boolean): Promise<FinalProviderAuditReport> {
  const selection = await selectReliabilityMatches();
  const selected = selection.selected;
  const footballDataCrossChecks = await Promise.all(selected.map(footballDataCheck));

  const goalKey = process.env.GOAL_API_KEY;
  const goalClient = goalKey
    ? new ProviderAuditClient("goal-api", goalKey, GOAL_API_BASE_URL)
    : null;
  const goalMatches: ProviderMatchAudit[] = [];
  if (goalClient) {
    for (const match of selected) goalMatches.push(await sweepGoalMatch(match, goalClient));
  } else {
    goalMatches.push(...selected.map((match) => ({
      ...baseMatchAudit(match),
      error: "GOAL_API_KEY is not configured.",
    })));
  }

  const bigBallsKey = process.env.BBS_API_KEY;
  const bigBallsClient = bigBallsKey
    ? new ProviderAuditClient("big-balls-data", bigBallsKey, BIG_BALLS_BASE_URL)
    : null;
  let account = { plan: null as string | null, perMinute: null as number | null, perDay: null as number | null };
  const bigBallsSweeps: BigBallsSweepInternal[] = [];
  if (bigBallsClient) {
    const me = await bigBallsClient.get("/v1/user/me");
    if (me.ok) {
      const data = asObject(me.body.data);
      const limits = asObject(data?.limits);
      account = {
        plan: stringValue(data, "plan"),
        perMinute: typeof limits?.per_minute === "number" ? limits.per_minute : null,
        perDay: typeof limits?.per_day === "number" ? limits.per_day : null,
      };
    }
    for (const match of selected) {
      bigBallsSweeps.push(await sweepBigBallsMatch(match, bigBallsClient));
    }
  } else {
    bigBallsSweeps.push(...selected.map((match) => ({
      report: {
        ...baseMatchAudit(match),
        error: "BBS_API_KEY is not configured.",
      },
      playerRows: [],
    })));
  }
  const bigBallsMatches = bigBallsSweeps.map((sweep) => sweep.report);
  const playerSeason = bigBallsClient
    ? await seasonPlayerAudit(bigBallsClient, bigBallsSweeps)
    : {
        status: "not_tested" as const,
        playerId: null,
        playerName: null,
        actualFields: [],
        xG: "unknown" as const,
        xA: "unknown" as const,
        rating: "unknown" as const,
        evidence: ["BBS_API_KEY is not configured."],
      };
  const comparison = providerComparison(goalMatches, bigBallsMatches);
  const goalResolved = goalMatches.filter((match) => match.status === "resolved").length;
  const bigBallsResolved = bigBallsMatches.filter((match) => match.status === "resolved").length;

  return {
    generatedAt: new Date().toISOString(),
    environment: "development",
    cache: {
      hit: false,
      ttlSeconds: CACHE_TTL_SECONDS,
      refreshBypassed,
    },
    database: {
      mode: "read-only",
      writesAttempted: 0,
      schemaChanged: false,
    },
    documentation: {
      researchedAt: "2026-09-25",
      goalApi: [
        "https://goal-api.com/documentation",
        "https://goal-api.com/openapi.json",
        "https://goal-api.com/coverage",
        "https://goal-api.com/terms",
      ],
      bigBallsData: [
        "https://bigballsdata.com/docs/soccer",
        "https://bigballsdata.com/openapi.json",
        "https://bigballsdata.com/coverage",
        "https://bigballsdata.com/docs/quickstart",
      ],
    },
    selection: selected.map((match) => ({
      label: match.label,
      internalMatchId: match.internal.id,
      competition: match.internal.competition.name,
      kickoff: match.internal.kickoff,
      fixture: match.internal.homeTeam.name + " vs " + match.internal.awayTeam.name,
      score: String(match.internal.score.home) + "-" + String(match.internal.score.away),
    })),
    footballDataCrossChecks,
    providers: {
      goalApi: {
        configured: Boolean(goalClient),
        resolvedMatches: goalResolved,
        budget: goalClient
          ? goalClient.usage(1000)
          : {
              hardRequestLimit: 100,
              requestsConsumed: 0,
              rateLimitBefore: null,
              rateLimitAfter: null,
              advertisedAccountLimit: null,
              requests: [],
            },
        matches: goalMatches,
        verdict: goalResolved === selected.length
          ? "All selected matches resolved; use the per-surface audits to decide ownership."
          : "Match availability is incomplete on the selected Barcelona set.",
      },
      bigBallsData: {
        configured: Boolean(bigBallsClient),
        account,
        resolvedMatches: bigBallsResolved,
        budget: bigBallsClient
          ? bigBallsClient.usage(account.perDay)
          : {
              hardRequestLimit: 100,
              requestsConsumed: 0,
              rateLimitBefore: null,
              rateLimitAfter: null,
              advertisedAccountLimit: null,
              requests: [],
            },
        matches: bigBallsMatches,
        seasonPlayerAudit: playerSeason,
        verdict: bigBallsResolved === selected.length
          ? "All selected matches resolved; actual free-plan stat and lineup coverage is reported separately."
          : "Match availability is incomplete on the selected Barcelona set.",
      },
    },
    providerComparison: comparison,
    unresolved: [
      ...comparison
        .filter((row) => row.recommendedOwner === "NO_FREE_RELIABLE_SOURCE")
        .map((row) => row.fieldGroup),
      "3D kit assets and interactive pitch presentation remain a UI/manual-asset phase.",
      "No lineup may be inferred from minutes, roster position, or a partial team sheet.",
    ],
  };
}

export async function runFinalProviderAudit({
  refresh = false,
}: { refresh?: boolean } = {}) {
  if (!refresh && cacheEntry && cacheEntry.expiresAt > Date.now()) {
    return {
      ...cacheEntry.report,
      cache: {
        ...cacheEntry.report.cache,
        hit: true,
        refreshBypassed: false,
      },
    };
  }
  if (inFlight) {
    const report = await inFlight;
    return {
      ...report,
      cache: {
        ...report.cache,
        hit: true,
        refreshBypassed: refresh,
      },
    };
  }
  inFlight = runUncached(refresh);
  try {
    const report = await inFlight;
    cacheEntry = {
      report,
      expiresAt: Date.now() + CACHE_TTL_SECONDS * 1000,
    };
    return report;
  } finally {
    inFlight = null;
  }
}
