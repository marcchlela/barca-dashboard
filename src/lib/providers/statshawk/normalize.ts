import type {
  StatsHawkEnvelope,
} from "./client";

import type {
  StatsHawkMatchCandidate,
  StatsHawkPlayerPosition,
  StatsHawkPlayerStatistic,
  StatsHawkRosterPlayer,
} from "./types";

import {
  asArray,
  asObject,
  booleanValue,
  nestedScalar,
  numberValue,
  stringValue,
  type JsonObject,
} from "../shared/json";

import {
  repairMojibake,
} from "../shared/normalization";

type ProviderReference = {
  id: string | null;
  name: string | null;
};

type PhaseRow = {
  personId: string;
  personName: string;

  teamId: string;
  teamName: string;

  phase: string | null;

  measures: JsonObject;
};

function reference(
  object: JsonObject | null,
  key: string,
): ProviderReference {
  const value =
    object?.[key];

  if (
    typeof value ===
    "string"
  ) {
    return {
      id:
        value,

      name:
        stringValue(
          object,
          `${key}_name`,
        ),
    };
  }

  const nested =
    asObject(value);

  return {
    id:
      stringValue(
        nested,
        "id",
      ) ??
      stringValue(
        object,
        `${key}_id`,
      ),

    name:
      stringValue(
        nested,
        "name",
        "display_name",
        "full_name",
      ) ??
      stringValue(
        object,
        `${key}_name`,
      ),
  };
}

function primitiveMeasures(
  measures: JsonObject,
) {
  return Object.fromEntries(
    Object.entries(
      measures,
    )
      .map(
        ([
          key,
          value,
        ]) => [
          key,
          nestedScalar(
            value,
          ),
        ],
      )
      .filter(
        ([
          ,
          value,
        ]) =>
          value === null ||
          typeof value ===
            "string" ||
          typeof value ===
            "number" ||
          typeof value ===
            "boolean",
      ),
  ) as Record<
    string,
    string | number | boolean | null
  >;
}

function broadPosition(
  value: string | null,
): StatsHawkPlayerPosition {
  const normalized =
    value
      ?.toLowerCase()
      .trim() ??
    "";

  if (
    normalized === "g" ||
    normalized.includes(
      "goal",
    ) ||
    normalized.includes(
      "keeper",
    )
  ) {
    return "goalkeeper";
  }

  if (
    normalized === "d" ||
    normalized.includes(
      "def",
    )
  ) {
    return "defender";
  }

  if (
    normalized === "m" ||
    normalized.includes(
      "mid",
    )
  ) {
    return "midfielder";
  }

  if (
    normalized === "f" ||
    normalized.includes(
      "for",
    ) ||
    normalized.includes(
      "attack",
    )
  ) {
    return "forward";
  }

  return "unknown";
}

function numericMeasure(
  measures: JsonObject,
  ...aliases: string[]
) {
  for (
    const alias
    of aliases
  ) {
    const direct =
      numberValue(
        measures,
        alias,
      );

    if (
      direct !== null
    ) {
      return direct;
    }

    const nested =
      nestedScalar(
        measures[alias],
      );

    if (
      typeof nested ===
        "number" &&
      Number.isFinite(
        nested,
      )
    ) {
      return nested;
    }

    if (
      typeof nested ===
        "string" &&
      nested.trim() &&
      Number.isFinite(
        Number(
          nested,
        ),
      )
    ) {
      return Number(
        nested,
      );
    }
  }

  return null;
}

function booleanMeasure(
  measures: JsonObject,
  ...aliases: string[]
) {
  for (
    const alias
    of aliases
  ) {
    const value =
      booleanValue(
        measures,
        alias,
      );

    if (
      value !== null
    ) {
      return value;
    }

    const numeric =
      numericMeasure(
        measures,
        alias,
      );

    if (
      numeric !== null
    ) {
      return numeric > 0;
    }
  }

  return null;
}

function phaseRows(
  envelope: StatsHawkEnvelope,
  teamNamesById:
    Record<string, string>,
) {
  const boxscore =
    asObject(
      envelope.data,
    );

  const appearances =
    asArray(
      boxscore,
      "lines",
      "players",
    );

  const rows:
    PhaseRow[] =
    [];

  const seen =
    new Set<string>();

  for (
    const appearance
    of appearances
  ) {
    const row =
      asObject(
        appearance,
      );

    if (!row) {
      continue;
    }

    const person =
      reference(
        row,
        "person",
      );

    const team =
      reference(
        row,
        "team",
      );

    /*
     * StatsHawk box-score lines provide:
     *
     * person
     * person_name
     * team
     *
     * but do not necessarily provide team_name.
     *
     * We therefore resolve the team name from the already
     * verified contest detail instead of discarding the row.
     */
    if (
      !person.id ||
      !person.name ||
      !team.id
    ) {
      continue;
    }

    const teamName =
      team.name ??
      teamNamesById[
        team.id
      ];

    if (!teamName) {
      /*
       * We have a provider team ID that does not belong to either
       * verified fixture side. Do not guess its identity.
       */
      continue;
    }

    const rawPhases =
      asArray(
        row,
        "phases",
      );

    const phases =
      rawPhases.length
        ? rawPhases
        : [row];

    for (
      const phaseValue
      of phases
    ) {
      const phase =
        asObject(
          phaseValue,
        );

      if (!phase) {
        continue;
      }

      const phaseName =
        stringValue(
          phase,
          "phase",
          "role",
        );

      const measures =
        asObject(
          phase.measures,
        ) ??
        asObject(
          phase.statistics,
        ) ??
        asObject(
          phase.stats,
        ) ??
        {};

      const key =
        `${person.id}:${team.id}:${phaseName ?? "unknown"}`;

      if (
        seen.has(
          key,
        )
      ) {
        throw new Error(
          `StatsHawk returned duplicate player phase ${key}.`,
        );
      }

      seen.add(
        key,
      );

      rows.push({
        personId:
          person.id,

        personName:
          repairMojibake(
            person.name,
          ),

        teamId:
          team.id,

        teamName:
          repairMojibake(
            teamName,
          ),

        phase:
          phaseName,

        measures,
      });
    }
  }

  return rows;
}

function summedMetric(
  rows: PhaseRow[],
  ...aliases: string[]
) {
  let found =
    false;

  let total =
    0;

  for (
    const row
    of rows
  ) {
    const value =
      numericMeasure(
        row.measures,
        ...aliases,
      );

    if (
      value === null
    ) {
      continue;
    }

    found = true;
    total += value;
  }

  return found
    ? total
    : null;
}

function combinedBoolean(
  rows: PhaseRow[],
  ...aliases: string[]
) {
  let found =
    false;

  let result =
    false;

  for (
    const row
    of rows
  ) {
    const value =
      booleanMeasure(
        row.measures,
        ...aliases,
      );

    if (
      value === null
    ) {
      continue;
    }

    found = true;

    if (value) {
      result = true;
    }
  }

  return found
    ? result
    : null;
}

function hasParticipation(
  stats: {
    minutes:
      number | null;

    goals:
      number | null;

    assists:
      number | null;

    shots:
      number | null;

    passes:
      number | null;

    tackles:
      number | null;

    interceptions:
      number | null;

    fouls:
      number | null;

    yellowCards:
      number | null;

    redCards:
      number | null;

    saves:
      number | null;

    goalsConceded:
      number | null;
  },
) {
  if (
    (
      stats.minutes ??
      0
    ) > 0
  ) {
    return true;
  }

  return [
    stats.goals,
    stats.assists,
    stats.shots,
    stats.passes,
    stats.tackles,
    stats.interceptions,
    stats.fouls,
    stats.yellowCards,
    stats.redCards,
    stats.saves,
    stats.goalsConceded,
  ].some(
    (value) =>
      (
        value ??
        0
      ) > 0,
  );
}

export function statsHawkCandidate(
  value: unknown,
  competitionName: string,
): StatsHawkMatchCandidate | null {
  const row =
    asObject(value);

  if (!row) {
    return null;
  }

  const home =
    reference(
      row,
      "home_team",
    );

  const away =
    reference(
      row,
      "away_team",
    );

  const kickoff =
    stringValue(
      row,
      "kickoff",
    );

  const score =
    asObject(
      row.score,
    );

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

    homeTeam:
      home.name ??
      stringValue(
        row,
        "home_team_name",
      ) ??
      "",

    awayTeam:
      away.name ??
      stringValue(
        row,
        "away_team_name",
      ) ??
      "",

    homeScore:
      numberValue(
        score,
        "home",
      ) ??
      numberValue(
        row,
        "home_score",
      ),

    awayScore:
      numberValue(
        score,
        "away",
      ) ??
      numberValue(
        row,
        "away_score",
      ),

    competition:
      competitionName,
  };
}

export function statsHawkTeamReference(
  value: unknown,
  side:
    | "home"
    | "away",
) {
  const row =
    asObject(value);

  return reference(
    row,
    `${side}_team`,
  );
}

export function normalizeStatsHawkBoxscore(
  envelope: StatsHawkEnvelope,
  teamNamesById:
    Record<string, string>,
): StatsHawkPlayerStatistic[] {
  const rows =
    phaseRows(
      envelope,
      teamNamesById,
    );

  const grouped =
    new Map<
      string,
      PhaseRow[]
    >();

  for (
    const row
    of rows
  ) {
    const key =
      `${row.personId}:${row.teamId}`;

    const current =
      grouped.get(
        key,
      ) ?? [];

    current.push(
      row,
    );

    grouped.set(
      key,
      current,
    );
  }

  const output:
    StatsHawkPlayerStatistic[] =
    [];

  for (
    const playerRows
    of grouped.values()
  ) {
    const first =
      playerRows[0];

    const minutes =
      summedMetric(
        playerRows,
        "minutes",
        "mins",
      );

    const goals =
      summedMetric(
        playerRows,
        "goals",
      );

    const assists =
      summedMetric(
        playerRows,
        "assists",
      );

    const shots =
      summedMetric(
        playerRows,
        "shots",
      );

    const shotsOnTarget =
      summedMetric(
        playerRows,
        "sot",
        "shots_on_target",
      );

    const passes =
      summedMetric(
        playerRows,
        "passes",
      );

    const completedPasses =
      summedMetric(
        playerRows,
        "passes_cmp",
        "passes_completed",
      );

    const tackles =
      summedMetric(
        playerRows,
        "tackles",
      );

    const interceptions =
      summedMetric(
        playerRows,
        "intc",
        "interceptions",
      );

    const fouls =
      summedMetric(
        playerRows,
        "fouls",
      );

    const yellowCards =
      summedMetric(
        playerRows,
        "yellow",
        "yellow_cards",
      );

    const redCards =
      summedMetric(
        playerRows,
        "red",
        "red_cards",
      );

    const saves =
      summedMetric(
        playerRows,
        "saves",
      );

    const goalsConceded =
      summedMetric(
        playerRows,
        "goals_conceded",
      );

    const cleanSheet =
      combinedBoolean(
        playerRows,
        "clean_sheet",
        "clean_sheets",
      );

    const participant = {
      minutes,
      goals,
      assists,
      shots,
      passes,
      tackles,
      interceptions,
      fouls,
      yellowCards,
      redCards,
      saves,
      goalsConceded,
    };

    if (
      !hasParticipation(
        participant,
      )
    ) {
      continue;
    }

    output.push({
      personId:
        first.personId,

      name:
        first.personName,

      teamProviderId:
        first.teamId,

      teamName:
        first.teamName,

      position:
        broadPosition(
          first.phase,
        ),

      minutes,

      goals,

      assists,

      shots,

      shotsOnTarget,

      passes,

      completedPasses,

      passAccuracy:
        passes !== null &&
        passes > 0 &&
        completedPasses !==
          null
          ? completedPasses /
            passes
          : null,

      tackles,

      interceptions,

      fouls,

      yellowCards,

      redCards,

      saves,

      goalsConceded,

      cleanSheet,

      raw: {
        phases:
          playerRows.map(
            (row) => ({
              phase:
                row.phase,

              measures:
                primitiveMeasures(
                  row.measures,
                ),
            }),
          ),
      },
    });
  }

  return output;
}

function rosterRows(
  envelope: StatsHawkEnvelope,
) {
  const direct =
    asArray(
      envelope.data,
      "items",
      "roster",
      "players",
      "memberships",
    );

  if (
    direct.length
  ) {
    return direct;
  }

  const root =
    asObject(
      envelope.data,
    );

  for (
    const value
    of Object.values(
      root ?? {},
    )
  ) {
    const nested =
      asArray(
        value,
        "items",
        "roster",
        "players",
        "memberships",
      );

    if (
      nested.length
    ) {
      return nested;
    }
  }

  return [];
}

export function normalizeStatsHawkRoster(
  envelope: StatsHawkEnvelope,
): StatsHawkRosterPlayer[] {
  const output:
    StatsHawkRosterPlayer[] =
    [];

  const seen =
    new Set<string>();

  for (
    const value
    of rosterRows(
      envelope,
    )
  ) {
    const row =
      asObject(
        value,
      );

    if (!row) {
      continue;
    }

    const person =
      asObject(
        row.person,
      ) ??
      asObject(
        row.player,
      );

    const bio =
      asObject(
        person?.bio,
      );

    const personId =
      stringValue(
        person,
        "id",
      ) ??
      stringValue(
        row,
        "person_id",
      );

    const rawName =
      stringValue(
        bio,
        "display_name",
        "full_name",
      ) ??
      stringValue(
        person,
        "display_name",
        "full_name",
        "name",
      );

    if (
      !personId ||
      !rawName
    ) {
      continue;
    }

    if (
      seen.has(
        personId,
      )
    ) {
      throw new Error(
        `StatsHawk roster returned duplicate person ID ${personId}.`,
      );
    }

    seen.add(
      personId,
    );

    const rawPosition =
      stringValue(
        bio,
        "position",
        "position_name",
      ) ??
      stringValue(
        person,
        "position",
        "position_name",
      ) ??
      stringValue(
        row,
        "position",
        "position_name",
      );

    output.push({
      personId,

      displayName:
        repairMojibake(
          rawName,
        ),

      position:
        broadPosition(
          rawPosition,
        ),

      birthDate:
        stringValue(
          bio,
          "dob",
          "birth_date",
          "date_of_birth",
        ) ??
        stringValue(
          person,
          "dob",
          "birth_date",
          "date_of_birth",
        ),

      height:
        numberValue(
          bio,
          "height_cm",
          "height_inches",
          "height",
        ) ??
        stringValue(
          bio,
          "height_cm",
          "height_inches",
          "height",
        ),

      weight:
        numberValue(
          bio,
          "weight_kg",
          "weight_lbs",
          "weight",
        ) ??
        stringValue(
          bio,
          "weight_kg",
          "weight_lbs",
          "weight",
        ),

      nationality:
        stringValue(
          bio,
          "nationality",
          "citizenship",
        ) ??
        stringValue(
          person,
          "nationality",
          "citizenship",
        ),

      preferredFoot:
        stringValue(
          bio,
          "preferred_foot",
          "foot",
        ) ??
        stringValue(
          person,
          "preferred_foot",
          "foot",
        ),

      portraitUrl:
        stringValue(
          bio,
          "portrait_url",
          "photo_url",
          "image_url",
          "headshot_url",
        ) ??
        stringValue(
          person,
          "portrait_url",
          "photo_url",
          "image_url",
          "headshot_url",
        ),

      rawPosition,
    });
  }

  return output;
}