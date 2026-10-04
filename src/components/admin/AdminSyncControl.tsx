"use client";

import {
  useMemo,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  FileSearch,
  Film,
  Gauge,
  LoaderCircle,
  Play,
  RefreshCw,
  ShieldCheck,
  Terminal,
  TriangleAlert,
} from "lucide-react";

import {
  kitThemes,
} from "../../lib/themes";

import type {
  AdminSyncData,
} from "../../lib/admin/sync";

type SyncAction =
  | "fixture_sync"
  | "rich_match_preview"
  | "rich_match_sync"
  | "match_qa"
  | "media_match_preview"
  | "media_match_sync"
  | "media_worker_preview"
  | "media_worker_run";

type RunMode =
  | "read"
  | "preview"
  | "write";

type RunRecord = {
  id:
    string;

  label:
    string;

  action:
    SyncAction;

  mode:
    RunMode;

  ok:
    boolean;

  startedAt:
    string;

  durationMs:
    number;

  output:
    unknown;
};

type PendingWrite = {
  action:
    SyncAction;

  label:
    string;

  description:
    string;

  requiresMatch:
    boolean;
};

export default function AdminSyncControl({
  data,
}: {
  data:
    AdminSyncData;
}) {
  const theme =
    kitThemes.home;

  const router =
    useRouter();

  const defaultMatch =
    data.matches.find(
      (
        match,
      ) =>
        match.status ===
        "finished",
    ) ??
    data.matches[0] ??
    null;

  const [
    selectedMatchId,
    setSelectedMatchId,
  ] =
    useState(
      defaultMatch?.id ??
        "",
    );

  const [
    busyAction,
    setBusyAction,
  ] =
    useState<
      SyncAction | null
    >(
      null,
    );

  const [
    pendingWrite,
    setPendingWrite,
  ] =
    useState<
      PendingWrite | null
    >(
      null,
    );

  const [
    history,
    setHistory,
  ] =
    useState<
      RunRecord[]
    >(
      [],
    );

  const selectedMatch =
    useMemo(
      () =>
        data.matches.find(
          (
            match,
          ) =>
            match.id ===
            selectedMatchId,
        ) ??
        null,
      [
        data.matches,
        selectedMatchId,
      ],
    );

  const isBusy =
    busyAction !==
    null;

  async function execute(
    action:
      SyncAction,

    label:
      string,

    mode:
      RunMode,

    requiresMatch =
      false,
  ) {
    if (
      isBusy ||
      !data.executionEnabled
    ) {
      return;
    }

    if (
      requiresMatch &&
      !selectedMatchId
    ) {
      return;
    }

    setBusyAction(
      action,
    );

    const localStartedAt =
      new Date();

    try {
      const response =
        await fetch(
          "/api/admin/sync",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                action,

                matchId:
                  requiresMatch
                    ? selectedMatchId
                    : undefined,
              }),
          },
        );

      const payload =
        (await response.json()) as {
          ok?:
            boolean;

          error?:
            string;

          durationMs?:
            number;

          result?:
            unknown;
        };

      const ok =
        response.ok &&
        payload.ok ===
          true;

      const record:
        RunRecord = {
        id:
          `${Date.now()}-${action}`,

        label,

        action,

        mode,

        ok,

        startedAt:
          localStartedAt
            .toISOString(),

        durationMs:
          payload.durationMs ??
          (
            Date.now() -
            localStartedAt.getTime()
          ),

        output:
          ok
            ? payload.result
            : {
                error:
                  payload.error ??
                  `Request failed with status ${response.status}.`,
              },
      };

      setHistory(
        (
          current,
        ) => [
          record,
          ...current,
        ].slice(
          0,
          12,
        ),
      );

      if (
        ok &&
        mode ===
          "write"
      ) {
        router.refresh();
      }
    } catch (
      error
    ) {
      setHistory(
        (
          current,
        ) => [
          {
            id:
              `${Date.now()}-${action}`,

            label,

            action,

            mode,

            ok:
              false,

            startedAt:
              localStartedAt
                .toISOString(),

            durationMs:
              Date.now() -
              localStartedAt.getTime(),

            output: {
              error:
                error instanceof Error
                  ? error.message
                  : String(
                      error,
                    ),
            },
          },

          ...current,
        ].slice(
          0,
          12,
        ),
      );
    } finally {
      setBusyAction(
        null,
      );
    }
  }

  function requestWrite(
    action:
      SyncAction,

    label:
      string,

    description:
      string,

    requiresMatch =
      false,
  ) {
    if (
      isBusy ||
      !data.executionEnabled
    ) {
      return;
    }

    setPendingWrite({
      action,
      label,
      description,
      requiresMatch,
    });
  }

  async function confirmWrite() {
    if (
      !pendingWrite
    ) {
      return;
    }

    const action =
      pendingWrite;

    setPendingWrite(
      null,
    );

    await execute(
      action.action,
      action.label,
      "write",
      action.requiresMatch,
    );
  }

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
            Operations
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
            Sync Control
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
            Safely inspect and run
            fixture, rich-match, QA and
            official-media operations
            against the canonical Barça
            data pipeline.
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
            label="Environment"
            value={
              data.environment
            }
          />

          <HeaderMetric
            label="Execution"
            value={
              data.executionEnabled
                ? "Enabled"
                : "Locked"
            }
            tone={
              data.executionEnabled
                ? "success"
                : "warning"
            }
          />

          <HeaderMetric
            label="Season"
            value={
              data.season
                .label
            }
          />

          <HeaderMetric
            label="Finished"
            value={
              data.summary
                .finished
            }
          />
        </div>
      </section>

      {/* SAFETY NOTICE */}

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
          <ShieldCheck
            size={14}
            className="
              mt-0.5
              shrink-0
            "
            style={{
              color:
                data.executionEnabled
                  ? theme.colors.success
                  : theme.colors.warning,
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
              Controlled execution
              surface
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
              Preview actions use
              dry-run mode and do not
              persist provider data.
              Write actions require an
              explicit second
              confirmation. Admin Sync
              V1 is disabled in
              production until proper
              admin authentication is
              added.
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
          {
            data.automation
              .internalJobConfigured
              ? "Internal job auth ready"
              : "Internal job auth missing"
          }
        </div>
      </section>

      {/* PIPELINE STATE */}

      <section
        className="
          mt-5
          grid
          gap-px
          border

          sm:grid-cols-2
          xl:grid-cols-4
        "
        style={{
          borderColor:
            theme.colors.border,

          backgroundColor:
            theme.colors.border,
        }}
      >
        <StatusMetric
          icon={
            Database
          }
          label="Fixture Provider"
          value="football-data.org"
          ready={
            data.automation
              .footballDataConfigured
          }
        />

        <StatusMetric
          icon={
            Gauge
          }
          label="Rich Match"
          value="GOAL + Stats"
          ready={
            data.automation
              .richMatchConfigured
          }
        />

        <StatusMetric
          icon={
            Film
          }
          label="Match Media"
          value="Official YouTube"
          ready={
            data.automation
              .youtubeConfigured
          }
        />

        <StatusMetric
          icon={
            Clock3
          }
          label="Latest Match Activity"
          value={
            data.summary
              .latestActivity
              ? relativeTime(
                  data.summary
                    .latestActivity,
                )
              : "No activity"
          }
          ready={
            Boolean(
              data.summary
                .latestActivity,
            )
          }
        />
      </section>

      {/* CONFIRMATION */}

      {pendingWrite ? (
        <section
          className="
            mt-5
            flex
            flex-col
            gap-4
            border
            p-4

            lg:flex-row
            lg:items-center
            lg:justify-between
          "
          style={{
            borderColor:
              `${theme.colors.warning}88`,

            backgroundColor:
              `${theme.colors.warning}08`,
          }}
        >
          <div
            className="
              flex
              items-start
              gap-3
            "
          >
            <TriangleAlert
              size={15}
              className="
                mt-0.5
                shrink-0
              "
              style={{
                color:
                  theme.colors.warning,
              }}
            />

            <div>
              <p
                className="
                  text-[9px]
                  font-medium
                  uppercase
                  tracking-[0.12em]
                "
                style={{
                  color:
                    theme.colors.warning,
                }}
              >
                Confirm write operation
              </p>

              <p
                className="
                  mt-1
                  text-[10px]
                  font-medium
                "
              >
                {
                  pendingWrite.label
                }
              </p>

              <p
                className="
                  mt-1
                  max-w-2xl
                  text-[8px]
                  leading-4
                "
                style={{
                  color:
                    theme.colors.textMuted,
                }}
              >
                {
                  pendingWrite.description
                }
              </p>
            </div>
          </div>

          <div
            className="
              flex
              shrink-0
              gap-2
            "
          >
            <button
              type="button"
              onClick={
                () =>
                  setPendingWrite(
                    null,
                  )
              }
              className="
                h-9
                cursor-pointer
                border
                px-4
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
              Cancel
            </button>

            <button
              type="button"
              onClick={
                confirmWrite
              }
              className="
                h-9
                cursor-pointer
                border
                px-4
                text-[7px]
                uppercase
                tracking-[0.11em]
              "
              style={{
                borderColor:
                  `${theme.colors.warning}88`,

                color:
                  theme.colors.warning,

                backgroundColor:
                  `${theme.colors.warning}0B`,
              }}
            >
              Confirm & Run
            </button>
          </div>
        </section>
      ) : null}

      {/* OPERATIONS */}

      <section
        className="
          mt-7
          grid
          gap-4

          xl:grid-cols-[0.8fr_1.2fr]
        "
      >
        {/* LEFT COLUMN */}

        <div
          className="
            grid
            gap-4
          "
        >
          {/* FIXTURE SYNC */}

          <OperationCard
            eyebrow="Schedule Layer"
            title="Fixture Spine"
            icon={
              Database
            }
            description="Refresh the current La Liga season through football-data.org and persist canonical fixture, team, competition and result updates."
          >
            <div
              className="
                mt-5
                border-t
                pt-4
              "
              style={{
                borderColor:
                  theme.colors.border,
              }}
            >
              <p
                className="
                  text-[8px]
                  leading-4
                "
                style={{
                  color:
                    theme.colors.textMuted,
                }}
              >
                This operation writes
                directly to the
                canonical fixture
                spine. The existing
                football-data sync does
                not have a dry-run
                mode.
              </p>

              <div className="mt-4">
                <ActionButton
                  label="Run Fixture Sync"
                  icon={
                    RefreshCw
                  }
                  tone="warning"
                  busy={
                    busyAction ===
                    "fixture_sync"
                  }
                  disabled={
                    isBusy ||
                    !data.executionEnabled ||
                    !data.automation
                      .footballDataConfigured
                  }
                  onClick={
                    () =>
                      requestWrite(
                        "fixture_sync",
                        "Run Fixture Sync",
                        "This will call football-data.org and persist current-season La Liga fixture and result changes.",
                      )
                  }
                />
              </div>
            </div>
          </OperationCard>

          {/* MEDIA WORKER */}

          <OperationCard
            eyebrow="Automation Layer"
            title="Match Media Worker"
            icon={
              Film
            }
            description="Run the incremental official Barça YouTube worker across currently eligible finished matches."
          >
            <div
              className="
                mt-5
                grid
                gap-2

                sm:grid-cols-2
              "
            >
              <ActionButton
                label="Preview Worker"
                icon={
                  FileSearch
                }
                busy={
                  busyAction ===
                  "media_worker_preview"
                }
                disabled={
                  isBusy ||
                  !data.executionEnabled ||
                  !data.automation
                    .youtubeConfigured
                }
                onClick={
                  () =>
                    execute(
                      "media_worker_preview",
                      "Preview Match Media Worker",
                      "preview",
                    )
                }
              />

              <ActionButton
                label="Run Worker"
                icon={
                  Play
                }
                tone="warning"
                busy={
                  busyAction ===
                  "media_worker_run"
                }
                disabled={
                  isBusy ||
                  !data.executionEnabled ||
                  !data.automation
                    .youtubeConfigured
                }
                onClick={
                  () =>
                    requestWrite(
                      "media_worker_run",
                      "Run Match Media Worker",
                      "This will run the incremental official YouTube worker and persist safe media matches or review candidates.",
                    )
                }
              />
            </div>

            <p
              className="
                mt-3
                text-[7px]
                leading-4
              "
              style={{
                color:
                  theme.colors.textMuted,
              }}
            >
              Uses the existing
              incremental worker:
              recent finished matches,
              missing media and retry
              candidates only. It does
              not force a full-season
              rescan.
            </p>
          </OperationCard>
        </div>

        {/* MATCH OPERATIONS */}

        <OperationCard
          eyebrow="Selected Match"
          title="Match Operations"
          icon={
            Activity
          }
          description="Inspect, preview and deliberately resync one canonical Barça fixture without touching the rest of the season."
        >
          <div className="mt-5">
            <label
              htmlFor="sync-match"
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
              Match
            </label>

            <select
              id="sync-match"
              value={
                selectedMatchId
              }
              onChange={
                (
                  event,
                ) =>
                  setSelectedMatchId(
                    event
                      .target
                      .value,
                  )
              }
              className="
                mt-2
                h-11
                w-full
                cursor-pointer
                border
                bg-transparent
                px-3
                text-[10px]
                outline-none
              "
              style={{
                borderColor:
                  theme.colors.border,

                color:
                  theme.colors.text,

                backgroundColor:
                  theme.colors.backgroundElevated,
              }}
            >
              {data.matches.map(
                (
                  match,
                ) => (
                  <option
                    key={
                      match.id
                    }
                    value={
                      match.id
                    }
                  >
                    {
                      match.label
                    }{" "}
                    —{" "}
                    {
                      match.competition
                    }{" "}
                    —{" "}
                    {
                      formatShortDate(
                        match.kickoff,
                      )
                    }
                  </option>
                ),
              )}
            </select>
          </div>

          {selectedMatch ? (
            <div
              className="
                mt-4
                grid
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
              <MatchMetric
                label="Status"
                value={
                  humanize(
                    selectedMatch.status,
                  )
                }
              />

              <MatchMetric
                label="Competition"
                value={
                  selectedMatch.competition
                }
              />

              <MatchMetric
                label="Kickoff"
                value={
                  formatDateTime(
                    selectedMatch.kickoff,
                  )
                }
              />

              <MatchMetric
                label="Score"
                value={
                  selectedMatch.score ??
                  "—"
                }
              />
            </div>
          ) : null}

          {/* RICH DATA */}

          <OperationSection
            title="Rich Match Data"
            description="GOAL + player-stat provider normalization and canonical merge."
          >
            <ActionButton
              label="Preview Rich Sync"
              icon={
                FileSearch
              }
              busy={
                busyAction ===
                "rich_match_preview"
              }
              disabled={
                isBusy ||
                !selectedMatch ||
                !data.executionEnabled ||
                !data.automation
                  .richMatchConfigured
              }
              onClick={
                () =>
                  execute(
                    "rich_match_preview",
                    "Preview Rich Match Sync",
                    "preview",
                    true,
                  )
              }
            />

            <ActionButton
              label="Sync Rich Data"
              icon={
                RefreshCw
              }
              tone="warning"
              busy={
                busyAction ===
                "rich_match_sync"
              }
              disabled={
                isBusy ||
                !selectedMatch ||
                !data.executionEnabled ||
                !data.automation
                  .richMatchConfigured
              }
              onClick={
                () =>
                  requestWrite(
                    "rich_match_sync",
                    "Sync Rich Match Data",
                    selectedMatch
                      ? `This will fetch, normalize and persist rich data for ${selectedMatch.label}.`
                      : "This will persist rich match data.",
                    true,
                  )
              }
            />

            <ActionButton
              label="Run Match QA"
              icon={
                CheckCircle2
              }
              tone="success"
              busy={
                busyAction ===
                "match_qa"
              }
              disabled={
                isBusy ||
                !selectedMatch ||
                !data.executionEnabled
              }
              onClick={
                () =>
                  execute(
                    "match_qa",
                    "Run Rich Match QA",
                    "read",
                    true,
                  )
              }
            />
          </OperationSection>

          {/* MEDIA */}

          <OperationSection
            title="Official Match Media"
            description="Inspect or rerun the official FC Barcelona YouTube matcher for only this fixture."
          >
            <ActionButton
              label="Preview Media"
              icon={
                FileSearch
              }
              busy={
                busyAction ===
                "media_match_preview"
              }
              disabled={
                isBusy ||
                !selectedMatch ||
                !data.executionEnabled ||
                !data.automation
                  .youtubeConfigured
              }
              onClick={
                () =>
                  execute(
                    "media_match_preview",
                    "Preview Match Media Sync",
                    "preview",
                    true,
                  )
              }
            />

            <ActionButton
              label="Sync Match Media"
              icon={
                Film
              }
              tone="warning"
              busy={
                busyAction ===
                "media_match_sync"
              }
              disabled={
                isBusy ||
                !selectedMatch ||
                !data.executionEnabled ||
                !data.automation
                  .youtubeConfigured
              }
              onClick={
                () =>
                  requestWrite(
                    "media_match_sync",
                    "Sync Official Match Media",
                    selectedMatch
                      ? `This will run the official Barça YouTube matcher and persist safe results for ${selectedMatch.label}.`
                      : "This will persist official match media.",
                    true,
                  )
              }
            />
          </OperationSection>
        </OperationCard>
      </section>

      {/* EXECUTION LOG */}

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
            items-center
            justify-between
            gap-4
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
          <div
            className="
              flex
              items-center
              gap-2
            "
          >
            <Terminal
              size={13}
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
                  tracking-[0.15em]
                "
              >
                Execution Console
              </p>

              <p
                className="
                  mt-0.5
                  text-[7px]
                "
                style={{
                  color:
                    theme.colors.textMuted,
                }}
              >
                Current browser session
              </p>
            </div>
          </div>

          {history.length >
          0 ? (
            <button
              type="button"
              onClick={
                () =>
                  setHistory(
                    [],
                  )
              }
              className="
                cursor-pointer
                text-[7px]
                uppercase
                tracking-[0.11em]
              "
              style={{
                color:
                  theme.colors.textMuted,
              }}
            >
              Clear
            </button>
          ) : null}
        </div>

        {history.length ===
        0 ? (
          <div
            className="
              flex
              min-h-44
              flex-col
              items-center
              justify-center
              px-6
              text-center
            "
          >
            <Terminal
              size={20}
              style={{
                color:
                  theme.colors.textMuted,
              }}
            />

            <p
              className="
                mt-3
                text-[11px]
                font-medium
              "
            >
              No operations run yet
            </p>

            <p
              className="
                mt-1
                max-w-md
                text-[8px]
                leading-4
              "
              style={{
                color:
                  theme.colors.textMuted,
              }}
            >
              Preview, QA and write
              results from this Sync
              session will appear here.
            </p>
          </div>
        ) : (
          <div>
            {history.map(
              (
                record,
              ) => (
                <ExecutionRecord
                  key={
                    record.id
                  }
                  record={
                    record
                  }
                />
              ),
            )}
          </div>
        )}
      </section>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Operation cards
|--------------------------------------------------------------------------
*/

function OperationCard({
  eyebrow,
  title,
  description,
  icon:
    Icon,
  children,
}: {
  eyebrow:
    string;

  title:
    string;

  description:
    string;

  icon:
    typeof Database;

  children:
    React.ReactNode;
}) {
  const theme =
    kitThemes.home;

  return (
    <article
      className="
        border
        p-4
      "
      style={{
        borderColor:
          theme.colors.border,

        backgroundColor:
          `${theme.colors.surface}68`,
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
            flex
            h-9
            w-9
            shrink-0
            items-center
            justify-center
            border
          "
          style={{
            borderColor:
              theme.colors.border,

            color:
              theme.colors.accent,

            backgroundColor:
              theme.colors.backgroundElevated,
          }}
        >
          <Icon
            size={15}
          />
        </div>

        <div>
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
            {eyebrow}
          </p>

          <h3
            className="
              mt-1
              text-[15px]
              font-medium
              tracking-[-0.02em]
            "
          >
            {title}
          </h3>

          <p
            className="
              mt-2
              max-w-2xl
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
      </div>

      {children}
    </article>
  );
}

function OperationSection({
  title,
  description,
  children,
}: {
  title:
    string;

  description:
    string;

  children:
    React.ReactNode;
}) {
  const theme =
    kitThemes.home;

  return (
    <div
      className="
        mt-5
        border-t
        pt-4
      "
      style={{
        borderColor:
          theme.colors.border,
      }}
    >
      <p
        className="
          text-[9px]
          font-medium
        "
      >
        {title}
      </p>

      <p
        className="
          mt-1
          text-[7px]
          leading-4
        "
        style={{
          color:
            theme.colors.textMuted,
        }}
      >
        {description}
      </p>

      <div
        className="
          mt-3
          grid
          gap-2

          sm:grid-cols-2
          2xl:grid-cols-3
        "
      >
        {children}
      </div>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Buttons
|--------------------------------------------------------------------------
*/

function ActionButton({
  label,
  icon:
    Icon,
  onClick,
  busy,
  disabled,
  tone =
    "accent",
}: {
  label:
    string;

  icon:
    typeof Play;

  onClick:
    () => void;

  busy:
    boolean;

  disabled:
    boolean;

  tone?:
    | "accent"
    | "success"
    | "warning";
}) {
  const theme =
    kitThemes.home;

  const color =
    tone ===
    "success"
      ? theme.colors.success
      : tone ===
          "warning"
        ? theme.colors.warning
        : theme.colors.accent;

  return (
    <button
      type="button"
      onClick={
        onClick
      }
      disabled={
        disabled
      }
      className="
        flex
        min-h-10
        cursor-pointer
        items-center
        justify-between
        gap-3
        border
        px-3
        text-left
        text-[7px]
        uppercase
        tracking-[0.1em]

        disabled:cursor-not-allowed
        disabled:opacity-40
      "
      style={{
        borderColor:
          `${color}55`,

        color,
      }}
    >
      {label}

      {busy ? (
        <LoaderCircle
          size={11}
          className="animate-spin"
        />
      ) : (
        <Icon
          size={11}
        />
      )}
    </button>
  );
}

/*
|--------------------------------------------------------------------------
| Metrics
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
    | "normal"
    | "success"
    | "warning";
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
          text-[14px]
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

function StatusMetric({
  icon:
    Icon,
  label,
  value,
  ready,
}: {
  icon:
    typeof Database;

  label:
    string;

  value:
    string;

  ready:
    boolean;
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
              ready
                ? theme.colors.success
                : theme.colors.warning,
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
          text-[11px]
          font-medium
        "
      >
        {value}
      </p>

      <p
        className="
          mt-1
          text-[7px]
          uppercase
          tracking-[0.1em]
        "
        style={{
          color:
            ready
              ? theme.colors.success
              : theme.colors.warning,
        }}
      >
        {ready
          ? "Ready"
          : "Not configured"}
      </p>
    </div>
  );
}

function MatchMetric({
  label,
  value,
}: {
  label:
    string;

  value:
    string;
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
          text-[7px]
          uppercase
          tracking-[0.11em]
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
          text-[9px]
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
| Execution console
|--------------------------------------------------------------------------
*/

function ExecutionRecord({
  record,
}: {
  record:
    RunRecord;
}) {
  const theme =
    kitThemes.home;

  const color =
    record.ok
      ? theme.colors.success
      : theme.colors.danger;

  return (
    <article
      className="
        border-b
        p-4
        last:border-b-0
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
          gap-3

          sm:flex-row
          sm:items-start
          sm:justify-between
        "
      >
        <div>
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
                tracking-[0.1em]
              "
              style={{
                borderColor:
                  `${color}55`,

                color,
              }}
            >
              {record.ok ? (
                <CheckCircle2
                  size={9}
                />
              ) : (
                <AlertTriangle
                  size={9}
                />
              )}

              {record.ok
                ? "Success"
                : "Failed"}
            </span>

            <span
              className="
                text-[7px]
                uppercase
                tracking-[0.1em]
              "
              style={{
                color:
                  theme.colors.textMuted,
              }}
            >
              {
                record.mode
              }
            </span>
          </div>

          <p
            className="
              mt-2
              text-[10px]
              font-medium
            "
          >
            {
              record.label
            }
          </p>
        </div>

        <div
          className="
            text-left

            sm:text-right
          "
        >
          <p
            className="
              text-[8px]
              tabular-nums
            "
          >
            {
              formatDuration(
                record.durationMs,
              )
            }
          </p>

          <p
            className="
              mt-1
              text-[7px]
              tabular-nums
            "
            style={{
              color:
                theme.colors.textMuted,
            }}
          >
            {
              formatDateTime(
                record.startedAt,
              )
            }
          </p>
        </div>
      </div>

      <details
        className="
          mt-3
          border-t
          pt-3
        "
        style={{
          borderColor:
            theme.colors.border,
        }}
      >
        <summary
          className="
            cursor-pointer
            text-[7px]
            uppercase
            tracking-[0.11em]
          "
          style={{
            color:
              theme.colors.accent,
          }}
        >
          View output
        </summary>

        <pre
          className="
            scrollbar-subtle
            mt-3
            max-h-[420px]
            overflow-auto
            border
            p-3
            text-[8px]
            leading-4
          "
          style={{
            borderColor:
              theme.colors.border,

            backgroundColor:
              theme.colors.backgroundElevated,

            color:
              theme.colors.textMuted,
          }}
        >
          {
            stringifyOutput(
              record.output,
            )
          }
        </pre>
      </details>
    </article>
  );
}

/*
|--------------------------------------------------------------------------
| Formatting
|--------------------------------------------------------------------------
*/

function humanize(
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

function formatShortDate(
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

function formatDuration(
  durationMs:
    number,
) {
  if (
    durationMs <
    1000
  ) {
    return `${durationMs}ms`;
  }

  return `${(
    durationMs /
    1000
  ).toFixed(
    1,
  )}s`;
}

function stringifyOutput(
  value:
    unknown,
) {
  try {
    return JSON.stringify(
      value,
      null,
      2,
    );
  } catch {
    return String(
      value,
    );
  }
}