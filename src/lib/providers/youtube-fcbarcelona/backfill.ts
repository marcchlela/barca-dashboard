import "server-only";

import {
  db,
} from "../../../prisma/db";

import {
  syncOfficialMatchMedia,
  type MatchMediaSyncResult,
} from "./match-media";

type BackfillStatus =
  | "synced"
  | "no-match-found"
  | "skipped-existing"
  | "failed";

type BackfillMatchResult = {
  matchId:
    string;

  kickoff:
    string;

  competition:
    string;

  home:
    string;

  away:
    string;

  score:
    string;

  status:
    BackfillStatus;

  ok:
    boolean;

  dryRun:
    boolean;

  accepted:
    number;

  acceptedVideos:
    Array<{
      videoId:
        string;

      title:
        string;

      type:
        string;

      score:
        number;
    }>;

  youtubeRequests:
    number;

  videosInspected:
    number;

  writePlan: {
    created:
      number;

    updated:
      number;

    unchanged:
      number;
  };

  persisted:
    boolean;

  error:
    string | null;
};

function errorMessage(
  error:
    unknown,
) {
  return error instanceof Error
    ? error.message
    : String(
        error,
      );
}

async function hasOfficialHighlight(
  matchId:
    string,
) {
  const media =
    await db.orm.public.MediaItem
      .where({
        matchId,
      })
      .all();

  return media.some(
    (
      item,
    ) =>
      item.isOfficial &&
      item.type ===
        "match_highlight",
  );
}

function resultFromSync(
  sync:
    MatchMediaSyncResult,
): BackfillMatchResult {
  return {
    matchId:
      sync.matchId,

    kickoff:
      sync.fixture.kickoff,

    competition:
      "",

    home:
      sync.fixture.home,

    away:
      sync.fixture.away,

    score:
      sync.fixture.score,

    status:
      sync.accepted.length >
      0
        ? "synced"
        : "no-match-found",

    ok:
      true,

    dryRun:
      sync.dryRun,

    accepted:
      sync.accepted.length,

    acceptedVideos:
      sync.accepted.map(
        (
          candidate,
        ) => ({
          videoId:
            candidate.videoId,

          title:
            candidate.title,

          type:
            candidate.type,

          score:
            candidate.score,
        }),
      ),

    youtubeRequests:
      sync.youtube.requests,

    videosInspected:
      sync.youtube
        .videosInspected,

    writePlan:
      sync.writePlan,

    persisted:
      sync.persisted,

    error:
      null,
  };
}

export async function backfillOfficialMatchMedia(
  input: {
    dryRun:
      boolean;

    competitionCodes?:
      string[];

    onlyMissingHighlights?:
      boolean;

    limit?:
      number;
  },
) {
  const season =
    await db.orm.public.Season
      .where({
        isCurrent:
          true,
      })
      .first();

  if (!season) {
    throw new Error(
      "No current season exists in the database.",
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

  const matches =
    await db.orm.public.Match
      .where({
        seasonId:
          season.id,

        status:
          "finished",
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
      .all();

  let selectedMatches =
    matches.filter(
      (
        match,
      ) =>
        match.homeTeamId ===
          barcelona.id ||
        match.awayTeamId ===
          barcelona.id,
    );

  if (
    input.competitionCodes &&
    input.competitionCodes
      .length >
      0
  ) {
    const competitionCodes =
      new Set(
        input.competitionCodes.map(
          (
            value,
          ) =>
            value
              .trim()
              .toUpperCase(),
        ),
      );

    selectedMatches =
      selectedMatches.filter(
        (
          match,
        ) =>
          competitionCodes.has(
            match.competition
              .code
              .toUpperCase(),
          ),
      );
  }

  if (
    input.limit !==
      undefined
  ) {
    selectedMatches =
      selectedMatches.slice(
        0,
        input.limit,
      );
  }

  const onlyMissingHighlights =
    input.onlyMissingHighlights ??
    true;

  const results:
    BackfillMatchResult[] =
    [];

  for (
    const match
    of selectedMatches
  ) {
    const fixture = {
      matchId:
        match.id,

      kickoff:
        match.kickoff
          .toString(),

      competition:
        match.competition
          .name,

      home:
        match.homeTeam.name,

      away:
        match.awayTeam.name,

      score:
        `${match.homeScore ?? "?"}-${match.awayScore ?? "?"}`,
    };

    if (
      onlyMissingHighlights &&
      await hasOfficialHighlight(
        match.id,
      )
    ) {
      results.push({
        ...fixture,

        status:
          "skipped-existing",

        ok:
          true,

        dryRun:
          input.dryRun,

        accepted:
          0,

        acceptedVideos:
          [],

        youtubeRequests:
          0,

        videosInspected:
          0,

        writePlan: {
          created:
            0,

          updated:
            0,

          unchanged:
            1,
        },

        persisted:
          !input.dryRun,

        error:
          null,
      });

      continue;
    }

    console.log(
      `[MEDIA BACKFILL] ${input.dryRun ? "DRY RUN" : "SYNC"}: ${fixture.home} ${fixture.score} ${fixture.away}`,
    );

    try {
      const sync =
        await syncOfficialMatchMedia({
          matchId:
            match.id,

          dryRun:
            input.dryRun,
        });

      const normalized =
        resultFromSync(
          sync,
        );

      normalized.competition =
        match.competition.name;

      results.push(
        normalized,
      );
    } catch (
      error
    ) {
      const message =
        errorMessage(
          error,
        );

      console.error(
        `[MEDIA BACKFILL] FAILED: ${fixture.home} ${fixture.score} ${fixture.away}:`,
        message,
      );

      results.push({
        ...fixture,

        status:
          "failed",

        ok:
          false,

        dryRun:
          input.dryRun,

        accepted:
          0,

        acceptedVideos:
          [],

        youtubeRequests:
          0,

        videosInspected:
          0,

        writePlan: {
          created:
            0,

          updated:
            0,

          unchanged:
            0,
        },

        persisted:
          false,

        error:
          message,
      });
    }
  }

  const synced =
    results.filter(
      (
        result,
      ) =>
        result.status ===
        "synced",
    ).length;

  const noMatchFound =
    results.filter(
      (
        result,
      ) =>
        result.status ===
        "no-match-found",
    ).length;

  const skippedExisting =
    results.filter(
      (
        result,
      ) =>
        result.status ===
        "skipped-existing",
    ).length;

  const failed =
    results.filter(
      (
        result,
      ) =>
        result.status ===
        "failed",
    ).length;

  const acceptedCandidates =
    results.reduce(
      (
        total,
        result,
      ) =>
        total +
        result.accepted,
      0,
    );

  const youtubeRequests =
    results.reduce(
      (
        total,
        result,
      ) =>
        total +
        result.youtubeRequests,
      0,
    );

  const videosInspected =
    results.reduce(
      (
        total,
        result,
      ) =>
        total +
        result.videosInspected,
      0,
    );

  const writePlan =
    results.reduce(
      (
        totals,
        result,
      ) => ({
        created:
          totals.created +
          result.writePlan
            .created,

        updated:
          totals.updated +
          result.writePlan
            .updated,

        unchanged:
          totals.unchanged +
          result.writePlan
            .unchanged,
      }),
      {
        created:
          0,

        updated:
          0,

        unchanged:
          0,
      },
    );

  return {
    season: {
      id:
        season.id,

      label:
        season.label,

      startYear:
        season.startYear,

      endYear:
        season.endYear,
    },

    mode:
      input.dryRun
        ? "dry-run"
        : "write",

    onlyMissingHighlights,

    competitionCodes:
      input.competitionCodes ??
      null,

    limit:
      input.limit ??
      null,

    matchesFound:
      selectedMatches.length,

    processed:
      results.length,

    synced,

    noMatchFound,

    skippedExisting,

    failed,

    acceptedCandidates,

    youtube: {
      requests:
        youtubeRequests,

      videosInspected,
    },

    writePlan,

    allProcessed:
      failed ===
      0,

    results,
  };
}
