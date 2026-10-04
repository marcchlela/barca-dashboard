import "server-only";

import {
  db,
} from "../../prisma/db";

export type AdminIssueSeverity =
  | "high"
  | "medium"
  | "low";

export type AdminIssueCategory =
  | "match_data"
  | "media"
  | "player_metadata"
  | "review";

export type AdminIssueType =
  | "missing_final_score"
  | "stale_fixture_status"
  | "missing_player_stats"
  | "missing_team_stats"
  | "missing_confirmed_lineups"
  | "missing_official_highlight"
  | "pending_media_review"
  | "missing_player_portrait"
  | "unknown_player_position";

export type AdminDataIssue = {
  id:
    string;

  severity:
    AdminIssueSeverity;

  category:
    AdminIssueCategory;

  type:
    AdminIssueType;

  title:
    string;

  description:
    string;

  entityLabel:
    string;

  context:
    string | null;

  timestamp:
    string | null;

  href:
    string | null;

  actionLabel:
    string | null;
};

export async function getAdminDataIssues() {
  const season =
    await db.orm.public.Season
      .where({
        isCurrent:
          true,
      })
      .first();

  if (!season) {
    throw new Error(
      "No current season exists.",
    );
  }

  const barcelona =
    await db.orm.public.Team
      .where({
        isBarcelona:
          true,
      })
      .first();

  if (!barcelona) {
    throw new Error(
      "FC Barcelona does not exist in the database.",
    );
  }

  const [
    matches,
    lineups,
    teamStatistics,
    playerStatistics,
    mediaItems,
    squadMemberships,
    reviewCandidates,
  ] =
    await Promise.all([
      db.orm.public.Match
        .where({
          seasonId:
            season.id,
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
        .orderBy(
          (
            match,
          ) =>
            match.kickoff.asc(),
        )
        .all(),

      db.orm.public.Lineup
        .all(),

      db.orm.public.MatchStatistic
        .all(),

      db.orm.public.PlayerMatchStatistic
        .all(),

      db.orm.public.MediaItem
        .all(),

      db.orm.public.SquadMembership
        .where({
          seasonId:
            season.id,

          teamId:
            barcelona.id,
        })
        .include(
          "player",
        )
        .all(),

      db.orm.public.MediaReviewCandidate
        .where({
          seasonId:
            season.id,
        })
        .all(),
    ]);

  /*
  |--------------------------------------------------------------------------
  | Current Barça matches
  |--------------------------------------------------------------------------
  */

  const barcelonaMatches =
    matches.filter(
      (
        match,
      ) =>
        match.homeTeamId ===
          barcelona.id ||
        match.awayTeamId ===
          barcelona.id,
    );

  const matchIds =
    new Set(
      barcelonaMatches.map(
        (
          match,
        ) =>
          match.id,
      ),
    );

  const finishedMatches =
    barcelonaMatches.filter(
      (
        match,
      ) =>
        match.status ===
        "finished",
    );

  const finishedMatchIds =
    new Set(
      finishedMatches.map(
        (
          match,
        ) =>
          match.id,
      ),
    );

  const matchById =
    new Map(
      barcelonaMatches.map(
        (
          match,
        ) => [
          match.id,
          match,
        ],
      ),
    );

  /*
  |--------------------------------------------------------------------------
  | Coverage maps
  |--------------------------------------------------------------------------
  */

  const confirmedLineupCountByMatch =
    new Map<
      string,
      number
    >();

  for (
    const lineup
    of lineups
  ) {
    if (
      !finishedMatchIds.has(
        lineup.matchId,
      ) ||
      !lineup.isConfirmed
    ) {
      continue;
    }

    confirmedLineupCountByMatch.set(
      lineup.matchId,
      (
        confirmedLineupCountByMatch.get(
          lineup.matchId,
        ) ??
        0
      ) +
        1,
    );
  }

  const teamStatCountByMatch =
    new Map<
      string,
      number
    >();

  for (
    const statistic
    of teamStatistics
  ) {
    if (
      !finishedMatchIds.has(
        statistic.matchId,
      )
    ) {
      continue;
    }

    teamStatCountByMatch.set(
      statistic.matchId,
      (
        teamStatCountByMatch.get(
          statistic.matchId,
        ) ??
        0
      ) +
        1,
    );
  }

  const playerStatCountByMatch =
    new Map<
      string,
      number
    >();

  for (
    const statistic
    of playerStatistics
  ) {
    if (
      !finishedMatchIds.has(
        statistic.matchId,
      )
    ) {
      continue;
    }

    playerStatCountByMatch.set(
      statistic.matchId,
      (
        playerStatCountByMatch.get(
          statistic.matchId,
        ) ??
        0
      ) +
        1,
    );
  }

  const matchesWithOfficialHighlight =
    new Set(
      mediaItems
        .filter(
          (
            item,
          ) =>
            item.matchId !==
              null &&
            matchIds.has(
              item.matchId,
            ) &&
            item.isOfficial &&
            item.type ===
              "match_highlight",
        )
        .map(
          (
            item,
          ) =>
            item.matchId,
        )
        .filter(
          (
            matchId,
          ): matchId is string =>
            matchId !==
            null,
        ),
    );

  /*
  |--------------------------------------------------------------------------
  | Build issues
  |--------------------------------------------------------------------------
  */

  const issues:
    AdminDataIssue[] = [];

  const now =
    Date.now();

  const staleFixtureThreshold =
    6 *
    60 *
    60 *
    1000;

  /*
  |--------------------------------------------------------------------------
  | Match integrity
  |--------------------------------------------------------------------------
  */

  for (
    const match
    of barcelonaMatches
  ) {
    const label =
      matchLabel(
        match,
      );

    const context =
      matchContext(
        match,
      );

    const timestamp =
      temporalString(
        match.kickoff,
      );

    if (
      match.status ===
        "finished" &&
      (
        match.homeScore ===
          null ||
        match.awayScore ===
          null
      )
    ) {
      issues.push({
        id:
          `missing-final-score:${match.id}`,

        severity:
          "high",

        category:
          "match_data",

        type:
          "missing_final_score",

        title:
          "Finished match is missing its final score",

        description:
          "This fixture is marked finished, but one or both canonical full-time score fields are still null.",

        entityLabel:
          label,

        context,

        timestamp,

        href:
          `/matches/${match.id}`,

        actionLabel:
          "Open Match",
      });
    }

    const kickoffTime =
      temporalMilliseconds(
        match.kickoff,
      );

    if (
      match.status ===
        "scheduled" &&
      Number.isFinite(
        kickoffTime,
      ) &&
      kickoffTime <
        now -
          staleFixtureThreshold
    ) {
      issues.push({
        id:
          `stale-fixture:${match.id}`,

        severity:
          "high",

        category:
          "match_data",

        type:
          "stale_fixture_status",

        title:
          "Fixture status may be stale",

        description:
          "The scheduled kickoff is already more than six hours in the past, but the canonical fixture is still marked scheduled.",

        entityLabel:
          label,

        context,

        timestamp,

        href:
          `/matches/${match.id}`,

        actionLabel:
          "Inspect Match",
      });
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Finished-match rich data
  |--------------------------------------------------------------------------
  */

  for (
    const match
    of finishedMatches
  ) {
    const label =
      matchLabel(
        match,
      );

    const context =
      matchContext(
        match,
      );

    const timestamp =
      temporalString(
        match.kickoff,
      );

    const playerStatCount =
      playerStatCountByMatch.get(
        match.id,
      ) ??
      0;

    if (
      playerStatCount ===
      0
    ) {
      issues.push({
        id:
          `missing-player-stats:${match.id}`,

        severity:
          "medium",

        category:
          "match_data",

        type:
          "missing_player_stats",

        title:
          "Player statistics are missing",

        description:
          "No canonical player-match statistic rows exist for this finished Barça fixture.",

        entityLabel:
          label,

        context,

        timestamp,

        href:
          `/matches/${match.id}`,

        actionLabel:
          "Open Match",
      });
    }

    const teamStatCount =
      teamStatCountByMatch.get(
        match.id,
      ) ??
      0;

    if (
      teamStatCount <
      2
    ) {
      issues.push({
        id:
          `missing-team-stats:${match.id}`,

        severity:
          "medium",

        category:
          "match_data",

        type:
          "missing_team_stats",

        title:
          "Team comparison data is incomplete",

        description:
          "A finished match should have canonical team-stat rows for both sides. Fewer than two are currently stored.",

        entityLabel:
          label,

        context,

        timestamp,

        href:
          `/matches/${match.id}`,

        actionLabel:
          "Open Match",
      });
    }

    const confirmedLineups =
      confirmedLineupCountByMatch.get(
        match.id,
      ) ??
      0;

    if (
      confirmedLineups <
      2
    ) {
      issues.push({
        id:
          `missing-confirmed-lineups:${match.id}`,

        severity:
          "medium",

        category:
          "match_data",

        type:
          "missing_confirmed_lineups",

        title:
          "Confirmed lineups are incomplete",

        description:
          "The canonical database does not currently contain confirmed lineup records for both teams.",

        entityLabel:
          label,

        context,

        timestamp,

        href:
          `/matches/${match.id}`,

        actionLabel:
          "Open Match",
      });
    }

    if (
      !matchesWithOfficialHighlight.has(
        match.id,
      )
    ) {
      issues.push({
        id:
          `missing-highlight:${match.id}`,

        severity:
          "low",

        category:
          "media",

        type:
          "missing_official_highlight",

        title:
          "Official highlight is missing",

        description:
          "No official match_highlight media item is currently attached to this finished fixture.",

        entityLabel:
          label,

        context,

        timestamp,

        href:
          "/admin/media",

        actionLabel:
          "Open Media",
      });
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Media review
  |--------------------------------------------------------------------------
  */

  for (
    const candidate
    of reviewCandidates
  ) {
    if (
      candidate.status !==
      "pending"
    ) {
      continue;
    }

    const match =
      matchById.get(
        candidate.matchId,
      );

    issues.push({
      id:
        `media-review:${candidate.id}`,

      severity:
        "medium",

      category:
        "review",

      type:
        "pending_media_review",

      title:
        "Media candidate needs review",

      description:
        `The automatic Barça media matcher left this candidate for human review with confidence score ${candidate.score}.`,

      entityLabel:
        match
          ? matchLabel(
              match,
            )
          : candidate.title,

      context:
        match
          ? matchContext(
              match,
            )
          : "Official media review",

      timestamp:
        temporalString(
          candidate.updatedAt,
        ),

      href:
        "/admin/media/review",

      actionLabel:
        "Review Candidate",
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Current squad metadata
  |--------------------------------------------------------------------------
  */

  const seenPlayers =
    new Set<string>();

  for (
    const membership
    of squadMemberships
  ) {
    const player =
      membership.player;

    if (
      !player ||
      !player.isActive ||
      seenPlayers.has(
        player.id,
      )
    ) {
      continue;
    }

    seenPlayers.add(
      player.id,
    );

    const playerContext =
      [
        membership.shirtNumber
          ? `#${membership.shirtNumber}`
          : null,

        membership.position !==
        "unknown"
          ? humanize(
              membership.position,
            )
          : null,
      ]
        .filter(
          Boolean,
        )
        .join(
          " · ",
        ) ||
      "Current squad";

    if (
      !player.portraitUrl
    ) {
      issues.push({
        id:
          `missing-portrait:${player.id}`,

        severity:
          "low",

        category:
          "player_metadata",

        type:
          "missing_player_portrait",

        title:
          "Player portrait is missing",

        description:
          "This active current-season Barça squad member has no canonical portrait URL.",

        entityLabel:
          player.displayName,

        context:
          playerContext,

        timestamp:
          temporalString(
            player.updatedAt,
          ),

        href:
          null,

        actionLabel:
          null,
      });
    }

    if (
      player.primaryPosition ===
      "unknown"
    ) {
      issues.push({
        id:
          `unknown-position:${player.id}`,

        severity:
          "low",

        category:
          "player_metadata",

        type:
          "unknown_player_position",

        title:
          "Primary position is unknown",

        description:
          "This active current-season Barça player still has primaryPosition set to unknown.",

        entityLabel:
          player.displayName,

        context:
          playerContext,

        timestamp:
          temporalString(
            player.updatedAt,
          ),

        href:
          null,

        actionLabel:
          null,
      });
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Sort
  |--------------------------------------------------------------------------
  */

  issues.sort(
    (
      left,
      right,
    ) => {
      const severityDifference =
        severityRank(
          left.severity,
        ) -
        severityRank(
          right.severity,
        );

      if (
        severityDifference !==
        0
      ) {
        return severityDifference;
      }

      const leftTime =
        left.timestamp
          ? new Date(
              left.timestamp,
            ).getTime()
          : 0;

      const rightTime =
        right.timestamp
          ? new Date(
              right.timestamp,
            ).getTime()
          : 0;

      if (
        leftTime !==
        rightTime
      ) {
        return (
          rightTime -
          leftTime
        );
      }

      return left.title.localeCompare(
        right.title,
      );
    },
  );

  const summary = {
    total:
      issues.length,

    high:
      issues.filter(
        (
          issue,
        ) =>
          issue.severity ===
          "high",
      ).length,

    medium:
      issues.filter(
        (
          issue,
        ) =>
          issue.severity ===
          "medium",
      ).length,

    low:
      issues.filter(
        (
          issue,
        ) =>
          issue.severity ===
          "low",
      ).length,

    matchData:
      issues.filter(
        (
          issue,
        ) =>
          issue.category ===
          "match_data",
      ).length,

    media:
      issues.filter(
        (
          issue,
        ) =>
          issue.category ===
            "media" ||
          issue.category ===
            "review",
      ).length,

    playerMetadata:
      issues.filter(
        (
          issue,
        ) =>
          issue.category ===
          "player_metadata",
      ).length,

    review:
      issues.filter(
        (
          issue,
        ) =>
          issue.category ===
          "review",
      ).length,
  };

  return {
    generatedAt:
      new Date()
        .toISOString(),

    season: {
      id:
        season.id,

      label:
        season.label,
    },

    summary,

    issues,
  };
}

function matchLabel(
  match: {
    homeTeam: {
      name:
        string;

      shortName:
        string | null;
    };

    awayTeam: {
      name:
        string;

      shortName:
        string | null;
    };
  },
) {
  const home =
    match.homeTeam
      .shortName ??
    match.homeTeam
      .name;

  const away =
    match.awayTeam
      .shortName ??
    match.awayTeam
      .name;

  return `${home} vs ${away}`;
}

function matchContext(
  match: {
    competition: {
      name:
        string;

      shortName:
        string | null;
    };

    matchday:
      number | null;
  },
) {
  const competition =
    match.competition
      .shortName ??
    match.competition
      .name;

  return match.matchday
    ? `${competition} · Matchday ${match.matchday}`
    : competition;
}

function humanize(
  value:
    string,
) {
  return value
    .replaceAll(
      "_",
      " ",
    )
    .replace(
      /\b\w/g,
      (
        character,
      ) =>
        character.toUpperCase(),
    );
}

function severityRank(
  severity:
    AdminIssueSeverity,
) {
  switch (
    severity
  ) {
    case "high":
      return 0;

    case "medium":
      return 1;

    default:
      return 2;
  }
}

function temporalString(
  value:
    | {
        toString():
          string;
      }
    | string
    | null
    | undefined,
) {
  if (!value) {
    return null;
  }

  return typeof value ===
    "string"
    ? value
    : value.toString();
}

function temporalMilliseconds(
  value: {
    toString():
      string;
  },
) {
  return new Date(
    value.toString(),
  ).getTime();
}

export type AdminDataIssuesData =
  Awaited<
    ReturnType<
      typeof getAdminDataIssues
    >
  >;