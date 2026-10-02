export type TeamIdentityMethod =
  | "exact_normalized"
  | "known_alias"
  | "conservative_tokens"
  | "none";

export type MatchIdentityInput = {
  kickoff: string;
  competition: {
    name: string;
  };
  homeTeam: {
    name: string;
  };
  awayTeam: {
    name: string;
  };
  score: {
    home: number | null;
    away: number | null;
  };
  providerIds: Record<
    string,
    string
  >;
};

export type MatchIdentityCandidate = {
  providerMatchId:
    | string
    | null;

  kickoff:
    | string
    | null;

  calendarDate:
    | string
    | null;

  localTime:
    | string
    | null;

  temporalPrecision:
    | "exact"
    | "local_time_unknown_zone"
    | "date_only"
    | "unknown";

  homeTeam: string;
  awayTeam: string;

  homeScore:
    | number
    | null;

  awayScore:
    | number
    | null;

  competition:
    | string
    | null;
};

export type MatchIdentityResolution = {
  matched: boolean;

  confidence: number;

  criteria: {
    providerId: boolean;

    temporalPrecision:
      MatchIdentityCandidate["temporalPrecision"];

    exactKickoff: boolean;

    kickoffDeltaMinutes:
      | number
      | null;

    sameCalendarDate: boolean;

    localTimeProvided: boolean;

    homeTeam: boolean;

    homeTeamMethod:
      TeamIdentityMethod;

    awayTeam: boolean;

    awayTeamMethod:
      TeamIdentityMethod;

    score: boolean;

    competition: boolean;
  };

  notes: string[];
};

const TEAM_STOP_WORDS =
  new Set([
    "club",
    "de",
    "del",
    "fc",
    "cf",
    "futbol",
    "rc",
    "rcd",
    "sad",
  ]);

const TEAM_ALIAS_GROUPS = [
  [
    "barcelona",
    "fc barcelona",
    "barca",
    "barca fc",
  ],

  [
    "sevilla",
    "sevilla fc",
  ],

  [
    "atletico madrid",
    "club atletico de madrid",
    "atletico de madrid",
  ],

  [
    "athletic bilbao",
    "athletic club",
    "athletic club bilbao",
  ],

  [
    "real betis",
    "real betis balompie",
    "betis",
  ],

  [
    "real sociedad",
    "real sociedad de futbol",
  ],

  [
    "deportivo alaves",
    "alaves",
  ],

  [
    "racing santander",
    "real racing santander",
    "real racing club de santander",
  ],

  [
    "rayo vallecano",
    "rayo vallecano madrid",
    "rayo vallecano de madrid",
  ],

  [
    "feyenoord",
    "feyenoord rotterdam",
  ],

  /*
   * Big Balls currently uses "Levante",
   * while football-data.org stores "Levante UD".
   */
  [
    "levante",
    "levante ud",
  ],
] as const;

const COMPETITION_ALIAS_GROUPS = [
  [
    "la liga",
    "laliga",
    "spanish la liga",
    "spain primera division",
    "primera division",
  ],

  [
    "uefa champions league",
    "champions league",
    "ucl",
    "cl",
  ],
] as const;

const DISTINCT_TEAM_MARKERS =
  new Set([
    "b",
    "ii",
    "u17",
    "u18",
    "u19",
    "u20",
    "u21",
    "u23",
    "women",
    "woman",
    "w",
    "femeni",
    "femenino",
    "juvenil",
    "youth",
    "reserves",
  ]);

export function normalizedTeamName(
  value: string,
) {
  return value
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .toLowerCase()
    .replace(
      /[^a-z0-9 ]/g,
      " ",
    )
    .split(/\s+/)
    .filter(
      (part) =>
        part &&
        !TEAM_STOP_WORDS.has(
          part,
        ),
    )
    .join(" ")
    .trim();
}

function aliasKey(
  value: string,
  groups: readonly (
    readonly string[]
  )[],
) {
  const normalized =
    normalizedTeamName(
      value,
    );

  const groupIndex =
    groups.findIndex(
      (group) =>
        group.some(
          (alias) =>
            normalizedTeamName(
              alias,
            ) ===
            normalized,
        ),
    );

  return groupIndex === -1
    ? null
    : `alias-group-${groupIndex}`;
}

function hasDistinctMarker(
  value: string,
) {
  return normalizedTeamName(
    value,
  )
    .split(" ")
    .some(
      (token) =>
        DISTINCT_TEAM_MARKERS.has(
          token,
        ),
    );
}

export function matchTeamIdentity(
  left: string,
  right: string,
): {
  matched: boolean;
  method: TeamIdentityMethod;
} {
  const a =
    normalizedTeamName(
      left,
    );

  const b =
    normalizedTeamName(
      right,
    );

  if (!a || !b) {
    return {
      matched: false,
      method: "none",
    };
  }

  if (a === b) {
    return {
      matched: true,
      method:
        "exact_normalized",
    };
  }

  if (
    hasDistinctMarker(a) ||
    hasDistinctMarker(b)
  ) {
    return {
      matched: false,
      method: "none",
    };
  }

  const leftAlias =
    aliasKey(
      a,
      TEAM_ALIAS_GROUPS,
    );

  const rightAlias =
    aliasKey(
      b,
      TEAM_ALIAS_GROUPS,
    );

  if (
    leftAlias &&
    leftAlias ===
      rightAlias
  ) {
    return {
      matched: true,
      method:
        "known_alias",
    };
  }

  const leftTokens =
    new Set(
      a.split(" "),
    );

  const rightTokens =
    new Set(
      b.split(" "),
    );

  const shared = [
    ...leftTokens,
  ].filter(
    (token) =>
      rightTokens.has(
        token,
      ),
  );

  const largest =
    Math.max(
      leftTokens.size,
      rightTokens.size,
    );

  if (
    largest >= 2 &&
    shared.length ===
      largest
  ) {
    return {
      matched: true,
      method:
        "conservative_tokens",
    };
  }

  return {
    matched: false,
    method: "none",
  };
}

function competitionMatches(
  left: string,
  right: string | null,
) {
  if (!right) {
    return false;
  }

  const normalizedLeft =
    normalizedTeamName(
      left,
    );

  const normalizedRight =
    normalizedTeamName(
      right,
    );

  if (
    normalizedLeft ===
    normalizedRight
  ) {
    return true;
  }

  const leftAlias =
    aliasKey(
      normalizedLeft,
      COMPETITION_ALIAS_GROUPS,
    );

  return Boolean(
    leftAlias &&
      leftAlias ===
        aliasKey(
          normalizedRight,
          COMPETITION_ALIAS_GROUPS,
        ),
  );
}

function internalHasFinalScore(
  internal: MatchIdentityInput,
) {
  return (
    internal.score.home !==
      null &&
    internal.score.away !==
      null
  );
}

export function resolveMatchIdentity(
  internal: MatchIdentityInput,
  candidate: MatchIdentityCandidate,
  providerCode?: string,
): MatchIdentityResolution {
  const expectedProviderId =
    providerCode
      ? internal.providerIds[
          providerCode
        ]
      : undefined;

  const idMatch =
    Boolean(
      expectedProviderId &&
        candidate.providerMatchId &&
        expectedProviderId ===
          candidate.providerMatchId,
    );

  const homeIdentity =
    matchTeamIdentity(
      internal.homeTeam.name,
      candidate.homeTeam,
    );

  const awayIdentity =
    matchTeamIdentity(
      internal.awayTeam.name,
      candidate.awayTeam,
    );

  const score =
    internalHasFinalScore(
      internal,
    ) &&
    candidate.homeScore ===
      internal.score.home &&
    candidate.awayScore ===
      internal.score.away;

  const competition =
    competitionMatches(
      internal.competition.name,
      candidate.competition,
    );

  const internalDate =
    internal.kickoff.slice(
      0,
      10,
    );

  const candidateDate =
    candidate.calendarDate ??
    (
      candidate.temporalPrecision ===
        "exact" &&
      candidate.kickoff
        ? candidate.kickoff.slice(
            0,
            10,
          )
        : null
    );

  const sameCalendarDate =
    Boolean(
      candidateDate &&
        candidateDate ===
          internalDate,
    );

  let exactKickoff =
    false;

  let kickoffDeltaMinutes:
    | number
    | null = null;

  if (
    candidate.temporalPrecision ===
      "exact" &&
    candidate.kickoff
  ) {
    const candidateInstant =
      Date.parse(
        candidate.kickoff,
      );

    const internalInstant =
      Date.parse(
        internal.kickoff,
      );

    if (
      Number.isFinite(
        candidateInstant,
      ) &&
      Number.isFinite(
        internalInstant,
      )
    ) {
      kickoffDeltaMinutes =
        Math.abs(
          candidateInstant -
            internalInstant,
        ) / 60_000;

      exactKickoff =
        kickoffDeltaMinutes <=
        30;
    }
  }

  const confidence =
    Math.min(
      1,

      (
        idMatch
          ? 0.3
          : 0
      ) +
        (
          exactKickoff
            ? 0.15
            : sameCalendarDate
              ? 0.1
              : 0
        ) +
        (
          homeIdentity.matched
            ? 0.15
            : 0
        ) +
        (
          awayIdentity.matched
            ? 0.15
            : 0
        ) +
        (
          score
            ? 0.2
            : 0
        ) +
        (
          competition
            ? 0.05
            : 0
        ),
    );

  const calendarDateEvidence =
    candidate.temporalPrecision !==
      "exact" &&
    sameCalendarDate;

  const finishedEvidence =
    internalHasFinalScore(
      internal,
    ) &&
    score &&
    competition &&
    (
      exactKickoff ||
      calendarDateEvidence
    );

  const upcomingEvidence =
    !internalHasFinalScore(
      internal,
    ) &&
    competition &&
    (
      exactKickoff ||
      (
        calendarDateEvidence &&
        homeIdentity.method ===
          "exact_normalized" &&
        awayIdentity.method ===
          "exact_normalized"
      )
    );

  const matched =
    homeIdentity.matched &&
    awayIdentity.matched &&
    (
      idMatch ||
      finishedEvidence ||
      upcomingEvidence
    );

  const temporalNote =
    (() => {
      switch (
        candidate.temporalPrecision
      ) {
        case "exact":
          return kickoffDeltaMinutes ===
            null
            ? "Provider claimed exact time, but the timestamp was invalid."
            : `Exact kickoff delta: ${kickoffDeltaMinutes.toFixed(
                0,
              )} minutes; tolerance is 30 minutes.`;

        case "local_time_unknown_zone":
          return `Provider time ${candidate.localTime ?? "unknown"} has no reliable timezone and was not compared as an absolute instant.`;

        case "date_only":
          return "Provider supplied a calendar date only; no synthetic kickoff was created.";

        default:
          return "Provider supplied no usable date or kickoff time.";
      }
    })();

  return {
    matched,

    confidence:
      Number(
        confidence.toFixed(
          2,
        ),
      ),

    criteria: {
      providerId:
        idMatch,

      temporalPrecision:
        candidate.temporalPrecision,

      exactKickoff,

      kickoffDeltaMinutes,

      sameCalendarDate,

      localTimeProvided:
        Boolean(
          candidate.localTime,
        ),

      homeTeam:
        homeIdentity.matched,

      homeTeamMethod:
        homeIdentity.method,

      awayTeam:
        awayIdentity.matched,

      awayTeamMethod:
        awayIdentity.method,

      score,

      competition,
    },

    notes: [
      expectedProviderId
        ? `Internal provider ID available: ${expectedProviderId}.`
        : "No internal provider ID was available; used date, teams, score, and competition.",

      temporalNote,

      sameCalendarDate
        ? `Provider calendar date matches ${internalDate}.`
        : `Provider calendar date does not match ${internalDate}.`,

      "A match requires both teams plus provider mapping, or appropriately strong finished/upcoming evidence.",
    ],
  };
}