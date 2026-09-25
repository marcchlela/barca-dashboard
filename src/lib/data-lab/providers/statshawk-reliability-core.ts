import { safeErrorMessage } from "../http";
import type {
  FieldState,
  PlayerOverviewAudit,
  PlayerPhaseRow,
  PlayerRowAudit,
  ReliabilityField,
  RosterAudit,
  RosterEntryAudit,
  StatsHawkRequestRecord,
} from "../statshawk-reliability-types";
import { RELIABILITY_FIELD_MAP } from "../statshawk-reliability-types";
import type { MatchCandidate } from "../types";

const DEFAULT_BASE_URL = "https://api.statshawk.ai/v1";
const REQUEST_TIMEOUT_MS = 12_000;

export type JsonObject = Record<string, unknown>;
export type StatsHawkEnvelope = {
  data?: unknown;
  meta?: {
    cache?: string;
    request_id?: string;
    fetched_at?: string;
    source?: string | null;
  };
  error?: unknown;
};

export type StatsHawkCompetition = {
  id: string;
  slug: string;
  name: string;
  sport: string | null;
  kind: string | null;
};

export type ParsedAppearance = {
  appearanceId: string | null;
  personId: string | null;
  personName: string | null;
  teamId: string | null;
  teamName: string | null;
  phases: PlayerPhaseRow[];
};

export function asObject(value: unknown): JsonObject | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
    : null;
}

export function stringField(
  value: JsonObject | null,
  ...keys: string[]
): string | null {
  for (const key of keys) {
    const candidate = value?.[key];
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate;
    }
  }
  return null;
}

export function numberField(
  value: JsonObject | null,
  ...keys: string[]
): number | null {
  for (const key of keys) {
    const candidate = value?.[key];
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate;
    }
  }
  return null;
}

export function scalarField(
  value: JsonObject | null,
  ...keys: string[]
): string | number | null {
  return numberField(value, ...keys) ?? stringField(value, ...keys);
}

export function arrayField(value: unknown, ...keys: string[]): unknown[] {
  if (Array.isArray(value)) return value;
  const object = asObject(value);
  for (const key of keys) {
    if (Array.isArray(object?.[key])) return object[key] as unknown[];
  }
  return [];
}

function parseHeaderNumber(response: Response, name: string) {
  const raw = response.headers.get(name);
  if (raw === null) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export class StatsHawkBudgetExceededError extends Error {}

export class StatsHawkBudgetClient {
  readonly requests: StatsHawkRequestRecord[] = [];
  private expectedUnitsAttempted = 0;

  constructor(
    private readonly apiKey: string,
    private readonly hardBudget: number,
    private readonly baseUrl = (
      process.env.STATSHAWK_BASE_URL ?? DEFAULT_BASE_URL
    ).replace(/\/$/, ""),
  ) {}

  async get(
    path: string,
    expectedUnits: number,
  ): Promise<StatsHawkEnvelope> {
    if (this.expectedUnitsAttempted + expectedUnits > this.hardBudget) {
      throw new StatsHawkBudgetExceededError(
        "StatsHawk reliability budget would exceed " +
          this.hardBudget +
          " weighted units before requesting " +
          path +
          ".",
      );
    }

    this.expectedUnitsAttempted += expectedUnits;
    let response: Response | null = null;
    let recorded = false;

    try {
      response = await fetch(this.baseUrl + path, {
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "X-API-Key": this.apiKey,
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const text = await response.text();
      let body: StatsHawkEnvelope = {};
      if (text) {
        try {
          body = JSON.parse(text) as StatsHawkEnvelope;
        } catch {
          body = { error: text.slice(0, 300) };
        }
      }
      const meta = asObject(body.meta);
      this.requests.push({
        path,
        status: response.status,
        expectedUnits,
        quotaRemaining: parseHeaderNumber(
          response,
          "x-account-quota-remaining",
        ),
        cache: stringField(meta, "cache"),
        error: response.ok
          ? null
          : JSON.stringify(body.error ?? body).slice(0, 300),
      });
      recorded = true;

      if (!response.ok) {
        throw new Error(
          "StatsHawk " + path + " returned HTTP " + response.status + ".",
        );
      }

      return body;
    } catch (error) {
      if (!recorded) {
        this.requests.push({
          path,
          status: response?.status ?? null,
          expectedUnits,
          quotaRemaining: response
            ? parseHeaderNumber(response, "x-account-quota-remaining")
            : null,
          cache: null,
          error: safeErrorMessage(error),
        });
      }
      throw error;
    }
  }

  usage() {
    const metered = this.requests.filter(
      (request) => request.quotaRemaining !== null,
    );
    const first = metered[0];
    const quotaBefore = first?.quotaRemaining === null ||
        first?.quotaRemaining === undefined
      ? null
      : first.quotaRemaining + first.expectedUnits;
    const quotaAfter = metered.length
      ? Math.min(
          ...metered.map((request) => request.quotaRemaining as number),
        )
      : null;

    return {
      hardLimitWeightedUnits: this.hardBudget,
      expectedUnitsAttempted: this.expectedUnitsAttempted,
      actualWeightedUnitsConsumed:
        quotaBefore !== null && quotaAfter !== null
          ? quotaBefore - quotaAfter
          : null,
      quotaBefore,
      quotaAfter,
      quotaLimit: 5000,
      requestCount: this.requests.length,
      requests: this.requests,
    };
  }
}

function reference(
  object: JsonObject | null,
  key: string,
): { id: string | null; name: string | null } {
  const value = object?.[key];
  if (typeof value === "string") {
    return {
      id: value,
      name: stringField(object, key + "_name"),
    };
  }

  const nested = asObject(value);
  return {
    id: stringField(nested, "id") ?? stringField(object, key + "_id"),
    name:
      stringField(nested, "name", "display_name", "full_name") ??
      stringField(object, key + "_name"),
  };
}

export function competitionRows(
  envelope: StatsHawkEnvelope,
): StatsHawkCompetition[] {
  const data = envelope.data;
  return arrayField(data, "items", "competitions")
    .map(asObject)
    .filter((row): row is JsonObject => row !== null)
    .map((row) => ({
      id: stringField(row, "id") ?? "",
      slug: stringField(row, "slug") ?? "",
      name: stringField(row, "name") ?? "",
      sport: stringField(row, "sport"),
      kind: stringField(row, "kind"),
    }))
    .filter((row) => row.id && row.slug && row.name);
}

export function contestRows(envelope: StatsHawkEnvelope) {
  return arrayField(envelope.data, "items", "games", "contests")
    .map(asObject)
    .filter((row): row is JsonObject => row !== null);
}

export function contestCandidate(
  contest: JsonObject,
  competitionName: string,
): MatchCandidate {
  const score = asObject(contest.score);
  const kickoff = stringField(contest, "kickoff");
  const hasZone = Boolean(
    kickoff &&
      (kickoff.endsWith("Z") || /[+-][0-9]{2}:[0-9]{2}$/.test(kickoff)),
  );

  return {
    providerMatchId: stringField(contest, "id"),
    kickoff: hasZone ? kickoff : null,
    calendarDate: kickoff?.slice(0, 10) ?? null,
    localTime: kickoff && !hasZone ? kickoff.slice(11, 19) : null,
    temporalPrecision: hasZone
      ? "exact"
      : kickoff
        ? "local_time_unknown_zone"
        : "unknown",
    homeTeam: stringField(contest, "home_team_name") ?? "",
    awayTeam: stringField(contest, "away_team_name") ?? "",
    homeScore: numberField(score, "home"),
    awayScore: numberField(score, "away"),
    competition: competitionName,
  };
}

export function contestTeam(
  contest: JsonObject,
  side: "home" | "away",
) {
  return reference(contest, side + "_team");
}

export function primitiveMeasures(measures: JsonObject) {
  return Object.fromEntries(
    Object.entries(measures).filter(([, value]) =>
      value === null ||
      typeof value === "number" ||
      typeof value === "string" ||
      typeof value === "boolean"
    ),
  );
}

export function parseAppearances(
  boxscoreEnvelope: StatsHawkEnvelope,
): {
  finalized: boolean | null;
  appearances: ParsedAppearance[];
  phaseRows: PlayerPhaseRow[];
} {
  const boxscore = asObject(boxscoreEnvelope.data);
  const rawAppearances = arrayField(boxscore, "lines", "players");
  const appearances = rawAppearances
    .map((value): ParsedAppearance | null => {
      const row = asObject(value);
      if (!row) return null;
      const person = reference(row, "person");
      const team = reference(row, "team");
      const appearanceId = stringField(row, "appearance", "appearance_id");
      const rawPhases = arrayField(row, "phases");
      const phases = (rawPhases.length ? rawPhases : [row])
        .map(asObject)
        .filter((phase): phase is JsonObject => phase !== null)
        .map((phase): PlayerPhaseRow => ({
          appearanceId,
          personId: person.id,
          personName: person.name,
          teamId: team.id,
          teamName: team.name,
          phase: stringField(phase, "phase", "role"),
          measures: primitiveMeasures(
            asObject(phase.measures) ??
              asObject(phase.statistics) ??
              asObject(phase.stats) ??
              {},
          ),
        }));

      return {
        appearanceId,
        personId: person.id,
        personName: person.name,
        teamId: team.id,
        teamName: team.name,
        phases,
      };
    })
    .filter((row): row is ParsedAppearance => row !== null);

  return {
    finalized:
      typeof boxscore?.finalized === "boolean"
        ? boxscore.finalized
        : null,
    appearances,
    phaseRows: appearances.flatMap((appearance) => appearance.phases),
  };
}

export function rowMinutes(row: PlayerPhaseRow) {
  return numberField(asObject(row.measures), "minutes", "mins") ?? 0;
}

export function hasNonZeroStatistic(
  row: PlayerPhaseRow,
  includeMinutes = false,
) {
  return Object.entries(row.measures).some(([key, value]) => {
    if (!includeMinutes && (key === "minutes" || key === "mins")) return false;
    if (typeof value === "number") return value !== 0;
    if (typeof value === "boolean") return value;
    return false;
  });
}

function fieldStateForRows(
  rows: PlayerPhaseRow[],
  aliases: readonly string[],
): FieldState {
  const values = rows.flatMap((row) =>
    aliases
      .filter((alias) => Object.hasOwn(row.measures, alias))
      .map((alias) => row.measures[alias])
  );
  if (!values.length) return "absent";
  const nonZero = values.some((value) => {
    if (typeof value === "number") return value !== 0;
    if (typeof value === "boolean") return value;
    return false;
  });
  return nonZero ? "present_nonzero" : "present_zero_only";
}

export function fieldStatesForRows(
  rows: PlayerPhaseRow[],
): Record<ReliabilityField, FieldState> {
  return Object.fromEntries(
    Object.entries(RELIABILITY_FIELD_MAP).map(([field, aliases]) => [
      field,
      fieldStateForRows(rows, aliases),
    ]),
  ) as Record<ReliabilityField, FieldState>;
}

function duplicateValues(values: Array<string | null>) {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([value]) => value)
    .sort();
}

export function auditPlayerRows(
  parsed: ReturnType<typeof parseAppearances>,
  barcelonaTeamId: string,
): {
  audit: PlayerRowAudit;
  barcelonaRows: PlayerPhaseRow[];
} {
  const barcelonaAppearances = parsed.appearances.filter(
    (appearance) => appearance.teamId === barcelonaTeamId,
  );
  const barcelonaRows = barcelonaAppearances.flatMap(
    (appearance) => appearance.phases,
  );
  const active = barcelonaRows.filter((row) => rowMinutes(row) > 0);
  const zeroMinutes = barcelonaRows.filter((row) => rowMinutes(row) === 0);
  const nonZeroAtZeroMinutes = zeroMinutes.filter((row) =>
    hasNonZeroStatistic(row)
  );
  const zeroActivity = zeroMinutes.filter((row) =>
    !hasNonZeroStatistic(row)
  );
  const duplicatePhaseRows = duplicateValues(
    barcelonaRows.map((row) =>
      row.personId ? row.personId + ":" + (row.phase ?? "unknown") : null
    ),
  );

  return {
    barcelonaRows,
    audit: {
      providerAppearanceRows: parsed.appearances.length,
      providerPhaseRows: parsed.phaseRows.length,
      barcelonaAppearanceRows: barcelonaAppearances.length,
      barcelonaPhaseRows: barcelonaRows.length,
      rowsWithMinutesAboveZero: active.length,
      rowsWithMinutesEqualZero: zeroMinutes.length,
      rowsWithStatisticsDespiteZeroMinutes: nonZeroAtZeroMinutes.length,
      zeroActivityRows: zeroActivity.length,
      duplicatePlayerIds: duplicateValues(
        barcelonaAppearances.map((appearance) => appearance.personId),
      ),
      duplicatePhaseRows,
      goalkeeperPhaseRows: barcelonaRows.filter(
        (row) => row.phase === "keeper",
      ).length,
      outfieldPhaseRows: barcelonaRows.filter(
        (row) => row.phase === "outfield",
      ).length,
      unknownPhaseRows: barcelonaRows.filter(
        (row) => row.phase !== "keeper" && row.phase !== "outfield",
      ).length,
      representativeActiveRows: active
        .sort((left, right) => rowMinutes(right) - rowMinutes(left))
        .slice(0, 3)
        .map((row) => ({
          personId: row.personId,
          personName: row.personName,
          phase: row.phase,
          measures: row.measures,
        })),
      representativeZeroMinuteRows: zeroMinutes.slice(0, 3).map((row) => ({
        personId: row.personId,
        personName: row.personName,
        phase: row.phase,
        hasNonZeroStatistic: hasNonZeroStatistic(row),
        measures: row.measures,
      })),
    },
  };
}

function rosterRows(envelope: StatsHawkEnvelope) {
  const direct = arrayField(
    envelope.data,
    "items",
    "roster",
    "players",
    "memberships",
  );
  if (direct.length) return direct;

  for (const value of Object.values(asObject(envelope.data) ?? {})) {
    const nested = arrayField(
      value,
      "items",
      "roster",
      "players",
      "memberships",
    );
    if (nested.length) return nested;
  }
  return [];
}

function parseRosterEntry(value: unknown): RosterEntryAudit | null {
  const row = asObject(value);
  if (!row) return null;
  const person = asObject(row.person) ?? asObject(row.player);
  const bio = asObject(person?.bio);

  return {
    personId: stringField(person, "id") ?? stringField(row, "person_id"),
    displayName:
      stringField(bio, "display_name", "full_name") ??
      stringField(person, "display_name", "full_name", "name"),
    position:
      stringField(bio, "position", "position_name") ??
      stringField(person, "position", "position_name") ??
      stringField(row, "position", "position_name"),
    shirtNumber: scalarField(
      row,
      "shirt_number",
      "jersey_number",
      "number",
    ) ?? scalarField(bio, "shirt_number", "jersey_number", "number"),
    nationality:
      stringField(bio, "nationality", "citizenship") ??
      stringField(person, "nationality", "citizenship"),
    birthCountry:
      stringField(bio, "birth_country", "country_of_birth") ??
      stringField(person, "birth_country", "country_of_birth"),
    birthDate:
      stringField(bio, "dob", "birth_date", "date_of_birth") ??
      stringField(person, "dob", "birth_date", "date_of_birth"),
    preferredFoot:
      stringField(bio, "preferred_foot", "foot") ??
      stringField(person, "preferred_foot", "foot"),
    height:
      scalarField(bio, "height_cm", "height_inches", "height") ??
      scalarField(person, "height_cm", "height_inches", "height"),
    weight:
      scalarField(bio, "weight_kg", "weight_lbs", "weight") ??
      scalarField(person, "weight_kg", "weight_lbs", "weight"),
    portraitUrl:
      stringField(
        bio,
        "portrait_url",
        "photo_url",
        "image_url",
        "headshot_url",
      ) ??
      stringField(
        person,
        "portrait_url",
        "photo_url",
        "image_url",
        "headshot_url",
      ),
    membershipStatus: stringField(
      row,
      "membership_status",
      "status",
    ),
    source: stringField(row, "source"),
  };
}

function isPresent(value: unknown) {
  return value !== null && value !== undefined && value !== "";
}

export function auditRoster(
  envelope: StatsHawkEnvelope,
  teamId: string,
): { audit: RosterAudit; entries: RosterEntryAudit[] } {
  const entries = rosterRows(envelope)
    .map(parseRosterEntry)
    .filter((row): row is RosterEntryAudit => row !== null);
  const ids = entries.map((row) => row.personId);
  const sourceCounts: Record<string, number> = {};
  for (const entry of entries) {
    const source = entry.source ?? "unknown";
    sourceCounts[source] = (sourceCounts[source] ?? 0) + 1;
  }
  const representatives: RosterEntryAudit[] = [];
  for (const position of ["G", "D", "M", "F"]) {
    const found = entries.find((entry) => entry.position === position);
    if (found && !representatives.includes(found)) representatives.push(found);
  }
  for (const entry of entries) {
    if (representatives.length >= 6) break;
    if (!representatives.includes(entry)) representatives.push(entry);
  }

  const coverage = {
    providerPersonId: entries.filter((row) => isPresent(row.personId)).length,
    displayName: entries.filter((row) => isPresent(row.displayName)).length,
    position: entries.filter((row) => isPresent(row.position)).length,
    shirtNumber: entries.filter((row) => isPresent(row.shirtNumber)).length,
    nationality: entries.filter((row) => isPresent(row.nationality)).length,
    birthCountry: entries.filter((row) => isPresent(row.birthCountry)).length,
    birthDate: entries.filter((row) => isPresent(row.birthDate)).length,
    preferredFoot: entries.filter((row) => isPresent(row.preferredFoot)).length,
    height: entries.filter((row) => isPresent(row.height)).length,
    weight: entries.filter((row) => isPresent(row.weight)).length,
    portraitOrPhoto: entries.filter((row) => isPresent(row.portraitUrl)).length,
    membershipStatus: entries.filter((row) =>
      isPresent(row.membershipStatus)
    ).length,
  };

  return {
    entries,
    audit: {
      status: entries.length ? "ok" : "not_available",
      teamId,
      totalRows: entries.length,
      uniqueProviderPersonIds: new Set(ids.filter(Boolean)).size,
      duplicateProviderPersonIds: duplicateValues(ids),
      coverage,
      sourceCounts,
      representativeRows: representatives,
      evidence: [
        "Every roster row was inspected; coverage counts are not extrapolated from a sample.",
        "birthCountry is reported separately and is never treated as nationality.",
        "Roster associations do not establish starters, substitutes, formation, or match shirt numbers.",
      ],
    },
  };
}

function numericLeaves(
  value: unknown,
  prefix = "",
  depth = 0,
): Record<string, number> {
  if (depth > 5) return {};
  if (typeof value === "number" && Number.isFinite(value)) {
    return prefix ? { [prefix]: value } : {};
  }
  const object = asObject(value);
  if (!object) return {};

  return Object.fromEntries(
    Object.entries(object).flatMap(([key, child]) =>
      Object.entries(
        numericLeaves(child, prefix ? prefix + "." + key : key, depth + 1),
      )
    ),
  );
}

function totalsByPhase(stats: JsonObject | null) {
  if (!stats) return {};
  const directNumeric = Object.values(stats).some(
    (value) => typeof value === "number",
  );
  const phases = directNumeric ? [["all", stats] as const] : Object.entries(stats);

  return Object.fromEntries(
    phases.flatMap(([phase, value]) => {
      const leaves = numericLeaves(value);
      const compact = Object.fromEntries(
        Object.entries(leaves).map(([path, amount]) => [
          path.split(".").at(-1) ?? path,
          amount,
        ]),
      );
      return Object.keys(compact).length ? [[phase, compact]] : [];
    }),
  );
}

function mergedPhaseRows(
  totals: Record<string, Record<string, number>>,
): PlayerPhaseRow[] {
  return Object.entries(totals).map(([phase, measures]) => ({
    appearanceId: null,
    personId: null,
    personName: null,
    teamId: null,
    teamName: null,
    phase,
    measures,
  }));
}

function findTotal(
  totals: Record<string, Record<string, number>>,
  aliases: string[],
) {
  for (const phase of Object.values(totals)) {
    for (const alias of aliases) {
      if (typeof phase[alias] === "number") return phase[alias];
    }
  }
  return null;
}

function gameLogRows(data: JsonObject | null) {
  for (const key of ["game_log", "games", "recent_games", "appearances"]) {
    const direct = arrayField(data?.[key], "items", "games");
    if (direct.length) return direct.length;
  }
  return 0;
}

export function auditOverview(
  envelope: StatsHawkEnvelope,
  selected: {
    personId: string;
    displayName: string | null;
    selectedRole: PlayerOverviewAudit["selectedRole"];
  },
  competition: StatsHawkCompetition,
): PlayerOverviewAudit {
  const data = asObject(envelope.data);
  const person = asObject(data?.person) ?? asObject(data?.identity);
  const bio = asObject(person?.bio);
  const teamValue = data?.current_team ?? data?.team;
  const team = asObject(teamValue);
  const stats = asObject(data?.season_stats) ?? asObject(data?.stats);
  const phaseTotals = totalsByPhase(stats);
  const actualStatPaths = Object.keys(numericLeaves(stats)).sort();
  const identityName =
    stringField(person, "display_name", "full_name", "name") ??
    stringField(bio, "display_name", "full_name") ??
    selected.displayName;

  return {
    personId: selected.personId,
    displayName: identityName,
    selectedRole: selected.selectedRole,
    competition: {
      id: competition.id,
      slug: competition.slug,
      name: competition.name,
    },
    status: data ? "ok" : "not_available",
    identity: data
      ? {
          id: stringField(person, "id") ?? selected.personId,
          displayName: identityName,
          position:
            stringField(bio, "position", "position_name") ??
            stringField(person, "position", "position_name"),
        }
      : null,
    currentTeam: data
      ? {
          id:
            stringField(team, "id") ??
            (typeof teamValue === "string" ? teamValue : null),
          name:
            stringField(team, "name") ??
            stringField(data, "team_name", "current_team_name"),
        }
      : null,
    profile: data
      ? {
          birthDate:
            stringField(bio, "dob", "birth_date", "date_of_birth") ??
            stringField(person, "dob", "birth_date", "date_of_birth"),
          nationality:
            stringField(bio, "nationality", "citizenship") ??
            stringField(person, "nationality", "citizenship"),
          birthCountry:
            stringField(bio, "birth_country", "country_of_birth") ??
            stringField(person, "birth_country", "country_of_birth"),
          preferredFoot:
            stringField(bio, "preferred_foot", "foot") ??
            stringField(person, "preferred_foot", "foot"),
          height:
            scalarField(bio, "height_cm", "height_inches", "height") ??
            scalarField(person, "height_cm", "height_inches", "height"),
          weight:
            scalarField(bio, "weight_kg", "weight_lbs", "weight") ??
            scalarField(person, "weight_kg", "weight_lbs", "weight"),
          portraitUrl:
            stringField(
              bio,
              "portrait_url",
              "photo_url",
              "image_url",
              "headshot_url",
            ) ??
            stringField(
              person,
              "portrait_url",
              "photo_url",
              "image_url",
              "headshot_url",
            ),
        }
      : null,
    actualStatPaths,
    totalsByPhase: phaseTotals,
    fieldStates: fieldStatesForRows(mergedPhaseRows(phaseTotals)),
    appearances: findTotal(
      phaseTotals,
      ["appearances", "games", "games_played"],
    ),
    starts: findTotal(phaseTotals, ["starts", "games_started"]),
    gameLogRows: gameLogRows(data),
    error: null,
  };
}

export function auditCapabilities(envelope: StatsHawkEnvelope) {
  const data = asObject(envelope.data);
  const phases = arrayField(data, "phases")
    .map(asObject)
    .filter((phase): phase is JsonObject => phase !== null);
  const advertisedPhases = phases
    .map((phase) => stringField(phase, "phase", "name"))
    .filter((phase): phase is string => Boolean(phase));
  const advertisedMeasures = [
    ...new Set(
      phases.flatMap((phase) =>
        arrayField(phase, "measures")
          .filter((measure): measure is string => typeof measure === "string")
      ),
    ),
  ].sort();

  return { advertisedPhases, advertisedMeasures };
}

export function blankFieldStates(state: FieldState = "unknown") {
  return Object.fromEntries(
    Object.keys(RELIABILITY_FIELD_MAP).map((field) => [field, state]),
  ) as Record<ReliabilityField, FieldState>;
}

export function normalizedRole(
  position: string | null,
): PlayerOverviewAudit["selectedRole"] | null {
  switch (position?.toUpperCase()) {
    case "G":
    case "GK":
    case "GOALKEEPER":
      return "goalkeeper";
    case "D":
    case "DF":
    case "DEFENDER":
      return "defender";
    case "M":
    case "MF":
    case "MIDFIELDER":
      return "midfielder";
    case "F":
    case "FW":
    case "FORWARD":
      return "forward";
    default:
      return null;
  }
}

export function canonicalMeasureSums(rows: PlayerPhaseRow[]) {
  const sums: Record<string, number> = {};
  for (const [field, aliases] of Object.entries(RELIABILITY_FIELD_MAP)) {
    for (const row of rows) {
      const value = aliases
        .map((alias) => row.measures[alias])
        .find((candidate) => typeof candidate === "number");
      if (typeof value === "number") {
        sums[field] = (sums[field] ?? 0) + value;
      }
    }
  }
  return sums;
}
