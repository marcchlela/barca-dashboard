"use client";

import type {
  ReactNode,
} from "react";

import {
  useMemo,
  useState,
  useTransition,
} from "react";

import {
  AlertTriangle,
  BadgeCheck,
  Check,
  ChevronDown,
  ExternalLink,
  Film,
  Link2Off,
  Loader2,
  RefreshCw,
  Save,
  Search,
  Trash2,
  Video,
} from "lucide-react";

import {
  useRouter,
} from "next/navigation";

import {
  kitThemes,
} from "../../lib/themes";

import type {
  AdminMediaData,
  AdminMediaItem,
  AdminMediaMatch,
  AdminMediaType,
} from "../../lib/admin/media";

type Props = {
  data:
    AdminMediaData;
};

type TypeFilter =
  | "all"
  | "highlight"
  | "secondary";

type SortMode =
  | "newest"
  | "oldest"
  | "match";

type ViewMode =
  | "grouped"
  | "flat";

type MediaGroup = {
  key:
    string;

  match:
    AdminMediaItem[
      "match"
    ];

  items:
    AdminMediaItem[];
};

export default function AdminMediaManager({
  data,
}: Props) {
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
    typeFilter,
    setTypeFilter,
  ] =
    useState<TypeFilter>(
      "all",
    );

  const [
    matchFilter,
    setMatchFilter,
  ] =
    useState(
      "all",
    );

  const [
    sort,
    setSort,
  ] =
    useState<SortMode>(
      "newest",
    );

  const [
    viewMode,
    setViewMode,
  ] =
    useState<ViewMode>(
      "grouped",
    );

  const [
    selectedId,
    setSelectedId,
  ] =
    useState<
      string | null
    >(
      data.items[0]
        ?.id ??
        null,
    );

  /*
  |--------------------------------------------------------------------------
  | Matches containing media
  |--------------------------------------------------------------------------
  */

  const mediaMatches =
    useMemo(
      () => {
        const ids =
          new Set(
            data.items
              .map(
                (
                  item,
                ) =>
                  item.matchId,
              )
              .filter(
                (
                  value,
                ): value is string =>
                  value !==
                  null,
              ),
          );

        return data.matches.filter(
          (
            match,
          ) =>
            ids.has(
              match.id,
            ),
        );
      },
      [
        data.items,
        data.matches,
      ],
    );

  /*
  |--------------------------------------------------------------------------
  | Filters
  |--------------------------------------------------------------------------
  */

  const filtered =
    useMemo(
      () => {
        const normalizedQuery =
          query
            .trim()
            .toLowerCase();

        const result =
          data.items.filter(
            (
              item,
            ) => {
              if (
                typeFilter ===
                  "highlight" &&
                item.type !==
                  "match_highlight"
              ) {
                return false;
              }

              if (
                typeFilter ===
                  "secondary" &&
                item.type ===
                  "match_highlight"
              ) {
                return false;
              }

              if (
                matchFilter ===
                "__unlinked__"
              ) {
                if (
                  item.matchId !==
                  null
                ) {
                  return false;
                }
              } else if (
                matchFilter !==
                  "all" &&
                item.matchId !==
                  matchFilter
              ) {
                return false;
              }

              if (
                !normalizedQuery
              ) {
                return true;
              }

              const haystack = [
                item.title,

                item.externalMediaId ??
                  "",

                item.type,

                item.source?.name ??
                  "",

                item.source?.code ??
                  "",

                item.match?.home ??
                  "",

                item.match?.homeShort ??
                  "",

                item.match?.away ??
                  "",

                item.match?.awayShort ??
                  "",

                item.match?.score ??
                  "",

                item.match
                  ?.competition
                  .name ??
                  "",

                item.match
                  ?.competition
                  .shortName ??
                  "",

                item.match
                  ?.matchday
                  ?.toString() ??
                  "",
              ]
                .join(
                  " ",
                )
                .toLowerCase();

              return haystack.includes(
                normalizedQuery,
              );
            },
          );

        if (
          sort ===
          "match"
        ) {
          return result.sort(
            (
              left,
              right,
            ) =>
              matchLabel(
                left.match,
              ).localeCompare(
                matchLabel(
                  right.match,
                ),
              ),
          );
        }

        return result.sort(
          (
            left,
            right,
          ) => {
            const leftTime =
              mediaTime(
                left,
              );

            const rightTime =
              mediaTime(
                right,
              );

            return sort ===
              "oldest"
              ? leftTime -
                  rightTime
              : rightTime -
                  leftTime;
          },
        );
      },
      [
        data.items,
        matchFilter,
        query,
        sort,
        typeFilter,
      ],
    );

  /*
  |--------------------------------------------------------------------------
  | Groups
  |--------------------------------------------------------------------------
  */

  const groups =
    useMemo(
      () =>
        buildMediaGroups(
          filtered,
          sort,
        ),
      [
        filtered,
        sort,
      ],
    );

  const selected =
    filtered.find(
      (
        item,
      ) =>
        item.id ===
        selectedId,
    ) ??
    filtered[0] ??
    null;

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
            Media Operations
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
            Media Manager
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
            Review the canonical
            Barça media library by
            fixture, correct media
            links and rescan
            individual matches when
            needed.
          </p>
        </div>

        <div
          className="
            grid
            grid-cols-2
            gap-px
            border

            sm:grid-cols-5
          "
          style={{
            borderColor:
              theme.colors.border,

            backgroundColor:
              theme.colors.border,
          }}
        >
          <HeaderMetric
            label="All"
            value={
              data.counts
                .total
            }
          />

          <HeaderMetric
            label="Highlights"
            value={
              data.counts
                .highlights
            }
          />

          <HeaderMetric
            label="Secondary"
            value={
              data.counts
                .secondary
            }
          />

          <HeaderMetric
            label="Coverage"
            value={`${data.counts.coverageReady}/${data.counts.finishedMatches}`}
            good={
              data.counts
                .coverageReady ===
              data.counts
                .finishedMatches
            }
          />

          <HeaderMetric
            label="Unlinked"
            value={
              data.counts
                .unlinked
            }
            warning={
              data.counts
                .unlinked >
              0
            }
          />
        </div>
      </section>

      {/* TOOLBAR */}

      <section
        className="
          mt-5
          border
        "
        style={{
          borderColor:
            theme.colors.border,

          backgroundColor:
            `${theme.colors.surface}80`,
        }}
      >
        {/* SEARCH / MATCH / SORT */}

        <div
          className="
            grid

            xl:grid-cols-[minmax(0,1fr)_minmax(220px,300px)_160px]
          "
        >
          <label
            className="
              flex
              h-13
              min-w-0
              items-center
              gap-3
              border-b
              px-4

              xl:border-b-0
              xl:border-r
            "
            style={{
              borderColor:
                theme.colors.border,
            }}
          >
            <Search
              size={14}
              className="shrink-0"
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
                    event.target
                      .value,
                  )
              }
              placeholder="Search media, match, source or video ID…"
              className="
                min-w-0
                flex-1
                bg-transparent
                text-[11px]
                outline-none
                placeholder:text-current
                placeholder:opacity-45
              "
            />
          </label>

          <StyledSelect
            value={
              matchFilter
            }
            onChange={
              setMatchFilter
            }
            label="Match"
            options={[
              {
                value:
                  "all",

                label:
                  "All matches",
              },

              {
                value:
                  "__unlinked__",

                label:
                  "Unlinked media",
              },

              ...mediaMatches.map(
                (
                  match,
                ) => ({
                  value:
                    match.id,

                  label:
                    compactMatchLabel(
                      match,
                    ),
                }),
              ),
            ]}
          />

          <StyledSelect
            value={
              sort
            }
            onChange={
              (
                value,
              ) =>
                setSort(
                  value as
                    SortMode,
                )
            }
            label="Sort"
            options={[
              {
                value:
                  "newest",

                label:
                  "Newest",
              },

              {
                value:
                  "oldest",

                label:
                  "Oldest",
              },

              {
                value:
                  "match",

                label:
                  "Match A–Z",
              },
            ]}
            last
          />
        </div>

        {/* VIEW / MEDIA TYPE */}

        <div
          className="
            grid
            border-t

            md:grid-cols-2
          "
          style={{
            borderColor:
              theme.colors.border,
          }}
        >
          <SegmentControl
            label="View"
          >
            <FilterButton
              active={
                viewMode ===
                "grouped"
              }
              onClick={
                () =>
                  setViewMode(
                    "grouped",
                  )
              }
            >
              Grouped
            </FilterButton>

            <FilterButton
              active={
                viewMode ===
                "flat"
              }
              onClick={
                () =>
                  setViewMode(
                    "flat",
                  )
              }
              last
            >
              All Media
            </FilterButton>
          </SegmentControl>

          <SegmentControl
            label="Media Type"
            right
          >
            <FilterButton
              active={
                typeFilter ===
                "all"
              }
              onClick={
                () =>
                  setTypeFilter(
                    "all",
                  )
              }
            >
              All
            </FilterButton>

            <FilterButton
              active={
                typeFilter ===
                "highlight"
              }
              onClick={
                () =>
                  setTypeFilter(
                    "highlight",
                  )
              }
            >
              Highlights
            </FilterButton>

            <FilterButton
              active={
                typeFilter ===
                "secondary"
              }
              onClick={
                () =>
                  setTypeFilter(
                    "secondary",
                  )
              }
              last
            >
              Secondary
            </FilterButton>
          </SegmentControl>
        </div>
      </section>

      {/* CONTENT */}

      <section
        className="
          mt-5
          grid
          gap-5

          xl:grid-cols-[minmax(0,1fr)_420px]
        "
      >
        {/* LIBRARY */}

        <div
          className="
            min-w-0
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
                `${theme.colors.surface}78`,
            }}
          >
            <div>
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
                Media Library
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
                {viewMode ===
                "grouped"
                  ? "Grouped by canonical fixture"
                  : "Flat canonical media library"}
              </p>
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
              {viewMode ===
              "grouped"
                ? `${groups.length} groups · ${filtered.length} media`
                : `${filtered.length} media`}
            </p>
          </div>

          {filtered.length >
          0 ? (
            viewMode ===
            "grouped" ? (
              <div>
                {groups.map(
                  (
                    group,
                  ) => (
                    <MediaGroupSection
                      key={
                        group.key
                      }
                      group={
                        group
                      }
                      selectedId={
                        selected?.id ??
                        null
                      }
                      onSelect={
                        setSelectedId
                      }
                    />
                  ),
                )}
              </div>
            ) : (
              <div>
                {filtered.map(
                  (
                    item,
                  ) => (
                    <MediaRow
                      key={
                        item.id
                      }
                      item={
                        item
                      }
                      selected={
                        selected?.id ===
                        item.id
                      }
                      onSelect={
                        () =>
                          setSelectedId(
                            item.id,
                          )
                      }
                      showMatchMeta
                    />
                  ),
                )}
              </div>
            )
          ) : (
            <div
              className="
                flex
                min-h-64
                items-center
                justify-center
                p-8
                text-center
              "
            >
              <div>
                <Video
                  size={20}
                  className="mx-auto"
                  style={{
                    color:
                      theme.colors.textMuted,
                  }}
                />

                <p className="mt-4 text-xs">
                  No media matches
                  these filters.
                </p>

                <p
                  className="
                    mt-2
                    text-[9px]
                  "
                  style={{
                    color:
                      theme.colors.textMuted,
                  }}
                >
                  Try another match,
                  type or search.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* INSPECTOR */}

        <div className="min-w-0">
          {selected ? (
            <MediaInspector
              key={
                selected.id
              }
              item={
                selected
              }
              matches={
                data.matches
              }
              mediaTypes={
                data.mediaTypes
              }
            />
          ) : (
            <EmptyInspector />
          )}
        </div>
      </section>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Segment controls
|--------------------------------------------------------------------------
*/

function SegmentControl({
  label,
  children,
  right = false,
}: {
  label:
    string;

  children:
    ReactNode;

  right?:
    boolean;
}) {
  const theme =
    kitThemes.home;

  return (
    <div
      className={`
        flex
        min-w-0
        items-stretch

        ${
          right
            ? "border-t md:border-l md:border-t-0"
            : ""
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
          w-24
          shrink-0
          items-center
          border-r
          px-4
        "
        style={{
          borderColor:
            theme.colors.border,

          backgroundColor:
            `${theme.colors.background}55`,
        }}
      >
        <span
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
          {label}
        </span>
      </div>

      <div
        className="
          flex
          min-w-0
          flex-1
        "
      >
        {children}
      </div>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Match group
|--------------------------------------------------------------------------
*/

function MediaGroupSection({
  group,
  selectedId,
  onSelect,
}: {
  group:
    MediaGroup;

  selectedId:
    string | null;

  onSelect:
    (
      id:
        string,
    ) => void;
}) {
  const theme =
    kitThemes.home;

  const match =
    group.match;

  const hasHighlight =
    group.items.some(
      (
        item,
      ) =>
        item.type ===
        "match_highlight",
    );

  const secondaryCount =
    group.items.filter(
      (
        item,
      ) =>
        item.type !==
        "match_highlight",
    ).length;

  const scoreParts =
    match?.score
      ? splitScore(
          match.score,
        )
      : null;

  return (
    <section
      className="
        border-b
        last:border-b-0
      "
      style={{
        borderColor:
          theme.colors.border,
      }}
    >
      {/* MATCH HEADER */}

      <div
        className="
          flex
          flex-col
          gap-4
          border-b
          px-4
          py-4

          sm:flex-row
          sm:items-center
          sm:justify-between
        "
        style={{
          borderColor:
            theme.colors.border,

          backgroundColor:
            `${theme.colors.backgroundElevated}D8`,
        }}
      >
        {match ? (
          <>
            <div className="min-w-0">
              {/* META */}

              <div
                className="
                  flex
                  flex-wrap
                  items-center
                  gap-x-2
                  gap-y-1
                  text-[7px]
                  uppercase
                  tracking-[0.14em]
                "
                style={{
                  color:
                    theme.colors.textMuted,
                }}
              >
                <span>
                  {match
                    .competition
                    .shortName ??
                    match
                      .competition
                      .name}
                </span>

                {match.matchday !==
                null ? (
                  <>
                    <span>
                      ·
                    </span>

                    <span>
                      MD
                      {String(
                        match.matchday,
                      ).padStart(
                        2,
                        "0",
                      )}
                    </span>
                  </>
                ) : null}

                {match.stage ? (
                  <>
                    <span>
                      ·
                    </span>

                    <span>
                      {formatStage(
                        match.stage,
                      )}
                    </span>
                  </>
                ) : null}

                <span>
                  ·
                </span>

                <span>
                  {formatDate(
                    match.kickoff,
                  )}
                </span>
              </div>

              {/* TEAMS */}

              <div
                className="
                  mt-2
                  flex
                  min-w-0
                  flex-wrap
                  items-center
                  gap-2.5
                "
              >
                {/* HOME LOGO */}

                <TeamCrest
                  url={
                    match.homeCrestUrl
                  }
                  name={
                    match.home
                  }
                />

                {/* HOME TEAM */}

                <span
                  className="
                    min-w-0
                    truncate
                    text-[13px]
                    font-medium

                    sm:text-sm
                  "
                >
                  {
                    match.homeShort
                  }
                </span>

                {/* SCORE */}

                {scoreParts ? (
                  <>
                    <span
                      className="
                        shrink-0
                        text-base
                        font-medium
                        tabular-nums
                      "
                      style={{
                        color:
                          theme.colors.accent,
                      }}
                    >
                      {
                        scoreParts.home
                      }
                    </span>

                    <span
                      className="
                        shrink-0
                        text-[7px]
                        uppercase
                        tracking-[0.14em]
                      "
                      style={{
                        color:
                          theme.colors.textMuted,
                      }}
                    >
                      VS
                    </span>

                    <span
                      className="
                        shrink-0
                        text-base
                        font-medium
                        tabular-nums
                      "
                      style={{
                        color:
                          theme.colors.accent,
                      }}
                    >
                      {
                        scoreParts.away
                      }
                    </span>
                  </>
                ) : (
                  <span
                    className="
                      shrink-0
                      text-[7px]
                      uppercase
                      tracking-[0.14em]
                    "
                    style={{
                      color:
                        theme.colors.textMuted,
                    }}
                  >
                    VS
                  </span>
                )}

                {/* AWAY TEAM */}

                <span
                  className="
                    min-w-0
                    truncate
                    text-[13px]
                    font-medium

                    sm:text-sm
                  "
                >
                  {
                    match.awayShort
                  }
                </span>

                {/* AWAY LOGO */}

                <TeamCrest
                  url={
                    match.awayCrestUrl
                  }
                  name={
                    match.away
                  }
                />
              </div>
            </div>

            {/* GROUP STATUS */}

            <div
              className="
                flex
                shrink-0
                flex-wrap
                items-center
                gap-3
              "
            >
              {hasHighlight ? (
                <span
                  className="
                    inline-flex
                    items-center
                    gap-1.5
                    text-[7px]
                    uppercase
                    tracking-[0.13em]
                  "
                  style={{
                    color:
                      theme.colors.success,
                  }}
                >
                  <Check
                    size={9}
                  />

                  Highlight
                </span>
              ) : null}

              {secondaryCount >
              0 ? (
                <span
                  className="
                    text-[7px]
                    uppercase
                    tracking-[0.13em]
                  "
                  style={{
                    color:
                      theme.colors.textMuted,
                  }}
                >
                  +
                  {
                    secondaryCount
                  }{" "}
                  extra
                </span>
              ) : null}

              <span
                className="
                  border
                  px-2.5
                  py-1.5
                  text-[7px]
                  uppercase
                  tracking-[0.12em]
                "
                style={{
                  borderColor:
                    group.items.length >
                    1
                      ? `${theme.colors.accent}88`
                      : theme.colors.border,

                  color:
                    group.items.length >
                    1
                      ? theme.colors.accent
                      : theme.colors.textMuted,

                  backgroundColor:
                    group.items.length >
                    1
                      ? `${theme.colors.accent}08`
                      : "transparent",
                }}
              >
                {
                  group.items
                    .length
                }{" "}
                {group.items
                  .length ===
                1
                  ? "item"
                  : "items"}
              </span>
            </div>
          </>
        ) : (
          <>
            <div>
              <p
                className="
                  text-[7px]
                  uppercase
                  tracking-[0.15em]
                "
                style={{
                  color:
                    theme.colors.warning,
                }}
              >
                Needs Attention
              </p>

              <h3 className="mt-1 text-sm font-medium">
                Unlinked Media
              </h3>

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
                Canonical media
                without an attached
                fixture.
              </p>
            </div>

            <span
              className="
                border
                px-2.5
                py-1.5
                text-[7px]
                uppercase
                tracking-[0.12em]
              "
              style={{
                borderColor:
                  `${theme.colors.warning}66`,

                color:
                  theme.colors.warning,
              }}
            >
              {
                group.items
                  .length
              }{" "}
              {group.items
                .length ===
              1
                ? "item"
                : "items"}
            </span>
          </>
        )}
      </div>

      {/* MEDIA */}

      <div>
        {group.items.map(
          (
            item,
          ) => (
            <MediaRow
              key={
                item.id
              }
              item={
                item
              }
              selected={
                selectedId ===
                item.id
              }
              onSelect={
                () =>
                  onSelect(
                    item.id,
                  )
              }
              showMatchMeta={
                false
              }
            />
          ),
        )}
      </div>
    </section>
  );
}

/*
|--------------------------------------------------------------------------
| Team crest
|--------------------------------------------------------------------------
*/

function TeamCrest({
  url,
  name,
}: {
  url:
    string | null;

  name:
    string;
}) {
  const theme =
    kitThemes.home;

  return (
    <div
      className="
        flex
        h-7
        w-7
        shrink-0
        items-center
        justify-center
      "
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={
            url
          }
          alt={`${name} crest`}
          className="
            max-h-7
            max-w-7
            object-contain
          "
        />
      ) : (
        <div
          className="
            h-2
            w-2
            rounded-full
          "
          style={{
            backgroundColor:
              theme.colors.textMuted,
          }}
        />
      )}
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Media row
|--------------------------------------------------------------------------
*/

function MediaRow({
  item,
  selected,
  onSelect,
  showMatchMeta,
}: {
  item:
    AdminMediaItem;

  selected:
    boolean;

  onSelect:
    () => void;

  showMatchMeta:
    boolean;
}) {
  const theme =
    kitThemes.home;

  const highlight =
    item.type ===
    "match_highlight";

  return (
    <button
      type="button"
      onClick={
        onSelect
      }
      className="
        grid
        w-full
        cursor-pointer
        grid-cols-[112px_minmax(0,1fr)]
        border-b
        border-l-2
        text-left
        transition-colors
        last:border-b-0

        sm:grid-cols-[150px_minmax(0,1fr)]
      "
      style={{
        borderBottomColor:
          theme.colors.border,

        borderLeftColor:
          selected
            ? theme.colors.accent
            : "transparent",

        backgroundColor:
          selected
            ? `${theme.colors.accent}10`
            : `${theme.colors.surface}5E`,
      }}
    >
      {/* THUMBNAIL */}

      <div
        className="
          relative
          aspect-video
          self-center
          overflow-hidden
          border-r
          bg-black/20
        "
        style={{
          borderColor:
            highlight
              ? `${theme.colors.accent}88`
              : theme.colors.border,
        }}
      >
        {item.thumbnailUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={
                item.thumbnailUrl
              }
              alt=""
              className="
                h-full
                w-full
                object-cover
              "
            />

            <div
              className="
                absolute
                inset-0
                bg-gradient-to-t
                from-black/45
                to-transparent
              "
            />
          </>
        ) : (
          <div
            className="
              flex
              h-full
              items-center
              justify-center
            "
            style={{
              color:
                theme.colors.textMuted,
            }}
          >
            <Video
              size={18}
            />
          </div>
        )}

        <div
          className="
            absolute
            bottom-2
            left-2
            flex
            h-6
            w-6
            items-center
            justify-center
            border
            bg-black/60
          "
          style={{
            borderColor:
              highlight
                ? theme.colors.accent
                : "rgba(255,255,255,0.18)",

            color:
              highlight
                ? theme.colors.accent
                : "#ffffff",
          }}
        >
          {highlight ? (
            <Film
              size={11}
            />
          ) : (
            <Video
              size={11}
            />
          )}
        </div>
      </div>

      {/* INFO */}

      <div
        className="
          min-w-0
          p-3

          sm:p-4
        "
      >
        <div
          className="
            flex
            flex-wrap
            items-center
            gap-2
          "
        >
          <MediaTypeBadge
            type={
              item.type
            }
          />

          {item.isOfficial ? (
            <span
              className="
                inline-flex
                items-center
                gap-1
                text-[7px]
                uppercase
                tracking-[0.13em]
              "
              style={{
                color:
                  theme.colors.accent,
              }}
            >
              <BadgeCheck
                size={9}
              />

              Official
            </span>
          ) : null}
        </div>

        <p
          className="
            mt-2
            line-clamp-2
            text-[11px]
            font-medium
            leading-4

            sm:text-xs
            sm:leading-5
          "
        >
          {
            item.title
          }
        </p>

        <div
          className="
            mt-3
            flex
            flex-wrap
            items-center
            gap-x-3
            gap-y-1
            text-[8px]
            uppercase
            tracking-[0.09em]
          "
          style={{
            color:
              theme.colors.textMuted,
          }}
        >
          {showMatchMeta ? (
            <>
              <span>
                {matchLabel(
                  item.match,
                )}
              </span>

              {item.match
                ?.score ? (
                <span>
                  {formatScore(
                    item.match
                      .score,
                  )}
                </span>
              ) : null}
            </>
          ) : (
            <span>
              {item.source
                ?.name ??
                "Unknown source"}
            </span>
          )}

          <span>
            {formatDate(
              item.publishedAt ??
                item.createdAt,
            )}
          </span>
        </div>
      </div>
    </button>
  );
}

/*
|--------------------------------------------------------------------------
| Inspector
|--------------------------------------------------------------------------
*/

function MediaInspector({
  item,
  matches,
  mediaTypes,
}: {
  item:
    AdminMediaItem;

  matches:
    AdminMediaMatch[];

  mediaTypes:
    AdminMediaType[];
}) {
  const theme =
    kitThemes.home;

  const router =
    useRouter();

  const [
    draftType,
    setDraftType,
  ] =
    useState<
      AdminMediaType
    >(
      item.type,
    );

  const [
    draftMatch,
    setDraftMatch,
  ] =
    useState(
      item.matchId ??
        "",
    );

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const [
    message,
    setMessage,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const [
    isPending,
    startTransition,
  ] =
    useTransition();

  const dirty =
    draftType !==
      item.type ||
    draftMatch !==
      (
        item.matchId ??
        ""
      );

  function run(
    operation:
      () =>
        Promise<string>,
  ) {
    setError(
      null,
    );

    setMessage(
      null,
    );

    startTransition(
      () => {
        void operation()
          .then(
            (
              result,
            ) => {
              setMessage(
                result,
              );

              router.refresh();
            },
          )
          .catch(
            (
              reason,
            ) => {
              setError(
                reason instanceof
                  Error
                  ? reason.message
                  : String(
                      reason,
                    ),
              );
            },
          );
      },
    );
  }

  async function save() {
    const response =
      await fetch(
        "/api/admin/media",
        {
          method:
            "PATCH",

          headers: {
            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify({
              mediaId:
                item.id,

              type:
                draftType,

              matchId:
                draftMatch ||
                null,
            }),
        },
      );

    const payload =
      await response.json();

    if (
      !response.ok ||
      !payload.ok
    ) {
      throw new Error(
        payload.error ??
          "Media update failed.",
      );
    }

    return "Media item saved.";
  }

  async function unlink() {
    if (
      !window.confirm(
        "Unlink this video from its match? The media row will be kept.",
      )
    ) {
      return "Cancelled.";
    }

    const response =
      await fetch(
        "/api/admin/media",
        {
          method:
            "DELETE",

          headers: {
            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify({
              mediaId:
                item.id,

              mode:
                "unlink",
            }),
        },
      );

    const payload =
      await response.json();

    if (
      !response.ok ||
      !payload.ok
    ) {
      throw new Error(
        payload.error ??
          "Media unlink failed.",
      );
    }

    return "Media item unlinked.";
  }

  async function remove() {
    if (
      !window.confirm(
        "Permanently delete this media item from the canonical database? This cannot be undone from this screen.",
      )
    ) {
      return "Cancelled.";
    }

    const response =
      await fetch(
        "/api/admin/media",
        {
          method:
            "DELETE",

          headers: {
            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify({
              mediaId:
                item.id,

              mode:
                "delete",
            }),
        },
      );

    const payload =
      await response.json();

    if (
      !response.ok ||
      !payload.ok
    ) {
      throw new Error(
        payload.error ??
          "Media deletion failed.",
      );
    }

    return "Media item deleted.";
  }

  async function rescan() {
    if (
      !item.matchId
    ) {
      throw new Error(
        "Attach this media item to a match before rescanning.",
      );
    }

    const response =
      await fetch(
        "/api/admin/media",
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify({
              action:
                "rescan",

              matchId:
                item.matchId,
            }),
        },
      );

    const payload =
      await response.json();

    if (
      !response.ok ||
      !payload.ok
    ) {
      throw new Error(
        payload.error ??
          "Match rescan failed.",
      );
    }

    const created =
      payload.result
        ?.writePlan
        ?.created ??
      0;

    const updated =
      payload.result
        ?.writePlan
        ?.updated ??
      0;

    const unchanged =
      payload.result
        ?.writePlan
        ?.unchanged ??
      0;

    const queued =
      payload.result
        ?.reviewPlan
        ?.queued ??
      0;

    const refreshed =
      payload.result
        ?.reviewPlan
        ?.refreshed ??
      0;

    const removedPending =
      payload.result
        ?.reviewPlan
        ?.removedPending ??
      0;

    const preservedReviewed =
      payload.result
        ?.reviewPlan
        ?.preservedReviewed ??
      0;

    const canonicalMessage =
      `Canonical: ${created} created · ${updated} updated · ${unchanged} unchanged`;

    const reviewMessage =
      `Review: ${queued} queued · ${refreshed} refreshed · ${removedPending} cleared · ${preservedReviewed} previously reviewed`;

    return `${canonicalMessage} — ${reviewMessage}.`;
  }

  return (
    <aside
      className="
        sticky
        top-5
        border
      "
      style={{
        borderColor:
          item.type ===
          "match_highlight"
            ? `${theme.colors.accent}88`
            : theme.colors.border,

        backgroundColor:
          `${theme.colors.surface}92`,
      }}
    >
      {/* HEADER */}

      <div
        className="
          border-b
          p-4
        "
        style={{
          borderColor:
            theme.colors.border,
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
          Media Inspector
        </p>

        <h3
          className="
            mt-1
            text-sm
            font-medium
          "
        >
          Canonical Record
        </h3>
      </div>

      {/* PREVIEW */}

      <div
        className="
          relative
          aspect-[2/1]
          overflow-hidden
          border-b
          bg-black/25
        "
        style={{
          borderColor:
            theme.colors.border,
        }}
      >
        {item.thumbnailUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={
                item.thumbnailUrl
              }
              alt=""
              className="
                h-full
                w-full
                object-cover
              "
            />

            <div
              className="
                absolute
                inset-0
                bg-gradient-to-t
                from-black/75
                via-transparent
                to-transparent
              "
            />
          </>
        ) : (
          <div
            className="
              flex
              h-full
              items-center
              justify-center
            "
            style={{
              color:
                theme.colors.textMuted,
            }}
          >
            <Video
              size={22}
            />
          </div>
        )}

        <div
          className="
            absolute
            bottom-3
            left-3
            right-3
          "
        >
          <div
            className="
              flex
              items-center
              gap-2
            "
          >
            <MediaTypeBadge
              type={
                item.type
              }
            />

            {item.isOfficial ? (
              <span
                className="
                  inline-flex
                  items-center
                  gap-1
                  text-[7px]
                  uppercase
                  tracking-[0.13em]
                "
                style={{
                  color:
                    theme.colors.accent,
                }}
              >
                <BadgeCheck
                  size={9}
                />

                Official
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="p-4">
        <p
          className="
            text-[13px]
            font-medium
            leading-5
          "
        >
          {
            item.title
          }
        </p>

        <a
          href={
            item.url
          }
          target="_blank"
          rel="noreferrer"
          className="
            mt-3
            inline-flex
            items-center
            gap-2
            text-[8px]
            uppercase
            tracking-[0.12em]
            transition-opacity
            hover:opacity-75
          "
          style={{
            color:
              theme.colors.accent,
          }}
        >
          Open source

          <ExternalLink
            size={11}
          />
        </a>

        {/* DETAILS */}

        <div
          className="
            mt-4
            grid
            grid-cols-2
            border-l
            border-t
          "
          style={{
            borderColor:
              theme.colors.border,
          }}
        >
          <InspectorDetail
            label="Match"
            value={
              item.match
                ? `${matchLabel(item.match)}${item.match.score ? ` · ${formatScore(item.match.score)}` : ""}`
                : "Unlinked"
            }
            full
          />

          <InspectorDetail
            label="Source"
            value={
              item.source
                ?.name ??
              "Unknown"
            }
          />

          <InspectorDetail
            label="Published"
            value={
              item.publishedAt
                ? formatDate(
                    item.publishedAt,
                  )
                : "Unknown"
            }
          />

          <InspectorDetail
            label="Video ID"
            value={
              item.externalMediaId ??
              "—"
            }
            mono
          />

          <InspectorDetail
            label="Record ID"
            value={
              shortId(
                item.id,
              )
            }
            mono
          />
        </div>

        {/* EDIT */}

        <div
          className="
            mt-5
            border-t
            pt-5
          "
          style={{
            borderColor:
              theme.colors.border,
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
            Edit Canonical Link
          </p>

          <label className="mt-4 block">
            <span
              className="
                text-[8px]
                uppercase
                tracking-[0.13em]
              "
              style={{
                color:
                  theme.colors.textMuted,
              }}
            >
              Media type
            </span>

            <div className="relative mt-2">
              <select
                value={
                  draftType
                }
                onChange={
                  (
                    event,
                  ) =>
                    setDraftType(
                      event.target
                        .value as
                        AdminMediaType,
                    )
                }
                className="
                  h-11
                  w-full
                  cursor-pointer
                  appearance-none
                  border
                  bg-transparent
                  px-3
                  pr-9
                  text-[10px]
                  outline-none
                "
                style={{
                  borderColor:
                    theme.colors.border,

                  backgroundColor:
                    theme.colors.backgroundElevated,

                  color:
                    theme.colors.text,
                }}
              >
                {mediaTypes.map(
                  (
                    type,
                  ) => (
                    <option
                      key={
                        type
                      }
                      value={
                        type
                      }
                    >
                      {mediaTypeLabel(
                        type,
                      )}
                    </option>
                  ),
                )}
              </select>

              <ChevronDown
                size={13}
                className="
                  pointer-events-none
                  absolute
                  right-3
                  top-1/2
                  -translate-y-1/2
                "
                style={{
                  color:
                    theme.colors.textMuted,
                }}
              />
            </div>
          </label>

          <label className="mt-4 block">
            <span
              className="
                text-[8px]
                uppercase
                tracking-[0.13em]
              "
              style={{
                color:
                  theme.colors.textMuted,
              }}
            >
              Attached match
            </span>

            <div className="relative mt-2">
              <select
                value={
                  draftMatch
                }
                onChange={
                  (
                    event,
                  ) =>
                    setDraftMatch(
                      event.target
                        .value,
                    )
                }
                className="
                  h-11
                  w-full
                  cursor-pointer
                  appearance-none
                  border
                  bg-transparent
                  px-3
                  pr-9
                  text-[10px]
                  outline-none
                "
                style={{
                  borderColor:
                    theme.colors.border,

                  backgroundColor:
                    theme.colors.backgroundElevated,

                  color:
                    theme.colors.text,
                }}
              >
                <option value="">
                  Unlinked
                </option>

                {matches.map(
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
                        compactMatchLabel(
                          match,
                        )
                      }
                    </option>
                  ),
                )}
              </select>

              <ChevronDown
                size={13}
                className="
                  pointer-events-none
                  absolute
                  right-3
                  top-1/2
                  -translate-y-1/2
                "
                style={{
                  color:
                    theme.colors.textMuted,
                }}
              />
            </div>
          </label>

          <button
            type="button"
            disabled={
              !dirty ||
              isPending
            }
            onClick={
              () =>
                run(
                  save,
                )
            }
            className="
              mt-4
              flex
              h-11
              w-full
              cursor-pointer
              items-center
              justify-center
              gap-2
              border
              text-[8px]
              font-semibold
              uppercase
              tracking-[0.14em]
              disabled:cursor-not-allowed
              disabled:opacity-35
            "
            style={{
              borderColor:
                theme.colors.accent,

              color:
                theme.colors.accent,

              backgroundColor:
                `${theme.colors.accent}08`,
            }}
          >
            {isPending ? (
              <Loader2
                size={12}
                className="animate-spin"
              />
            ) : (
              <Save
                size={12}
              />
            )}

            Save changes
          </button>
        </div>

        {/* OPERATIONS */}

        <div
          className="
            mt-5
            border-t
            pt-5
          "
          style={{
            borderColor:
              theme.colors.border,
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
            Operations
          </p>

          <button
            type="button"
            disabled={
              isPending ||
              !item.matchId
            }
            onClick={
              () =>
                run(
                  rescan,
                )
            }
            className="
              mt-3
              flex
              h-10
              w-full
              cursor-pointer
              items-center
              justify-between
              border
              px-3
              text-[8px]
              uppercase
              tracking-[0.12em]
              disabled:cursor-not-allowed
              disabled:opacity-35
            "
            style={{
              borderColor:
                theme.colors.border,

              color:
                theme.colors.textMuted,
            }}
          >
            Rescan this match

            <RefreshCw
              size={12}
            />
          </button>

          <button
            type="button"
            disabled={
              isPending ||
              !item.matchId
            }
            onClick={
              () =>
                run(
                  unlink,
                )
            }
            className="
              mt-2
              flex
              h-10
              w-full
              cursor-pointer
              items-center
              justify-between
              border
              px-3
              text-[8px]
              uppercase
              tracking-[0.12em]
              disabled:cursor-not-allowed
              disabled:opacity-35
            "
            style={{
              borderColor:
                theme.colors.border,

              color:
                theme.colors.warning,
            }}
          >
            Unlink from match

            <Link2Off
              size={12}
            />
          </button>

          <button
            type="button"
            disabled={
              isPending
            }
            onClick={
              () =>
                run(
                  remove,
                )
            }
            className="
              mt-2
              flex
              h-10
              w-full
              cursor-pointer
              items-center
              justify-between
              border
              px-3
              text-[8px]
              uppercase
              tracking-[0.12em]
              disabled:cursor-not-allowed
              disabled:opacity-35
            "
            style={{
              borderColor:
                `${theme.colors.danger}55`,

              color:
                theme.colors.danger,
            }}
          >
            Delete permanently

            <Trash2
              size={12}
            />
          </button>
        </div>

        {/* STATUS */}

        {message ? (
          <div
            className="
              mt-4
              flex
              gap-2
              border
              p-3
              text-[9px]
              leading-4
            "
            style={{
              borderColor:
                `${theme.colors.success}55`,

              color:
                theme.colors.success,

              backgroundColor:
                `${theme.colors.success}08`,
            }}
          >
            <Check
              size={12}
              className="mt-0.5 shrink-0"
            />

            {message}
          </div>
        ) : null}

        {error ? (
          <div
            className="
              mt-4
              flex
              gap-2
              border
              p-3
              text-[9px]
              leading-4
            "
            style={{
              borderColor:
                `${theme.colors.danger}55`,

              color:
                theme.colors.danger,

              backgroundColor:
                `${theme.colors.danger}08`,
            }}
          >
            <AlertTriangle
              size={12}
              className="mt-0.5 shrink-0"
            />

            {error}
          </div>
        ) : null}
      </div>
    </aside>
  );
}

/*
|--------------------------------------------------------------------------
| Header metric
|--------------------------------------------------------------------------
*/

function HeaderMetric({
  label,
  value,
  good = false,
  warning = false,
}: {
  label:
    string;

  value:
    string | number;

  good?:
    boolean;

  warning?:
    boolean;
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
            good
              ? theme.colors.success
              : warning
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
| Filter button
|--------------------------------------------------------------------------
*/

function FilterButton({
  active,
  onClick,
  children,
  last = false,
}: {
  active:
    boolean;

  onClick:
    () => void;

  children:
    string;

  last?:
    boolean;
}) {
  const theme =
    kitThemes.home;

  return (
    <button
      type="button"
      onClick={
        onClick
      }
      className={`
        min-w-0
        flex-1
        cursor-pointer
        px-4
        py-3
        text-[8px]
        uppercase
        tracking-[0.11em]

        ${
          last
            ? ""
            : "border-r"
        }
      `}
      style={{
        borderColor:
          theme.colors.border,

        color:
          active
            ? theme.colors.accent
            : theme.colors.textMuted,

        backgroundColor:
          active
            ? `${theme.colors.accent}0A`
            : "transparent",
      }}
    >
      {children}
    </button>
  );
}

/*
|--------------------------------------------------------------------------
| Select
|--------------------------------------------------------------------------
*/

function StyledSelect({
  value,
  onChange,
  label,
  options,
  last = false,
}: {
  value:
    string;

  onChange:
    (
      value:
        string,
    ) => void;

  label:
    string;

  options:
    Array<{
      value:
        string;

      label:
        string;
    }>;

  last?:
    boolean;
}) {
  const theme =
    kitThemes.home;

  return (
    <label
      className={`
        relative
        flex
        h-13
        min-w-0
        items-center
        border-b

        xl:border-b-0

        ${
          last
            ? ""
            : "xl:border-r"
        }
      `}
      style={{
        borderColor:
          theme.colors.border,
      }}
    >
      <span
        className="
          absolute
          left-3
          top-1.5
          text-[6px]
          uppercase
          tracking-[0.14em]
        "
        style={{
          color:
            theme.colors.textMuted,
        }}
      >
        {label}
      </span>

      <select
        value={
          value
        }
        onChange={
          (
            event,
          ) =>
            onChange(
              event.target
                .value,
            )
        }
        className="
          h-full
          min-w-0
          w-full
          cursor-pointer
          appearance-none
          bg-transparent
          px-3
          pb-1
          pt-3
          pr-8
          text-[9px]
          outline-none
        "
        style={{
          color:
            theme.colors.text,

          backgroundColor:
            theme.colors.backgroundElevated,
        }}
      >
        {options.map(
          (
            option,
          ) => (
            <option
              key={
                option.value
              }
              value={
                option.value
              }
              style={{
                backgroundColor:
                  theme.colors.backgroundElevated,
              }}
            >
              {
                option.label
              }
            </option>
          ),
        )}
      </select>

      <ChevronDown
        size={12}
        className="
          pointer-events-none
          absolute
          right-3
          top-1/2
          -translate-y-1/2
        "
        style={{
          color:
            theme.colors.textMuted,
        }}
      />
    </label>
  );
}

/*
|--------------------------------------------------------------------------
| Media badge
|--------------------------------------------------------------------------
*/

function MediaTypeBadge({
  type,
}: {
  type:
    string;
}) {
  const theme =
    kitThemes.home;

  const highlight =
    type ===
    "match_highlight";

  return (
    <span
      className="
        inline-flex
        items-center
        gap-1.5
        text-[7px]
        font-semibold
        uppercase
        tracking-[0.13em]
      "
      style={{
        color:
          highlight
            ? theme.colors.accent
            : theme.colors.textMuted,
      }}
    >
      {highlight ? (
        <Film
          size={9}
        />
      ) : (
        <Video
          size={9}
        />
      )}

      {mediaTypeLabel(
        type,
      )}
    </span>
  );
}

/*
|--------------------------------------------------------------------------
| Inspector detail
|--------------------------------------------------------------------------
*/

function InspectorDetail({
  label,
  value,
  mono = false,
  full = false,
}: {
  label:
    string;

  value:
    string;

  mono?:
    boolean;

  full?:
    boolean;
}) {
  const theme =
    kitThemes.home;

  return (
    <div
      className={`
        border-b
        border-r
        p-3

        ${
          full
            ? "col-span-2"
            : ""
        }
      `}
      style={{
        borderColor:
          theme.colors.border,
      }}
    >
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
        {label}
      </p>

      <p
        className={`
          mt-1
          break-all
          text-[8px]
          leading-4

          ${
            mono
              ? "font-mono"
              : ""
          }
        `}
      >
        {value}
      </p>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Empty inspector
|--------------------------------------------------------------------------
*/

function EmptyInspector() {
  const theme =
    kitThemes.home;

  return (
    <div
      className="
        flex
        min-h-72
        items-center
        justify-center
        border
        p-8
        text-center
      "
      style={{
        borderColor:
          theme.colors.border,

        color:
          theme.colors.textMuted,
      }}
    >
      <div>
        <Video
          size={20}
          className="mx-auto"
        />

        <p className="mt-4 text-[10px]">
          Select a media item
          to inspect it.
        </p>
      </div>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Group builder
|--------------------------------------------------------------------------
*/

function buildMediaGroups(
  items:
    AdminMediaItem[],

  sort:
    SortMode,
): MediaGroup[] {
  const map =
    new Map<
      string,
      MediaGroup
    >();

  for (
    const item
    of items
  ) {
    const key =
      item.matchId ??
      "__unlinked__";

    const existing =
      map.get(
        key,
      );

    if (
      existing
    ) {
      existing.items.push(
        item,
      );

      continue;
    }

    map.set(
      key,
      {
        key,

        match:
          item.match,

        items: [
          item,
        ],
      },
    );
  }

  const groups =
    Array.from(
      map.values(),
    );

  for (
    const group
    of groups
  ) {
    group.items.sort(
      (
        left,
        right,
      ) => {
        const leftHighlight =
          left.type ===
          "match_highlight";

        const rightHighlight =
          right.type ===
          "match_highlight";

        if (
          leftHighlight &&
          !rightHighlight
        ) {
          return -1;
        }

        if (
          rightHighlight &&
          !leftHighlight
        ) {
          return 1;
        }

        return (
          mediaTime(
            right,
          ) -
          mediaTime(
            left,
          )
        );
      },
    );
  }

  groups.sort(
    (
      left,
      right,
    ) => {
      if (
        !left.match &&
        right.match
      ) {
        return 1;
      }

      if (
        left.match &&
        !right.match
      ) {
        return -1;
      }

      if (
        !left.match ||
        !right.match
      ) {
        return 0;
      }

      if (
        sort ===
        "match"
      ) {
        return matchLabel(
          left.match,
        ).localeCompare(
          matchLabel(
            right.match,
          ),
        );
      }

      const leftTime =
        new Date(
          left.match
            .kickoff,
        ).getTime();

      const rightTime =
        new Date(
          right.match
            .kickoff,
        ).getTime();

      return sort ===
        "oldest"
        ? leftTime -
            rightTime
        : rightTime -
            leftTime;
    },
  );

  return groups;
}

/*
|--------------------------------------------------------------------------
| Formatting
|--------------------------------------------------------------------------
*/

function matchLabel(
  match:
    AdminMediaItem[
      "match"
    ],
) {
  if (!match) {
    return "Unlinked";
  }

  return `${match.homeShort} vs ${match.awayShort}`;
}

function compactMatchLabel(
  match:
    AdminMediaMatch,
) {
  const score =
    match.score
      ? ` · ${formatScore(
          match.score,
        )}`
      : "";

  return `${match.homeShort} vs ${match.awayShort}${score}`;
}

function mediaTypeLabel(
  type:
    string,
) {
  switch (
    type
  ) {
    case "match_highlight":
      return "Highlight";

    case "match_feature":
      return "Match Feature";

    case "match_preview":
      return "Match Preview";

    case "goal_clip":
      return "Goal Clip";

    case "interview":
      return "Interview";

    case "press_conference":
      return "Press Conference";

    case "training":
      return "Training";

    case "historical":
      return "Historical";

    default:
      return "Other";
  }
}

function mediaTime(
  item:
    AdminMediaItem,
) {
  return new Date(
    item.publishedAt ??
      item.createdAt,
  ).getTime();
}

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

function formatScore(
  value:
    string,
) {
  return value.replace(
    "-",
    "–",
  );
}

function splitScore(
  value:
    string,
) {
  const [
    home,
    away,
  ] =
    value.split(
      "-",
    );

  return {
    home:
      home ??
      "",

    away:
      away ??
      "",
  };
}

function formatStage(
  value:
    string,
) {
  return value
    .toLowerCase()
    .split(
      "_",
    )
    .filter(
      Boolean,
    )
    .map(
      (
        word,
      ) =>
        word
          .charAt(
            0,
          )
          .toUpperCase() +
        word.slice(
          1,
        ),
    )
    .join(
      " ",
    );
}

function shortId(
  value:
    string,
) {
  if (
    value.length <=
    16
  ) {
    return value;
  }

  return `${value.slice(
    0,
    8,
  )}…${value.slice(
    -6,
  )}`;
}