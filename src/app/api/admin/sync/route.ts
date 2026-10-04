import {
  NextResponse,
} from "next/server";

import {
  syncBarcelonaMatches,
  syncLaLigaCurrentSeason,
} from "../../../../lib/providers/football-data/sync";

import {
  syncRichMatch,
} from "../../../../lib/providers/rich-match/sync";

import {
  richMatchQa,
} from "../../../../lib/providers/rich-match/qa";

import {
  syncOfficialMatchMedia,
} from "../../../../lib/providers/youtube-fcbarcelona/match-media";

import {
  runAutomaticMatchMediaWorker,
} from "../../../../lib/providers/youtube-fcbarcelona/automatic-worker";

type SyncAction =
  | "fixture_sync"
  | "rich_match_preview"
  | "rich_match_sync"
  | "match_qa"
  | "media_match_preview"
  | "media_match_sync"
  | "media_worker_preview"
  | "media_worker_run";

type RequestBody = {
  action?:
    unknown;

  matchId?:
    unknown;
};

const MATCH_ACTIONS =
  new Set<
    SyncAction
  >([
    "rich_match_preview",
    "rich_match_sync",
    "match_qa",
    "media_match_preview",
    "media_match_sync",
  ]);

export async function POST(
  request:
    Request,
) {
  if (
    process.env.NODE_ENV ===
    "production"
  ) {
    return NextResponse.json(
      {
        ok:
          false,

        error:
          "Admin sync execution is disabled in production.",
      },
      {
        status:
          404,
      },
    );
  }

  try {
    const body =
      (
        await request.json()
      ) as RequestBody;

    if (
      typeof body.action !==
      "string" ||
      !isSyncAction(
        body.action,
      )
    ) {
      return badRequest(
        "A valid sync action is required.",
      );
    }

    const action =
      body.action;

    let matchId:
      string | undefined;

    if (
      MATCH_ACTIONS.has(
        action,
      )
    ) {
      if (
        typeof body.matchId !==
          "string" ||
        !isUuid(
          body.matchId,
        )
      ) {
        return badRequest(
          "A valid matchId UUID is required for this action.",
        );
      }

      matchId =
        body.matchId;
    }

    const startedAt =
      new Date();

    let result:
      unknown;

    switch (
      action
    ) {
      case "fixture_sync": {
        const standings =
          await syncLaLigaCurrentSeason();

        const matches =
          await syncBarcelonaMatches();

        result = {
          standings,
          matches,
        };

        break;
      }

      case "rich_match_preview":
        result =
          await syncRichMatch({
            matchId:
              matchId!,

            dryRun:
              true,
          });

        break;

      case "rich_match_sync":
        result =
          await syncRichMatch({
            matchId:
              matchId!,

            dryRun:
              false,
          });

        break;

      case "match_qa":
        result =
          await richMatchQa(
            matchId!,
          );

        break;

      case "media_match_preview":
        result =
          await syncOfficialMatchMedia({
            matchId:
              matchId!,

            dryRun:
              true,
          });

        break;

      case "media_match_sync":
        result =
          await syncOfficialMatchMedia({
            matchId:
              matchId!,

            dryRun:
              false,
          });

        break;

      case "media_worker_preview":
        result =
          await runAutomaticMatchMediaWorker({
            dryRun:
              true,

            forceAllFinished:
              false,
          });

        break;

      case "media_worker_run":
        result =
          await runAutomaticMatchMediaWorker({
            dryRun:
              false,

            forceAllFinished:
              false,
          });

        break;
    }

    const finishedAt =
      new Date();

    return NextResponse.json({
      ok:
        true,

      action,

      startedAt:
        startedAt
          .toISOString(),

      finishedAt:
        finishedAt
          .toISOString(),

      durationMs:
        finishedAt.getTime() -
        startedAt.getTime(),

      result,
    });
  } catch (
    error
  ) {
    console.error(
      "ADMIN SYNC ACTION FAILED:",
      error,
    );

    return NextResponse.json(
      {
        ok:
          false,

        error:
          error instanceof Error
            ? error.message
            : String(
                error,
              ),
      },
      {
        status:
          500,
      },
    );
  }
}

function isSyncAction(
  value:
    string,
): value is SyncAction {
  return [
    "fixture_sync",
    "rich_match_preview",
    "rich_match_sync",
    "match_qa",
    "media_match_preview",
    "media_match_sync",
    "media_worker_preview",
    "media_worker_run",
  ].includes(
    value,
  );
}

function isUuid(
  value:
    string,
) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function badRequest(
  error:
    string,
) {
  return NextResponse.json(
    {
      ok:
        false,

      error,
    },
    {
      status:
        400,
    },
  );
}