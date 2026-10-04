"use client";

import {
  useMemo,
} from "react";

import Link from "next/link";

import {
  ArrowRight,
  CircleDot,
} from "lucide-react";

import CompetitionLogo from "./CompetitionLogo";

import type {
  KitTheme,
} from "../../lib/themes";

import type {
  MatchesOverviewData,
} from "../../lib/matches/get-matches-overview";

type Match =
  MatchesOverviewData[
    "matches"
  ][number];

export default function CurrentMatchWindow({
  data,
  theme,
}: {
  data:
    MatchesOverviewData;

  theme:
    KitTheme;
}) {
  const {
    latestFinished,
    currentMatch,
    currentLabel,
  } =
    useMemo(
      () => {
        const now =
          new Date(
            data.generatedAt,
          ).getTime();

        const finished =
          data.matches
            .filter(
              (
                match,
              ) =>
                match.status ===
                  "finished" &&
                new Date(
                  match.kickoff,
                ).getTime() <=
                  now,
            )
            .sort(
              (
                left,
                right,
              ) =>
                new Date(
                  right.kickoff,
                ).getTime() -
                new Date(
                  left.kickoff,
                ).getTime(),
            )[0] ??
          null;

        const live =
          data.matches.find(
            (
              match,
            ) =>
              [
                "live",
                "halftime",
                "extra_time",
                "penalties",
              ].includes(
                match.status,
              ),
          ) ??
          null;

        const next =
          data.matches.find(
            (
              match,
            ) =>
              match.status ===
                "scheduled" &&
              new Date(
                match.kickoff,
              ).getTime() >=
                now,
          ) ??
          null;

        return {
          latestFinished:
            finished,

          currentMatch:
            live ??
            next,

          currentLabel:
            live
              ? "Live Now"
              : "Next Match",
        };
      },
      [
        data.generatedAt,
        data.matches,
      ],
    );

  return (
    <section className="mt-5">
      {/* SECTION LABEL */}

      <div
        className="
          mb-3
          flex
          items-center
          gap-3
        "
      >
        <p
          className="
            text-[8px]
            uppercase
            tracking-[0.18em]
          "
          style={{
            color:
              theme.colors.textMuted,
          }}
        >
          Current Window
        </p>

        <div
          className="
            h-px
            flex-1
          "
          style={{
            backgroundColor:
              theme.colors.border,
          }}
        />
      </div>

      {/* CURRENT MATCH PAIR */}

      <div
        className="
          grid
          gap-3

          lg:grid-cols-2
        "
      >
        <FocusMatch
          label="Latest Result"
          match={
            latestFinished
          }
          theme={
            theme
          }
        />

        <FocusMatch
          label={
            currentLabel
          }
          match={
            currentMatch
          }
          theme={
            theme
          }
          live={
            currentLabel ===
            "Live Now"
          }
        />
      </div>
    </section>
  );
}

/*
|--------------------------------------------------------------------------
| Focus match
|--------------------------------------------------------------------------
*/

function FocusMatch({
  label,
  match,
  theme,
  live = false,
}: {
  label:
    string;

  match:
    Match | null;

  theme:
    KitTheme;

  live?:
    boolean;
}) {
  if (!match) {
    return (
      <div
        className="
          flex
          min-h-[150px]
          items-center
          justify-center
          border
          px-5
        "
        style={{
          borderColor:
            theme.colors.border,

          backgroundColor:
            `${theme.colors.surface}62`,

          color:
            theme.colors.textMuted,
        }}
      >
        <span
          className="
            text-[8px]
            uppercase
            tracking-[0.12em]
          "
        >
          No match available
        </span>
      </div>
    );
  }

  const resultColor =
    match.result ===
    "W"
      ? theme.colors.success
      : match.result ===
          "L"
        ? theme.colors.danger
        : theme.colors.warning;

  return (
    <Link
      href={`/matches/${match.id}`}
      className="
        group
        relative
        min-h-[150px]
        cursor-pointer
        overflow-hidden
        border
        p-4

        sm:p-5
      "
      style={{
        borderColor:
          theme.colors.border,

        background: `
          linear-gradient(
            135deg,
            ${theme.colors.surface} 0%,
            ${theme.colors.backgroundElevated} 100%
          )
        `,
      }}
    >
      {/* STATE STRIPE */}

      <div
        className="
          absolute
          bottom-0
          left-0
          top-0
          w-[2px]
        "
        style={{
          backgroundColor:
            live
              ? theme.colors.success
              : match.result
                ? resultColor
                : theme.colors.accent,
        }}
      />

      {/* TOP */}

      <div
        className="
          flex
          items-start
          justify-between
          gap-4
        "
      >
        <div>
          <div
            className="
              flex
              items-center
              gap-2
            "
          >
            {live ? (
              <CircleDot
                size={10}
                style={{
                  color:
                    theme.colors.success,
                }}
              />
            ) : null}

            <p
              className="
                text-[8px]
                font-medium
                uppercase
                tracking-[0.15em]
              "
              style={{
                color:
                  live
                    ? theme.colors.success
                    : theme.colors.accent,
              }}
            >
              {label}
            </p>
          </div>

          {/* COMPETITION */}

          <div
            className="
              mt-2
              flex
              items-center
              gap-2
            "
          >
            <CompetitionLogo
              src={
                match.competition
                  .logoUrl
              }
              name={
                match.competition
                  .name
              }
              code={
                match.competition
                  .code
              }
              theme={
                theme
              }
              size={
                16
              }
            />

            <span
              className="
                text-[8px]
              "
              style={{
                color:
                  theme.colors.textMuted,
              }}
            >
              {
                match.competition
                  .shortName ??
                match.competition
                  .name
              }
            </span>
          </div>
        </div>

        <ArrowRight
          size={14}
          className="
            transition-transform
            duration-150

            group-hover:translate-x-1
          "
          style={{
            color:
              theme.colors.textMuted,
          }}
        />
      </div>

      {/* TEAMS */}

      <div
        className="
          mt-5
          grid
          gap-2
        "
      >
        <FocusTeam
          team={
            match.homeTeam
          }
          score={
            match.homeScore
          }
          showScore={
            match.status !==
            "scheduled"
          }
          theme={
            theme
          }
        />

        <FocusTeam
          team={
            match.awayTeam
          }
          score={
            match.awayScore
          }
          showScore={
            match.status !==
            "scheduled"
          }
          theme={
            theme
          }
        />
      </div>

      {/* FOOT */}

      <div
        className="
          mt-4
          flex
          items-center
          justify-between
          gap-4
          border-t
          pt-3
        "
        style={{
          borderColor:
            theme.colors.border,
        }}
      >
        <span
          className="
            text-[8px]
            tabular-nums
          "
          style={{
            color:
              theme.colors.textMuted,
          }}
        >
          {formatDate(
            match.kickoff,
          )}

          {match.status ===
          "scheduled"
            ? ` · ${formatTime(
                match.kickoff,
              )}`
            : ""}
        </span>

        {match.result ? (
          <span
            className="
              flex
              h-7
              w-7
              items-center
              justify-center
              border
              text-[9px]
              font-semibold
            "
            style={{
              borderColor:
                `${resultColor}55`,

              color:
                resultColor,
            }}
          >
            {
              match.result
            }
          </span>
        ) : null}
      </div>
    </Link>
  );
}

/*
|--------------------------------------------------------------------------
| Focus team
|--------------------------------------------------------------------------
*/

function FocusTeam({
  team,
  score,
  showScore,
  theme,
}: {
  team: {
    name:
      string;

    shortName:
      string | null;

    crestUrl:
      string | null;
  };

  score:
    number | null;

  showScore:
    boolean;

  theme:
    KitTheme;
}) {
  return (
    <div
      className="
        flex
        items-center
        gap-3
      "
    >
      <TeamCrest
        src={
          team.crestUrl
        }
        name={
          team.shortName ??
          team.name
        }
        theme={
          theme
        }
      />

      <span
        className="
          min-w-0
          flex-1
          truncate
          text-[11px]
          font-medium
        "
      >
        {
          team.shortName ??
          team.name
        }
      </span>

      {showScore ? (
        <span
          className="
            text-[16px]
            font-semibold
            tabular-nums
          "
        >
          {
            score ??
            "—"
          }
        </span>
      ) : null}
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Team crest
|--------------------------------------------------------------------------
*/

function TeamCrest({
  src,
  name,
  theme,
}: {
  src:
    string | null;

  name:
    string;

  theme:
    KitTheme;
}) {
  if (!src) {
    return (
      <span
        className="
          flex
          h-7
          w-7
          shrink-0
          items-center
          justify-center
          border
          text-[7px]
          uppercase
        "
        style={{
          borderColor:
            theme.colors.border,

          color:
            theme.colors.textMuted,
        }}
      >
        {name
          .slice(
            0,
            2,
          )
          .toUpperCase()}
      </span>
    );
  }

  return (
    <span
      className="
        flex
        h-7
        w-7
        shrink-0
        items-center
        justify-center
      "
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={
          src
        }
        alt=""
        className="
          max-h-full
          max-w-full
          object-contain
        "
      />
    </span>
  );
}

/*
|--------------------------------------------------------------------------
| Formatting
|--------------------------------------------------------------------------
*/

function formatDate(
  value:
    string,
) {
  return new Date(
    value,
  ).toLocaleDateString(
    "en-GB",
    {
      day:
        "2-digit",

      month:
        "short",

      year:
        "numeric",
    },
  );
}

function formatTime(
  value:
    string,
) {
  return new Date(
    value,
  ).toLocaleTimeString(
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