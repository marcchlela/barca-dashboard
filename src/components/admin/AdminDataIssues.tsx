"use client";

import {
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Database,
  Info,
  Search,
  ShieldAlert,
  UserRound,
  Video,
} from "lucide-react";

import {
  kitThemes,
} from "../../lib/themes";

import type {
  AdminDataIssue,
  AdminDataIssuesData,
  AdminIssueCategory,
  AdminIssueSeverity,
} from "../../lib/admin/issues";

type CategoryFilter =
  | "all"
  | AdminIssueCategory;

type SeverityFilter =
  | "all"
  | AdminIssueSeverity;

export default function AdminDataIssues({
  data,
}: {
  data:
    AdminDataIssuesData;
}) {
  const theme =
    kitThemes.home;

  const [
    query,
    setQuery,
  ] =
    useState(
      "",
    );

  const [
    category,
    setCategory,
  ] =
    useState<CategoryFilter>(
      "all",
    );

  const [
    severity,
    setSeverity,
  ] =
    useState<SeverityFilter>(
      "all",
    );

  const filteredIssues =
    useMemo(
      () => {
        const normalizedQuery =
          query
            .trim()
            .toLowerCase();

        return data.issues.filter(
          (
            issue,
          ) => {
            if (
              category !==
                "all" &&
              issue.category !==
                category
            ) {
              return false;
            }

            if (
              severity !==
                "all" &&
              issue.severity !==
                severity
            ) {
              return false;
            }

            if (
              !normalizedQuery
            ) {
              return true;
            }

            return [
              issue.title,
              issue.description,
              issue.entityLabel,
              issue.context,
            ]
              .filter(
                Boolean,
              )
              .join(
                " ",
              )
              .toLowerCase()
              .includes(
                normalizedQuery,
              );
          },
        );
      },
      [
        data.issues,
        query,
        category,
        severity,
      ],
    );

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
            Canonical QA
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
            Data Issues
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
            Live triage for canonical
            data gaps, stale records,
            unresolved review work and
            incomplete Barça metadata.
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
            label="Open"
            value={
              data.summary
                .total
            }
          />

          <HeaderMetric
            label="High Attention"
            value={
              data.summary
                .high
            }
            tone={
              data.summary
                  .high >
              0
                ? "danger"
                : "success"
            }
          />

          <HeaderMetric
            label="Match Data"
            value={
              data.summary
                .matchData
            }
          />

          <HeaderMetric
            label="Media / Review"
            value={
              data.summary
                .media
            }
          />
        </div>
      </section>

      {/* COMPUTED STATE NOTICE */}

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
          <Database
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
                font-medium
                uppercase
                tracking-[0.16em]
              "
            >
              Computed from canonical
              data
            </p>

            <p
              className="
                mt-1
                max-w-3xl
                text-[8px]
                leading-4
              "
              style={{
                color:
                  theme.colors.textMuted,
              }}
            >
              Data Issues V1 does not
              maintain a separate issue
              table. These rows are
              derived from the current
              database and disappear
              automatically when their
              underlying condition is
              repaired.
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
          Season{" "}
          {
            data.season
              .label
          }
        </div>
      </section>

      {/* SECONDARY SUMMARY */}

      <section
        className="
          mt-5
          grid
          gap-px
          border

          sm:grid-cols-2
          lg:grid-cols-4
        "
        style={{
          borderColor:
            theme.colors.border,

          backgroundColor:
            theme.colors.border,
        }}
      >
        <SummaryMetric
          label="Medium"
          value={
            data.summary
              .medium
          }
          icon={
            AlertTriangle
          }
          tone="warning"
        />

        <SummaryMetric
          label="Low"
          value={
            data.summary
              .low
          }
          icon={
            Info
          }
        />

        <SummaryMetric
          label="Player Metadata"
          value={
            data.summary
              .playerMetadata
          }
          icon={
            UserRound
          }
        />

        <SummaryMetric
          label="Review Queue"
          value={
            data.summary
              .review
          }
          icon={
            Clock3
          }
        />
      </section>

      {/* FILTERS */}

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
            flex
            flex-col
            gap-4
            border-b
            p-4

            xl:flex-row
            xl:items-center
            xl:justify-between
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
              relative
              w-full

              xl:max-w-md
            "
          >
            <Search
              size={13}
              className="
                pointer-events-none
                absolute
                left-3
                top-1/2
                -translate-y-1/2
              "
              style={{
                color:
                  theme.colors.textMuted,
              }}
            />

            <input
              value={
                query
              }
              onChange={
                (
                  event,
                ) =>
                  setQuery(
                    event
                      .target
                      .value,
                  )
              }
              placeholder="Search issues, matches or players..."
              className="
                h-10
                w-full
                border
                bg-transparent
                pl-9
                pr-3
                text-[10px]
                outline-none
              "
              style={{
                borderColor:
                  theme.colors.border,

                color:
                  theme.colors.text,
              }}
            />
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
              filteredIssues.length
            }{" "}
            of{" "}
            {
              data.issues
                .length
            }{" "}
            issues shown
          </p>
        </div>

        <div
          className="
            grid
            gap-px

            xl:grid-cols-[minmax(0,1fr)_auto]
          "
          style={{
            backgroundColor:
              theme.colors.border,
          }}
        >
          <div
            className="
              flex
              flex-wrap
              gap-2
              p-3
            "
            style={{
              backgroundColor:
                theme.colors.background,
            }}
          >
            <FilterButton
              active={
                category ===
                "all"
              }
              onClick={
                () =>
                  setCategory(
                    "all",
                  )
              }
              label="All"
              count={
                data.summary
                  .total
              }
            />

            <FilterButton
              active={
                category ===
                "match_data"
              }
              onClick={
                () =>
                  setCategory(
                    "match_data",
                  )
              }
              label="Match Data"
              count={
                data.summary
                  .matchData
              }
            />

            <FilterButton
              active={
                category ===
                "media"
              }
              onClick={
                () =>
                  setCategory(
                    "media",
                  )
              }
              label="Media"
              count={
                data.issues.filter(
                  (
                    issue,
                  ) =>
                    issue.category ===
                    "media",
                ).length
              }
            />

            <FilterButton
              active={
                category ===
                "review"
              }
              onClick={
                () =>
                  setCategory(
                    "review",
                  )
              }
              label="Review"
              count={
                data.summary
                  .review
              }
            />

            <FilterButton
              active={
                category ===
                "player_metadata"
              }
              onClick={
                () =>
                  setCategory(
                    "player_metadata",
                  )
              }
              label="Players"
              count={
                data.summary
                  .playerMetadata
              }
            />
          </div>

          <div
            className="
              flex
              flex-wrap
              gap-2
              p-3
            "
            style={{
              backgroundColor:
                theme.colors.background,
            }}
          >
            <SeverityButton
              active={
                severity ===
                "all"
              }
              onClick={
                () =>
                  setSeverity(
                    "all",
                  )
              }
              label="All Severities"
            />

            <SeverityButton
              active={
                severity ===
                "high"
              }
              onClick={
                () =>
                  setSeverity(
                    "high",
                  )
              }
              label="High"
              severity="high"
            />

            <SeverityButton
              active={
                severity ===
                "medium"
              }
              onClick={
                () =>
                  setSeverity(
                    "medium",
                  )
              }
              label="Medium"
              severity="medium"
            />

            <SeverityButton
              active={
                severity ===
                "low"
              }
              onClick={
                () =>
                  setSeverity(
                    "low",
                  )
              }
              label="Low"
              severity="low"
            />
          </div>
        </div>
      </section>

      {/* ISSUE QUEUE */}

      <section className="mt-4">
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
              Attention Queue
            </p>

            <h3
              className="
                mt-1
                text-lg
                font-medium
                tracking-[-0.02em]
              "
            >
              Current issues
            </h3>
          </div>
        </div>

        <div
          className="
            mt-4
            border
          "
          style={{
            borderColor:
              theme.colors.border,
          }}
        >
          {filteredIssues.length >
          0 ? (
            filteredIssues.map(
              (
                issue,
              ) => (
                <IssueRow
                  key={
                    issue.id
                  }
                  issue={
                    issue
                  }
                />
              ),
            )
          ) : (
            <EmptyState />
          )}
        </div>
      </section>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Issue row
|--------------------------------------------------------------------------
*/

function IssueRow({
  issue,
}: {
  issue:
    AdminDataIssue;
}) {
  const theme =
    kitThemes.home;

  const severity =
    severityMeta(
      issue.severity,
    );

  const category =
    categoryMeta(
      issue.category,
    );

  const SeverityIcon =
    severity.icon;

  const CategoryIcon =
    category.icon;

  return (
    <article
      className="
        grid
        border-b
        last:border-b-0

        lg:grid-cols-[5px_minmax(0,1fr)_auto]
      "
      style={{
        borderColor:
          theme.colors.border,

        backgroundColor:
          `${theme.colors.surface}58`,
      }}
    >
      <div
        className="
          hidden

          lg:block
        "
        style={{
          backgroundColor:
            severity.color,
        }}
      />

      <div className="p-4">
        <div
          className="
            flex
            flex-wrap
            items-center
            gap-2
          "
        >
          <span
            className="
              inline-flex
              items-center
              gap-1.5
              border
              px-2
              py-1
              text-[7px]
              uppercase
              tracking-[0.11em]
            "
            style={{
              borderColor:
                `${severity.color}55`,

              color:
                severity.color,

              backgroundColor:
                `${severity.color}08`,
            }}
          >
            <SeverityIcon
              size={9}
            />

            {
              severity.label
            }
          </span>

          <span
            className="
              inline-flex
              items-center
              gap-1.5
              text-[7px]
              uppercase
              tracking-[0.11em]
            "
            style={{
              color:
                theme.colors.textMuted,
            }}
          >
            <CategoryIcon
              size={10}
            />

            {
              category.label
            }
          </span>
        </div>

        <h4
          className="
            mt-3
            text-[13px]
            font-medium
            tracking-[-0.015em]
          "
        >
          {
            issue.title
          }
        </h4>

        <p
          className="
            mt-1.5
            max-w-4xl
            text-[9px]
            leading-4
          "
          style={{
            color:
              theme.colors.textMuted,
          }}
        >
          {
            issue.description
          }
        </p>

        <div
          className="
            mt-4
            flex
            flex-wrap
            items-center
            gap-x-5
            gap-y-2
          "
        >
          <div>
            <p
              className="
                text-[7px]
                uppercase
                tracking-[0.11em]
              "
              style={{
                color:
                  theme.colors.textMuted,
              }}
            >
              Entity
            </p>

            <p
              className="
                mt-1
                text-[9px]
                font-medium
              "
            >
              {
                issue.entityLabel
              }
            </p>
          </div>

          {issue.context ? (
            <div>
              <p
                className="
                  text-[7px]
                  uppercase
                  tracking-[0.11em]
                "
                style={{
                  color:
                    theme.colors.textMuted,
                }}
              >
                Context
              </p>

              <p
                className="
                  mt-1
                  text-[9px]
                "
              >
                {
                  issue.context
                }
              </p>
            </div>
          ) : null}

          {issue.timestamp ? (
            <div>
              <p
                className="
                  text-[7px]
                  uppercase
                  tracking-[0.11em]
                "
                style={{
                  color:
                    theme.colors.textMuted,
                }}
              >
                Reference Time
              </p>

              <p
                className="
                  mt-1
                  text-[9px]
                  tabular-nums
                "
              >
                {
                  formatDateTime(
                    issue.timestamp,
                  )
                }
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <div
        className="
          flex
          items-center
          border-t
          p-4

          lg:border-l
          lg:border-t-0
        "
        style={{
          borderColor:
            theme.colors.border,
        }}
      >
        {issue.href &&
        issue.actionLabel ? (
          <Link
            href={
              issue.href
            }
            className="
              flex
              h-9
              cursor-pointer
              items-center
              gap-2
              border
              px-3
              text-[7px]
              uppercase
              tracking-[0.11em]
              transition-colors
            "
            style={{
              borderColor:
                `${theme.colors.accent}55`,

              color:
                theme.colors.accent,
            }}
          >
            {
              issue.actionLabel
            }

            <ArrowUpRight
              size={10}
            />
          </Link>
        ) : (
          <span
            className="
              text-[7px]
              uppercase
              tracking-[0.11em]
            "
            style={{
              color:
                theme.colors.textMuted,
            }}
          >
            Action coming with
            admin editing
          </span>
        )}
      </div>
    </article>
  );
}

/*
|--------------------------------------------------------------------------
| Summary
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
    number;

  tone?:
    | "normal"
    | "success"
    | "danger";
}) {
  const theme =
    kitThemes.home;

  return (
    <div
      className="
        min-w-[100px]
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
                  "danger"
                ? theme.colors.danger
                : theme.colors.text,
        }}
      >
        {value}
      </p>
    </div>
  );
}

function SummaryMetric({
  label,
  value,
  icon:
    Icon,
  tone =
    "normal",
}: {
  label:
    string;

  value:
    number;

  icon:
    typeof Info;

  tone?:
    | "normal"
    | "warning";
}) {
  const theme =
    kitThemes.home;

  return (
    <div
      className="
        min-h-24
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
              tone ===
              "warning"
                ? theme.colors.warning
                : theme.colors.accent,
          }}
        />

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
      </div>

      <p
        className="
          mt-3
          text-xl
          font-medium
          tabular-nums
        "
      >
        {value}
      </p>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Filters
|--------------------------------------------------------------------------
*/

function FilterButton({
  active,
  onClick,
  label,
  count,
}: {
  active:
    boolean;

  onClick:
    () => void;

  label:
    string;

  count:
    number;
}) {
  const theme =
    kitThemes.home;

  return (
    <button
      type="button"
      onClick={
        onClick
      }
      className="
        cursor-pointer
        border
        px-2.5
        py-1.5
        text-[7px]
        uppercase
        tracking-[0.1em]
        transition-colors
        "
      style={{
        borderColor:
          active
            ? `${theme.colors.accent}77`
            : theme.colors.border,

        color:
          active
            ? theme.colors.accent
            : theme.colors.textMuted,

        backgroundColor:
          active
            ? `${theme.colors.accent}0B`
            : "transparent",
      }}
    >
      {label}

      <span
        className="
          ml-2
          tabular-nums
        "
      >
        {count}
      </span>
    </button>
  );
}

function SeverityButton({
  active,
  onClick,
  label,
  severity,
}: {
  active:
    boolean;

  onClick:
    () => void;

  label:
    string;

  severity?:
    AdminIssueSeverity;
}) {
  const theme =
    kitThemes.home;

  const color =
    severity
      ? severityMeta(
          severity,
        ).color
      : theme.colors.textMuted;

  return (
    <button
      type="button"
      onClick={
        onClick
      }
      className="
        cursor-pointer
        border
        px-2.5
        py-1.5
        text-[7px]
        uppercase
        tracking-[0.1em]
        transition-colors
        "
      style={{
        borderColor:
          active
            ? `${color}77`
            : theme.colors.border,

        color:
          active
            ? color
            : theme.colors.textMuted,

        backgroundColor:
          active
            ? `${color}08`
            : "transparent",
      }}
    >
      {label}
    </button>
  );
}

/*
|--------------------------------------------------------------------------
| Empty
|--------------------------------------------------------------------------
*/

function EmptyState() {
  const theme =
    kitThemes.home;

  return (
    <div
      className="
        flex
        min-h-48
        flex-col
        items-center
        justify-center
        px-6
        text-center
      "
      style={{
        backgroundColor:
          `${theme.colors.surface}58`,
      }}
    >
      <CheckCircle2
        size={22}
        style={{
          color:
            theme.colors.success,
        }}
      />

      <p
        className="
          mt-3
          text-[11px]
          font-medium
        "
      >
        No matching issues
      </p>

      <p
        className="
          mt-1
          max-w-sm
          text-[8px]
          leading-4
        "
        style={{
          color:
            theme.colors.textMuted,
        }}
      >
        The current filters do not
        match any canonical data
        problems.
      </p>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Metadata
|--------------------------------------------------------------------------
*/

function severityMeta(
  severity:
    AdminIssueSeverity,
) {
  const theme =
    kitThemes.home;

  switch (
    severity
  ) {
    case "high":
      return {
        label:
          "High",

        color:
          theme.colors.danger,

        icon:
          ShieldAlert,
      };

    case "medium":
      return {
        label:
          "Medium",

        color:
          theme.colors.warning,

        icon:
          AlertTriangle,
      };

    default:
      return {
        label:
          "Low",

        color:
          theme.colors.accent,

        icon:
          Info,
      };
  }
}

function categoryMeta(
  category:
    AdminIssueCategory,
) {
  switch (
    category
  ) {
    case "match_data":
      return {
        label:
          "Match Data",

        icon:
          Database,
      };

    case "media":
      return {
        label:
          "Media",

        icon:
          Video,
      };

    case "review":
      return {
        label:
          "Needs Review",

        icon:
          CircleAlert,
      };

    default:
      return {
        label:
          "Player Metadata",

        icon:
          UserRound,
      };
  }
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