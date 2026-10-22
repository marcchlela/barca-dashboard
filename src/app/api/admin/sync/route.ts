import {
  NextResponse,
} from "next/server";
import { guardAdminRequest } from "../../../../lib/admin/access";
import { db } from "../../../../prisma/db";

import {
  syncBarcelonaMatches,
  syncLaLigaCurrentSeason,
} from "../../../../lib/providers/football-data/sync";
import { syncStandingsHistory } from "../../../../lib/analytics/standings-history";
import { syncCompetitionFixtures } from "../../../../lib/analytics/competition-sync";

import {
  syncRichMatch,
} from "../../../../lib/providers/rich-match/sync";
import { persistCanonicalPlayerStatistics } from "../../../../lib/providers/rich-match/persist-canonical-player-stats";

import {
  richMatchQa,
} from "../../../../lib/providers/rich-match/qa";

import {
  syncOfficialMatchMedia,
} from "../../../../lib/providers/youtube-fcbarcelona/match-media";

import {
  runAutomaticMatchMediaWorker,
} from "../../../../lib/providers/youtube-fcbarcelona/automatic-worker";
import { runGoalMediaBackgroundWorker } from "../../../../lib/providers/dailygoal/background-worker";

type SyncAction =
  | "fixture_sync"
  | "standings_history_preview"
  | "standings_history_sync"
  | "competition_fixtures_preview"
  | "competition_fixtures_sync"
  | "rich_match_preview"
  | "rich_match_sync"
  | "match_qa"
  | "media_match_preview"
  | "media_match_sync"
  | "media_worker_preview"
  | "media_worker_run"
  | "goal_media_worker_preview"
  | "goal_media_worker_run";

type RequestBody = {
  action?:
    unknown;

  matchId?:
    unknown;
  competitionCode?: unknown;
};

async function syncCompleteRichMatch(matchId: string, dryRun: boolean) {
  let richMatch:
    | { status: "success"; result: Awaited<ReturnType<typeof syncRichMatch>> }
    | { status: "unavailable"; error: string };
  try {
    richMatch = { status: "success", result: await syncRichMatch({ matchId, dryRun }) };
  } catch (error) {
    // GOAL can omit or misidentify a fixture while Highlightly/live recovery
    // has already populated useful canonical data. Report that provider stage
    // accurately without hiding the data that is present or preventing the
    // independent player-stat provider from running.
    richMatch = {
      status: "unavailable",
      error: error instanceof Error ? error.message : String(error),
    };
  }
  let playerStatistics:
    | { status: "success"; result: Awaited<ReturnType<typeof persistCanonicalPlayerStatistics>> }
    | { status: "unavailable"; error: string };
  try {
    playerStatistics = {
      status: "success",
      result: await persistCanonicalPlayerStatistics({ matchId, dryRun }),
    };
  } catch (error) {
    // Lineups/events remain useful when a free player-stat provider has not
    // published its box score yet. The automatic worker will retry this stage.
    playerStatistics = {
      status: "unavailable",
      error: error instanceof Error ? error.message : String(error),
    };
  }

  const [match, lineups, events, teamStatistics, playerRows] = await Promise.all([
    db.orm.public.Match.where({ id: matchId }).first(),
    db.orm.public.Lineup.where({ matchId }).include("players").all(),
    db.orm.public.MatchEvent.where({ matchId }).all(),
    db.orm.public.MatchStatistic.where({ matchId }).all(),
    db.orm.public.PlayerMatchStatistic.where({ matchId }).all(),
  ]);
  const confirmedLineupSides = lineups.filter((lineup) =>
    lineup.isConfirmed && lineup.players.filter((player) => player.role === "starter").length === 11,
  ).length;
  const canonicalCoverage = {
    matchStatus: match?.status ?? "missing",
    score: match?.homeScore !== null && match?.homeScore !== undefined &&
      match.awayScore !== null && match.awayScore !== undefined
      ? `${match.homeScore}-${match.awayScore}`
      : null,
    confirmedLineupSides,
    events: events.length,
    goals: events.filter((event) => ["goal", "penalty_goal", "own_goal"].includes(event.type)).length,
    teamStatisticSides: teamStatistics.length,
    playerPerformances: playerRows.length,
    playerRatings: playerRows.filter((row) => row.rating !== null).length,
  };
  const fallbackDataPresent = confirmedLineupSides === 2 || events.length > 0 ||
    teamStatistics.length > 0 || playerRows.length > 0;

  return {
    status: richMatch.status === "unavailable" && fallbackDataPresent
      ? "fallback-data-present"
      : richMatch.status === "unavailable" && playerStatistics.status === "unavailable"
        ? "providers-unavailable"
        : "success",
    richMatch,
    playerStatistics,
    canonicalCoverage,
  };
}

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
  const denied = await guardAdminRequest(request);
  if (denied) return denied;

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

      case "standings_history_preview":
        result = await syncStandingsHistory(true);
        break;

      case "standings_history_sync":
        result = await syncStandingsHistory(false);
        break;

      case "competition_fixtures_preview":
      case "competition_fixtures_sync": {
        if (body.competitionCode !== "CL" && body.competitionCode !== "CDR" && body.competitionCode !== "SSC") {
          return badRequest("competitionCode must be CL, CDR or SSC.");
        }
        result = await syncCompetitionFixtures(body.competitionCode, action === "competition_fixtures_preview");
        break;
      }

      case "rich_match_preview":
        result =
          await syncCompleteRichMatch(matchId!, true);

        break;

      case "rich_match_sync":
        result =
          await syncCompleteRichMatch(matchId!, false);

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

      case "goal_media_worker_preview":
      case "goal_media_worker_run":
        result = await runGoalMediaBackgroundWorker({ dryRun: action === "goal_media_worker_preview" });
        break;
    }

    const finishedAt =
      new Date();

    const goalWorkerBlocked = (action === "goal_media_worker_preview" || action === "goal_media_worker_run") &&
      result !== null && typeof result === "object" && "status" in result && result.status === "blocked";

    return NextResponse.json({
      ok:
        !goalWorkerBlocked,

      error: goalWorkerBlocked ? "Goal-media source cooldown is active; no requests were made." : undefined,

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
    }, { status: goalWorkerBlocked ? 503 : 200 });
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
    "standings_history_preview",
    "standings_history_sync",
    "competition_fixtures_preview",
    "competition_fixtures_sync",
    "rich_match_preview",
    "rich_match_sync",
    "match_qa",
    "media_match_preview",
    "media_match_sync",
    "media_worker_preview",
    "media_worker_run",
    "goal_media_worker_preview",
    "goal_media_worker_run",
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
