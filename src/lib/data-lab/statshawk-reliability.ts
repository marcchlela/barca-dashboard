import { or } from "@prisma/orm-postgres/orm-client";
import { Temporal } from "temporal-polyfill";

import { db } from "../../prisma/db";
import { FOOTBALL_DATA_BASE_URL } from "../providers/football-data/constants";
import { fetchJson, safeErrorMessage } from "./http";
import {
  matchTeamIdentity,
  resolveMatchCandidate,
} from "./match-resolver";
import {
  asObject,
  auditCapabilities,
  auditOverview,
  auditPlayerRows,
  auditRoster,
  blankFieldStates,
  canonicalMeasureSums,
  competitionRows,
  contestCandidate,
  contestRows,
  contestTeam,
  normalizedRole,
  parseAppearances,
  rowMinutes,
  StatsHawkBudgetClient,
  type StatsHawkCompetition,
} from "./providers/statshawk-reliability-core";
import {
  RELIABILITY_FIELD_MAP,
  type FieldState,
  type PlayerOverviewAudit,
  type PlayerPhaseRow,
  type ProviderIdentityCheck,
  type ReliabilityField,
  type ReliabilityMatchResult,
  type RosterAudit,
  type RosterEntryAudit,
  type SeasonSanityRow,
  type SelectedReliabilityMatch,
  type StatsHawkReliabilityReport,
} from "./statshawk-reliability-types";
import { SOURCE_PROFILES } from "./source-status";
import type {
  InternalMatch,
  MatchCandidate,
  MatchResolution,
} from "./types";

export const STATSHAWK_RELIABILITY_CACHE_TTL_SECONDS = 6 * 60 * 60;
const STATSHAWK_HARD_BUDGET = 120 as const;
const REPORT_VERSION = "statshawk-reliability-v1";

type FinishedMatchRows = Awaited<ReturnType<typeof loadFinishedMatches>>;
type FinishedMatchRow = FinishedMatchRows[number];

type SelectedRow = {
  row: FinishedMatchRow;
  label: string;
  competitionKind: SelectedReliabilityMatch["competitionKind"];
  selectionReasons: string[];
};

type SweepInternal = {
  report: ReliabilityMatchResult;
  phaseRows: PlayerPhaseRow[];
  barcelonaTeamId: string | null;
  competitionSlug: string | null;
};

type OpenFootballMatch = {
  date: string;
  time?: string;
  team1: string;
  team2: string;
  score?: { ft?: [number, number] } | [number, number];
};

type OpenFootballSeason = {
  name: string;
  matches: OpenFootballMatch[];
};

type CacheEntry = {
  expiresAt: number;
  report: StatsHawkReliabilityReport;
};

let cacheEntry: CacheEntry | null = null;
let inFlight: Promise<StatsHawkReliabilityReport> | null = null;

async function loadFinishedMatches(barcelonaId: string) {
  return db.orm.public.Match
    .where((match) =>
      or(
        match.homeTeamId.eq(barcelonaId),
        match.awayTeamId.eq(barcelonaId),
      ),
    )
    .where({ status: "finished" })
    .where((match) => match.kickoff.lt(Temporal.Now.instant()))
    .include("homeTeam")
    .include("awayTeam")
    .include("competition")
    .orderBy((match) => match.kickoff.desc())
    .all();
}

function isLaLiga(row: FinishedMatchRow) {
  return (
    row.competition.code === "PD" ||
    row.competition.name.toLowerCase().includes("primera") ||
    row.competition.name.toLowerCase().includes("la liga")
  );
}

function isChampionsLeague(row: FinishedMatchRow) {
  return (
    row.competition.code === "CL" ||
    row.competition.name.toLowerCase().includes("champions league")
  );
}

function selectVariedRows(
  rows: FinishedMatchRow[],
  barcelonaId: string,
  limit: number,
  prefix: string,
  competitionKind: SelectedReliabilityMatch["competitionKind"],
): SelectedRow[] {
  if (!rows.length) return [];
  const selected: Array<{
    row: FinishedMatchRow;
    reasons: string[];
  }> = [];
  const add = (row: FinishedMatchRow | undefined, reason: string) => {
    if (!row) return;
    const existing = selected.find((item) => item.row.id === row.id);
    if (existing) {
      if (!existing.reasons.includes(reason)) existing.reasons.push(reason);
      return;
    }
    if (selected.length < limit) selected.push({ row, reasons: [reason] });
  };

  add(rows[0], "latest finished match in this competition");
  const firstIsHome = rows[0]?.homeTeamId === barcelonaId;
  add(
    rows.find((row) =>
      row.id !== rows[0]?.id &&
      (row.homeTeamId === barcelonaId) !== firstIsHome
    ),
    firstIsHome
      ? "away-match variety"
      : "home-match variety",
  );
  const highScoring = [...rows]
    .filter((row) => !selected.some((item) => item.row.id === row.id))
    .sort((left, right) =>
      ((right.homeScore ?? 0) + (right.awayScore ?? 0)) -
      ((left.homeScore ?? 0) + (left.awayScore ?? 0))
    )[0];
  add(highScoring, "highest remaining combined score for event variety");

  for (const row of rows) {
    if (selected.length >= limit) break;
    add(row, "filled remaining reliability sample");
  }

  return selected.map((item, index) => ({
    row: item.row,
    label: prefix + (index + 1),
    competitionKind,
    selectionReasons: item.reasons,
  }));
}

async function toInternalMatch(row: FinishedMatchRow): Promise<InternalMatch> {
  const mappings = await db.orm.public.ProviderMapping
    .where({ internalId: row.id, entityType: "match" })
    .include("dataSource")
    .all();

  return {
    id: row.id,
    kickoff: row.kickoff.toString(),
    status: row.status,
    competition: {
      id: row.competition.id,
      name: row.competition.name,
      code: row.competition.code,
    },
    seasonId: row.seasonId,
    matchday: row.matchday,
    homeTeam: { id: row.homeTeam.id, name: row.homeTeam.name },
    awayTeam: { id: row.awayTeam.id, name: row.awayTeam.name },
    score: { home: row.homeScore, away: row.awayScore },
    providerIds: Object.fromEntries(
      mappings.map((mapping) => [
        mapping.dataSource.code,
        mapping.providerId,
      ]),
    ),
  };
}

async function selectReliabilityMatches() {
  const barcelona = await db.orm.public.Team
    .where({ isBarcelona: true })
    .first();
  if (!barcelona) {
    throw new Error("FC Barcelona does not exist in the local database.");
  }

  const allFinished = await loadFinishedMatches(barcelona.id);
  const currentSeasonId = allFinished[0]?.seasonId ?? null;
  const currentSeason = currentSeasonId
    ? allFinished.filter((row) => row.seasonId === currentSeasonId)
    : [];
  const laLiga = currentSeason.filter(isLaLiga);
  const championsLeague = currentSeason.filter(isChampionsLeague);
  const selectedRows = [
    ...selectVariedRows(laLiga, barcelona.id, 3, "LL", "la_liga"),
    ...selectVariedRows(
      championsLeague,
      barcelona.id,
      2,
      "UCL",
      "champions_league",
    ),
  ];
  const selected = await Promise.all(
    selectedRows.map(async (item): Promise<SelectedReliabilityMatch> => ({
      label: item.label,
      competitionKind: item.competitionKind,
      selectionReasons: item.selectionReasons,
      internal: await toInternalMatch(item.row),
    })),
  );

  return {
    selected,
    currentSeasonId,
    availableFinished: {
      laLiga: laLiga.length,
      championsLeague: championsLeague.length,
    },
  };
}

function findCompetition(
  competitions: StatsHawkCompetition[],
  kind: SelectedReliabilityMatch["competitionKind"],
) {
  if (kind === "la_liga") {
    return competitions.find((competition) =>
      competition.slug.toLowerCase() === "laliga" ||
      competition.name.toLowerCase() === "la liga" ||
      competition.name.toLowerCase() === "laliga"
    ) ?? null;
  }

  return competitions.find((competition) => {
    const name = competition.name.toLowerCase();
    const slug = competition.slug.toLowerCase();
    return (
      competition.sport?.toLowerCase() === "soccer" &&
      (
        name === "uefa champions league" ||
        name.includes("champions league") ||
        slug === "ucl" ||
        slug.includes("champions")
      )
    );
  }) ?? null;
}

function seasonStartYear(kickoff: string) {
  const year = Number(kickoff.slice(0, 4));
  const month = Number(kickoff.slice(5, 7));
  return month >= 7 ? year : year - 1;
}

function disagreements(
  candidate: MatchCandidate,
  resolution: MatchResolution,
) {
  const issues: string[] = [];
  if (!resolution.criteria.homeTeam) issues.push("home team differs");
  if (!resolution.criteria.awayTeam) issues.push("away team differs");
  if (!resolution.criteria.score) issues.push("full-time score differs");
  if (!resolution.criteria.competition) issues.push("competition differs");
  if (
    candidate.temporalPrecision === "exact" &&
    !resolution.criteria.exactKickoff
  ) {
    issues.push("exact kickoff differs by more than 30 minutes");
  }
  if (
    candidate.temporalPrecision !== "exact" &&
    !resolution.criteria.sameCalendarDate
  ) {
    issues.push("calendar date differs");
  }
  return issues;
}

function identityCheck(
  provider: ProviderIdentityCheck["provider"],
  candidate: MatchCandidate,
  resolution: MatchResolution,
  evidence: string[],
): ProviderIdentityCheck {
  const issues = disagreements(candidate, resolution);
  return {
    provider,
    status: resolution.matched && !issues.length ? "agree" : "disagree",
    candidate,
    resolution,
    disagreements: issues,
    evidence,
  };
}

function unavailableCheck(
  provider: ProviderIdentityCheck["provider"],
  status: ProviderIdentityCheck["status"],
  evidence: string,
): ProviderIdentityCheck {
  return {
    provider,
    status,
    candidate: null,
    resolution: null,
    disagreements: [],
    evidence: [evidence],
  };
}

async function sweepMatch(
  selected: SelectedReliabilityMatch,
  competition: StatsHawkCompetition | null,
  client: StatsHawkBudgetClient,
): Promise<SweepInternal> {
  const base: ReliabilityMatchResult = {
    label: selected.label,
    competitionKind: selected.competitionKind,
    selectionReasons: selected.selectionReasons,
    internal: selected.internal,
    statsHawkCompetition: competition
      ? {
          id: competition.id,
          slug: competition.slug,
          name: competition.name,
        }
      : null,
    status: competition ? "not_available" : "unsupported_competition",
    contestId: null,
    candidate: null,
    resolution: null,
    fieldStates: blankFieldStates(),
    observedMeasureKeys: [],
    rowAudit: null,
    identityChecks: [],
    error: null,
  };
  if (!competition) {
    return {
      report: base,
      phaseRows: [],
      barcelonaTeamId: null,
      competitionSlug: null,
    };
  }

  try {
    const year = seasonStartYear(selected.internal.kickoff);
    const date = selected.internal.kickoff.slice(0, 10);
    const schedulePath =
      "/competitions/" +
      encodeURIComponent(competition.slug) +
      "/editions/" +
      year +
      "/games?date=" +
      encodeURIComponent(date);
    const schedule = await client.get(schedulePath, 2);
    const scheduled = contestRows(schedule)
      .map((row) => ({
        row,
        candidate: contestCandidate(row, competition.name),
      }))
      .find(({ candidate }) =>
        resolveMatchCandidate(
          selected.internal,
          candidate,
          SOURCE_PROFILES.statsHawk.id,
        ).matched
      );
    if (!scheduled?.candidate.providerMatchId) {
      return {
        report: {
          ...base,
          status: "not_available",
          error: "No dated StatsHawk candidate passed the hardened resolver.",
        },
        phaseRows: [],
        barcelonaTeamId: null,
        competitionSlug: competition.slug,
      };
    }

    const contestId = scheduled.candidate.providerMatchId;
    const detailEnvelope = await client.get(
      "/contests/" + encodeURIComponent(contestId),
      1,
    );
    const detail = asObject(detailEnvelope.data);
    if (!detail) throw new Error("Contest detail returned no data object.");
    const candidate = contestCandidate(detail, competition.name);
    const resolution = resolveMatchCandidate(
      selected.internal,
      candidate,
      SOURCE_PROFILES.statsHawk.id,
    );
    const statsHawkCheck = identityCheck(
      "statshawk",
      candidate,
      resolution,
      ["Resolved from live schedule plus contest detail."],
    );
    if (!resolution.matched || statsHawkCheck.disagreements.length) {
      return {
        report: {
          ...base,
          status: "not_available",
          contestId,
          candidate,
          resolution,
          identityChecks: [statsHawkCheck],
          error: "Contest detail disagreed with immutable internal facts.",
        },
        phaseRows: [],
        barcelonaTeamId: null,
        competitionSlug: competition.slug,
      };
    }

    const homeTeam = contestTeam(detail, "home");
    const awayTeam = contestTeam(detail, "away");
    const barcelonaTeamId = matchTeamIdentity(
      "FC Barcelona",
      homeTeam.name ?? "",
    ).matched
      ? homeTeam.id
      : matchTeamIdentity("FC Barcelona", awayTeam.name ?? "").matched
        ? awayTeam.id
        : null;
    if (!barcelonaTeamId) {
      throw new Error("Contest detail did not identify Barcelona's team ID.");
    }
    const boxscore = await client.get(
      "/contests/" + encodeURIComponent(contestId) + "/boxscore",
      2,
    );
    const parsed = parseAppearances(boxscore);
    const { audit, barcelonaRows } = auditPlayerRows(
      parsed,
      barcelonaTeamId,
    );
    const observedMeasureKeys = [
      ...new Set(barcelonaRows.flatMap((row) => Object.keys(row.measures))),
    ].sort();

    return {
      report: {
        ...base,
        status: "ok",
        contestId,
        candidate,
        resolution,
        fieldStates: Object.fromEntries(
          Object.entries(RELIABILITY_FIELD_MAP).map(([field, aliases]) => {
            const values = barcelonaRows.flatMap((row) =>
              aliases
                .filter((alias) => Object.hasOwn(row.measures, alias))
                .map((alias) => row.measures[alias])
            );
            const state: FieldState = !values.length
              ? "absent"
              : values.some((value) =>
                    (typeof value === "number" && value !== 0) ||
                    (typeof value === "boolean" && value)
                  )
                ? "present_nonzero"
                : "present_zero_only";
            return [field, state];
          }),
        ) as Record<ReliabilityField, FieldState>,
        observedMeasureKeys,
        rowAudit: audit,
        identityChecks: [statsHawkCheck],
        error: null,
      },
      phaseRows: barcelonaRows,
      barcelonaTeamId,
      competitionSlug: competition.slug,
    };
  } catch (error) {
    return {
      report: {
        ...base,
        status: "error",
        error: safeErrorMessage(error),
      },
      phaseRows: [],
      barcelonaTeamId: null,
      competitionSlug: competition.slug,
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

async function checkFootballData(
  internal: InternalMatch,
): Promise<ProviderIdentityCheck> {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) {
    return unavailableCheck(
      "football-data-org",
      "not_configured",
      "FOOTBALL_DATA_API_KEY is not configured.",
    );
  }
  const providerId =
    internal.providerIds[SOURCE_PROFILES.footballData.id];
  if (!providerId) {
    return unavailableCheck(
      "football-data-org",
      "not_available",
      "The internal match has no football-data.org provider mapping.",
    );
  }

  try {
    const raw = await fetchJson<FootballDataMatch>(
      FOOTBALL_DATA_BASE_URL + "/matches/" + encodeURIComponent(providerId),
      { headers: { "X-Auth-Token": apiKey } },
    );
    const candidate: MatchCandidate = {
      providerMatchId: String(raw.id),
      kickoff: raw.utcDate,
      calendarDate: raw.utcDate.slice(0, 10),
      localTime: null,
      temporalPrecision: "exact",
      homeTeam: raw.homeTeam.name,
      awayTeam: raw.awayTeam.name,
      homeScore: raw.score.fullTime.home,
      awayScore: raw.score.fullTime.away,
      competition: raw.competition.name,
    };
    return identityCheck(
      "football-data-org",
      candidate,
      resolveMatchCandidate(
        internal,
        candidate,
        SOURCE_PROFILES.footballData.id,
      ),
      ["Fetched by the existing exact provider mapping " + providerId + "."],
    );
  } catch (error) {
    return {
      ...unavailableCheck(
        "football-data-org",
        "error",
        "The independent football-data.org check failed.",
      ),
      evidence: [safeErrorMessage(error)],
    };
  }
}

function openFootballScore(match: OpenFootballMatch) {
  if (!match.score) return null;
  return Array.isArray(match.score) ? match.score : match.score.ft ?? null;
}

function openFootballCandidate(
  match: OpenFootballMatch,
): MatchCandidate {
  const score = openFootballScore(match);
  return {
    providerMatchId: null,
    kickoff: null,
    calendarDate: match.date,
    localTime: match.time ?? null,
    temporalPrecision: match.time
      ? "local_time_unknown_zone"
      : "date_only",
    homeTeam: match.team1,
    awayTeam: match.team2,
    homeScore: score?.[0] ?? null,
    awayScore: score?.[1] ?? null,
    competition: "Spain Primera División",
  };
}

async function loadOpenFootballForSeason(kickoff: string) {
  const start = seasonStartYear(kickoff);
  const seasonPath = start + "-" + String(start + 1).slice(-2);
  const url =
    "https://raw.githubusercontent.com/openfootball/football.json/master/" +
    seasonPath +
    "/es.1.json";
  return {
    url,
    season: await fetchJson<OpenFootballSeason>(url),
  };
}

function checkOpenFootball(
  internal: InternalMatch,
  loaded: { url: string; season: OpenFootballSeason } | null,
  loadError: string | null,
): ProviderIdentityCheck {
  if (internal.competition.code === "CL") {
    return unavailableCheck(
      "openfootball",
      "not_available",
      "The official openfootball Champions League repository has no 2026/27 dataset available for this check.",
    );
  }
  if (!loaded) {
    return unavailableCheck(
      "openfootball",
      loadError ? "error" : "not_available",
      loadError ?? "No openfootball season data was loaded.",
    );
  }
  const found = loaded.season.matches
    .map(openFootballCandidate)
    .find((candidate) =>
      resolveMatchCandidate(internal, candidate).matched
    );
  if (!found) {
    return unavailableCheck(
      "openfootball",
      "not_available",
      "The season file contained no row passing the hardened resolver.",
    );
  }
  return identityCheck(
    "openfootball",
    found,
    resolveMatchCandidate(internal, found),
    ["Reused one CC0 season file: " + loaded.url],
  );
}

function defaultRosterAudit(
  status: RosterAudit["status"],
  teamId: string | null,
  evidence: string,
): RosterAudit {
  return {
    status,
    teamId,
    totalRows: 0,
    uniqueProviderPersonIds: 0,
    duplicateProviderPersonIds: [],
    coverage: {
      providerPersonId: 0,
      displayName: 0,
      position: 0,
      shirtNumber: 0,
      nationality: 0,
      birthCountry: 0,
      birthDate: 0,
      preferredFoot: 0,
      height: 0,
      weight: 0,
      portraitOrPhoto: 0,
      membershipStatus: 0,
    },
    sourceCounts: {},
    representativeRows: [],
    evidence: [evidence],
  };
}

function selectOverviewPlayers(
  rosterEntries: RosterEntryAudit[],
  sweep: SweepInternal[],
) {
  const minutes = new Map<string, number>();
  for (const match of sweep) {
    for (const row of match.phaseRows) {
      if (row.personId) {
        minutes.set(
          row.personId,
          (minutes.get(row.personId) ?? 0) + rowMinutes(row),
        );
      }
    }
  }
  const roles: PlayerOverviewAudit["selectedRole"][] = [
    "goalkeeper",
    "defender",
    "midfielder",
    "forward",
  ];
  return roles.flatMap((role) => {
    const candidates = rosterEntries
      .filter((entry) =>
        entry.personId && normalizedRole(entry.position) === role
      )
      .sort((left, right) =>
        (minutes.get(right.personId ?? "") ?? 0) -
        (minutes.get(left.personId ?? "") ?? 0)
      );
    const selected = candidates[0];
    return selected?.personId
      ? [{
          personId: selected.personId,
          displayName: selected.displayName,
          selectedRole: role,
        }]
      : [];
  });
}

function overviewRows(
  overview: PlayerOverviewAudit,
): PlayerPhaseRow[] {
  return Object.entries(overview.totalsByPhase).map(([phase, measures]) => ({
    appearanceId: null,
    personId: overview.personId,
    personName: overview.displayName,
    teamId: overview.currentTeam?.id ?? null,
    teamName: overview.currentTeam?.name ?? null,
    phase,
    measures,
  }));
}

function seasonSanityRows(
  overviews: PlayerOverviewAudit[],
  sweep: SweepInternal[],
): SeasonSanityRow[] {
  const additiveFields = new Set([
    "minutes",
    "goals",
    "assists",
    "shots",
    "shotsOnTarget",
    "passes",
    "completedPasses",
    "tackles",
    "interceptions",
    "fouls",
    "yellowCards",
    "redCards",
    "saves",
    "goalsConceded",
    "cleanSheet",
    "xG",
    "xA",
  ]);

  return overviews
    .filter(
      (overview) =>
        overview.status === "ok" &&
        overview.competition.slug.toLowerCase().includes("laliga"),
    )
    .map((overview) => {
      const relevant = sweep.filter(
        (match) =>
          match.report.status === "ok" &&
          match.competitionSlug === overview.competition.slug,
      );
      const retrievedRows = relevant.flatMap((match) =>
        match.phaseRows.filter((row) => row.personId === overview.personId)
      );
      const overviewTotals = Object.fromEntries(
        Object.entries(canonicalMeasureSums(overviewRows(overview)))
          .filter(([field]) => additiveFields.has(field)),
      );
      const retrievedMatchSums = Object.fromEntries(
        Object.entries(canonicalMeasureSums(retrievedRows))
          .filter(([field]) => additiveFields.has(field)),
      );
      const comparableKeys = Object.keys(overviewTotals).filter((field) =>
        Object.hasOwn(retrievedMatchSums, field)
      );

      return {
        personId: overview.personId,
        displayName: overview.displayName,
        competitionSlug: overview.competition.slug,
        retrievedMatchCount: relevant.filter((match) =>
          match.phaseRows.some((row) => row.personId === overview.personId)
        ).length,
        overviewTotals,
        retrievedMatchSums,
        comparableKeys,
        note:
          "Retrieved sums cover only the sampled matches; they test naming and units, not equality with the season total.",
      };
    });
}

function consistencyMatrix(matches: ReliabilityMatchResult[]) {
  return Object.fromEntries(
    Object.keys(RELIABILITY_FIELD_MAP).map((field) => [
      field,
      Object.fromEntries(
        matches.map((match) => [
          match.label,
          match.fieldStates[field as ReliabilityField],
        ]),
      ),
    ]),
  ) as Record<ReliabilityField, Record<string, FieldState>>;
}

function consistentlyPresentFields(matches: ReliabilityMatchResult[]) {
  const resolved = matches.filter((match) => match.status === "ok");
  if (!resolved.length) return [];
  return (Object.keys(RELIABILITY_FIELD_MAP) as ReliabilityField[])
    .filter((field) =>
      resolved.every((match) =>
        match.fieldStates[field] === "present_zero_only" ||
        match.fieldStates[field] === "present_nonzero"
      )
    );
}

function schemaProposal(roster: RosterAudit) {
  return {
    prismaModified: false as const,
    normalizedColumnsToAddLater: [
      {
        model: "PlayerMatchStatistic",
        field: "fouls",
        type: "Int?",
        reason: "Direct additive match measure returned consistently by StatsHawk.",
      },
      {
        model: "PlayerMatchStatistic",
        field: "saves",
        type: "Int?",
        reason: "Core goalkeeper match measure.",
      },
      {
        model: "PlayerMatchStatistic",
        field: "goalsConceded",
        type: "Int?",
        reason: "Core goalkeeper match measure.",
      },
      {
        model: "PlayerMatchStatistic",
        field: "cleanSheet",
        type: "Boolean?",
        reason: "Provider supplies a keeper clean-sheet value distinct from missing.",
      },
    ],
    derivedFields: [
      {
        field: "shotAccuracy",
        recommendation:
          "Do not add a column; derive shotsOnTarget / shots when shots > 0 and retain the provider value in rawData for comparison.",
      },
      {
        field: "savePercentage",
        recommendation:
          "Do not add a column yet; derive cautiously from saves and goalsConceded only when the denominator semantics are valid, retaining provider save_pct in rawData.",
      },
      {
        field: "passAccuracy",
        recommendation:
          "Keep the existing column for compatibility, normalize it to a 0–1 ratio, derive from completedPasses / passes, and use the provider pass_pct only as a validation value in rawData.",
      },
    ],
    provenance: {
      currentRecommendation:
        "For the first ingestion phase, keep one canonical PlayerMatchStatistic owned entirely by StatsHawk via dataSourceId, with the sanitized provider observation in rawData. Do not mix providers field-by-field yet.",
      futureMultiProviderRecommendation:
        "When a second provider contributes unique fields such as xG, add PlayerMatchStatisticObservation rows keyed by match, player, team, and data source, then materialize the existing canonical row from explicit source priorities. Add compact fieldProvenance JSON to the canonical row only if it becomes hybrid.",
      rejectedForNow: [
        "Field-level provenance JSON without retained provider observations.",
        "Multiple provider rows in PlayerMatchStatistic despite its canonical unique(matchId, playerId) contract.",
        "A new observation model before a second useful current provider actually exists.",
      ],
    },
    profileAndSquadNotes: [
      "Player already has birthDate, nationality, primaryPosition, preferredFoot, and portraitUrl; populate only fields actually supplied and identity-resolved.",
      "Do not copy birthCountry into Player.nationality.",
      "Consider Player.heightCm Int? and Player.weightKg Int? only if the full roster audit remains broadly populated; this run observed height on " +
        roster.coverage.height +
        "/" +
        roster.totalRows +
        " and weight on " +
        roster.coverage.weight +
        "/" +
        roster.totalRows +
        ".",
      "Do not populate SquadMembership.shirtNumber or lineup roles from StatsHawk unless a real membership/lineup field appears.",
    ],
  };
}

function identityStrategy() {
  return {
    automaticEvidenceOrder: [
      "Existing ProviderMapping for dataSource=statshawk, entityType=player, providerId=person ID.",
      "Exact StatsHawk person ID already retained in a reviewed import candidate.",
      "Unique exact accent-folded full display name within the same team/season plus exact birth date and compatible position.",
      "Manual review for every remaining candidate; create no mapping until approved.",
    ],
    normalization: [
      "Unicode NFD accent folding is for candidate generation only; preserve the original display name.",
      "Normalize whitespace, punctuation, and common given-name abbreviations, but never reduce identity to surname-only matching.",
      "Require the current Barcelona team context and use date of birth as the strongest bio discriminator.",
      "Treat youth/reserve players and first-team players as separate identities even when names match.",
    ],
    ambiguousCasePolicy: [
      "Duplicate surname, missing birth date, conflicting position, or multiple internal candidates means no auto-merge.",
      "Name changes and abbreviated provider names require an explicit reviewed alias in ProviderMapping.metadata.",
      "Record the unresolved provider person ID in the lab/import review queue, not in production player rows.",
    ],
    mappingTarget:
      "ProviderMapping(dataSource=statshawk, entityType=player, internalId=Player.id, providerId=StatsHawk person ID), created only during the later ingestion phase.",
  };
}

async function runUncached(
  refreshBypassed: boolean,
): Promise<StatsHawkReliabilityReport> {
  const apiKey = process.env.STATSHAWK_API_KEY;
  if (!apiKey) {
    throw new Error("STATSHAWK_API_KEY is not configured.");
  }

  const selection = await selectReliabilityMatches();
  const client = new StatsHawkBudgetClient(
    apiKey,
    STATSHAWK_HARD_BUDGET,
  );
  const competitionEnvelope = await client.get("/competitions", 1);
  const competitions = competitionRows(competitionEnvelope);
  const laLigaCompetition = findCompetition(competitions, "la_liga");
  const championsLeagueCompetition = findCompetition(
    competitions,
    "champions_league",
  );
  const capabilityReport: StatsHawkReliabilityReport["competitionDiscovery"]["capabilities"] =
    {};
  for (const competition of [
    laLigaCompetition,
    championsLeagueCompetition,
  ]) {
    if (!competition) continue;
    try {
      const response = await client.get(
        "/competitions/" +
          encodeURIComponent(competition.slug) +
          "/capabilities",
        1,
      );
      capabilityReport[competition.slug] = {
        ...auditCapabilities(response),
        error: null,
      };
    } catch (error) {
      capabilityReport[competition.slug] = {
        advertisedPhases: [],
        advertisedMeasures: [],
        error: safeErrorMessage(error),
      };
    }
  }

  const sweep: SweepInternal[] = [];
  for (const selected of selection.selected) {
    sweep.push(
      await sweepMatch(
        selected,
        selected.competitionKind === "la_liga"
          ? laLigaCompetition
          : championsLeagueCompetition,
        client,
      ),
    );
  }

  let openFootball:
    | { url: string; season: OpenFootballSeason }
    | null = null;
  let openFootballError: string | null = null;
  const firstLaLiga = selection.selected.find(
    (match) => match.competitionKind === "la_liga",
  );
  if (firstLaLiga) {
    try {
      openFootball = await loadOpenFootballForSeason(
        firstLaLiga.internal.kickoff,
      );
    } catch (error) {
      openFootballError = safeErrorMessage(error);
    }
  }
  for (const match of sweep) {
    const [footballData, openFootballCheck] = await Promise.all([
      checkFootballData(match.report.internal),
      Promise.resolve(
        checkOpenFootball(
          match.report.internal,
          openFootball,
          openFootballError,
        ),
      ),
    ]);
    match.report.identityChecks.push(footballData, openFootballCheck);
  }

  const teamIdCounts = new Map<string, number>();
  for (const match of sweep) {
    if (match.barcelonaTeamId) {
      teamIdCounts.set(
        match.barcelonaTeamId,
        (teamIdCounts.get(match.barcelonaTeamId) ?? 0) + 1,
      );
    }
  }
  const barcelonaTeamId = [...teamIdCounts.entries()]
    .sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
  let rosterAudit = defaultRosterAudit(
    "not_available",
    barcelonaTeamId,
    "No resolved StatsHawk Barcelona team ID was available.",
  );
  let rosterEntries: RosterEntryAudit[] = [];
  if (barcelonaTeamId) {
    try {
      const rosterEnvelope = await client.get(
        "/teams/" + encodeURIComponent(barcelonaTeamId) + "/roster",
        3,
      );
      const audited = auditRoster(rosterEnvelope, barcelonaTeamId);
      rosterAudit = audited.audit;
      rosterEntries = audited.entries;
      if (teamIdCounts.size > 1) {
        rosterAudit.evidence.push(
          "Warning: resolved matches returned more than one Barcelona team ID: " +
            [...teamIdCounts.keys()].join(", "),
        );
      } else {
        rosterAudit.evidence.push(
          "The same Barcelona team ID was reused across every resolved match.",
        );
      }
    } catch (error) {
      rosterAudit = defaultRosterAudit(
        "error",
        barcelonaTeamId,
        safeErrorMessage(error),
      );
    }
  }

  const playerOverviews: PlayerOverviewAudit[] = [];
  const selectedPlayers = selectOverviewPlayers(rosterEntries, sweep);
  if (laLigaCompetition) {
    for (const player of selectedPlayers) {
      try {
        const response = await client.get(
          "/persons/" +
            encodeURIComponent(player.personId) +
            "/overview?competition=" +
            encodeURIComponent(laLigaCompetition.slug) +
            "&season=" +
            seasonStartYear(selection.selected[0]?.internal.kickoff ?? "2026-08-01"),
          1,
        );
        playerOverviews.push(
          auditOverview(response, player, laLigaCompetition),
        );
      } catch (error) {
        playerOverviews.push({
          personId: player.personId,
          displayName: player.displayName,
          selectedRole: player.selectedRole,
          competition: {
            id: laLigaCompetition.id,
            slug: laLigaCompetition.slug,
            name: laLigaCompetition.name,
          },
          status: "error",
          identity: null,
          currentTeam: null,
          profile: null,
          actualStatPaths: [],
          totalsByPhase: {},
          fieldStates: blankFieldStates(),
          appearances: null,
          starts: null,
          gameLogRows: 0,
          error: safeErrorMessage(error),
        });
      }
    }
  }
  const crossCompetitionPlayer =
    selectedPlayers.find((player) => player.selectedRole === "midfielder") ??
    selectedPlayers[0];
  if (championsLeagueCompetition && crossCompetitionPlayer) {
    try {
      const response = await client.get(
        "/persons/" +
          encodeURIComponent(crossCompetitionPlayer.personId) +
          "/overview?competition=" +
          encodeURIComponent(championsLeagueCompetition.slug) +
          "&season=" +
          seasonStartYear(selection.selected[0]?.internal.kickoff ?? "2026-08-01"),
        1,
      );
      playerOverviews.push(
        auditOverview(
          response,
          crossCompetitionPlayer,
          championsLeagueCompetition,
        ),
      );
    } catch (error) {
      playerOverviews.push({
        personId: crossCompetitionPlayer.personId,
        displayName: crossCompetitionPlayer.displayName,
        selectedRole: crossCompetitionPlayer.selectedRole,
        competition: {
          id: championsLeagueCompetition.id,
          slug: championsLeagueCompetition.slug,
          name: championsLeagueCompetition.name,
        },
        status: "error",
        identity: null,
        currentTeam: null,
        profile: null,
        actualStatPaths: [],
        totalsByPhase: {},
        fieldStates: blankFieldStates(),
        appearances: null,
        starts: null,
        gameLogRows: 0,
        error: safeErrorMessage(error),
      });
    }
  }

  const matches = sweep.map((match) => match.report);
  const matrix = consistencyMatrix(matches);
  const laLigaMatches = matches.filter(
    (match) => match.competitionKind === "la_liga",
  );
  const championsMatches = matches.filter(
    (match) => match.competitionKind === "champions_league",
  );
  const laLigaFields = consistentlyPresentFields(laLigaMatches);
  const championsFields = consistentlyPresentFields(championsMatches);
  const sameShape =
    championsMatches.some((match) => match.status === "ok") &&
    laLigaFields.length === championsFields.length &&
    laLigaFields.every((field) => championsFields.includes(field));
  const actualMatchXG = matches.some((match) =>
    match.fieldStates.xG === "present_nonzero" ||
    match.fieldStates.xG === "present_zero_only"
  );
  const actualMatchXA = matches.some((match) =>
    match.fieldStates.xA === "present_nonzero" ||
    match.fieldStates.xA === "present_zero_only"
  );
  const overviewXG = playerOverviews.some((overview) =>
    overview.fieldStates.xG === "present_nonzero" ||
    overview.fieldStates.xG === "present_zero_only"
  );
  const overviewXA = playerOverviews.some((overview) =>
    overview.fieldStates.xA === "present_nonzero" ||
    overview.fieldStates.xA === "present_zero_only"
  );
  const advertisedMeasures = Object.values(capabilityReport).flatMap(
    (capability) => capability.advertisedMeasures,
  );
  const allIdentityDisagreements = matches.flatMap((match) =>
    match.identityChecks.flatMap((check) => check.disagreements)
  );
  const coreFields: ReliabilityField[] = [
    "minutes",
    "goals",
    "assists",
    "shots",
    "shotsOnTarget",
    "passes",
    "completedPasses",
    "passAccuracy",
    "tackles",
    "interceptions",
    "fouls",
    "yellowCards",
    "redCards",
  ];
  const laLigaStable =
    laLigaMatches.length >= 3 &&
    laLigaMatches.every((match) => match.status === "ok") &&
    coreFields.every((field) => laLigaFields.includes(field));
  const championsStable =
    championsMatches.length === 0 ||
    championsMatches.every((match) => match.status === "ok");
  const reliabilityDecision =
    laLigaStable && championsStable && !allIdentityDisagreements.length
      ? "suitable_as_primary_free_player_stats_source"
      : matches.some((match) => match.status === "ok")
        ? "promising_but_not_yet_primary"
        : "not_suitable";
  const rowAudits = matches
    .map((match) => match.rowAudit)
    .filter((audit): audit is NonNullable<typeof audit> => audit !== null);
  const usage = client.usage();

  return {
    generatedAt: new Date().toISOString(),
    environment: "development",
    cache: {
      hit: false,
      ttlSeconds: STATSHAWK_RELIABILITY_CACHE_TTL_SECONDS,
      refreshBypassed,
    },
    database: {
      mode: "read-only",
      writesAttempted: 0,
      schemaChanged: false,
    },
    budget: {
      hardLimitWeightedUnits: STATSHAWK_HARD_BUDGET,
      expectedUnitsAttempted: usage.expectedUnitsAttempted,
      actualWeightedUnitsConsumed: usage.actualWeightedUnitsConsumed,
      quotaBefore: usage.quotaBefore,
      quotaAfter: usage.quotaAfter,
      quotaLimit: usage.quotaLimit,
      requestCount: usage.requestCount,
      requests: usage.requests,
    },
    selection: {
      currentSeasonId: selection.currentSeasonId,
      availableFinished: selection.availableFinished,
      selected: selection.selected.map((match) => ({
        label: match.label,
        internalMatchId: match.internal.id,
        competitionKind: match.competitionKind,
        selectionReasons: match.selectionReasons,
      })),
    },
    competitionDiscovery: {
      laLiga: laLigaCompetition
        ? {
            id: laLigaCompetition.id,
            slug: laLigaCompetition.slug,
            name: laLigaCompetition.name,
          }
        : null,
      championsLeague: championsLeagueCompetition
        ? {
            id: championsLeagueCompetition.id,
            slug: championsLeagueCompetition.slug,
            name: championsLeagueCompetition.name,
          }
        : null,
      capabilities: capabilityReport,
    },
    matches,
    consistencyMatrix: matrix,
    playerRowSemantics: {
      testedMatches: rowAudits.length,
      totalBarcelonaAppearanceRows: rowAudits.reduce(
        (sum, audit) => sum + audit.barcelonaAppearanceRows,
        0,
      ),
      rowsWithMinutesAboveZero: rowAudits.reduce(
        (sum, audit) => sum + audit.rowsWithMinutesAboveZero,
        0,
      ),
      rowsWithMinutesEqualZero: rowAudits.reduce(
        (sum, audit) => sum + audit.rowsWithMinutesEqualZero,
        0,
      ),
      rowsWithStatisticsDespiteZeroMinutes: rowAudits.reduce(
        (sum, audit) => sum + audit.rowsWithStatisticsDespiteZeroMinutes,
        0,
      ),
      zeroActivityRows: rowAudits.reduce(
        (sum, audit) => sum + audit.zeroActivityRows,
        0,
      ),
      duplicatePlayerIdOccurrences: rowAudits.reduce(
        (sum, audit) => sum + audit.duplicatePlayerIds.length,
        0,
      ),
      duplicatePhaseOccurrences: rowAudits.reduce(
        (sum, audit) => sum + audit.duplicatePhaseRows.length,
        0,
      ),
      interpretation: [
        "Zero-minute rows are provider appearance/squad observations with an all-zero stat line in the tested payloads; they do not establish starter or substitute status.",
        "A zero-minute row with a non-zero event/stat is participation evidence, but should be retained with the provider's raw values for review.",
        "Neither minutes nor roster position may be converted into a lineup role.",
      ],
      proposedCanonicalParticipationRule: [
        "Create a canonical PlayerMatchStatistic when minutes > 0.",
        "Also create one when minutes = 0 but a non-zero match action (goal, assist, shot, pass, tackle, interception, foul, card, save, goal conceded, or clean sheet) proves participation.",
        "Do not create a canonical statistic from an all-zero zero-minute row alone; retain it only as a provider observation/raw audit record.",
        "Deduplicate by match + resolved player + team; reject duplicate same-phase observations for review rather than summing blindly.",
      ],
    },
    roster: rosterAudit,
    playerOverviews,
    seasonTotalsSanity: seasonSanityRows(playerOverviews, sweep),
    competitionCoverage: {
      laLiga: {
        selected: laLigaMatches.length,
        resolved: laLigaMatches.filter((match) => match.status === "ok").length,
        consistentlyPresentFields: laLigaFields,
      },
      championsLeague: {
        selected: championsMatches.length,
        resolved: championsMatches.filter((match) => match.status === "ok").length,
        consistentlyPresentFields: championsFields,
        shapeComparisonWithLaLiga:
          championsMatches.length === 0
            ? "No finished local Champions League match was available."
            : sameShape
              ? "The actually observed field set matched the La Liga sample."
              : "The actually observed field set differed from the La Liga sample; inspect the matrix before combining competitions.",
      },
      allCompetitions:
        "No single all-competitions overview was assumed. Query competition-scoped totals separately and combine only additive measures with explicit competition provenance.",
    },
    xGxAVerdict: {
      matchXGObserved: actualMatchXG,
      matchXAObserved: actualMatchXA,
      overviewXGObserved: overviewXG,
      overviewXAObserved: overviewXA,
      advertisedOnly:
        (advertisedMeasures.includes("xg") ||
          advertisedMeasures.includes("xa")) &&
        !actualMatchXG &&
        !actualMatchXA &&
        !overviewXG &&
        !overviewXA,
      conclusion:
        actualMatchXG || actualMatchXA || overviewXG || overviewXA
          ? "At least one xG/xA value was actually observed; see the matrix and overview audits for its exact scope."
          : "xG/xA were advertised by capabilities but absent from every tested match and overview payload, so coverage remains false.",
    },
    reliabilityVerdict: {
      decision: reliabilityDecision,
      rationale: [
        laLigaStable
          ? "All three selected La Liga matches resolved and carried the core player-stat field set."
          : "The La Liga sample did not meet the full three-match/core-field threshold.",
        championsStable
          ? "Every selected Champions League match resolved, or none was locally available."
          : "At least one selected Champions League match did not resolve.",
        allIdentityDisagreements.length
          ? "At least one immutable fact disagreement was found: " +
            [...new Set(allIdentityDisagreements)].join(", ") +
            "."
          : "No resolved provider disagreed on kickoff/date, teams, score, or competition.",
        "This verdict covers current-season player box-score measures only; it does not authorize production ingestion or claim lineup, rating, injury, event, or spatial coverage.",
      ],
    },
    schemaProposal: schemaProposal(rosterAudit),
    playerIdentityStrategy: identityStrategy(),
    unresolved: [
      "Confirmed starting XI and substitute bench roles",
      "Formation and match-specific positions",
      "Match shirt numbers",
      "Player ratings",
      "Timestamped event timeline and substitutions",
      "xG/xA unless an actual populated payload is later verified",
      "Event and shot coordinates",
      "Current soccer injuries/suspensions",
      "3D kit assets and interactive pitch presentation",
    ],
  };
}

export async function runStatsHawkReliability({
  refresh = false,
}: {
  refresh?: boolean;
} = {}) {
  if (
    !refresh &&
    cacheEntry &&
    cacheEntry.expiresAt > Date.now()
  ) {
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
      expiresAt:
        Date.now() + STATSHAWK_RELIABILITY_CACHE_TTL_SECONDS * 1_000,
    };
    return report;
  } finally {
    inFlight = null;
  }
}

export function reliabilityReportVersion() {
  return REPORT_VERSION;
}
