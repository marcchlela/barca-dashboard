import type {
  ReactNode,
} from "react";

import Link from "next/link";

import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  CalendarDays,
  Check,
  CircleAlert,
  Database,
  Film,
  RefreshCw,
  ShieldCheck,
  Users,
  Video,
} from "lucide-react";

import {
  kitThemes,
} from "../../lib/themes";

import type {
  AdminOverviewData,
} from "../../lib/admin/overview";

type Props = {
  data:
    AdminOverviewData;
};

export default function AdminOverview({
  data,
}: Props) {
  const theme =
    kitThemes.home;

  return (
    <div>
      {/* HEADER */}

      <section
        className="
          flex
          flex-col
          gap-4
          border-b
          pb-6

          md:flex-row
          md:items-end
          md:justify-between
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
              tracking-[0.25em]
            "
            style={{
              color:
                theme.colors.accent,
            }}
          >
            Operations Overview
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
            Admin Control Room
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
            Canonical data,
            provider coverage,
            media ingestion and
            operational health for
            the Barça Command
            Center.
          </p>
        </div>

        <div
          className="
            border
            px-4
            py-3
          "
          style={{
            borderColor:
              theme.colors.border,

            backgroundColor:
              `${theme.colors.surface}A8`,
          }}
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
            Current Season
          </p>

          <p className="mt-1 text-sm font-medium">
            {
              data.season
                .label
            }
          </p>
        </div>
      </section>

      {/* PRIMARY COUNTS */}

      <section
        className="
          mt-6
          grid
          grid-cols-2
          border-l
          border-t

          md:grid-cols-3

          xl:grid-cols-6
        "
        style={{
          borderColor:
            theme.colors.border,
        }}
      >
        <Metric
          icon={
            CalendarDays
          }
          label="Matches"
          value={
            data.counts
              .matches
          }
          detail={`${data.counts.finishedMatches} finished`}
        />

        <Metric
          icon={
            Users
          }
          label="Players"
          value={
            data.counts
              .players
          }
          detail={`${data.counts.activePlayers} active`}
        />

        <Metric
          icon={
            Video
          }
          label="Media"
          value={
            data.counts
              .media
          }
          detail={`${data.counts.highlights} highlights`}
        />

        <Metric
          icon={
            BookOpenCheck
          }
          label="Diary"
          value={
            data.counts
              .diaryEntries
          }
          detail="personal entries"
        />

        <Metric
          icon={
            Database
          }
          label="Mappings"
          value={
            data.counts
              .mappings
          }
          detail={`${data.counts.dataSources} sources`}
        />

        <Metric
          icon={
            ShieldCheck
          }
          label="Overrides"
          value={
            data.counts
              .manualOverrides
          }
          detail="manual records"
        />
      </section>

      <div
        className="
          mt-7
          grid
          gap-6

          xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]
        "
      >
        <div className="min-w-0">
          {/* COVERAGE */}

          <SectionHeader
            eyebrow="Current Season"
            title="Canonical Coverage"
          />

          <div
            className="
              mt-3
              border
            "
            style={{
              borderColor:
                theme.colors.border,

              backgroundColor:
                `${theme.colors.surface}8A`,
            }}
          >
            <CoverageRow
              label="Official highlight"
              ready={
                data.coverage
                  .highlightReady
              }
              total={
                data.coverage
                  .finishedMatches
              }
            />

            <CoverageRow
              label="Player statistics"
              ready={
                data.coverage
                  .playerStatsReady
              }
              total={
                data.coverage
                  .finishedMatches
              }
            />

            <CoverageRow
              label="Team statistics"
              ready={
                data.coverage
                  .teamStatsReady
              }
              total={
                data.coverage
                  .finishedMatches
              }
            />

            <CoverageRow
              label="Confirmed lineups"
              ready={
                data.coverage
                  .confirmedLineupsReady
              }
              total={
                data.coverage
                  .finishedMatches
              }
              last
            />
          </div>

          {/* PROVIDERS */}

          <div className="mt-8">
            <SectionHeader
              eyebrow="Configuration"
              title="Provider Stack"
            />

            <div
              className="
                mt-3
                grid
                border-l
                border-t

                sm:grid-cols-2

                2xl:grid-cols-5
              "
              style={{
                borderColor:
                  theme.colors.border,
              }}
            >
              {data.providers.map(
                (
                  provider,
                ) => (
                  <div
                    key={
                      provider.id
                    }
                    className="
                      border-b
                      border-r
                      p-4
                    "
                    style={{
                      borderColor:
                        theme.colors.border,

                      backgroundColor:
                        `${theme.colors.surface}72`,
                    }}
                  >
                    <div
                      className="
                        flex
                        items-center
                        gap-2
                      "
                    >
                      <span
                        className="
                          h-1.5
                          w-1.5
                        "
                        style={{
                          backgroundColor:
                            provider.configured
                              ? theme.colors.success
                              : theme.colors.danger,
                        }}
                      />

                      <span
                        className="
                          text-[8px]
                          uppercase
                          tracking-[0.16em]
                        "
                        style={{
                          color:
                            provider.configured
                              ? theme.colors.success
                              : theme.colors.danger,
                        }}
                      >
                        {provider.configured
                          ? "Configured"
                          : "Missing"}
                      </span>
                    </div>

                    <p
                      className="
                        mt-3
                        text-xs
                        font-medium
                      "
                    >
                      {
                        provider.label
                      }
                    </p>

                    <p
                      className="
                        mt-1
                        text-[9px]
                        leading-4
                      "
                      style={{
                        color:
                          theme.colors.textMuted,
                      }}
                    >
                      {
                        provider.role
                      }
                    </p>
                  </div>
                ),
              )}
            </div>
          </div>

          {/* DATA SOURCES */}

          <div className="mt-8">
            <SectionHeader
              eyebrow="Canonical Database"
              title="Registered Sources"
            />

            <div
              className="
                scrollbar-subtle
                mt-3
                overflow-x-auto
                border
              "
              style={{
                borderColor:
                  theme.colors.border,
              }}
            >
              <table
                className="
                  w-full
                  min-w-[620px]
                  border-collapse
                  text-left
                "
              >
                <thead>
                  <tr
                    className="border-b"
                    style={{
                      borderColor:
                        theme.colors.border,
                    }}
                  >
                    <TableHead>
                      Source
                    </TableHead>

                    <TableHead>
                      Code
                    </TableHead>

                    <TableHead>
                      Status
                    </TableHead>

                    <TableHead>
                      Mappings
                    </TableHead>
                  </tr>
                </thead>

                <tbody>
                  {data.dataSources.map(
                    (
                      source,
                    ) => (
                      <tr
                        key={
                          source.id
                        }
                        className="border-b last:border-b-0"
                        style={{
                          borderColor:
                            theme.colors.border,
                        }}
                      >
                        <TableCell>
                          <div>
                            <p className="text-[11px]">
                              {
                                source.name
                              }
                            </p>

                            {source.isOfficial ? (
                              <p
                                className="
                                  mt-1
                                  text-[7px]
                                  uppercase
                                  tracking-[0.15em]
                                "
                                style={{
                                  color:
                                    theme.colors.accent,
                                }}
                              >
                                Official
                              </p>
                            ) : null}
                          </div>
                        </TableCell>

                        <TableCell>
                          {
                            source.code
                          }
                        </TableCell>

                        <TableCell>
                          <StatusText
                            good={
                              source.isEnabled
                            }
                            goodText="Enabled"
                            badText="Disabled"
                          />
                        </TableCell>

                        <TableCell>
                          {
                            source.mappingCount
                          }
                        </TableCell>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}

        <aside className="min-w-0">
          {/* ISSUES */}

          <SectionHeader
            eyebrow="Attention"
            title="Data Issues"
          />

          <div
            className="
              mt-3
              border
            "
            style={{
              borderColor:
                data.issues
                    .total ===
                  0
                  ? `${theme.colors.success}55`
                  : theme.colors.border,

              backgroundColor:
                `${theme.colors.surface}8A`,
            }}
          >
            <IssueRow
              label="Missing highlight"
              count={
                data.issues
                  .missingHighlight
              }
            />

            <IssueRow
              label="Missing player stats"
              count={
                data.issues
                  .missingPlayerStats
              }
            />

            <IssueRow
              label="Missing team stats"
              count={
                data.issues
                  .missingTeamStats
              }
            />

            <IssueRow
              label="Missing confirmed lineups"
              count={
                data.issues
                  .missingConfirmedLineups
              }
              last
            />
          </div>

          <Link
            href="/admin/issues"
            className="
              mt-2
              flex
              items-center
              justify-between
              border
              px-4
              py-3
              text-[9px]
              uppercase
              tracking-[0.12em]
              transition-opacity
              hover:opacity-80
            "
            style={{
              borderColor:
                theme.colors.border,

              color:
                theme.colors.textMuted,
            }}
          >
            Inspect data issues

            <ArrowRight
              size={13}
            />
          </Link>

          {/* AUTOMATION */}

          <div className="mt-8">
            <SectionHeader
              eyebrow="Background Jobs"
              title="Automation"
            />

            <div
              className="
                mt-3
                border
                p-4
              "
              style={{
                borderColor:
                  theme.colors.border,

                backgroundColor:
                  `${theme.colors.surface}8A`,
              }}
            >
              <StatusLine
                label="Internal job secret"
                good={
                  data.automation
                    .internalJobConfigured
                }
              />

              <StatusLine
                label="Media worker"
                good
                value={
                  data.automation
                    .mediaWorker
                }
              />

              <StatusLine
                label="Extra-media window"
                good
                value={`${data.automation.mediaWindowHours}h`}
              />

              <StatusLine
                label="Missing-highlight retry"
                good
                value={`${data.automation.missingHighlightLookbackDays}d`}
                last
              />
            </div>
          </div>

          {/* RECENT MEDIA */}

          <div className="mt-8">
            <SectionHeader
              eyebrow="Latest Ingestion"
              title="Recent Media"
            />

            <div
              className="
                mt-3
                border
              "
              style={{
                borderColor:
                  theme.colors.border,
              }}
            >
              {data.recentMedia.length >
              0 ? (
                data.recentMedia.map(
                  (
                    item,
                    index,
                  ) => (
                    <div
                      key={
                        item.id
                      }
                      className="
                        border-b
                        p-4
                        last:border-b-0
                      "
                      style={{
                        borderColor:
                          theme.colors.border,

                        backgroundColor:
                          `${theme.colors.surface}72`,
                      }}
                    >
                      <div
                        className="
                          flex
                          items-start
                          gap-3
                        "
                      >
                        <div
                          className="
                            mt-0.5
                            flex
                            h-7
                            w-7
                            shrink-0
                            items-center
                            justify-center
                            border
                          "
                          style={{
                            borderColor:
                              item.type ===
                              "match_highlight"
                                ? theme.colors.accent
                                : theme.colors.border,

                            color:
                              item.type ===
                              "match_highlight"
                                ? theme.colors.accent
                                : theme.colors.textMuted,
                          }}
                        >
                          {item.type ===
                          "match_highlight" ? (
                            <Film
                              size={12}
                            />
                          ) : (
                            <Video
                              size={12}
                            />
                          )}
                        </div>

                        <div className="min-w-0">
                          <p
                            className="
                              line-clamp-2
                              text-[10px]
                              leading-4
                            "
                          >
                            {
                              item.title
                            }
                          </p>

                          <p
                            className="
                              mt-1
                              text-[8px]
                              uppercase
                              tracking-[0.1em]
                            "
                            style={{
                              color:
                                theme.colors.textMuted,
                            }}
                          >
                            {item.match
                              ? `${item.match.label}${item.match.score ? ` • ${item.match.score}` : ""}`
                              : "Unlinked media"}
                          </p>
                        </div>
                      </div>

                      {index ===
                      0 ? null : null}
                    </div>
                  ),
                )
              ) : (
                <div
                  className="p-5 text-[10px]"
                  style={{
                    color:
                      theme.colors.textMuted,
                  }}
                >
                  No media has been
                  ingested yet.
                </div>
              )}
            </div>

            <Link
              href="/admin/media"
              className="
                mt-2
                flex
                items-center
                justify-between
                border
                px-4
                py-3
                text-[9px]
                uppercase
                tracking-[0.12em]
                transition-opacity
                hover:opacity-80
              "
              style={{
                borderColor:
                  theme.colors.border,

                color:
                  theme.colors.textMuted,
              }}
            >
              Open Media Manager

              <ArrowRight
                size={13}
              />
            </Link>
          </div>
        </aside>
      </div>

      {/* MODULES */}

      <section className="mt-10">
        <SectionHeader
          eyebrow="Admin V1"
          title="Control Modules"
        />

        <div
          className="
            mt-3
            grid
            border-l
            border-t

            md:grid-cols-2

            xl:grid-cols-4
          "
          style={{
            borderColor:
              theme.colors.border,
          }}
        >
          <ModuleLink
            href="/admin/media"
            icon={Video}
            title="Media"
            description="Review and manage official Barça match media."
          />

          <ModuleLink
            href="/admin/providers"
            icon={Database}
            title="Providers"
            description="Provider configuration, quota and health."
          />

          <ModuleLink
            href="/admin/issues"
            icon={AlertTriangle}
            title="Data Issues"
            description="Find gaps and unresolved canonical data."
          />

          <ModuleLink
            href="/admin/sync"
            icon={RefreshCw}
            title="Sync"
            description="Safe manual sync and rescan controls."
          />
        </div>
      </section>

      <p
        className="
          mt-7
          text-[8px]
          uppercase
          tracking-[0.13em]
        "
        style={{
          color:
            theme.colors.textMuted,
        }}
      >
        Snapshot generated{" "}
        {formatGeneratedAt(
          data.generatedAt,
        )}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Metric({
  icon:
    Icon,
  label,
  value,
  detail,
}: {
  icon:
    typeof CalendarDays;

  label:
    string;

  value:
    number;

  detail:
    string;
}) {
  const theme =
    kitThemes.home;

  return (
    <div
      className="
        border-b
        border-r
        p-4

        sm:p-5
      "
      style={{
        borderColor:
          theme.colors.border,

        backgroundColor:
          `${theme.colors.surface}72`,
      }}
    >
      <Icon
        size={14}
        style={{
          color:
            theme.colors.accent,
        }}
      />

      <p
        className="
          mt-5
          text-[8px]
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

      <p
        className="
          mt-1
          text-2xl
          font-medium
          tracking-[-0.04em]
        "
      >
        {value}
      </p>

      <p
        className="mt-1 text-[8px]"
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

function SectionHeader({
  eyebrow,
  title,
}: {
  eyebrow:
    string;

  title:
    string;
}) {
  const theme =
    kitThemes.home;

  return (
    <div>
      <p
        className="
          text-[8px]
          uppercase
          tracking-[0.2em]
        "
        style={{
          color:
            theme.colors.textMuted,
        }}
      >
        {eyebrow}
      </p>

      <h3
        className="
          mt-1
          text-sm
          font-medium
        "
      >
        {title}
      </h3>
    </div>
  );
}

function CoverageRow({
  label,
  ready,
  total,
  last = false,
}: {
  label:
    string;

  ready:
    number;

  total:
    number;

  last?:
    boolean;
}) {
  const theme =
    kitThemes.home;

  const percent =
    total ===
    0
      ? 100
      : Math.round(
          (
            ready /
            total
          ) *
            100,
        );

  return (
    <div
      className={`
        px-4
        py-4

        sm:px-5

        ${
          last
            ? ""
            : "border-b"
        }
      `}
      style={{
        borderColor:
          theme.colors.border,
      }}
    >
      <div
        className="
          flex
          items-center
          justify-between
          gap-4
        "
      >
        <span className="text-[10px]">
          {label}
        </span>

        <span
          className="
            text-[9px]
            tabular-nums
          "
          style={{
            color:
              ready === total
                ? theme.colors.success
                : theme.colors.warning,
          }}
        >
          {ready}/{total}
        </span>
      </div>

      <div
        className="
          mt-3
          h-1
          overflow-hidden
        "
        style={{
          backgroundColor:
            theme.colors.border,
        }}
      >
        <div
          className="
            h-full
            transition-all
          "
          style={{
            width:
              `${percent}%`,

            backgroundColor:
              percent ===
              100
                ? theme.colors.success
                : theme.colors.accent,
          }}
        />
      </div>
    </div>
  );
}

function IssueRow({
  label,
  count,
  last = false,
}: {
  label:
    string;

  count:
    number;

  last?:
    boolean;
}) {
  const theme =
    kitThemes.home;

  const good =
    count ===
    0;

  return (
    <div
      className={`
        flex
        items-center
        justify-between
        gap-4
        px-4
        py-3

        ${
          last
            ? ""
            : "border-b"
        }
      `}
      style={{
        borderColor:
          theme.colors.border,
      }}
    >
      <div
        className="
          flex
          items-center
          gap-2
        "
      >
        {good ? (
          <Check
            size={12}
            style={{
              color:
                theme.colors.success,
            }}
          />
        ) : (
          <CircleAlert
            size={12}
            style={{
              color:
                theme.colors.warning,
            }}
          />
        )}

        <span className="text-[10px]">
          {label}
        </span>
      </div>

      <span
        className="
          text-[10px]
          font-medium
          tabular-nums
        "
        style={{
          color:
            good
              ? theme.colors.success
              : theme.colors.warning,
        }}
      >
        {count}
      </span>
    </div>
  );
}

function StatusLine({
  label,
  good,
  value,
  last = false,
}: {
  label:
    string;

  good:
    boolean;

  value?:
    string;

  last?:
    boolean;
}) {
  const theme =
    kitThemes.home;

  return (
    <div
      className={`
        flex
        items-center
        justify-between
        gap-3
        py-2.5

        ${
          last
            ? ""
            : "border-b"
        }
      `}
      style={{
        borderColor:
          theme.colors.border,
      }}
    >
      <span
        className="text-[9px]"
        style={{
          color:
            theme.colors.textMuted,
        }}
      >
        {label}
      </span>

      <div
        className="
          flex
          items-center
          gap-2
        "
      >
        <span
          className="
            h-1.5
            w-1.5
          "
          style={{
            backgroundColor:
              good
                ? theme.colors.success
                : theme.colors.danger,
          }}
        />

        <span
          className="
            text-[8px]
            uppercase
            tracking-[0.12em]
          "
          style={{
            color:
              good
                ? theme.colors.success
                : theme.colors.danger,
          }}
        >
          {value ??
            (
              good
                ? "Ready"
                : "Missing"
            )}
        </span>
      </div>
    </div>
  );
}

function ModuleLink({
  href,
  icon:
    Icon,
  title,
  description,
}: {
  href:
    string;

  icon:
    typeof Video;

  title:
    string;

  description:
    string;
}) {
  const theme =
    kitThemes.home;

  return (
    <Link
      href={href}
      className="
        group
        border-b
        border-r
        p-5
        transition-colors
      "
      style={{
        borderColor:
          theme.colors.border,

        backgroundColor:
          `${theme.colors.surface}72`,
      }}
    >
      <div
        className="
          flex
          items-start
          justify-between
          gap-3
        "
      >
        <Icon
          size={16}
          style={{
            color:
              theme.colors.accent,
          }}
        />

        <ArrowRight
          size={13}
          className="
            transition-transform
            group-hover:translate-x-1
          "
          style={{
            color:
              theme.colors.textMuted,
          }}
        />
      </div>

      <p className="mt-6 text-xs font-medium">
        {title}
      </p>

      <p
        className="
          mt-2
          max-w-xs
          text-[9px]
          leading-4
        "
        style={{
          color:
            theme.colors.textMuted,
        }}
      >
        {description}
      </p>
    </Link>
  );
}

function TableHead({
  children,
}: {
  children:
    ReactNode;
}) {
  const theme =
    kitThemes.home;

  return (
    <th
      className="
        px-4
        py-3
        text-[8px]
        font-medium
        uppercase
        tracking-[0.15em]
      "
      style={{
        color:
          theme.colors.textMuted,
      }}
    >
      {children}
    </th>
  );
}

function TableCell({
  children,
}: {
  children:
    ReactNode;
}) {
  const theme =
    kitThemes.home;

  return (
    <td
      className="
        px-4
        py-3
        text-[9px]
      "
      style={{
        color:
          theme.colors.textMuted,
      }}
    >
      {children}
    </td>
  );
}

function StatusText({
  good,
  goodText,
  badText,
}: {
  good:
    boolean;

  goodText:
    string;

  badText:
    string;
}) {
  const theme =
    kitThemes.home;

  return (
    <span
      className="
        inline-flex
        items-center
        gap-2
      "
      style={{
        color:
          good
            ? theme.colors.success
            : theme.colors.danger,
      }}
    >
      <span
        className="
          h-1.5
          w-1.5
        "
        style={{
          backgroundColor:
            good
              ? theme.colors.success
              : theme.colors.danger,
        }}
      />

      {good
        ? goodText
        : badText}
    </span>
  );
}

function formatGeneratedAt(
  value:
    string,
) {
  const date =
    new Date(
      value,
    );

  return date.toLocaleString(
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