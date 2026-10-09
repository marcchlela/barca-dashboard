"use client";

import type {
  ReactNode,
} from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  ArrowDown,
  ArrowUp,
  CircleX,
  ExternalLink,
  Flag,
  Hand,
  HeartPulse,
  MoveRight,
  Pause,
  Play,
  Target,
  TriangleAlert,
  X,
} from "lucide-react";

import FootballIcon from "../icons/FootballIcon";

import type {
  MatchCenterData,
} from "../../lib/matches/get-match-center";

import type {
  KitTheme,
} from "../../lib/themes";
import type { MatchMediaItem } from "../../lib/matches/get-match-media";
import { goalEmbedUrl, goalYouTubeUrl, selectPlayableGoals } from "../../lib/matches/goal-playback";

type MatchTimelineProps = {
  data:
    MatchCenterData;

  theme:
    KitTheme;

  media:
    MatchMediaItem[];
};

type MatchEvent =
  MatchCenterData[
    "events"
  ][number];

type Score = {
  home:
    number;

  away:
    number;
};

const GOAL_TYPES =
  new Set([
    "goal",
    "penalty_goal",
    "own_goal",
  ]);

const YELLOW_TYPES =
  new Set([
    "yellow_card",
  ]);

const RED_TYPES =
  new Set([
    "red_card",
  ]);

const SUBSTITUTION_TYPES =
  new Set([
    "substitution",
  ]);

export default function MatchTimeline({
  data,
  theme,
  media,
}: MatchTimelineProps) {
  const playable = useMemo(() => selectPlayableGoals(data.events, media), [data.events, media]);
  const [activeGoalId, setActiveGoalId] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const activeGoal = activeGoalId ? playable.get(activeGoalId) ?? null : null;
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (activeGoal && !dialog.open) dialog.showModal();
    if (!activeGoal && dialog.open) dialog.close();
  }, [activeGoal]);
  const events =
    [...data.events].sort(
      (
        left,
        right,
      ) => {
        const leftMinute =
          left.minute ??
          Number.MAX_SAFE_INTEGER;

        const rightMinute =
          right.minute ??
          Number.MAX_SAFE_INTEGER;

        if (
          leftMinute !==
          rightMinute
        ) {
          return (
            leftMinute -
            rightMinute
          );
        }

        const leftOrder =
          left.order ??
          Number.MAX_SAFE_INTEGER;

        const rightOrder =
          right.order ??
          Number.MAX_SAFE_INTEGER;

        return (
          leftOrder -
          rightOrder
        );
      },
    );

  let runningScore:
    Score = {
      home:
        0,

      away:
        0,
    };

  let halfTimeInserted =
    false;

  let halfTimeScore:
    Score = {
      home:
        0,

      away:
        0,
    };

  const rows:
    ReactNode[] = [];

  rows.push(
    <MatchPhase
      key="kickoff"
      type="kickoff"
      title="Kick Off"
      detail={
        kickoffLabel(
          data.match
            .kickoff,
        )
      }
      theme={theme}
    />,
  );

  for (
    const event
    of events
  ) {
    const minute =
      event.minute;

    if (
      !halfTimeInserted &&
      minute !== null &&
      minute > 45
    ) {
      halfTimeInserted =
        true;

      halfTimeScore = {
        ...runningScore,
      };

      rows.push(
        <MatchPhase
          key="half-time"
          type="half-time"
          title="Half Time"
          detail={`${halfTimeScore.home} – ${halfTimeScore.away}`}
          theme={theme}
        />,
      );
    }

    if (
      GOAL_TYPES.has(
        event.type,
      )
    ) {
      if (
        event.team?.id ===
        data.match
          .homeTeam.id
      ) {
        runningScore = {
          ...runningScore,

          home:
            runningScore
              .home +
            1,
        };
      }

      if (
        event.team?.id ===
        data.match
          .awayTeam.id
      ) {
        runningScore = {
          ...runningScore,

          away:
            runningScore
              .away +
            1,
        };
      }
    }

    rows.push(
      <TimelineEvent
        key={
          event.id
        }
        event={event}
        score={
          GOAL_TYPES.has(
            event.type,
          )
            ? runningScore
            : null
        }
        data={data}
        theme={theme}
        playable={playable.has(event.id)}
        onPlay={() => setActiveGoalId(event.id)}
      />,
    );
  }

  if (
    !halfTimeInserted
  ) {
    halfTimeScore = {
      ...runningScore,
    };

    rows.push(
      <MatchPhase
        key="half-time"
        type="half-time"
        title="Half Time"
        detail={`${halfTimeScore.home} – ${halfTimeScore.away}`}
        theme={theme}
      />,
    );
  }

  rows.push(
    <MatchPhase
      key="full-time"
      type="full-time"
      title="Full Time"
      detail={
        data.match
          .score.home !==
            null &&
        data.match
          .score.away !==
            null
          ? `${data.match.score.home} – ${data.match.score.away}`
          : "Match ended"
      }
      theme={theme}
    />,
  );

  return (
    <div className="relative">
      <div
        className="
          pointer-events-none
          absolute
          bottom-7
          left-10.25
          top-7
          w-px
        "
        style={{
          backgroundColor:
            theme.colors
              .border,
        }}
      />

      <div>
        {rows}
      </div>

      <dialog
        ref={dialogRef}
        aria-label={activeGoal ? `Watch ${activeGoal.label}` : "Goal video"}
        onCancel={() => setActiveGoalId(null)}
        className="w-[min(94vw,760px)] max-h-[90vh] overflow-y-auto border p-0 backdrop:bg-[#020711db]"
        style={{ position: "fixed", left: "50%", top: "50%", transform: "translate(-50%, -50%)", margin: 0, borderColor: theme.colors.border, background: theme.colors.surface, color: theme.colors.text }}
      >
        {activeGoal && <>
          <div className="flex items-start justify-between gap-4 border-b p-4 sm:p-5" style={{ borderColor: theme.colors.border }}>
            <div className="min-w-0"><p className="text-[9px] uppercase tracking-[.2em]" style={{ color: theme.colors.accent }}>Match Flow / Goal footage</p><h3 className="mt-1 text-lg font-medium sm:text-xl">{activeGoal.label}</h3><p className="mt-1 text-xs" style={{ color: theme.colors.textMuted }}>{data.match.homeTeam.name} {data.match.score.home ?? "–"}–{data.match.score.away ?? "–"} {data.match.awayTeam.name} · {data.match.competition.name}</p></div>
            <button type="button" onClick={() => setActiveGoalId(null)} aria-label="Close goal video" className="cursor-pointer border p-2 focus-visible:outline-2" style={{ borderColor: theme.colors.border, outlineColor: theme.colors.accent }}><X size={18} /></button>
          </div>
          <div className="p-4 sm:p-5">
            <div className="aspect-video w-full bg-black"><iframe key={`${activeGoal.eventId}:${activeGoal.videoId}:${activeGoal.startSecond}`} src={goalEmbedUrl(activeGoal)} title={`${activeGoal.label} · ${activeGoal.mediaTitle}`} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" className="h-full w-full border-0" /></div>
            <div className="mt-3 flex flex-wrap items-start justify-between gap-3 text-xs" style={{ color: theme.colors.textMuted }}><p>{activeGoal.verificationBasis === "manual_visual" ? "Visually verified goal" : "Metadata-confirmed start; footage not visually verified"} · starts at {activeGoal.startSecond}s{activeGoal.endSecond !== null ? ` · ends at ${activeGoal.endSecond}s` : ""}</p><a href={goalYouTubeUrl(activeGoal)} target="_blank" rel="noopener noreferrer" className="inline-flex cursor-pointer items-center gap-1 underline focus-visible:outline-2" style={{ color: theme.colors.accent }}>Open on YouTube <ExternalLink size={12} /></a></div>
            <p className="mt-2 text-[11px]" style={{ color: theme.colors.textMuted }}>If the embed is unavailable or blocked, open the same video on YouTube at this timestamp.</p>
            {playable.size > 1 && <div className="mt-4 border-t pt-4" style={{ borderColor: theme.colors.border }}><p className="mb-2 text-[9px] uppercase tracking-widest" style={{ color: theme.colors.textMuted }}>Other goals</p><div className="flex flex-wrap gap-2">{[...playable.values()].map((goal) => <button key={goal.eventId} type="button" onClick={() => setActiveGoalId(goal.eventId)} aria-current={goal.eventId === activeGoalId ? "true" : undefined} className="cursor-pointer border px-2.5 py-1.5 text-xs focus-visible:outline-2" style={{ borderColor: goal.eventId === activeGoalId ? theme.colors.accent : theme.colors.border, color: goal.eventId === activeGoalId ? theme.colors.accent : theme.colors.text }}>{goal.label}</button>)}</div></div>}
          </div>
        </>}
      </dialog>

      <div
        className="
          border-t
          px-5
          py-3
          text-[8px]
          uppercase
          tracking-[0.16em]
        "
        style={{
          borderColor:
            theme.colors
              .border,

          color:
            theme.colors
              .textMuted,
        }}
      >
        Exact timed events shown from verified match data
      </div>
    </div>
  );
}

function TimelineEvent({
  event,
  score,
  data,
  theme,
  playable,
  onPlay,
}: {
  event:
    MatchEvent;

  score:
    Score | null;

  data:
    MatchCenterData;

  theme:
    KitTheme;

  playable:
    boolean;

  onPlay:
    () => void;
}) {
  const isBarcelona =
    event.team
      ?.isBarcelona ===
    true;

  const isGoal =
    GOAL_TYPES.has(
      event.type,
    );

  return (
    <div
      className="
        relative
        grid
        grid-cols-[58px_minmax(0,1fr)]
        overflow-hidden
        border-b
      "
      style={{
        borderColor:
          theme.colors
            .border,

        background:
          isBarcelona
            ? `linear-gradient(
                90deg,
                ${theme.colors.primary}25 0%,
                ${theme.colors.surface} 64%
              )`
            : "transparent",
      }}
    >
      {isGoal && playable && <button type="button" onClick={onPlay} aria-label={`Watch goal: ${eventTitle(event)} at ${formatMinute(event.minute)}`} className="absolute inset-0 z-20 cursor-pointer hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-[-2px]" style={{ outlineColor: theme.colors.accent }} />}
      {isBarcelona ? (
        <div
          className="
            absolute
            bottom-0
            left-0
            top-0
            w-0.75
          "
          style={{
            backgroundColor:
              theme.colors
                .accent,
          }}
        />
      ) : null}

      <div
        className="
          relative
          z-10
          flex
          flex-col
          items-center
          pt-5
        "
      >
        <span
          className="
            px-1
            font-mono
            text-[11px]
            font-semibold
            tabular-nums
          "
          style={{
            color:
              isBarcelona
                ? theme.colors
                    .accent
                : theme.colors
                    .textMuted,
          }}
        >
          {formatMinute(
            event.minute,
          )}
        </span>

        <div
          className="
            mt-2
            flex
            h-7
            w-7
            items-center
            justify-center
            rounded-full
            border
          "
          style={{
            borderColor:
              isBarcelona
                ? theme.colors
                    .accent
                : theme.colors
                    .border,

            backgroundColor:
              theme.colors
                .surface,

            color:
              isBarcelona
                ? theme.colors
                    .accent
                : theme.colors
                    .textMuted,
          }}
        >
          <EventIcon
            event={event}
          />
        </div>
      </div>

      <div className="min-w-0 px-4 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p
              className="truncate text-xs"
              style={{
                fontWeight:
                  isBarcelona
                    ? 650
                    : 500,

                color:
                  isBarcelona
                    ? theme.colors
                        .text
                    : theme.colors
                        .textMuted,
              }}
            >
              {eventTitle(
                event,
              )}
            </p>

            <EventDetail
              event={event}
              theme={theme}
            />
            {isGoal && playable && <span className="mt-2 inline-flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[.12em]" style={{ color: theme.colors.accent }}><Play size={11} fill="currentColor" aria-hidden="true" />Watch goal</span>}
          </div>

          <div className="flex shrink-0 items-center gap-3">
            {score ? (
              <span
                className="
                  border
                  px-2
                  py-1
                  font-mono
                  text-[10px]
                  font-semibold
                  tabular-nums
                "
                style={{
                  borderColor:
                    isBarcelona
                      ? theme.colors
                          .accent
                      : theme.colors
                          .border,

                  color:
                    isBarcelona
                      ? theme.colors
                          .accent
                      : theme.colors
                          .textMuted,

                  backgroundColor:
                    isBarcelona
                      ? `${theme.colors.accent}10`
                      : "transparent",
                }}
              >
                {score.home}
                {" – "}
                {score.away}
              </span>
            ) : null}

            <span
              className="
                max-w-24
                truncate
                text-right
                text-[8px]
                uppercase
                tracking-[0.14em]
              "
              style={{
                color:
                  isBarcelona
                    ? theme.colors
                        .accent
                    : theme.colors
                        .textMuted,
              }}
            >
              {isBarcelona
                ? "BARÇA"
                : event.team
                    ?.shortName ??
                  event.team
                    ?.name ??
                  opponentLabel(
                    data,
                  )}
            </span>
          </div>
        </div>

        {isGoal ? (
          <div
            className="mt-4 h-px"
            style={{
              background:
                isBarcelona
                  ? `linear-gradient(
                      90deg,
                      ${theme.colors.accent},
                      transparent
                    )`
                  : `linear-gradient(
                      90deg,
                      ${theme.colors.border},
                      transparent
                    )`,

              opacity:
                isBarcelona
                  ? 0.6
                  : 0.45,
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

function MatchPhase({
  type,
  title,
  detail,
  theme,
}: {
  type:
    | "kickoff"
    | "half-time"
    | "full-time";

  title:
    string;

  detail:
    string;

  theme:
    KitTheme;
}) {
  const Icon =
    type ===
    "kickoff"
      ? Play
      : type ===
          "half-time"
        ? Pause
        : Flag;

  return (
    <div
      className="
        relative
        grid
        grid-cols-[58px_minmax(0,1fr)]
        border-b
      "
      style={{
        borderColor:
          theme.colors
            .border,

        backgroundColor:
          theme.colors
            .backgroundElevated,
      }}
    >
      <div className="relative z-10 flex items-center justify-center py-4">
        <div
          className="
            flex
            h-7
            w-7
            items-center
            justify-center
            rounded-full
            border
          "
          style={{
            backgroundColor:
              theme.colors
                .backgroundElevated,

            borderColor:
              type ===
              "full-time"
                ? theme.colors
                    .accent
                : theme.colors
                    .border,

            color:
              type ===
              "full-time"
                ? theme.colors
                    .accent
                : theme.colors
                    .textMuted,
          }}
        >
          <Icon
            size={12}
            strokeWidth={2}
          />
        </div>
      </div>

      <div
        className="
          flex
          items-center
          justify-between
          gap-5
          py-4
          pr-5
        "
      >
        <span
          className="
            text-[9px]
            font-semibold
            uppercase
            tracking-[0.2em]
          "
          style={{
            color:
              type ===
              "full-time"
                ? theme.colors
                    .accent
                : theme.colors
                    .textMuted,
          }}
        >
          {title}
        </span>

        <span
          className="
            font-mono
            text-[10px]
            tabular-nums
          "
          style={{
            color:
              theme.colors
                .text,
          }}
        >
          {detail}
        </span>
      </div>
    </div>
  );
}

function EventIcon({
  event,
}: {
  event:
    MatchEvent;
}) {
  if (
    GOAL_TYPES.has(
      event.type,
    )
  ) {
    return (
      <FootballIcon
        size={13}
      />
    );
  }

  if (
    YELLOW_TYPES.has(
      event.type,
    )
  ) {
    return (
      <span
        className="
          h-3
          w-2
          rounded-[1px]
          bg-[#F2CA45]
        "
      />
    );
  }

  if (
    RED_TYPES.has(
      event.type,
    )
  ) {
    return (
      <span
        className="
          h-3
          w-2
          rounded-[1px]
          bg-[#E84C5B]
        "
      />
    );
  }

  if (
    SUBSTITUTION_TYPES.has(
      event.type,
    )
  ) {
    return (
      <span className="flex -space-x-0.5">
        <ArrowUp
          size={11}
          strokeWidth={2.2}
          className="text-[#58C98D]"
        />

        <ArrowDown
          size={11}
          strokeWidth={2.2}
          className="text-[#E56B73]"
        />
      </span>
    );
  }

  switch (
    event.type
  ) {
    case "kickoff":
    case "period_start":
      return (
        <Play
          size={12}
        />
      );

    case "period_end":
      return (
        <Pause
          size={12}
        />
      );

    case "missed_penalty":
      return (
        <CircleX
          size={13}
        />
      );

    case "shot":
      return (
        <Target
          size={13}
        />
      );

    case "pass":
    case "assist":
      return (
        <MoveRight
          size={13}
        />
      );

    case "carry":
      return (
        <ArrowUp
          size={13}
        />
      );

    case "injury":
      return (
        <HeartPulse
          size={13}
        />
      );

    case "offside":
      return (
        <Flag
          size={12}
        />
      );

    case "foul":
      return (
        <TriangleAlert
          size={13}
        />
      );

    case "save":
      return (
        <Hand
          size={13}
        />
      );

    default:
      return (
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
      );
  }
}

function EventDetail({
  event,
  theme,
}: {
  event:
    MatchEvent;

  theme:
    KitTheme;
}) {
  const text =
    eventDetail(
      event,
    );

  if (!text) {
    return null;
  }

  return (
    <p
      className="mt-1 text-[10px]"
      style={{
        color:
          theme.colors
            .textMuted,
      }}
    >
      {text}
    </p>
  );
}

function eventTitle(
  event:
    MatchEvent,
) {
  if (
    SUBSTITUTION_TYPES.has(
      event.type,
    )
  ) {
    return "Substitution";
  }

  if (
    YELLOW_TYPES.has(
      event.type,
    )
  ) {
    return (
      event.primaryPlayer
        ?.name ??
      "Yellow card"
    );
  }

  if (
    RED_TYPES.has(
      event.type,
    )
  ) {
    return (
      event.primaryPlayer
        ?.name ??
      "Red card"
    );
  }

  return (
    event.primaryPlayer
      ?.name ??
    eventTypeLabel(
      event.type,
    )
  );
}

function eventDetail(
  event:
    MatchEvent,
) {
  if (
    event.type ===
    "penalty_goal"
  ) {
    return event
      .relatedPlayer
      ? `Penalty · Assist: ${event.relatedPlayer.name}`
      : "Penalty";
  }

  if (
    event.type ===
    "own_goal"
  ) {
    return "Own goal";
  }

  if (
    event.type ===
    "goal"
  ) {
    return event
      .relatedPlayer
      ? `Assist: ${event.relatedPlayer.name}`
      : "Goal";
  }

  if (
    event.type ===
    "yellow_card"
  ) {
    return "Yellow card";
  }

  if (
    event.type ===
    "red_card"
  ) {
    return "Red card";
  }

  if (
    event.type ===
    "substitution"
  ) {
    if (
      event.primaryPlayer &&
      event.relatedPlayer
    ) {
      return `${event.relatedPlayer.name} on · ${event.primaryPlayer.name} off`;
    }

    if (
      event.relatedPlayer
    ) {
      return `${event.relatedPlayer.name} on`;
    }

    if (
      event.primaryPlayer
    ) {
      return `${event.primaryPlayer.name} off`;
    }

    return "Player change";
  }

  if (
    event.type ===
    "missed_penalty"
  ) {
    return "Penalty missed";
  }

  return eventTypeLabel(
    event.type,
  );
}

function eventTypeLabel(
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

function formatMinute(
  minute:
    number | null,
) {
  if (
    minute === null
  ) {
    return "—";
  }

  return `${minute}'`;
}

function kickoffLabel(
  kickoff:
    string,
) {
  const date =
    new Date(
      kickoff,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "0'";
  }

  return date.toLocaleTimeString(
    "en-US",
    {
      hour:
        "numeric",

      minute:
        "2-digit",

      hour12:
        true,
    },
  );
}

function opponentLabel(
  data:
    MatchCenterData,
) {
  const opponent =
    data.match
      .homeTeam
      .isBarcelona
      ? data.match
          .awayTeam
      : data.match
          .homeTeam;

  return (
    opponent.shortName ??
    opponent.name
  );
}
