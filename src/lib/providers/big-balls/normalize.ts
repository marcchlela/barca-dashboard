import {
  asArray,
  asObject,
  booleanValue,
  nestedScalar,
  numberValue,
  stringValue,
  type JsonObject,
} from "../shared/json";

import type {
  BigBallsMatchBundle,
  BigBallsPlayerPosition,
  BigBallsPlayerStatistic,
} from "./types";

import {
  repairMojibake,
} from "../shared/normalization";

import {
  matchTeamIdentity,
} from "../shared/match-identity";

function nestedName(
  value: unknown,
) {
  return stringValue(
    asObject(value),
    "name",
    "display_name",
    "displayName",
  );
}

export function bigBallsCandidate(
  value: unknown,
) {
  const row =
    asObject(value);

  if (!row) {
    return null;
  }

  const kickoff =
    stringValue(
      row,
      "kickoff_utc",
      "kickoffUtc",
    );

  const home =
    asObject(row.home);

  const away =
    asObject(row.away);

  const score =
    asObject(row.score);

  return {
    providerMatchId:
      stringValue(
        row,
        "id",
      ),

    kickoff,

    calendarDate:
      kickoff?.slice(
        0,
        10,
      ) ?? null,

    localTime:
      null,

    temporalPrecision:
      kickoff
        ? ("exact" as const)
        : ("unknown" as const),

    homeTeam:
      nestedName(home) ??
      stringValue(
        row,
        "home_name",
      ) ??
      "",

    awayTeam:
      nestedName(away) ??
      stringValue(
        row,
        "away_name",
      ) ??
      "",

    homeScore:
      numberValue(
        score,
        "home",
      ),

    awayScore:
      numberValue(
        score,
        "away",
      ),

    competition:
      stringValue(
        row,
        "league",
        "league_name",
      ),
  };
}

function position(
  value: string | null,
): BigBallsPlayerPosition {
  const normalized =
    value?.toLowerCase() ?? "";

  if (
    normalized.includes(
      "goal",
    )
  ) {
    return "goalkeeper";
  }

  if (
    normalized.includes(
      "def",
    )
  ) {
    return "defender";
  }

  if (
    normalized.includes(
      "mid",
    )
  ) {
    return "midfielder";
  }

  if (
    normalized.includes(
      "attack",
    ) ||
    normalized.includes(
      "for",
    )
  ) {
    return "forward";
  }

  return "unknown";
}

function statObject(
  row: JsonObject,
) {
  return (
    asObject(
      row.stats,
    ) ?? {}
  );
}

function statValue(
  stats: JsonObject,
  key: string,
) {
  return nestedScalar(
    stats[key],
  );
}

function numericStat(
  stats: JsonObject,
  key: string,
) {
  const value =
    statValue(
      stats,
      key,
    );

  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  if (
    typeof value === "string" &&
    value.trim() &&
    Number.isFinite(
      Number(value),
    )
  ) {
    return Number(value);
  }

  return null;
}

function stableRaw(
  stats: JsonObject,
) {
  return Object.fromEntries(
    Object.keys(stats)
      .sort()
      .map((key) => {
        const value =
          statValue(
            stats,
            key,
          );

        return [
          key,
          typeof value === "number" ||
          typeof value === "string" ||
          typeof value === "boolean"
            ? value
            : null,
        ];
      }),
  );
}

function hasParticipation(
  stats: JsonObject,
) {
  const minutes =
    numericStat(
      stats,
      "minutes",
    ) ?? 0;

  if (
    minutes > 0
  ) {
    return true;
  }

  return [
    "goals",
    "assists",
    "shots_total",
    "shots_on",
    "passes_total",
    "passes_key",
    "tackles_total",
    "tackles_blocks",
    "interceptions",
    "duels_total",
    "duels_won",
    "dribbles_attempts",
    "dribbles_success",
    "fouls_committed",
    "fouls_drawn",
    "saves",
    "yellow_cards",
    "red_cards",
  ].some(
    (key) =>
      (
        numericStat(
          stats,
          key,
        ) ?? 0
      ) > 0,
  );
}

function normalizePlayer(
  value: unknown,
): BigBallsPlayerStatistic | null {
  const row =
    asObject(value);

  if (!row) {
    return null;
  }

  const stats =
    statObject(row);

  if (
    !hasParticipation(
      stats,
    )
  ) {
    return null;
  }

  const providerId =
    stringValue(
      row,
      "id",
      "player_id",
      "playerId",
    );

  const rawName =
    stringValue(
      row,
      "name",
      "player_name",
      "playerName",
    );

  const name =
    rawName
      ? repairMojibake(
          rawName,
        )
      : null;

  const teamProviderId =
    stringValue(
      row,
      "team_id",
      "teamId",
    );

  const rawTeamName =
    stringValue(
      row,
      "team_name",
      "teamName",
    );

  const teamName =
    rawTeamName
      ? repairMojibake(
          rawTeamName,
        )
      : null;

  if (
    !providerId ||
    !name ||
    !teamProviderId ||
    !teamName
  ) {
    return null;
  }

  const passes =
    numericStat(
      stats,
      "passes_total",
    );

  /*
   * Verified during the Data Lab:
   * Big Balls' observed "pass_accuracy" field is actually
   * completed-pass COUNT, not an accuracy percentage.
   */
  const completedPasses =
    numericStat(
      stats,
      "pass_accuracy",
    );

  return {
    providerId,
    name,
    teamProviderId,
    teamName,

    shirtNumber:
      numberValue(
        row,
        "jersey_number",
        "shirt_number",
        "number",
      ),

    position:
      position(
        stringValue(
          row,
          "position",
          "player_position",
        ),
      ),

    minutes:
      numericStat(
        stats,
        "minutes",
      ),

    goals:
      numericStat(
        stats,
        "goals",
      ),

    assists:
      numericStat(
        stats,
        "assists",
      ),

    shots:
      numericStat(
        stats,
        "shots_total",
      ),

    shotsOnTarget:
      numericStat(
        stats,
        "shots_on",
      ),

    passes,

    completedPasses,

    passAccuracy:
      passes &&
      completedPasses !== null
        ? completedPasses /
          passes
        : null,

    keyPasses:
      numericStat(
        stats,
        "passes_key",
      ),

    tackles:
      numericStat(
        stats,
        "tackles_total",
      ),

    blocks:
      numericStat(
        stats,
        "tackles_blocks",
      ),

    interceptions:
      numericStat(
        stats,
        "interceptions",
      ),

    duelsWon:
      numericStat(
        stats,
        "duels_won",
      ),

    duelsTotal:
      numericStat(
        stats,
        "duels_total",
      ),

    dribblesAttempted:
      numericStat(
        stats,
        "dribbles_attempts",
      ),

    successfulDribbles:
      numericStat(
        stats,
        "dribbles_success",
      ),

    fouls:
      numericStat(
        stats,
        "fouls_committed",
      ),

    yellowCards:
      numericStat(
        stats,
        "yellow_cards",
      ),

    redCards:
      numericStat(
        stats,
        "red_cards",
      ),

    saves:
      numericStat(
        stats,
        "saves",
      ),

    rating:
      numericStat(
        stats,
        "rating",
      ),

    raw: {
      ...stableRaw(
        stats,
      ),

      captain:
        booleanValue(
          stats,
          "captain",
        ),

      substitute:
        booleanValue(
          stats,
          "substitute",
        ),
    },
  };
}

/**
 * Big Balls' stored-match stats endpoint can include player rows
 * belonging to clubs that did NOT play in the requested fixture.
 *
 * We therefore keep a player row only when its team identity safely
 * matches exactly one of the two already-validated fixture sides.
 *
 * Example contamination observed:
 * - Cagliari
 * - Arsenal
 * - Genoa
 * inside Barcelona vs Racing stats.
 *
 * Those rows must never reach player identity resolution.
 */
function normalizeFixturePlayerTeam(
  player: BigBallsPlayerStatistic,
  fixture: {
    homeName: string;
    awayName: string;
    homeProviderId: string;
    awayProviderId: string;
  },
): BigBallsPlayerStatistic | null {
  const homeIdentity =
    matchTeamIdentity(
      player.teamName,
      fixture.homeName,
    );

  const awayIdentity =
    matchTeamIdentity(
      player.teamName,
      fixture.awayName,
    );

  const matchesHome =
    homeIdentity.matched;

  const matchesAway =
    awayIdentity.matched;

  /*
   * Must match exactly one side.
   *
   * Neither = unrelated provider contamination.
   * Both = ambiguous provider row.
   *
   * In either case, discard safely.
   */
  if (
    matchesHome ===
    matchesAway
  ) {
    return null;
  }

  const canonicalTeamProviderId =
    matchesHome
      ? fixture.homeProviderId
      : fixture.awayProviderId;

  if (
    player.teamProviderId ===
    canonicalTeamProviderId
  ) {
    return player;
  }

  /*
   * Team name safely establishes the fixture side, but the
   * provider's row-level team ID differs from the fixture ID.
   *
   * Preserve the original ID in raw evidence.
   */
  return {
    ...player,

    teamProviderId:
      canonicalTeamProviderId,

    raw: {
      ...player.raw,

      original_team_id:
        player.teamProviderId,

      canonicalized_fixture_team:
        true,
    },
  };
}

function teamId(
  value: JsonObject,
  side:
    | "home"
    | "away",
) {
  const object =
    asObject(
      value[side],
    );

  return stringValue(
    object,
    "id",
    "team_id",
    "teamId",
  );
}

export function normalizeBigBallsBundle(
  input: {
    providerMatchId: string;
    detailBody: JsonObject;
    teamStatsBody: JsonObject;
    storedStatsBody: JsonObject;
    requestCount: number;
  },
): BigBallsMatchBundle {
  const detail =
    asObject(
      input.detailBody
        .data,
    );

  if (!detail) {
    throw new Error(
      "Big Balls detail response did not contain a match object.",
    );
  }

  const candidate =
    bigBallsCandidate(
      detail,
    );

  const homeTeamProviderId =
    teamId(
      detail,
      "home",
    );

  const awayTeamProviderId =
    teamId(
      detail,
      "away",
    );

  if (
    !candidate ||
    !homeTeamProviderId ||
    !awayTeamProviderId
  ) {
    throw new Error(
      "Big Balls detail is missing immutable match or team identity.",
    );
  }

  const storedData =
    asObject(
      input.storedStatsBody
        .data,
    );

  const players =
    asArray(
      storedData?.players,
      "items",
    )
      .map(
        normalizePlayer,
      )
      .filter(
        (
          player,
        ): player is BigBallsPlayerStatistic =>
          player !== null,
      )
      .map(
        (player) =>
          normalizeFixturePlayerTeam(
            player,
            {
              homeName:
                candidate.homeTeam,

              awayName:
                candidate.awayTeam,

              homeProviderId:
                homeTeamProviderId,

              awayProviderId:
                awayTeamProviderId,
            },
          ),
      )
      .filter(
        (
          player,
        ): player is BigBallsPlayerStatistic =>
          player !== null,
      );

  const teamData =
    asObject(
      input.teamStatsBody
        .data,
    );

  const normalizeTeam =
    (
      value: unknown,
    ) => {
      const object =
        asObject(
          value,
        ) ?? {};

      return Object.fromEntries(
        Object.keys(
          object,
        )
          .sort()
          .map(
            (key) => {
              const raw =
                nestedScalar(
                  object[
                    key
                  ],
                );

              const parsed =
                typeof raw ===
                  "number"
                  ? raw
                  : typeof raw ===
                        "string" &&
                      Number.isFinite(
                        Number(
                          raw.replace(
                            /%/g,
                            "",
                          ),
                        ),
                      )
                    ? Number(
                        raw.replace(
                          /%/g,
                          "",
                        ),
                      )
                    : null;

              return [
                key,
                parsed,
              ];
            },
          ),
      );
    };

  return {
    requestCount:
      input.requestCount,

    providerMatchId:
      input.providerMatchId,

    homeTeamProviderId,

    awayTeamProviderId,

    candidate: {
      kickoff:
        candidate.kickoff,

      calendarDate:
        candidate.calendarDate,

      homeTeam:
        candidate.homeTeam,

      awayTeam:
        candidate.awayTeam,

      homeScore:
        candidate.homeScore,

      awayScore:
        candidate.awayScore,

      competition:
        candidate.competition,
    },

    teamStatistics: {
      home:
        normalizeTeam(
          teamData?.home,
        ),

      away:
        normalizeTeam(
          teamData?.away,
        ),
    },

    players,
  };
}