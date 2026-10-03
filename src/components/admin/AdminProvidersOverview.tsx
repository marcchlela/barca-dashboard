import Link from "next/link";

import {
  Activity,
  BadgeCheck,
  CircleAlert,
  CircleCheck,
  Clock3,
  Database,
  Film,
  Gauge,
  Radio,
  Waypoints,
} from "lucide-react";

import {
  kitThemes,
} from "../../lib/themes";

import type {
  AdminProvider,
  AdminProvidersData,
} from "../../lib/admin/providers";

export default function AdminProvidersOverview({
  data,
}: {
  data:
    AdminProvidersData;
}) {
  const theme =
    kitThemes.home;

  return (
    <div>
      {/* HEADER */}

      <section
        className="
          flex
          flex-col
          gap-5
          border-b
          pb-6

          xl:flex-row
          xl:items-end
          xl:justify-between
        "
        style={{
          borderColor:
            theme.colors.border,
        }}
      >
        <div>
          <p
            className="
              text-[9px]
              uppercase
              tracking-[0.24em]
            "
            style={{
              color:
                theme.colors.accent,
            }}
          >
            Data Operations
          </p>

          <h2
            className="
              mt-2
              text-2xl
              font-medium
              tracking-[-0.035em]

              sm:text-3xl
            "
          >
            Providers
          </h2>

          <p
            className="
              mt-2
              max-w-2xl
              text-[11px]
              leading-5
            "
            style={{
              color:
                theme.colors.textMuted,
            }}
          >
            Inspect every external
            source feeding the Barça
            command center, its local
            configuration, canonical
            records and current-season
            coverage.
          </p>
        </div>

        <div
          className="
            grid
            grid-cols-2
            gap-px
            border

            sm:grid-cols-4
          "
          style={{
            borderColor:
              theme.colors.border,

            backgroundColor:
              theme.colors.border,
          }}
        >
          <HeaderMetric
            label="Active"
            value={
              data.summary
                .active
            }
            tone="success"
          />

          <HeaderMetric
            label="Ready"
            value={
              data.summary
                .ready
            }
          />

          <HeaderMetric
            label="Standby"
            value={
              data.summary
                .standby
            }
          />

          <HeaderMetric
            label="Warnings"
            value={
              data.summary
                .warnings
            }
            tone={
              data.summary
                  .warnings >
              0
                ? "warning"
                : "success"
            }
          />
        </div>
      </section>

      {/* READ-ONLY NOTICE */}

      <section
        className="
          mt-5
          flex
          flex-col
          gap-3
          border
          px-4
          py-3

          sm:flex-row
          sm:items-center
          sm:justify-between
        "
        style={{
          borderColor:
            theme.colors.border,

          backgroundColor:
            `${theme.colors.surface}75`,
        }}
      >
        <div
          className="
            flex
            items-start
            gap-3
          "
        >
          <Radio
            size={14}
            className="
              mt-0.5
              shrink-0
            "
            style={{
              color:
                theme.colors.accent,
            }}
          />

          <div>
            <p
              className="
                text-[8px]
                uppercase
                tracking-[0.16em]
              "
            >
              Read-only monitoring
            </p>

            <p
              className="
                mt-1
                text-[8px]
                leading-4
              "
              style={{
                color:
                  theme.colors.textMuted,
              }}
            >
              This page reads local
              configuration and
              canonical database
              activity only. It does
              not call or consume
              quota from any provider.
            </p>
          </div>
        </div>

        <div
          className="
            shrink-0
            text-[7px]
            uppercase
            tracking-[0.13em]
          "
          style={{
            color:
              theme.colors.textMuted,
          }}
        >
          Live health + sync controls
          next
        </div>
      </section>

      {/* PIPELINE SUMMARY */}

      <section
        className="
          mt-5
          grid
          gap-px
          border

          lg:grid-cols-3
        "
        style={{
          borderColor:
            theme.colors.border,

          backgroundColor:
            theme.colors.border,
        }}
      >
        <PipelineMetric
          icon={
            Activity
          }
          label="Season"
          value={
            data.season
              .label
          }
          detail={`${data.matchContext.finishedMatches} finished Barça matches`}
        />

        <PipelineMetric
          icon={
            Waypoints
          }
          label="Rich Match Coverage"
          value={`${data.matchContext.richCoveredMatches}/${data.matchContext.finishedMatches}`}
          detail="Events / team stats / player stats"
        />

        <PipelineMetric
          icon={
            Clock3
          }
          label="Latest Data Activity"
          value={
            data.summary
              .latestActivity
              ? relativeTime(
                  data.summary
                    .latestActivity,
                )
              : "No activity"
          }
          detail={
            data.summary
              .latestActivity
              ? formatDateTime(
                  data.summary
                    .latestActivity,
                )
              : "No provider writes recorded"
          }
        />
      </section>

      {/* STACK */}

      <section className="mt-7">
        <div
          className="
            flex
            items-end
            justify-between
            gap-4
            border-b
            pb-3
          "
          style={{
            borderColor:
              theme.colors.border,
          }}
        >
          <div>
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
              Provider Stack
            </p>

            <h3
              className="
                mt-1
                text-lg
                font-medium
                tracking-[-0.02em]
              "
            >
              Current data sources
            </h3>
          </div>

          <p
            className="
              text-[8px]
              tabular-nums
            "
            style={{
              color:
                theme.colors.textMuted,
            }}
          >
            {
              data.providers
                .length
            }{" "}
            providers
          </p>
        </div>

        <div
          className="
            mt-4
            grid
            gap-4

            xl:grid-cols-2
          "
        >
          {data.providers.map(
            (
              provider,
            ) => (
              <ProviderCard
                key={
                  provider.code
                }
                provider={
                  provider
                }
              />
            ),
          )}
        </div>
      </section>

      {/* ARCHITECTURE */}

      <section
        className="
          mt-7
          border
        "
        style={{
          borderColor:
            theme.colors.border,
        }}
      >
        <div
          className="
            border-b
            px-4
            py-3
          "
          style={{
            borderColor:
              theme.colors.border,

            backgroundColor:
              `${theme.colors.surface}75`,
          }}
        >
          <p
            className="
              text-[8px]
              uppercase
              tracking-[0.17em]
            "
            style={{
              color:
                theme.colors.textMuted,
            }}
          >
            Current Architecture
          </p>
        </div>

        <div
          className="
            grid
            gap-px

            lg:grid-cols-3
          "
          style={{
            backgroundColor:
              theme.colors.border,
          }}
        >
          <ArchitectureStep
            number="01"
            title="Schedule Layer"
            description="football-data.org maintains fixtures, teams, competitions, results and standings."
          />

          <ArchitectureStep
            number="02"
            title="Rich Match Layer"
            description="GOAL + Big Balls enrich completed fixtures with lineups, scoring events and player-level match data."
          />

          <ArchitectureStep
            number="03"
            title="Media Layer"
            description="The official Barça YouTube worker attaches trusted videos and sends ambiguous candidates to human review."
          />
        </div>
      </section>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Provider card
|--------------------------------------------------------------------------
*/

function ProviderCard({
  provider,
}: {
  provider:
    AdminProvider;
}) {
  const theme =
    kitThemes.home;

  const status =
    providerStatusMeta(
      provider.status,
    );

  return (
    <article
      className="
        flex
        min-h-[340px]
        flex-col
        border
      "
      style={{
        borderColor:
          theme.colors.border,

        backgroundColor:
          `${theme.colors.surface}68`,
      }}
    >
      {/* TOP */}

      <div
        className="
          flex
          items-start
          justify-between
          gap-4
          border-b
          p-4
        "
        style={{
          borderColor:
            theme.colors.border,
        }}
      >
        <div className="min-w-0">
          <p
            className="
              text-[7px]
              uppercase
              tracking-[0.16em]
            "
            style={{
              color:
                theme.colors.textMuted,
            }}
          >
            {
              provider.category
            }
          </p>

          <div
            className="
              mt-2
              flex
              items-center
              gap-2
            "
          >
            <h4
              className="
                truncate
                text-[15px]
                font-medium
                tracking-[-0.02em]
              "
            >
              {
                provider.name
              }
            </h4>

            {provider.official ? (
              <BadgeCheck
                size={13}
                className="shrink-0"
                style={{
                  color:
                    theme.colors.accent,
                }}
              />
            ) : null}
          </div>
        </div>

        <StatusBadge
          status={
            provider.status
          }
          label={
            status.label
          }
        />
      </div>

      {/* BODY */}

      <div
        className="
          flex
          flex-1
          flex-col
          p-4
        "
      >
        <p
          className="
            text-[10px]
            leading-5
          "
          style={{
            color:
              theme.colors.textMuted,
          }}
        >
          {
            provider.description
          }
        </p>

        {/* CAPABILITIES */}

        <div
          className="
            mt-4
            flex
            flex-wrap
            gap-1.5
          "
        >
          {provider.capabilities.map(
            (
              capability,
            ) => (
              <span
                key={
                  capability
                }
                className="
                  border
                  px-2
                  py-1
                  text-[7px]
                  uppercase
                  tracking-[0.09em]
                "
                style={{
                  borderColor:
                    theme.colors.border,

                  color:
                    theme.colors.textMuted,

                  backgroundColor:
                    `${theme.colors.backgroundElevated}70`,
                }}
              >
                {
                  capability
                }
              </span>
            ),
          )}
        </div>

        {/* CORE STATE */}

        <div
          className="
            mt-5
            grid
            grid-cols-2
            gap-px
            border
          "
          style={{
            borderColor:
              theme.colors.border,

            backgroundColor:
              theme.colors.border,
          }}
        >
          <MiniMetric
            label="Coverage"
            value={`${provider.coverage.covered}/${provider.coverage.total}`}
          />

          <MiniMetric
            label="Canonical Records"
            value={
              provider.counts
                .records
            }
          />

          <MiniMetric
            label="Configuration"
            value={
              provider.configured
                ? "Key present"
                : "Key missing"
            }
            tone={
              provider.configured
                ? "success"
                : "warning"
            }
          />

          <MiniMetric
            label="DB Source"
            value={
              provider.registered
                ? "Registered"
                : "Not registered"
            }
            tone={
              provider.registered
                ? "success"
                : "muted"
            }
          />
        </div>

        {/* DATA DETAIL */}

        <div
          className="
            mt-4
            grid
            grid-cols-3
            gap-y-3
          "
        >
          <CountItem
            label="Mappings"
            value={
              provider.counts
                .mappings
            }
          />

          <CountItem
            label="Events"
            value={
              provider.counts
                .events
            }
          />

          <CountItem
            label="Team Stats"
            value={
              provider.counts
                .teamStats
            }
          />

          <CountItem
            label="Player Stats"
            value={
              provider.counts
                .playerStats
            }
          />

          <CountItem
            label="Media"
            value={
              provider.counts
                .media
            }
          />

          <CountItem
            label="Review"
            value={
              provider.counts
                .reviewPending
            }
            warning={
              provider.counts
                .reviewPending >
              0
            }
          />
        </div>

        {/* FOOTER */}

        <div
          className="
            mt-auto
            pt-5
          "
        >
          <div
            className="
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
            <div>
              <p
                className="
                  text-[7px]
                  uppercase
                  tracking-[0.12em]
                "
                style={{
                  color:
                    theme.colors.textMuted,
                }}
              >
                Last data activity
              </p>

              <p
                className="
                  mt-1
                  text-[8px]
                "
              >
                {provider.lastActivity
                  ? relativeTime(
                      provider.lastActivity,
                    )
                  : "No local writes"}
              </p>
            </div>

            <span
              className="
                border
                px-2.5
                py-1.5
                text-[7px]
                uppercase
                tracking-[0.11em]
              "
              style={{
                borderColor:
                  theme.colors.border,

                color:
                  theme.colors.textMuted,
              }}
            >
              {
                provider.priorityLabel
              }
            </span>
          </div>

          {provider.code ===
          "youtube-fcbarcelona-official" ? (
            <Link
              href="/admin/media"
              className="
                mt-3
                flex
                h-9
                items-center
                justify-between
                border
                px-3
                text-[7px]
                uppercase
                tracking-[0.12em]
              "
              style={{
                borderColor:
                  `${theme.colors.accent}66`,

                color:
                  theme.colors.accent,
              }}
            >
              Open Media Manager

              <Film
                size={11}
              />
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}

/*
|--------------------------------------------------------------------------
| Header
|--------------------------------------------------------------------------
*/

function HeaderMetric({
  label,
  value,
  tone =
    "normal",
}: {
  label:
    string;

  value:
    string | number;

  tone?:
    "normal" |
    "success" |
    "warning";
}) {
  const theme =
    kitThemes.home;

  return (
    <div
      className="
        min-w-[92px]
        px-4
        py-3
      "
      style={{
        backgroundColor:
          theme.colors.surface,
      }}
    >
      <p
        className="
          text-[7px]
          uppercase
          tracking-[0.14em]
        "
        style={{
          color:
            theme.colors.textMuted,
        }}
      >
        {label}
      </p>

      <p
        className="
          mt-1
          text-lg
          font-medium
          tabular-nums
        "
        style={{
          color:
            tone ===
              "success"
              ? theme.colors.success
              : tone ===
                  "warning"
                ? theme.colors.warning
                : theme.colors.text,
        }}
      >
        {value}
      </p>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Pipeline metric
|--------------------------------------------------------------------------
*/

function PipelineMetric({
  icon:
    Icon,
  label,
  value,
  detail,
}: {
  icon:
    typeof Activity;

  label:
    string;

  value:
    string;

  detail:
    string;
}) {
  const theme =
    kitThemes.home;

  return (
    <div
      className="
        min-h-28
        p-4
      "
      style={{
        backgroundColor:
          theme.colors.surface,
      }}
    >
      <div
        className="
          flex
          items-center
          gap-2
        "
      >
        <Icon
          size={12}
          style={{
            color:
              theme.colors.accent,
          }}
        />

        <p
          className="
            text-[7px]
            uppercase
            tracking-[0.15em]
          "
          style={{
            color:
              theme.colors.textMuted,
          }}
        >
          {label}
        </p>
      </div>

      <p
        className="
          mt-3
          text-xl
          font-medium
          tracking-[-0.025em]
          tabular-nums
        "
      >
        {value}
      </p>

      <p
        className="
          mt-1
          text-[8px]
        "
        style={{
          color:
            theme.colors.textMuted,
        }}
      >
        {detail}
      </p>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Mini metric
|--------------------------------------------------------------------------
*/

function MiniMetric({
  label,
  value,
  tone =
    "normal",
}: {
  label:
    string;

  value:
    string | number;

  tone?:
    "normal" |
    "success" |
    "warning" |
    "muted";
}) {
  const theme =
    kitThemes.home;

  return (
    <div
      className="
        min-h-16
        p-3
      "
      style={{
        backgroundColor:
          theme.colors.backgroundElevated,
      }}
    >
      <p
        className="
          text-[6px]
          uppercase
          tracking-[0.13em]
        "
        style={{
          color:
            theme.colors.textMuted,
        }}
      >
        {label}
      </p>

      <p
        className="
          mt-1.5
          text-[10px]
          font-medium
          tabular-nums
        "
        style={{
          color:
            tone ===
              "success"
              ? theme.colors.success
              : tone ===
                  "warning"
                ? theme.colors.warning
                : tone ===
                    "muted"
                  ? theme.colors.textMuted
                  : theme.colors.text,
        }}
      >
        {value}
      </p>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Counts
|--------------------------------------------------------------------------
*/

function CountItem({
  label,
  value,
  warning = false,
}: {
  label:
    string;

  value:
    number;

  warning?:
    boolean;
}) {
  const theme =
    kitThemes.home;

  return (
    <div>
      <p
        className="
          text-[6px]
          uppercase
          tracking-[0.12em]
        "
        style={{
          color:
            theme.colors.textMuted,
        }}
      >
        {label}
      </p>

      <p
        className="
          mt-1
          text-xs
          font-medium
          tabular-nums
        "
        style={{
          color:
            warning
              ? theme.colors.warning
              : theme.colors.text,
        }}
      >
        {value}
      </p>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Status
|--------------------------------------------------------------------------
*/

function StatusBadge({
  status,
  label,
}: {
  status:
    AdminProvider[
      "status"
    ];

  label:
    string;
}) {
  const theme =
    kitThemes.home;

  const meta =
    providerStatusMeta(
      status,
    );

  const Icon =
    meta.icon;

  return (
    <span
      className="
        inline-flex
        shrink-0
        items-center
        gap-1.5
        border
        px-2.5
        py-1.5
        text-[7px]
        uppercase
        tracking-[0.12em]
      "
      style={{
        borderColor:
          `${meta.color}66`,

        color:
          meta.color,

        backgroundColor:
          `${meta.color}08`,
      }}
    >
      <Icon
        size={9}
      />

      {label}
    </span>
  );
}

function providerStatusMeta(
  status:
    AdminProvider[
      "status"
    ],
) {
  const theme =
    kitThemes.home;

  switch (
    status
  ) {
    case "active":
      return {
        label:
          "Active",

        color:
          theme.colors.success,

        icon:
          CircleCheck,
      };

    case "ready":
      return {
        label:
          "Ready",

        color:
          theme.colors.accent,

        icon:
          Gauge,
      };

    case "standby":
      return {
        label:
          "Standby",

        color:
          theme.colors.textMuted,

        icon:
          Clock3,
      };

    case "disabled":
      return {
        label:
          "Disabled",

        color:
          theme.colors.danger,

        icon:
          CircleAlert,
      };

    default:
      return {
        label:
          "Warning",

        color:
          theme.colors.warning,

        icon:
          CircleAlert,
      };
  }
}

/*
|--------------------------------------------------------------------------
| Architecture
|--------------------------------------------------------------------------
*/

function ArchitectureStep({
  number,
  title,
  description,
}: {
  number:
    string;

  title:
    string;

  description:
    string;
}) {
  const theme =
    kitThemes.home;

  return (
    <div
      className="
        min-h-36
        p-4
      "
      style={{
        backgroundColor:
          theme.colors.surface,
      }}
    >
      <div
        className="
          flex
          items-center
          justify-between
        "
      >
        <span
          className="
            text-[8px]
            font-mono
          "
          style={{
            color:
              theme.colors.accent,
          }}
        >
          {number}
        </span>

        <Database
          size={13}
          style={{
            color:
              theme.colors.textMuted,
          }}
        />
      </div>

      <p
        className="
          mt-4
          text-[11px]
          font-medium
        "
      >
        {title}
      </p>

      <p
        className="
          mt-2
          text-[8px]
          leading-4
        "
        style={{
          color:
            theme.colors.textMuted,
        }}
      >
        {description}
      </p>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Dates
|--------------------------------------------------------------------------
*/

function relativeTime(
  value:
    string,
) {
  const time =
    new Date(
      value,
    ).getTime();

  if (
    !Number.isFinite(
      time,
    )
  ) {
    return "Unknown";
  }

  const delta =
    Date.now() -
    time;

  const minutes =
    Math.floor(
      delta /
        60_000,
    );

  if (
    minutes <
    1
  ) {
    return "Just now";
  }

  if (
    minutes <
    60
  ) {
    return `${minutes}m ago`;
  }

  const hours =
    Math.floor(
      minutes /
        60,
    );

  if (
    hours <
    24
  ) {
    return `${hours}h ago`;
  }

  const days =
    Math.floor(
      hours /
        24,
    );

  return `${days}d ago`;
}

function formatDateTime(
  value:
    string,
) {
  return new Date(
    value,
  ).toLocaleString(
    "en-GB",
    {
      day:
        "2-digit",

      month:
        "short",

      year:
        "numeric",

      hour:
        "numeric",

      minute:
        "2-digit",

      hour12:
        true,
    },
  );
}