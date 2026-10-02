import { safeErrorMessage } from "../http";
import {
  FINAL_AUDIT_STAT_FIELDS,
  type AuditFieldState,
  type AuditProvider,
  type AuditRequestRecord,
  type EventsAudit,
  type FinalAuditStatField,
  type LineupAudit,
  type LineupSideAudit,
  type ProviderBudgetReport,
  type StatisticsAudit,
} from "../final-provider-audit-types";
import type { InternalMatch, MatchCandidate } from "../types";

export type JsonObject = Record<string, unknown>;
export type AuditResponse = {
  status: number;
  ok: boolean;
  body: JsonObject;
};

const REQUEST_TIMEOUT_MS = 15_000;

export function asObject(value: unknown): JsonObject | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
    : null;
}

export function arrayValue(value: unknown, ...keys: string[]): unknown[] {
  if (Array.isArray(value)) return value;
  const object = asObject(value);
  for (const key of keys) {
    if (Array.isArray(object?.[key])) return object[key] as unknown[];
  }
  return [];
}

export function stringValue(
  value: JsonObject | null,
  ...keys: string[]
): string | null {
  for (const key of keys) {
    const candidate = value?.[key];
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return null;
}

export function numberValue(
  value: JsonObject | null,
  ...keys: string[]
): number | null {
  for (const key of keys) {
    const candidate = value?.[key];
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate;
    }
    if (
      typeof candidate === "string" &&
      candidate.trim() &&
      Number.isFinite(Number(candidate))
    ) {
      return Number(candidate);
    }
  }
  return null;
}

function headerNumber(response: Response, ...names: string[]) {
  for (const name of names) {
    const raw = response.headers.get(name);
    if (raw !== null && Number.isFinite(Number(raw))) return Number(raw);
  }
  return null;
}

function bodySource(body: JsonObject) {
  const meta = asObject(body.meta);
  return stringValue(body, "source") ?? stringValue(meta, "source");
}

export class ProviderAuditClient {
  readonly requests: AuditRequestRecord[] = [];

  constructor(
    readonly provider: AuditProvider,
    private readonly apiKey: string,
    private readonly baseUrl: string,
    private readonly hardRequestLimit = 100,
  ) {}

  async get(path: string): Promise<AuditResponse> {
    if (this.requests.length >= this.hardRequestLimit) {
      throw new Error(
        this.provider + " audit refused to exceed " +
          this.hardRequestLimit + " requests.",
      );
    }

    let response: Response | null = null;
    let recorded = false;
    try {
      response = await fetch(this.baseUrl.replace(/\/$/, "") + path, {
        cache: "no-store",
        headers: {
          Accept: "application/json",
          Authorization: "Bearer " + this.apiKey,
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const raw = await response.text();
      let body: JsonObject = {};
      if (raw) {
        try {
          body = asObject(JSON.parse(raw)) ?? { data: JSON.parse(raw) };
        } catch {
          body = { error: raw.slice(0, 300) };
        }
      }
      const errorObject = asObject(body.error);
      const error = response.ok
        ? null
        : stringValue(errorObject, "message") ??
          stringValue(body, "message") ??
          "HTTP " + response.status;
      this.requests.push({
        path,
        status: response.status,
        rateLimit: headerNumber(
          response,
          "x-ratelimit-limit",
          "x-rate-limit-limit",
        ),
        rateLimitRemaining: headerNumber(
          response,
          "x-ratelimit-remaining",
          "x-rate-limit-remaining",
        ),
        rateLimitReset:
          response.headers.get("x-ratelimit-reset") ??
          response.headers.get("x-rate-limit-reset"),
        source: bodySource(body),
        error,
      });
      recorded = true;
      return {
        status: response.status,
        ok: response.ok,
        body,
      };
    } catch (error) {
      if (!recorded) {
        this.requests.push({
          path,
          status: response?.status ?? null,
          rateLimit: response
            ? headerNumber(response, "x-ratelimit-limit", "x-rate-limit-limit")
            : null,
          rateLimitRemaining: response
            ? headerNumber(
                response,
                "x-ratelimit-remaining",
                "x-rate-limit-remaining",
              )
            : null,
          rateLimitReset: response?.headers.get("x-ratelimit-reset") ?? null,
          source: null,
          error: safeErrorMessage(error),
        });
      }
      throw error;
    }
  }

  usage(advertisedAccountLimit: number | null = null): ProviderBudgetReport {
    const withRemaining = this.requests.filter(
      (request) => request.rateLimitRemaining !== null,
    );
    const first = withRemaining[0];
    const last = withRemaining.at(-1);
    return {
      hardRequestLimit: 100,
      requestsConsumed: this.requests.length,
      rateLimitBefore:
        first?.rateLimitRemaining === null ||
          first?.rateLimitRemaining === undefined
          ? null
          : first.rateLimitRemaining + 1,
      rateLimitAfter: last?.rateLimitRemaining ?? null,
      advertisedAccountLimit,
      requests: this.requests,
    };
  }
}

function nestedName(value: unknown) {
  const object = asObject(value);
  return stringValue(object, "name", "displayName", "display_name");
}

export function goalCandidate(value: unknown): MatchCandidate | null {
  const row = asObject(value);
  if (!row) return null;
  const kickoff = stringValue(row, "kickoffUtc", "kickoff_utc");
  const home = asObject(row.homeTeam) ?? asObject(row.home);
  const away = asObject(row.awayTeam) ?? asObject(row.away);
  const homeScore = numberValue(
    row,
    "homeTeamFtScore",
    "homeTeamScore",
    "home_score",
  ) ?? numberValue(asObject(row.score), "home");
  const awayScore = numberValue(
    row,
    "awayTeamFtScore",
    "awayTeamScore",
    "away_score",
  ) ?? numberValue(asObject(row.score), "away");
  return {
    providerMatchId: stringValue(row, "id", "apiId"),
    kickoff,
    calendarDate:
      kickoff?.slice(0, 10) ?? stringValue(row, "matchDate", "date"),
    localTime: null,
    temporalPrecision: kickoff ? "exact" : "date_only",
    homeTeam:
      nestedName(home) ?? stringValue(row, "homeTeamName", "home_team_name") ?? "",
    awayTeam:
      nestedName(away) ?? stringValue(row, "awayTeamName", "away_team_name") ?? "",
    homeScore,
    awayScore,
    competition:
      nestedName(row.league) ??
      stringValue(row, "leagueName", "league_name", "competition") ?? "",
  };
}

export function bigBallsCandidate(value: unknown): MatchCandidate | null {
  const row = asObject(value);
  if (!row) return null;
  const kickoff = stringValue(row, "kickoff_utc", "kickoffUtc");
  const home = asObject(row.home);
  const away = asObject(row.away);
  const score = asObject(row.score);
  return {
    providerMatchId: stringValue(row, "id"),
    kickoff,
    calendarDate: kickoff?.slice(0, 10) ?? null,
    localTime: null,
    temporalPrecision: kickoff ? "exact" : "unknown",
    homeTeam: nestedName(home) ?? stringValue(row, "home_name") ?? "",
    awayTeam: nestedName(away) ?? stringValue(row, "away_name") ?? "",
    homeScore: numberValue(score, "home"),
    awayScore: numberValue(score, "away"),
    competition: stringValue(row, "league", "league_name") ?? "",
  };
}

function blankLineupSide(formation: string | null = null): LineupSideAudit {
  return {
    starters: 0,
    completeStartingXI: false,
    bench: 0,
    unclassifiedRows: 0,
    formations: formation,
    names: 0,
    providerPlayerIds: 0,
    shirtNumbers: 0,
    broadPositions: 0,
    lineupOrdinals: 0,
    playerImages: 0,
    coaches: 0,
    confirmedOrPredictedStatus: null,
    publishedOrUpdatedAt: null,
  };
}

function rowValue(row: JsonObject, ...keys: string[]) {
  const nested = asObject(row.player);
  for (const key of keys) {
    const direct = row[key];
    if (direct !== null && direct !== undefined && direct !== "") return direct;
    const child = nested?.[key];
    if (child !== null && child !== undefined && child !== "") return child;
  }
  return null;
}

function lineupSide(
  rawStarters: unknown[],
  rawBench: unknown[],
  rawUnclassified: unknown[],
  rawCoaches: unknown[],
  formation: string | null,
  sideMetadata: JsonObject | null,
): LineupSideAudit {
  const starters = rawStarters.map(asObject).filter((row): row is JsonObject => row !== null);
  const bench = rawBench.map(asObject).filter((row): row is JsonObject => row !== null);
  const unclassified = rawUnclassified
    .map(asObject)
    .filter((row): row is JsonObject => row !== null);
  const all = [...starters, ...bench, ...unclassified];
  const has = (...keys: string[]) => all.filter((row) => rowValue(row, ...keys) !== null).length;
  const names = starters.filter((row) =>
    rowValue(row, "lineupPlayer", "player_name", "playerName", "name") !== null
  ).length;
  const updated = all
    .map((row) => rowValue(row, "updatedAt", "updated_at", "published_at"))
    .find((value) => typeof value === "string") as string | undefined;

  return {
    starters: starters.length,
    completeStartingXI: starters.length === 11 && names === 11,
    bench: bench.length,
    unclassifiedRows: unclassified.length,
    formations: formation,
    names: has("lineupPlayer", "player_name", "playerName", "name"),
    providerPlayerIds: has("playerId", "player_id", "id"),
    shirtNumbers: has("lineupNumber", "shirt_number", "jersey_number", "number"),
    broadPositions: has("playerPosition", "player_position", "position"),
    lineupOrdinals: has("lineupPosition", "lineup_position", "ordinal"),
    playerImages: has("playerImage", "player_image", "image", "image_url"),
    coaches: rawCoaches.length,
    confirmedOrPredictedStatus: stringValue(
      sideMetadata,
      "status",
      "lineup_status",
      "confirmation_status",
    ),
    publishedOrUpdatedAt:
      updated ??
      stringValue(sideMetadata, "updatedAt", "updated_at", "published_at"),
  };
}

function lineupStatus(home: LineupSideAudit, away: LineupSideAudit) {
  if (home.completeStartingXI && away.completeStartingXI) return "available" as const;
  if (
    home.starters || away.starters || home.bench || away.bench ||
    home.unclassifiedRows || away.unclassifiedRows
  ) return "partial" as const;
  return "not_available" as const;
}

export function auditGoalLineups(
  body: JsonObject,
  internal: InternalMatch,
): LineupAudit {
  const data = asObject(body.data);
  const homeObject = asObject(data?.home);
  const awayObject = asObject(data?.away);
  const home = lineupSide(
    arrayValue(homeObject?.startingLineups),
    arrayValue(homeObject?.substitutes),
    [],
    arrayValue(homeObject?.coach),
    stringValue(data, "homeFormation"),
    homeObject,
  );
  const away = lineupSide(
    arrayValue(awayObject?.startingLineups),
    arrayValue(awayObject?.substitutes),
    [],
    arrayValue(awayObject?.coach),
    stringValue(data, "awayFormation"),
    awayObject,
  );
  const barcelonaSide = internal.homeTeam.name.toLowerCase().includes("barcelona")
    ? "home"
    : internal.awayTeam.name.toLowerCase().includes("barcelona")
      ? "away"
      : null;
  return {
    status: lineupStatus(home, away),
    home,
    away,
    barcelonaSide,
    barcelona: barcelonaSide === "home" ? home : barcelonaSide === "away" ? away : null,
    evidence: [
      data?.hasLineups === true
        ? "Provider explicitly set hasLineups=true."
        : "Provider did not establish hasLineups=true.",
      "Completeness requires exactly 11 named starters; roster or minutes are never substituted.",
    ],
  };
}

export function auditBigBallsLineups(
  body: JsonObject,
  internal: InternalMatch,
): LineupAudit {
  const data = asObject(body.data);
  const homeRaw = arrayValue(data?.home);
  const awayRaw = arrayValue(data?.away);
  const classify = (rows: unknown[]) => {
    const starters: unknown[] = [];
    const bench: unknown[] = [];
    const unclassified: unknown[] = [];
    for (const row of rows) {
      const object = asObject(row);
      const role = stringValue(object, "type", "role", "status", "lineup_status")
        ?.toLowerCase();
      if (
        object?.starter === true || object?.starting === true ||
        role?.includes("start")
      ) {
        starters.push(row);
      } else if (
        object?.substitute === true || object?.bench === true ||
        role?.includes("bench") || role?.includes("substitute")
      ) {
        bench.push(row);
      } else {
        unclassified.push(row);
      }
    }
    return { starters, bench, unclassified };
  };
  const homeRows = classify(homeRaw);
  const awayRows = classify(awayRaw);
  const home = lineupSide(
    homeRows.starters,
    homeRows.bench,
    homeRows.unclassified,
    [],
    null,
    null,
  );
  const away = lineupSide(
    awayRows.starters,
    awayRows.bench,
    awayRows.unclassified,
    [],
    null,
    null,
  );
  const barcelonaSide = internal.homeTeam.name.toLowerCase().includes("barcelona")
    ? "home"
    : internal.awayTeam.name.toLowerCase().includes("barcelona")
      ? "away"
      : null;
  const meta = asObject(body.meta);
  return {
    status: lineupStatus(home, away),
    home,
    away,
    barcelonaSide,
    barcelona: barcelonaSide === "home" ? home : barcelonaSide === "away" ? away : null,
    evidence: [
      meta?.available === true
        ? "Lineup endpoint reported available=true."
        : "Lineup endpoint reported no currently ingested lineup data.",
      "Rows without an explicit starter or bench marker remain unclassified and never count as a starting XI.",
      stringValue(meta, "coverage_note") ??
        "Completeness requires exactly 11 named starters.",
    ],
  };
}

function objectLeafKeys(value: unknown, prefix = "", depth = 0): string[] {
  if (depth > 6) return [];
  if (Array.isArray(value)) {
    return value.flatMap((item) => objectLeafKeys(item, prefix, depth + 1));
  }
  const object = asObject(value);
  if (!object) return prefix ? [prefix] : [];
  return Object.entries(object).flatMap(([key, child]) =>
    objectLeafKeys(child, prefix ? prefix + "." + key : key, depth + 1)
  );
}

function eventText(row: JsonObject) {
  return [
    stringValue(row, "type", "event_type", "eventType"),
    stringValue(row, "info", "description", "detail"),
  ].filter(Boolean).join(" ").toLowerCase();
}

export function auditEvents(
  body: JsonObject,
  internal: InternalMatch,
  options: { planGatedFullTimeline?: boolean } = {},
): EventsAudit {
  const rows = arrayValue(body.data, "events", "items")
    .map(asObject)
    .filter((row): row is JsonObject => row !== null);
  const text = rows.map(eventText);
  const scorer = (row: JsonObject) =>
    stringValue(row, "homeScorer", "awayScorer", "scorer", "player_name") !== null;
  const goals = rows.filter((row, index) =>
    scorer(row) || /(^|\s)(goal|penalty scored)(\s|$)/.test(text[index])
  ).length;
  const assists = rows.filter((row, index) =>
    stringValue(
      row,
      "homeAssist",
      "awayAssist",
      "assist",
      "assist_name",
    ) !== null ||
    text[index].includes("assist")
  ).length;
  const yellowCards = text.filter((value) => value.includes("yellow")).length;
  const redCards = text.filter((value) =>
    value.includes("red card") || value.includes("second yellow")
  ).length;
  const substitutions = text.filter((value) =>
    value.includes("substitution") || value.includes("substitute")
  ).length;
  const penalties = text.filter((value) => value.includes("penalt")).length;
  const ownGoals = text.filter((value) => value.includes("own goal")).length;
  const minuteValues = rows.map((row) =>
    rowValue(row, "time", "minute", "elapsed", "clock")
  );
  const meta = asObject(body.meta);
  const uncovered = meta?.coverage === false;
  const expectedGoals = (internal.score.home ?? 0) + (internal.score.away ?? 0);
  return {
    status: uncovered
        ? "not_available"
        : options.planGatedFullTimeline
          ? rows.length ? "partial" : "plan_gated"
          : rows.length
            ? "available"
            : "not_available",
    totalRows: rows.length,
    goals,
    assists,
    yellowCards,
    redCards,
    substitutions,
    penalties,
    ownGoals,
    rowsWithMinute: minuteValues.filter((value) => value !== null).length,
    rowsWithAddedTime: minuteValues.filter((value) =>
      typeof value === "string" && value.includes("+")
    ).length,
    rowsWithPlayerId: rows.filter((row) =>
      rowValue(
        row,
        "playerId",
        "player_id",
        "scorerId",
        "scorer_id",
        "homeScorerId",
        "awayScorerId",
      ) !== null
    ).length,
    rowsWithRelatedPlayerId: rows.filter((row) =>
      rowValue(
        row,
        "relatedPlayerId",
        "related_player_id",
        "assist_player_id",
        "assistId",
        "homeAssistId",
        "awayAssistId",
      ) !== null
    ).length,
    rowsWithCoordinates: rows.filter((row) =>
      numberValue(row, "coordinate_x", "coordinateX", "x") !== null &&
      numberValue(row, "coordinate_y", "coordinateY", "y") !== null
    ).length,
    rowsWithXG: rows.filter((row) => numberValue(row, "xg", "xG") !== null).length,
    rowsWithXGOT: rows.filter((row) =>
      numberValue(row, "xgot", "xGOT") !== null
    ).length,
    goalCountMatchesFinalScore:
      rows.length && expectedGoals >= 0 ? goals === expectedGoals : null,
    actualKeys: [...new Set(rows.flatMap((row) => objectLeafKeys(row)))].sort(),
    evidence: [
      uncovered
        ? stringValue(meta, "message") ?? "Provider reported event coverage=false."
        : "Only fields present in returned event rows were counted.",
      options.planGatedFullTimeline
        ? "The free endpoint exposes scoring events; the documented complete event stream is plan-gated."
        : "Goal count was compared with the internal final score.",
    ],
  };
}

const FIELD_ALIASES: Record<FinalAuditStatField, string[]> = {
  possession: ["possession", "ballpossession", "possessionpercentage", "possessionpct"],
  shots: ["shots", "totalshots", "shotstotal"],
  shotsOnTarget: ["shotsontarget", "ontarget", "sot"],
  shotsOffTarget: ["shotsofftarget", "offtarget"],
  blockedShots: ["blockedshots", "shotsblocked"],
  corners: ["corners", "cornerkicks", "woncorners"],
  fouls: ["fouls", "foulscommitted"],
  offsides: ["offsides", "offside"],
  passes: ["passes", "totalpasses", "passestotal"],
  completedPasses: [
    "completedpasses",
    "accuratepasses",
    "passescompleted",
    "passesaccurate",
  ],
  passAccuracy: ["passaccuracy", "passaccuracypct", "passpercentage"],
  tackles: ["tackles", "totaltackles", "effectivetackles"],
  interceptions: ["interceptions", "defensiveinterceptions"],
  saves: ["saves", "goalkeepersaves"],
  xG: ["xg", "expectedgoals"],
  xA: ["xa", "expectedassists"],
  rating: ["rating", "matchrating", "playerrating"],
  minutes: ["minutes", "minutesplayed"],
  goals: ["goals"],
  assists: ["assists"],
  keyPasses: ["keypasses"],
  duels: ["duels", "totalduels", "duelswon"],
  dribbles: ["dribbles", "dribblescompleted", "dribblesattempted"],
  coordinates: ["coordinatex", "coordinatey", "averagepositions", "positionx", "positiony"],
};

function normalizedKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

type NamedValue = { key: string; value: unknown };

function namedValues(value: unknown, prefix = "", depth = 0): NamedValue[] {
  if (depth > 7) return [];
  if (Array.isArray(value)) {
    return value.flatMap((item) => namedValues(item, prefix, depth + 1));
  }
  const object = asObject(value);
  if (!object) return prefix ? [{ key: prefix, value }] : [];
  const label = stringValue(
    object,
    "type",
    "metric",
    "stat_name",
    "field",
    "label",
  ) ??
    (["home", "away", "value"].some((key) => Object.hasOwn(object, key))
      ? stringValue(object, "name")
      : null);
  const labelled = label
    ? ["home", "away", "value"].flatMap((key) =>
        Object.hasOwn(object, key) ? [{ key: label, value: object[key] }] : []
      )
    : [];
  return [
    ...labelled,
    ...Object.entries(object).flatMap(([key, child]) =>
      namedValues(child, prefix ? prefix + "." + key : key, depth + 1)
    ),
  ];
}

function valueState(values: unknown[]): AuditFieldState {
  if (!values.length) return "absent";
  const populated = values.filter((value) => value !== null && value !== undefined && value !== "");
  if (!populated.length) return "present_empty";
  const nonZero = populated.some((value) => {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    if (typeof value === "string") {
      const numeric = Number(value.replace(/[% ,]/g, ""));
      return Number.isFinite(numeric) ? numeric !== 0 : value.trim().length > 0;
    }
    return true;
  });
  return nonZero ? "present_nonzero" : "present_zero_only";
}

function actualFieldNames(values: unknown[]) {
  return [...new Set(
    values.flatMap((value) => {
      const object = asObject(value);
      const label = stringValue(
        object,
        "type",
        "metric",
        "stat_name",
        "field",
        "label",
      ) ??
        (object && ["home", "away", "value"].some((key) => Object.hasOwn(object, key))
          ? stringValue(object, "name")
          : null);
      return label ? [label] : objectLeafKeys(value).map((path) => path.split(".").at(-1) ?? path);
    }),
  )].sort((left, right) => left.localeCompare(right));
}

export function auditStatistics(
  teamValues: unknown[],
  playerValues: unknown[],
  options: {
    status?: StatisticsAudit["status"];
    documentationOnly?: FinalAuditStatField[];
    evidence?: string[];
  } = {},
): StatisticsAudit {
  const allNamed = namedValues([...teamValues, ...playerValues]);
  const fieldStates = Object.fromEntries(
    FINAL_AUDIT_STAT_FIELDS.map((field) => {
      const aliases = FIELD_ALIASES[field];
      const values = allNamed
        .filter((entry) => {
          const normalized = normalizedKey(entry.key.split(".").at(-1) ?? entry.key);
          return aliases.some((alias) => normalized === alias || normalized.endsWith(alias));
        })
        .map((entry) => entry.value);
      const actual = valueState(values);
      return [
        field,
        actual === "absent" && options.documentationOnly?.includes(field)
          ? "documentation_only"
          : actual,
      ];
    }),
  ) as Record<FinalAuditStatField, AuditFieldState>;
  const hasAny = teamValues.length > 0 || playerValues.length > 0;
  return {
    status: options.status ?? (hasAny ? "available" : "not_available"),
    teamRowCount: teamValues.length,
    playerRowCount: playerValues.length,
    actualTeamFields: actualFieldNames(teamValues),
    actualPlayerFields: actualFieldNames(playerValues),
    fieldStates,
    evidence: options.evidence ?? [],
  };
}

export function emptyLineupAudit(internal: InternalMatch): LineupAudit {
  const home = blankLineupSide();
  const away = blankLineupSide();
  const barcelonaSide = internal.homeTeam.name.toLowerCase().includes("barcelona")
    ? "home"
    : "away";
  return {
    status: "unknown",
    home,
    away,
    barcelonaSide,
    barcelona: barcelonaSide === "home" ? home : away,
    evidence: [],
  };
}

export function emptyEventsAudit(): EventsAudit {
  return {
    status: "unknown",
    totalRows: 0,
    goals: 0,
    assists: 0,
    yellowCards: 0,
    redCards: 0,
    substitutions: 0,
    penalties: 0,
    ownGoals: 0,
    rowsWithMinute: 0,
    rowsWithAddedTime: 0,
    rowsWithPlayerId: 0,
    rowsWithRelatedPlayerId: 0,
    rowsWithCoordinates: 0,
    rowsWithXG: 0,
    rowsWithXGOT: 0,
    goalCountMatchesFinalScore: null,
    actualKeys: [],
    evidence: [],
  };
}

export function emptyStatisticsAudit(): StatisticsAudit {
  return auditStatistics([], [], { status: "unknown" });
}
