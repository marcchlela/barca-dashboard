import "server-only";

import {
  db,
} from "../../prisma/db";

export type MatchMediaItem = {
  id:
    string;

  type:
    string;

  title:
    string;

  description:
    string | null;

  url:
    string;

  externalMediaId:
    string | null;

  thumbnailUrl:
    string | null;

  isOfficial:
    boolean;

  publishedAt:
    string | null;

  player: {
    id:
      string;

    name:
      string;

    portraitUrl:
      string | null;
  } | null;
  verifiedGoals: { id: string; label: string; startSecond: number | null; endSecond: number | null }[];
};

export async function getMatchMedia(
  matchId:
    string,
): Promise<
  MatchMediaItem[]
> {
  const rows =
    await db.orm.public.MediaItem
      .where({
        matchId,
      })
      .include(
        "player",
      )
      .include("goalMoments")
      .all();
  const events = await db.orm.public.MatchEvent.where({ matchId }).include("primaryPlayer").all();
  const eventById = new Map(events.map((event) => [event.id, event]));

  return rows
    .map(
      (
        row,
      ): MatchMediaItem => ({
        id:
          row.id,

        type:
          row.type,

        title:
          row.title,

        description:
          row.description,

        url:
          row.url,

        externalMediaId:
          row.externalMediaId,

        thumbnailUrl:
          row.thumbnailUrl,

        isOfficial:
          row.isOfficial,

        publishedAt:
          row.publishedAt
            ?.toString() ??
          null,

        player:
          row.player
            ? {
                id:
                  row.player.id,

                name:
                  row.player
                    .displayName,

                portraitUrl:
                  row.player
                    .portraitUrl,
              }
            : null,
        verifiedGoals: row.goalMoments.flatMap((moment) => {
          const event = eventById.get(moment.matchEventId);
          if (!event || !["goal", "own_goal", "penalty_goal"].includes(event.type)) return [];
          const rawScorer = event.rawData && typeof event.rawData === "object" && "scorerName" in event.rawData && typeof event.rawData.scorerName === "string" ? event.rawData.scorerName : null;
          return [{ id: event.id, label: `${event.minute ?? "?"}' ${event.primaryPlayer?.displayName ?? rawScorer ?? "Goal"}${event.type === "own_goal" ? " (own goal)" : ""}`, startSecond: moment.startSecond, endSecond: moment.endSecond }];
        }),
      }),
    )
    .sort(
      (
        left,
        right,
      ) => {
        const leftPriority =
          mediaPriority(
            left,
          );

        const rightPriority =
          mediaPriority(
            right,
          );

        if (
          leftPriority !==
          rightPriority
        ) {
          return (
            rightPriority -
            leftPriority
          );
        }

        return (
          new Date(
            right.publishedAt ??
              0,
          ).getTime() -
          new Date(
            left.publishedAt ??
              0,
          ).getTime()
        );
      },
    );
}

function mediaPriority(
  item:
    MatchMediaItem,
) {
  let score =
    0;

  if (
    item.isOfficial
  ) {
    score +=
      100;
  }

  switch (
    item.type
  ) {
    case "match_highlight":
      score +=
        50;
      break;

    case "goal_clip":
      score +=
        40;
      break;

    case "interview":
      score +=
        30;
      break;

    case "press_conference":
      score +=
        20;
      break;

    default:
      score +=
        10;
      break;
  }

  return score;
}
