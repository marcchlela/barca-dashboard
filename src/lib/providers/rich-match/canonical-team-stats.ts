import "server-only";

import { db } from "../../../prisma/db";

import {
  fetchBigBallsMatchBundle,
} from "../big-balls/fetch";

import {
  fetchGoalMatchBundle,
} from "../goal-api/fetch";

import type {
  GoalTeamStatistic,
} from "../goal-api/types";

import type {
  MatchIdentityInput,
} from "../shared/match-identity";

type ProviderCode =
  | "goal-api"
  | "big-balls-data";

type FieldSource =
  | ProviderCode
  | "derived";

type CanonicalTeamStatistic = {
  possession:
    number | null;

  shots:
    number | null;

  shotsOnTarget:
    number | null;

  shotsOffTarget:
    number | null;

  blockedShots:
    number | null;

  shotsInsideBox:
    number | null;

  shotsOutsideBox:
    number | null;

  xG:
    number | null;

  passes:
    number | null;

  completedPasses:
    number | null;

  passAccuracy:
    number | null;

  corners:
    number | null;

  fouls:
    number | null;

  offsides:
    number | null;

  yellowCards:
    number | null;

  redCards:
    number | null;

  tackles:
    number | null;

  interceptions:
    number | null;

  clearances:
    number | null;

  saves:
    number | null;

  attacks:
    number | null;

  dangerousAttacks:
    number | null;

  freeKicks:
    number | null;

  goalKicks:
    number | null;

  throwIns:
    number | null;

  substitutions:
    number | null;
};

type TeamDiscrepancy = {
  side:
    | "home"
    | "away";

  teamName:
    string;

  field:
    string;

  goal:
    number;

  bigBalls:
    number;

  delta:
    number;
};

function errorMessage(
  error: unknown,
) {
  return error instanceof Error
    ? error.message
    : String(error);
}

function intStat(
  stats:
    Record<
      string,
      number | null
    >,

  key:
    string,
) {
  const value =
    stats[key];

  if (
    typeof value !==
      "number" ||
    !Number.isFinite(
      value,
    )
  ) {
    return null;
  }

  return Math.round(
    value,
  );
}

function ratioStat(
  value:
    | number
    | null
    | undefined,
) {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(
      value,
    )
  ) {
    return null;
  }

  const ratio =
    value > 1
      ? value / 100
      : value;

  return (
    ratio >= 0 &&
    ratio <= 1
  )
    ? ratio
    : null;
}

function normalizeBigBallsTeamStatistic(
  stats:
    Record<
      string,
      number | null
    >,
): CanonicalTeamStatistic {
  const passes =
    intStat(
      stats,
      "total_passes",
    );

  const completedPasses =
    intStat(
      stats,
      "accurate_passes",
    );

  const derivedPassAccuracy =
    passes !== null &&
    passes > 0 &&
    completedPasses !==
      null &&
    completedPasses >= 0 &&
    completedPasses <=
      passes
      ? completedPasses /
        passes
      : null;

  return {
    possession:
      ratioStat(
        stats.ball_possession,
      ),

    shots:
      intStat(
        stats,
        "total_shots",
      ),

    shotsOnTarget:
      intStat(
        stats,
        "shots_on_target",
      ),

    shotsOffTarget:
      intStat(
        stats,
        "shots_off_target",
      ),

    blockedShots:
      intStat(
        stats,
        "blocked_shots",
      ),

    shotsInsideBox:
      intStat(
        stats,
        "shots_inside_box",
      ),

    shotsOutsideBox:
      intStat(
        stats,
        "shots_outside_box",
      ),

    xG:
      null,

    passes,

    completedPasses,

    passAccuracy:
      derivedPassAccuracy ??
      ratioStat(
        stats.pass_percentage,
      ),

    corners:
      intStat(
        stats,
        "corner_kicks",
      ),

    fouls:
      intStat(
        stats,
        "fouls",
      ),

    offsides:
      intStat(
        stats,
        "offsides",
      ),

    yellowCards:
      intStat(
        stats,
        "yellow_cards",
      ),

    redCards:
      intStat(
        stats,
        "red_cards",
      ),

    tackles:
      null,

    interceptions:
      null,

    clearances:
      null,

    saves:
      intStat(
        stats,
        "goalkeeper_saves",
      ),

    attacks:
      null,

    dangerousAttacks:
      null,

    freeKicks:
      null,

    goalKicks:
      null,

    throwIns:
      null,

    substitutions:
      null,
  };
}

function normalizeGoalTeamStatistic(
  stats:
    GoalTeamStatistic,
): CanonicalTeamStatistic {
  return {
    possession:
      stats.possession,

    shots:
      stats.shots,

    shotsOnTarget:
      stats.shotsOnTarget,

    shotsOffTarget:
      stats.shotsOffTarget,

    blockedShots:
      stats.blockedShots,

    shotsInsideBox:
      stats.shotsInsideBox,

    shotsOutsideBox:
      stats.shotsOutsideBox,

    xG:
      null,

    passes:
      stats.passes,

    completedPasses:
      stats.completedPasses,

    passAccuracy:
      stats.passAccuracy,

    corners:
      stats.corners,

    fouls:
      stats.fouls,

    offsides:
      stats.offsides,

    yellowCards:
      stats.yellowCards,

    redCards:
      stats.redCards,

    tackles:
      null,

    interceptions:
      null,

    clearances:
      null,

    saves:
      stats.saves,

    attacks:
      stats.attacks,

    dangerousAttacks:
      stats.dangerousAttacks,

    freeKicks:
      stats.freeKicks,

    goalKicks:
      stats.goalKicks,

    throwIns:
      stats.throwIns,

    substitutions:
      stats.substitutions,
  };
}

function derivePassAccuracy(
  passes:
    number | null,

  completedPasses:
    number | null,
) {
  if (
    passes === null ||
    passes <= 0 ||
    completedPasses ===
      null ||
    completedPasses < 0 ||
    completedPasses >
      passes
  ) {
    return null;
  }

  return (
    completedPasses /
    passes
  );
}

function mergeTeamStatistic(
  input: {
    side:
      | "home"
      | "away";

    teamName:
      string;

    goal:
      CanonicalTeamStatistic | null;

    bigBalls:
      CanonicalTeamStatistic | null;
  },
) {
  const fieldSources:
    Record<
      string,
      FieldSource
    > = {};

  const discrepancies:
    TeamDiscrepancy[] =
    [];

  let fieldsFilledByBigBalls =
    0;

  function choose(
    field:
      string,

    primary:
      | number
      | null
      | undefined,

    fallback:
      | number
      | null
      | undefined,

    compare =
      true,
  ) {
    if (
      primary !== null &&
      primary !== undefined
    ) {
      fieldSources[field] =
        "goal-api";

      if (
        compare &&
        fallback !== null &&
        fallback !== undefined &&
        primary !== fallback
      ) {
        discrepancies.push({
          side:
            input.side,

          teamName:
            input.teamName,

          field,

          goal:
            primary,

          bigBalls:
            fallback,

          delta:
            Math.abs(
              primary -
              fallback,
            ),
        });
      }

      return primary;
    }

    if (
      fallback !== null &&
      fallback !== undefined
    ) {
      fieldSources[field] =
        "big-balls-data";

      fieldsFilledByBigBalls +=
        1;

      return fallback;
    }

    return null;
  }

  const possession =
    choose(
      "possession",

      input.goal
        ?.possession,

      input.bigBalls
        ?.possession,
    );

  const shots =
    choose(
      "shots",

      input.goal
        ?.shots,

      input.bigBalls
        ?.shots,
    );

  const shotsOnTarget =
    choose(
      "shotsOnTarget",

      input.goal
        ?.shotsOnTarget,

      input.bigBalls
        ?.shotsOnTarget,
    );

  const shotsOffTarget =
    choose(
      "shotsOffTarget",

      input.goal
        ?.shotsOffTarget,

      input.bigBalls
        ?.shotsOffTarget,
    );

  const blockedShots =
    choose(
      "blockedShots",

      input.goal
        ?.blockedShots,

      input.bigBalls
        ?.blockedShots,
    );

  const shotsInsideBox =
    choose(
      "shotsInsideBox",

      input.goal
        ?.shotsInsideBox,

      input.bigBalls
        ?.shotsInsideBox,
    );

  const shotsOutsideBox =
    choose(
      "shotsOutsideBox",

      input.goal
        ?.shotsOutsideBox,

      input.bigBalls
        ?.shotsOutsideBox,
    );

  const passes =
    choose(
      "passes",

      input.goal
        ?.passes,

      input.bigBalls
        ?.passes,
    );

  const completedPasses =
    choose(
      "completedPasses",

      input.goal
        ?.completedPasses,

      input.bigBalls
        ?.completedPasses,
    );

  const derivedPassAccuracy =
    derivePassAccuracy(
      passes,
      completedPasses,
    );

  const passAccuracy =
    derivedPassAccuracy !==
    null
      ? derivedPassAccuracy
      : choose(
          "passAccuracy",

          input.goal
            ?.passAccuracy,

          input.bigBalls
            ?.passAccuracy,

          false,
        );

  if (
    derivedPassAccuracy !==
    null
  ) {
    fieldSources.passAccuracy =
      "derived";
  }

  const corners =
    choose(
      "corners",

      input.goal
        ?.corners,

      input.bigBalls
        ?.corners,
    );

  const fouls =
    choose(
      "fouls",

      input.goal
        ?.fouls,

      input.bigBalls
        ?.fouls,
    );

  const offsides =
    choose(
      "offsides",

      input.goal
        ?.offsides,

      input.bigBalls
        ?.offsides,
    );

  const yellowCards =
    choose(
      "yellowCards",

      input.goal
        ?.yellowCards,

      input.bigBalls
        ?.yellowCards,
    );

  const redCards =
    choose(
      "redCards",

      input.goal
        ?.redCards,

      input.bigBalls
        ?.redCards,
    );

  const tackles =
    choose(
      "tackles",

      input.goal
        ?.tackles,

      input.bigBalls
        ?.tackles,
    );

  const interceptions =
    choose(
      "interceptions",

      input.goal
        ?.interceptions,

      input.bigBalls
        ?.interceptions,
    );

  const clearances =
    choose(
      "clearances",

      input.goal
        ?.clearances,

      input.bigBalls
        ?.clearances,
    );

  const saves =
    choose(
      "saves",

      input.goal
        ?.saves,

      input.bigBalls
        ?.saves,
    );

  const attacks =
    choose(
      "attacks",

      input.goal
        ?.attacks,

      input.bigBalls
        ?.attacks,
    );

  const dangerousAttacks =
    choose(
      "dangerousAttacks",

      input.goal
        ?.dangerousAttacks,

      input.bigBalls
        ?.dangerousAttacks,
    );

  const freeKicks =
    choose(
      "freeKicks",

      input.goal
        ?.freeKicks,

      input.bigBalls
        ?.freeKicks,
    );

  const goalKicks =
    choose(
      "goalKicks",

      input.goal
        ?.goalKicks,

      input.bigBalls
        ?.goalKicks,
    );

  const throwIns =
    choose(
      "throwIns",

      input.goal
        ?.throwIns,

      input.bigBalls
        ?.throwIns,
    );

  const substitutions =
    choose(
      "substitutions",

      input.goal
        ?.substitutions,

      input.bigBalls
        ?.substitutions,
    );

  const statistics:
    CanonicalTeamStatistic = {
    possession,

    shots,

    shotsOnTarget,

    shotsOffTarget,

    blockedShots,

    shotsInsideBox,

    shotsOutsideBox,

    xG:
      null,

    passes,

    completedPasses,

    passAccuracy,

    corners,

    fouls,

    offsides,

    yellowCards,

    redCards,

    tackles,

    interceptions,

    clearances,

    saves,

    attacks,

    dangerousAttacks,

    freeKicks,

    goalKicks,

    throwIns,

    substitutions,
  };

  return {
    statistics,

    fieldSources,

    fieldsFilledByBigBalls,

    discrepancies,
  };
}

export async function previewCanonicalTeamStatistics(
  matchId:
    string,
) {
  const match =
    await db.orm.public.Match
      .where({
        id:
          matchId,
      })
      .include(
        "homeTeam",
      )
      .include(
        "awayTeam",
      )
      .include(
        "competition",
      )
      .first();

  if (!match) {
    throw new Error(
      `Match ${matchId} was not found.`,
    );
  }

  if (
    !match.homeTeam
      .isBarcelona &&
    !match.awayTeam
      .isBarcelona
  ) {
    throw new Error(
      "Match is not an FC Barcelona fixture.",
    );
  }

  if (
    match.status !==
    "finished"
  ) {
    throw new Error(
      "Canonical team-stat preview accepts finished matches only.",
    );
  }

  const mappings =
    await db.orm.public.ProviderMapping
      .where({
        internalId:
          match.id,

        entityType:
          "match",
      })
      .include(
        "dataSource",
      )
      .all();

  const internal:
    MatchIdentityInput = {
      kickoff:
        match.kickoff
          .toString(),

      competition: {
        name:
          match.competition
            .name,
      },

      homeTeam: {
        name:
          match.homeTeam
            .name,
      },

      awayTeam: {
        name:
          match.awayTeam
            .name,
      },

      score: {
        home:
          match.homeScore,

        away:
          match.awayScore,
      },

      providerIds:
        Object.fromEntries(
          mappings.map(
            (mapping) => [
              mapping.dataSource
                .code,

              mapping.providerId,
            ],
          ),
        ),
    };

  const [
    goalResult,
    bigBallsResult,
  ] =
    await Promise.allSettled([
      fetchGoalMatchBundle(
        internal,
      ),

      fetchBigBallsMatchBundle(
        internal,
      ),
    ]);

  if (
    goalResult.status ===
      "rejected" &&
    bigBallsResult.status ===
      "rejected"
  ) {
    throw new Error(
      `No team-stat provider available. GOAL: ${errorMessage(
        goalResult.reason,
      )}; Big Balls: ${errorMessage(
        bigBallsResult.reason,
      )}`,
    );
  }

  const goal =
    goalResult.status ===
    "fulfilled"
      ? goalResult.value
      : null;

  const bigBalls =
    bigBallsResult.status ===
    "fulfilled"
      ? bigBallsResult.value
      : null;

  const home =
    mergeTeamStatistic({
      side:
        "home",

      teamName:
        match.homeTeam
          .name,

      goal:
        goal
          ? normalizeGoalTeamStatistic(
              goal.statistics
                .home,
            )
          : null,

      bigBalls:
        bigBalls
          ? normalizeBigBallsTeamStatistic(
              bigBalls
                .teamStatistics
                .home,
            )
          : null,
    });

  const away =
    mergeTeamStatistic({
      side:
        "away",

      teamName:
        match.awayTeam
          .name,

      goal:
        goal
          ? normalizeGoalTeamStatistic(
              goal.statistics
                .away,
            )
          : null,

      bigBalls:
        bigBalls
          ? normalizeBigBallsTeamStatistic(
              bigBalls
                .teamStatistics
                .away,
            )
          : null,
    });

  const discrepancies = [
    ...home
      .discrepancies,

    ...away
      .discrepancies,
  ];

  return {
    match: {
      id:
        match.id,

      competition:
        match.competition
          .name,

      home:
        match.homeTeam
          .name,

      away:
        match.awayTeam
          .name,

      score: {
        home:
          match.homeScore,

        away:
          match.awayScore,
      },
    },

    providers: {
      goal: {
        available:
          goal !==
          null,

        error:
          goalResult.status ===
          "rejected"
            ? errorMessage(
                goalResult.reason,
              )
            : null,

        requestCount:
          goal?.requestCount ??
          0,
      },

      bigBalls: {
        available:
          bigBalls !==
          null,

        error:
          bigBallsResult.status ===
          "rejected"
            ? errorMessage(
                bigBallsResult.reason,
              )
            : null,

        requestCount:
          bigBalls
            ?.requestCount ??
          0,
      },
    },

    merge: {
      primary:
        goal
          ? "goal-api"
          : "big-balls-data",

      fallback:
        goal &&
        bigBalls
          ? "big-balls-data"
          : null,

      fieldsFilledByBigBalls:
        home
          .fieldsFilledByBigBalls +
        away
          .fieldsFilledByBigBalls,

      discrepancies:
        discrepancies.length,

      discrepancyDetails:
        discrepancies,
    },

    teams: {
      home: {
        teamId:
          match.homeTeamId,

        teamName:
          match.homeTeam
            .name,

        statistics:
          home.statistics,

        fieldSources:
          home.fieldSources,
      },

      away: {
        teamId:
          match.awayTeamId,

        teamName:
          match.awayTeam
            .name,

        statistics:
          away.statistics,

        fieldSources:
          away.fieldSources,
      },
    },

    database: {
      writes:
        0,
    },
  };
}