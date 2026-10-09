import "server-only";

import {
  db,
} from "../../prisma/db";

export async function getAdminSyncData() {
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

  const matches =
    await db.orm.public.Match
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
      .all();

  const barcelonaMatches =
    matches
      .filter(
        (
          match,
        ) =>
          match.homeTeamId ===
            barcelona.id ||
          match.awayTeamId ===
            barcelona.id,
      )
      .sort(
        (
          left,
          right,
        ) =>
          instantMilliseconds(
            right.kickoff,
          ) -
          instantMilliseconds(
            left.kickoff,
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

  const scheduledMatches =
    barcelonaMatches.filter(
      (
        match,
      ) =>
        match.status ===
        "scheduled",
    );

  const latestActivity =
    latestDate(
      barcelonaMatches.map(
        (
          match,
        ) =>
          match.updatedAt,
      ),
    );

  const [goalRuns, goalStates, goalEvents, goalMoments, goalCandidates] = await Promise.all([
    db.orm.public.GoalMediaSyncRun.orderBy((run) => run.startedAt.desc()).all(),
    db.orm.public.GoalMediaSyncState.all(),
    db.orm.public.MatchEvent.all(),
    db.orm.public.MediaMoment.include("mediaItem").all(),
    db.orm.public.GoalTimestampCandidate.where({ status: "pending" }).all(),
  ]);
  const latestGoalRun = goalRuns.find((run) => run.mode === "apply") ?? null;
  const lastGoalSuccess = goalRuns.find((run) => run.mode === "apply" && run.status === "success") ?? null;
  const latestScheduledJob = goalRuns.find((run) => run.mode === "scheduled-job") ?? null;
  const latestFixtureRefresh = goalRuns.find((run) => run.mode === "fixture-refresh") ?? null;
  const latestEventRefresh = goalRuns.find((run) => run.mode === "event-refresh") ?? null;
  const jobResult = latestScheduledJob?.result;
  const jobFields = jobResult && typeof jobResult === "object" && !Array.isArray(jobResult) ? jobResult : null;
  const currentMatchIds = new Set(finishedMatches.map((match) => match.id));
  const currentGoalEvents = goalEvents.filter((event) => currentMatchIds.has(event.matchId) && (event.type === "goal" || event.type === "penalty_goal" || event.type === "own_goal"));
  const coveredGoalIds = new Set(goalMoments.filter((moment) => moment.mediaItem.isOfficial).map((moment) => moment.matchEventId));
  const missingGoalEvents = currentGoalEvents.filter((event) => !coveredGoalIds.has(event.id));

  return {
    generatedAt:
      new Date()
        .toISOString(),

    environment:
      process.env.NODE_ENV ??
      "development",

    executionEnabled:
      process.env.NODE_ENV !==
      "production",

    season: {
      id:
        season.id,

      label:
        season.label,
    },

    automation: {
      internalJobConfigured:
        Boolean(
          process.env
            .INTERNAL_JOB_SECRET,
        ),

      footballDataConfigured:
        Boolean(
          process.env
            .FOOTBALL_DATA_API_KEY,
        ),

      goalApiConfigured: Boolean(process.env.GOAL_API_KEY),

      richMatchConfigured:
        Boolean(
          process.env
            .GOAL_API_KEY,
        ) &&
        (
          Boolean(
            process.env
              .BBS_API_KEY,
          ) ||
          Boolean(
            process.env
              .STATSHAWK_API_KEY,
          )
        ),

      youtubeConfigured:
        Boolean(
          process.env
            .YOUTUBE_API_KEY,
        ),
    },

    summary: {
      matches:
        barcelonaMatches.length,

      finished:
        finishedMatches.length,

      scheduled:
        scheduledMatches.length,

      latestActivity,
    },

    goalMedia: {
      schedulingActive: process.env.GOAL_MEDIA_SCHEDULE_ENABLED === "true",
      lastFixtureRefresh: latestFixtureRefresh ? { at: latestFixtureRefresh.startedAt.toString(), status: latestFixtureRefresh.status,
        error: latestFixtureRefresh.error, nextAt: latestFixtureRefresh.finishedAt ? new Date(Date.parse(latestFixtureRefresh.finishedAt.toString()) + (latestFixtureRefresh.status === "blocked" ? 24 : latestFixtureRefresh.status === "success" ? 6 : 3) * 3_600_000).toISOString() : null } : null,
      lastEventRefresh: latestEventRefresh ? { at: latestEventRefresh.startedAt.toString(), status: latestEventRefresh.status, error: latestEventRefresh.error } : null,
      awaitingGoalEvents: finishedMatches.filter((match) => match.homeScore !== null && match.awayScore !== null &&
        currentGoalEvents.filter((event) => event.matchId === match.id).length < match.homeScore + match.awayScore).length,
      lastScheduledJob: latestScheduledJob ? { at: latestScheduledJob.startedAt.toString(), status: latestScheduledJob.status,
        error: latestScheduledJob.error, officialFailed: jobFields && "officialFailed" in jobFields && typeof jobFields.officialFailed === "number" ? jobFields.officialFailed : null,
        fixtureStatus: jobFields && "fixtureStatus" in jobFields && typeof jobFields.fixtureStatus === "string" ? jobFields.fixtureStatus : null,
        eventStatus: jobFields && "eventStatus" in jobFields && typeof jobFields.eventStatus === "string" ? jobFields.eventStatus : null,
        goalStatus: jobFields && "goalStatus" in jobFields && typeof jobFields.goalStatus === "string" ? jobFields.goalStatus : null } : null,
      lastRun: latestGoalRun ? { at: latestGoalRun.startedAt.toString(), status: latestGoalRun.status, error: latestGoalRun.error,
        fixturesChecked: latestGoalRun.fixturesChecked, goalsPublished: latestGoalRun.goalsPublished,
        goalsQueued: latestGoalRun.goalsQueued, missingCoverage: latestGoalRun.missingCoverage } : null,
      lastSuccessfulRun: lastGoalSuccess?.finishedAt?.toString() ?? null,
      retryDue: goalStates.filter((state) => state.status === "pending" && state.nextRetryAt && Date.parse(state.nextRetryAt.toString()) <= Date.now()).length,
      waiting: goalStates.filter((state) => state.status === "pending" && state.nextRetryAt && Date.parse(state.nextRetryAt.toString()) > Date.now()).length,
      review: goalCandidates.filter((candidate) => candidate.matchId && currentMatchIds.has(candidate.matchId)).length,
      exhausted: goalStates.filter((state) => state.status === "exhausted").length,
      missingGoals: missingGoalEvents.length,
      missingFixtures: new Set(missingGoalEvents.map((event) => event.matchId)).size,
      fixtures: goalStates.filter((state) => currentMatchIds.has(state.matchId)).map((state) => {
        const match = finishedMatches.find((item) => item.id === state.matchId)!;
        return { matchId: state.matchId, fixture: `${match.homeTeam.shortName ?? match.homeTeam.name} vs ${match.awayTeam.shortName ?? match.awayTeam.name}`,
          status: state.status, attempts: state.attempts, nextRetryAt: state.nextRetryAt?.toString() ?? null,
          covered: state.goalsCovered, total: state.goalsTotal, reviewPending: state.reviewPending, error: state.lastError };
      }).sort((a, b) => a.fixture.localeCompare(b.fixture)),
    },

    matches:
      barcelonaMatches.map(
        (
          match,
        ) => ({
          id:
            match.id,

          label:
            `${match.homeTeam.shortName ?? match.homeTeam.name} vs ${match.awayTeam.shortName ?? match.awayTeam.name}`,

          homeTeam:
            match.homeTeam
              .shortName ??
            match.homeTeam
              .name,

          awayTeam:
            match.awayTeam
              .shortName ??
            match.awayTeam
              .name,

          competition:
            match.competition
              .shortName ??
            match.competition
              .name,

          competitionCode:
            match.competition
              .code,

          kickoff:
            match.kickoff
              .toString(),

          status:
            match.status,

          matchday:
            match.matchday,

          score:
            match.homeScore !==
                null &&
              match.awayScore !==
                null
              ? `${match.homeScore}-${match.awayScore}`
              : null,
        }),
      ),
  };
}

function instantMilliseconds(
  value: {
    toString():
      string;
  },
) {
  return new Date(
    value.toString(),
  ).getTime();
}

function latestDate(
  values:
    Array<
      | {
          toString():
            string;
        }
      | string
      | null
      | undefined
    >,
) {
  let latest:
    string | null =
    null;

  let latestTime =
    -Infinity;

  for (
    const value
    of values
  ) {
    if (!value) {
      continue;
    }

    const iso =
      typeof value ===
      "string"
        ? value
        : value.toString();

    const time =
      new Date(
        iso,
      ).getTime();

    if (
      Number.isFinite(
        time,
      ) &&
      time >
        latestTime
    ) {
      latestTime =
        time;

      latest =
        iso;
    }
  }

  return latest;
}

export type AdminSyncData =
  Awaited<
    ReturnType<
      typeof getAdminSyncData
    >
  >;
