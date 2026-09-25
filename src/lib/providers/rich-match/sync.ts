import "server-only";

import { db } from "../../../prisma/db";
import type { BigBallsPlayerStatistic } from "../big-balls/types";
import { fetchGoalMatchBundle } from "../goal-api/fetch";
import type {
  GoalLineupPlayer,
  GoalLineupSide,
} from "../goal-api/types";
import { formationPosition } from "../shared/formation-layout";
import type { MatchIdentityInput } from "../shared/match-identity";
import {
  jsonEqual,
  normalizedPersonName,
  splitDisplayName,
} from "../shared/normalization";
import { RICH_DATA_SOURCES } from "./constants";
import { bigBallsPlayerStatisticsProvider } from "./player-stat-provider";
import {
  emptySyncCounts,
  type ChangeCount,
  type RichSyncCounts,
  type UnresolvedIdentity,
} from "./types";

type Orm = typeof db.orm;

type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

type GoalResolvedPlayer = {
  playerId: string;
  teamId: string;
  providerTeamId: string;
  player: GoalLineupPlayer;
};

function recordMatches(
  existing: Record<string, unknown>,
  data: Record<string, unknown>,
) {
  return Object.entries(data).every(([key, value]) =>
    jsonEqual(existing[key], value),
  );
}

function changed(
  count: ChangeCount,
  kind: "created" | "updated" | "unchanged",
) {
  count[kind] += 1;
}

async function loadMatchContext(
  matchId: string,
) {
  const match =
    await db.orm.public.Match
      .where({
        id: matchId,
      })
      .include("homeTeam")
      .include("awayTeam")
      .include("competition")
      .first();

  if (!match) {
    throw new Error(
      `Match ${matchId} was not found.`,
    );
  }

  if (
    !match.homeTeam.isBarcelona &&
    !match.awayTeam.isBarcelona
  ) {
    throw new Error(
      `Match ${matchId} is not an FC Barcelona fixture.`,
    );
  }

  if (
    match.status !== "finished"
  ) {
    throw new Error(
      `Rich-match ingestion currently accepts finished matches only. Match ${matchId} has status "${match.status}".`,
    );
  }

  if (
    match.homeScore === null ||
    match.awayScore === null
  ) {
    throw new Error(
      `Finished match ${matchId} is missing its final score.`,
    );
  }

  const mappings =
    await db.orm.public.ProviderMapping
      .where({
        internalId:
          match.id,
        entityType:
          "match",
      })
      .include(
        "dataSource",
      )
      .all();

  const internal: MatchIdentityInput =
    {
      kickoff:
        match.kickoff.toString(),

      competition: {
        name:
          match.competition.name,
      },

      homeTeam: {
        name:
          match.homeTeam.name,
      },

      awayTeam: {
        name:
          match.awayTeam.name,
      },

      score: {
        home:
          match.homeScore,

        away:
          match.awayScore,
      },

      providerIds:
        Object.fromEntries(
          mappings.map(
            (mapping) => [
              mapping.dataSource.code,
              mapping.providerId,
            ],
          ),
        ),
    };

  return {
    match,
    internal,
  };
}

async function ensureDataSource(
  orm: Orm,
  definition:
    (typeof RICH_DATA_SOURCES)[keyof typeof RICH_DATA_SOURCES],
  counts: RichSyncCounts,
) {
  const existing =
    await orm.public.DataSource
      .where({
        code:
          definition.code,
      })
      .first();

  const data = {
    name:
      definition.name,

    baseUrl:
      definition.baseUrl,

    isOfficial:
      definition.isOfficial,

    isEnabled:
      definition.isEnabled,

    licenseNotes:
      definition.licenseNotes,
  };

  if (!existing) {
    changed(
      counts.dataSources,
      "created",
    );

    return orm.public.DataSource.create({
      code:
        definition.code,

      ...data,
    });
  }

  if (
    recordMatches(
      existing,
      data,
    )
  ) {
    changed(
      counts.dataSources,
      "unchanged",
    );

    return existing;
  }

  changed(
    counts.dataSources,
    "updated",
  );

  const updated =
    await orm.public.DataSource
      .where({
        id:
          existing.id,
      })
      .update(data);

  if (!updated) {
    throw new Error(
      `Data source ${definition.code} disappeared during sync.`,
    );
  }

  return updated;
}

async function ensureMapping(
  orm: Orm,
  counts: RichSyncCounts,
  input: {
    dataSourceId: string;

    entityType:
      | "team"
      | "player"
      | "match"
      | "event";

    internalId: string;
    providerId: string;
    metadata?: JsonValue;
  },
) {
  const existing =
    await orm.public.ProviderMapping
      .where({
        dataSourceId:
          input.dataSourceId,

        entityType:
          input.entityType,

        providerId:
          input.providerId,
      })
      .first();

  const metadata =
    input.metadata ?? null;

  if (!existing) {
    changed(
      counts.providerMappings,
      "created",
    );

    return orm.public.ProviderMapping.create({
      ...input,
      metadata,
    });
  }

  if (
    existing.internalId !==
    input.internalId
  ) {
    throw new Error(
      `Provider identity collision for ${input.entityType} ${input.providerId}: ${existing.internalId} != ${input.internalId}`,
    );
  }

  if (
    jsonEqual(
      existing.metadata,
      metadata,
    )
  ) {
    changed(
      counts.providerMappings,
      "unchanged",
    );

    return existing;
  }

  changed(
    counts.providerMappings,
    "updated",
  );

  const updated =
    await orm.public.ProviderMapping
      .where({
        id:
          existing.id,
      })
      .update({
        metadata,
      });

  if (!updated) {
    throw new Error(
      `Provider mapping ${input.providerId} disappeared during sync.`,
    );
  }

  return updated;
}

async function ensureSimpleRow<
  T extends Record<string, unknown>,
>(
  count: ChangeCount,
  existing: T | null,
  data: Record<string, unknown>,
  create: () => Promise<T | null>,
  update: () => Promise<T | null>,
): Promise<T> {
  if (!existing) {
    changed(
      count,
      "created",
    );

    const created =
      await create();

    if (!created) {
      throw new Error(
        "Created row could not be read back.",
      );
    }

    return created;
  }

  if (
    recordMatches(
      existing,
      data,
    )
  ) {
    changed(
      count,
      "unchanged",
    );

    return existing;
  }

  changed(
    count,
    "updated",
  );

  const updated =
    await update();

  if (!updated) {
    throw new Error(
      "Updated row disappeared during sync.",
    );
  }

  return updated;
}

async function findExistingTeamSeasonPlayer(
  orm: Orm,
  seasonId: string,
  teamId: string,
  input: GoalLineupPlayer,
) {
  const normalized =
    normalizedPersonName(
      input.name,
    );

  const memberships =
    await orm.public.SquadMembership
      .where({
        seasonId,
        teamId,
      })
      .include("player")
      .all();

  const matches =
    memberships.filter(
      (membership) =>
        normalizedPersonName(
          membership.player.displayName,
        ) === normalized,
    );

  if (
    matches.length > 1
  ) {
    throw new Error(
      `Ambiguous existing player identity for ${input.name} in team ${teamId} / season ${seasonId}.`,
    );
  }

  return (
    matches[0]
      ?.player ?? null
  );
}

async function ensureGoalPlayer(
  orm: Orm,
  counts: RichSyncCounts,
  dataSourceId: string,
  seasonId: string,
  teamId: string,
  providerTeamId: string,
  input: GoalLineupPlayer,
  knownPlayers: GoalResolvedPlayer[],
) {
  const canonicalMapping =
    await orm.public.ProviderMapping
      .where({
        dataSourceId,

        entityType:
          "player",

        providerId:
          input.providerId,
      })
      .first();

  let existing =
    canonicalMapping
      ? await orm.public.Player
          .where({
            id:
              canonicalMapping.internalId,
          })
          .first()
      : null;

  if (
    canonicalMapping &&
    !existing
  ) {
    throw new Error(
      `GOAL player mapping ${input.providerId} points to a missing player.`,
    );
  }

  if (!existing) {
    const normalized =
      normalizedPersonName(
        input.name,
      );

    const localMatches =
      knownPlayers.filter(
        (candidate) =>
          candidate.teamId ===
            teamId &&
          normalizedPersonName(
            candidate.player.name,
          ) === normalized,
      );

    if (
      localMatches.length ===
      1
    ) {
      existing =
        await orm.public.Player
          .where({
            id:
              localMatches[0].playerId,
          })
          .first();
    }
  }

  if (!existing) {
    existing =
      await findExistingTeamSeasonPlayer(
        orm,
        seasonId,
        teamId,
        input,
      );
  }

  const names =
    splitDisplayName(
      input.name,
    );

  const data = {
    firstName:
      existing?.firstName ??
      names.firstName,

    lastName:
      existing?.lastName ??
      names.lastName,

    displayName:
      existing?.displayName ??
      input.name,

    primaryPosition:
      existing &&
      existing.primaryPosition !==
        "unknown"
        ? existing.primaryPosition
        : input.primaryPosition,

    portraitUrl:
      existing?.portraitUrl ??
      input.imageUrl,

    isActive:
      true,
  };

  const player =
    await ensureSimpleRow(
      counts.players,
      existing,
      data,

      () =>
        orm.public.Player.create(
          data,
        ),

      () =>
        orm.public.Player
          .where({
            id:
              existing!.id,
          })
          .update(data),
    );

  await ensureMapping(
    orm,
    counts,
    {
      dataSourceId,

      entityType:
        "player",

      internalId:
        player.id as string,

      providerId:
        input.providerId,

      metadata: {
        identityKey:
          "canonical",
      },
    },
  );

  if (
    input.legacyEventKey &&
    input.legacyEventKey !==
      input.providerId
  ) {
    await ensureMapping(
      orm,
      counts,
      {
        dataSourceId,

        entityType:
          "player",

        internalId:
          player.id as string,

        providerId:
          input.legacyEventKey,

        metadata: {
          identityKey:
            "legacy_event_key",
        },
      },
    );
  }

  return {
    playerId:
      player.id as string,

    teamId,

    providerTeamId,

    player:
      input,
  } satisfies GoalResolvedPlayer;
}

async function ensureLineupSide(
  orm: Orm,
  counts: RichSyncCounts,
  matchId: string,
  teamId: string,
  side: GoalLineupSide,
  players: GoalResolvedPlayer[],
) {
  const existing =
    await orm.public.Lineup
      .where({
        matchId,
        teamId,
      })
      .first();

  const data = {
    formation:
      side.formation,

    coachName:
      side.coachName,

    isConfirmed:
      true,
  };

  const lineup =
    await ensureSimpleRow(
      counts.lineups,
      existing,
      data,

      () =>
        orm.public.Lineup.create({
          matchId,
          teamId,
          ...data,
        }),

      () =>
        orm.public.Lineup
          .where({
            id:
              existing!.id,
          })
          .update(data),
    );

  for (
    const resolved
    of players.filter(
      (row) =>
        row.teamId ===
        teamId,
    )
  ) {
    const entry =
      await orm.public.LineupPlayer
        .where({
          lineupId:
            lineup.id as string,

          playerId:
            resolved.playerId,
        })
        .first();

    const position =
      resolved.player.role ===
      "starter"
        ? formationPosition(
            side.formation,

            resolved.player
              .lineupOrdinal ??
              0,
          )
        : null;

    const entryData = {
      role:
        resolved.player.role,

      shirtNumber:
        resolved.player.shirtNumber,

      position:
        resolved.player.matchPosition,

      lineupOrdinal:
        resolved.player.lineupOrdinal,

      positionX:
        position?.x ??
        null,

      positionY:
        position?.y ??
        null,

      enteredMinute:
        null,

      leftMinute:
        null,
    };

    await ensureSimpleRow(
      counts.lineupPlayers,
      entry,
      entryData,

      () =>
        orm.public.LineupPlayer.create({
          lineupId:
            lineup.id as string,

          playerId:
            resolved.playerId,

          ...entryData,
        }),

      () =>
        orm.public.LineupPlayer
          .where({
            id:
              entry!.id,
          })
          .update(
            entryData,
          ),
    );
  }
}

function compatiblePosition(
  left: string,
  right: string,
) {
  return (
    left === "unknown" ||
    right === "unknown" ||
    left === right
  );
}

function nameParts(
  value: string,
) {
  return normalizedPersonName(
    value,
  )
    .split(" ")
    .filter(Boolean);
}

function surnameOf(
  value: string,
) {
  return (
    nameParts(
      value,
    ).at(-1) ??
    ""
  );
}

/**
 * Conservative identity rule for providers that abbreviate names
 * or disagree on broad football positions.
 *
 * Requirements:
 *
 * - player must already belong to the same confirmed match team
 * - both providers must expose the same shirt number
 * - normalized surname must match
 * - exactly ONE GOAL lineup player may satisfy those conditions
 *
 * We deliberately do NOT match on shirt number alone.
 * We deliberately do NOT match on surname alone.
 */
function uniqueSurnameShirtMatch(
  input: BigBallsPlayerStatistic,
  sameTeam: GoalResolvedPlayer[],
) {
  if (
    input.shirtNumber ===
    null
  ) {
    return null;
  }

  const surname =
    surnameOf(
      input.name,
    );

  if (!surname) {
    return null;
  }

  const matches =
    sameTeam.filter(
      (candidate) =>
        candidate.player
          .shirtNumber ===
          input.shirtNumber &&
        surnameOf(
          candidate.player.name,
        ) === surname,
    );

  return matches.length ===
    1
    ? matches[0]
    : null;
}

function abbreviatedIdentityMatches(
  provider: BigBallsPlayerStatistic,
  candidate: GoalResolvedPlayer,
) {
  if (
    provider.shirtNumber ===
      null ||
    candidate.player
      .shirtNumber ===
      null ||
    provider.shirtNumber !==
      candidate.player
        .shirtNumber ||
    !compatiblePosition(
      provider.position,
      candidate.player
        .primaryPosition,
    )
  ) {
    return false;
  }

  const providerParts =
    nameParts(
      provider.name,
    );

  const candidateParts =
    nameParts(
      candidate.player.name,
    );

  if (
    providerParts.length <
      2 ||
    candidateParts.length <
      2
  ) {
    return false;
  }

  const first =
    providerParts[0];

  return (
    first.length === 1 &&
    candidateParts[0]
      .startsWith(first) &&
    providerParts.at(-1) ===
      candidateParts.at(-1)
  );
}

function matchBigBallsPlayer(
  input: BigBallsPlayerStatistic,
  teamId: string,
  candidates: GoalResolvedPlayer[],
) {
  const sameTeam =
    candidates.filter(
      (candidate) =>
        candidate.teamId ===
        teamId,
    );

  const normalized =
    normalizedPersonName(
      input.name,
    );

  /*
   * Strongest non-mapping evidence:
   * exact normalized full name inside the correct match team.
   */
  const exact =
    sameTeam.filter(
      (candidate) =>
        normalizedPersonName(
          candidate.player.name,
        ) ===
        normalized,
    );

  if (
    exact.length === 1
  ) {
    return {
      resolved:
        exact[0],

      method:
        "exact_normalized_name" as const,
    };
  }

  /*
   * Next: traditional abbreviated identity:
   * initial + surname + shirt + compatible broad position.
   */
  const abbreviated =
    sameTeam.filter(
      (candidate) =>
        abbreviatedIdentityMatches(
          input,
          candidate,
        ),
    );

  if (
    abbreviated.length ===
    1
  ) {
    return {
      resolved:
        abbreviated[0],

      method:
        "initial_surname_shirt_position" as const,
    };
  }

  /*
   * Final safe fallback:
   *
   * same confirmed fixture team
   * + same shirt number
   * + same normalized surname
   * + exactly one GOAL candidate.
   *
   * This handles real provider disagreements such as:
   *
   * Big Balls: K. Adeyemi, #14, midfielder
   * GOAL:      Karim Adeyemi, #14, forward
   *
   * and:
   *
   * Big Balls: M. Zabiri, #21
   * GOAL:      Yassir Zabiri, #21
   *
   * without resorting to surname-only matching.
   */
  const surnameShirt =
    uniqueSurnameShirtMatch(
      input,
      sameTeam,
    );

  if (
    surnameShirt
  ) {
    return {
      resolved:
        surnameShirt,

      method:
        "unique_team_surname_shirt" as const,
    };
  }

  return {
    resolved:
      null,

    method:
      null,
  };
}

async function resolveBigBallsPlayer(
  orm: Orm,
  dataSourceId: string,
  input: BigBallsPlayerStatistic,
  teamId: string,
  candidates: GoalResolvedPlayer[],
) {
  const mapping =
    await orm.public.ProviderMapping
      .where({
        dataSourceId,

        entityType:
          "player",

        providerId:
          input.providerId,
      })
      .first();

  if (mapping) {
    const mapped =
      candidates.find(
        (candidate) =>
          candidate.playerId ===
            mapping.internalId &&
          candidate.teamId ===
            teamId,
      );

    if (!mapped) {
      throw new Error(
        `Big Balls player mapping ${input.providerId} is outside the resolved match team.`,
      );
    }

    return {
      resolved:
        mapped,

      method:
        "provider_mapping" as const,
    };
  }

  return matchBigBallsPlayer(
    input,
    teamId,
    candidates,
  );
}

export async function syncRichMatch(
  input: {
    matchId: string;
    dryRun: boolean;
  },
) {
  const {
    match,
    internal,
  } =
    await loadMatchContext(
      input.matchId,
    );

  const [
    goal,
    bigBalls,
  ] =
    await Promise.all([
      fetchGoalMatchBundle(
        internal,
      ),

      bigBallsPlayerStatisticsProvider.fetchMatch(
        internal,
      ),
    ]);

  const expectedGoalCount =
    (match.homeScore ??
      0) +
    (match.awayScore ??
      0);

  if (
    goal.events.length !==
    expectedGoalCount
  ) {
    throw new Error(
      `GOAL returned ${goal.events.length} scoring events; final score requires ${expectedGoalCount}.`,
    );
  }

  const preview = {
    fixture: {
      matchId:
        match.id,

      kickoff:
        match.kickoff.toString(),

      competition:
        match.competition.name,

      home:
        match.homeTeam.name,

      away:
        match.awayTeam.name,

      score: {
        home:
          match.homeScore,

        away:
          match.awayScore,
      },
    },

    goalPlayers:
      goal.home.players.length +
      goal.away.players.length,

    starters: {
      home:
        goal.home.players.filter(
          (player) =>
            player.role ===
            "starter",
        ).length,

      away:
        goal.away.players.filter(
          (player) =>
            player.role ===
            "starter",
        ).length,
    },

    bench: {
      home:
        goal.home.players.filter(
          (player) =>
            player.role ===
            "substitute",
        ).length,

      away:
        goal.away.players.filter(
          (player) =>
            player.role ===
            "substitute",
        ).length,
    },

    formations: {
      home:
        goal.home.formation,

      away:
        goal.away.formation,
    },

    scoringEvents:
      goal.events.length,

    bigBallsParticipants:
      bigBalls.players.length,
  };

  const previewGoalPlayers: GoalResolvedPlayer[] =
    [
      ...goal.home.players.map(
        (player) => ({
          playerId:
            player.providerId,

          teamId:
            match.homeTeamId,

          providerTeamId:
            goal.home.providerTeamId,

          player,
        }),
      ),

      ...goal.away.players.map(
        (player) => ({
          playerId:
            player.providerId,

          teamId:
            match.awayTeamId,

          providerTeamId:
            goal.away.providerTeamId,

          player,
        }),
      ),
    ];

  const previewBigBallsTeams =
    new Map([
      [
        bigBalls.homeTeamProviderId,
        match.homeTeamId,
      ],

      [
        bigBalls.awayTeamProviderId,
        match.awayTeamId,
      ],
    ]);

  const previewUnresolved: UnresolvedIdentity[] =
    [];

  let previewResolved =
    0;

  for (
    const statistic
    of bigBalls.players
  ) {
    const teamId =
      previewBigBallsTeams.get(
        statistic.teamProviderId,
      );

    const identity =
      teamId
        ? matchBigBallsPlayer(
            statistic,
            teamId,
            previewGoalPlayers,
          )
        : {
            resolved:
              null,
            method:
              null,
          };

    if (
      identity.resolved
    ) {
      previewResolved +=
        1;
    } else {
      previewUnresolved.push({
        providerId:
          statistic.providerId,

        name:
          statistic.name,

        teamProviderId:
          statistic.teamProviderId,

        shirtNumber:
          statistic.shirtNumber,

        position:
          statistic.position,

        reason:
          teamId
            ? "no_unique_safe_player_match"
            : "team_identity_not_resolved",
      });
    }
  }

  previewUnresolved.sort(
    (left, right) =>
      left.providerId.localeCompare(
        right.providerId,
      ),
  );

  if (
    input.dryRun
  ) {
    return {
      dryRun:
        true,

      matchId:
        match.id,

      providers: {
        goal: {
          matchId:
            goal.providerMatchId,

          requests:
            goal.requestCount,
        },

        bigBalls: {
          matchId:
            bigBalls.providerMatchId,

          requests:
            bigBalls.requestCount,
        },
      },

      preview,

      identityResolution: {
        resolved:
          previewResolved,

        unresolved:
          previewUnresolved.length,

        unresolvedIdentities:
          previewUnresolved,
      },

      persisted:
        false,
    };
  }

  const result =
    await db.transaction(
      async (tx) => {
        const orm =
          tx.orm;

        const counts =
          emptySyncCounts();

        const goalSource =
          await ensureDataSource(
            orm,
            RICH_DATA_SOURCES.goal,
            counts,
          );

        const bigBallsSource =
          await ensureDataSource(
            orm,
            RICH_DATA_SOURCES.bigBalls,
            counts,
          );

        await ensureDataSource(
          orm,
          RICH_DATA_SOURCES.statsHawk,
          counts,
        );

        const goalSides =
          [
            {
              side:
                goal.home,

              teamId:
                match.homeTeamId,
            },

            {
              side:
                goal.away,

              teamId:
                match.awayTeamId,
            },
          ];

        await ensureMapping(
          orm,
          counts,
          {
            dataSourceId:
              goalSource.id,

            entityType:
              "match",

            internalId:
              match.id,

            providerId:
              goal.providerMatchId,

            metadata: {
              ownership: [
                "lineups",
                "scoring_events",
                "team_statistics",
              ],
            },
          },
        );

        for (
          const side
          of goalSides
        ) {
          await ensureMapping(
            orm,
            counts,
            {
              dataSourceId:
                goalSource.id,

              entityType:
                "team",

              internalId:
                side.teamId,

              providerId:
                side.side.providerTeamId,
            },
          );
        }

        const resolvedGoalPlayers: GoalResolvedPlayer[] =
          [];

        for (
          const {
            side,
            teamId,
          }
          of goalSides
        ) {
          for (
            const player
            of side.players
          ) {
            resolvedGoalPlayers.push(
              await ensureGoalPlayer(
                orm,
                counts,
                goalSource.id,
                match.seasonId,
                teamId,
                side.providerTeamId,
                player,
                resolvedGoalPlayers,
              ),
            );
          }
        }

        const barcelonaTeamId =
          match.awayTeam.isBarcelona
            ? match.awayTeamId
            : match.homeTeamId;

        for (
          const resolved
          of resolvedGoalPlayers.filter(
            (player) =>
              player.teamId ===
              barcelonaTeamId,
          )
        ) {
          const existing =
            await orm.public.SquadMembership
              .where({
                seasonId:
                  match.seasonId,

                teamId:
                  resolved.teamId,

                playerId:
                  resolved.playerId,
              })
              .first();

          const membershipData =
            {
              shirtNumber:
                resolved.player.shirtNumber ??
                existing?.shirtNumber ??
                null,

              position:
                resolved.player.primaryPosition !==
                "unknown"
                  ? resolved.player.primaryPosition
                  : existing?.position ??
                    "unknown",

              isCaptain:
                existing?.isCaptain ??
                false,
            };

          await ensureSimpleRow(
            counts.squadMemberships,
            existing,
            membershipData,

            () =>
              orm.public.SquadMembership.create({
                seasonId:
                  match.seasonId,

                teamId:
                  resolved.teamId,

                playerId:
                  resolved.playerId,

                ...membershipData,
              }),

            () =>
              orm.public.SquadMembership
                .where({
                  id:
                    existing!.id,
                })
                .update(
                  membershipData,
                ),
          );
        }

        await ensureLineupSide(
          orm,
          counts,
          match.id,
          match.homeTeamId,
          goal.home,
          resolvedGoalPlayers,
        );

        await ensureLineupSide(
          orm,
          counts,
          match.id,
          match.awayTeamId,
          goal.away,
          resolvedGoalPlayers,
        );

        const goalPlayerByProviderKey =
          new Map<
            string,
            GoalResolvedPlayer
          >();

        for (
          const resolved
          of resolvedGoalPlayers
        ) {
          goalPlayerByProviderKey.set(
            resolved.player.providerId,
            resolved,
          );

          if (
            resolved.player.legacyEventKey
          ) {
            goalPlayerByProviderKey.set(
              resolved.player.legacyEventKey,
              resolved,
            );
          }
        }

        for (
          const [
            index,
            event,
          ]
          of goal.events.entries()
        ) {
          const teamId =
            event.side ===
            "home"
              ? match.homeTeamId
              : match.awayTeamId;

          const scorer =
            event.scorerProviderKey
              ? goalPlayerByProviderKey.get(
                  event.scorerProviderKey,
                )
              : resolvedGoalPlayers.find(
                  (candidate) =>
                    candidate.teamId ===
                      teamId &&
                    event.scorerName &&
                    normalizedPersonName(
                      candidate.player.name,
                    ) ===
                      normalizedPersonName(
                        event.scorerName,
                      ),
                );

          const assist =
            event.assistProviderKey
              ? goalPlayerByProviderKey.get(
                  event.assistProviderKey,
                )
              : resolvedGoalPlayers.find(
                  (candidate) =>
                    candidate.teamId ===
                      teamId &&
                    event.assistName &&
                    normalizedPersonName(
                      candidate.player.name,
                    ) ===
                      normalizedPersonName(
                        event.assistName,
                      ),
                );

          if (!scorer) {
            throw new Error(
              `Could not resolve GOAL scorer for event ${event.providerId}.`,
            );
          }

          const mapping =
            await orm.public.ProviderMapping
              .where({
                dataSourceId:
                  goalSource.id,

                entityType:
                  "event",

                providerId:
                  event.providerId,
              })
              .first();

          const existing =
            mapping
              ? await orm.public.MatchEvent
                  .where({
                    id:
                      mapping.internalId,
                  })
                  .first()
              : null;

          const eventData =
            {
              matchId:
                match.id,

              teamId,

              primaryPlayerId:
                scorer.playerId,

              relatedPlayerId:
                assist?.playerId ??
                null,

              dataSourceId:
                goalSource.id,

              type:
                event.type,

              period:
                event.minute !==
                  null &&
                event.minute >
                  45
                  ? 2
                  : 1,

              minute:
                event.minute,

              second:
                null,

              eventOrder:
                index + 1,

              xG:
                null,

              outcome:
                "goal",

              sequenceId:
                `goal-api:${event.providerId}`,

              coordinateSystem:
                null,

              confidence:
                "exact_provider" as const,

              rawData: {
                providerEventId:
                  event.providerId,

                scorerName:
                  event.scorerName,

                scorerProviderKey:
                  event.scorerProviderKey,

                assistName:
                  event.assistName,

                assistProviderKey:
                  event.assistProviderKey,

                homeScore:
                  event.homeScore,

                awayScore:
                  event.awayScore,
              },
            };

          const stored =
            await ensureSimpleRow(
              counts.events,
              existing,
              eventData,

              () =>
                orm.public.MatchEvent.create(
                  eventData,
                ),

              () =>
                orm.public.MatchEvent
                  .where({
                    id:
                      existing!.id,
                  })
                  .update(
                    eventData,
                  ),
            );

          await ensureMapping(
            orm,
            counts,
            {
              dataSourceId:
                goalSource.id,

              entityType:
                "event",

              internalId:
                stored.id as string,

              providerId:
                event.providerId,
            },
          );
        }

        for (
          const [
            teamId,
            statistic,
          ]
          of [
            [
              match.homeTeamId,
              goal.statistics.home,
            ],

            [
              match.awayTeamId,
              goal.statistics.away,
            ],
          ] as const
        ) {
          const existing =
            await orm.public.MatchStatistic
              .where({
                matchId:
                  match.id,

                teamId,
              })
              .first();

          if (
            existing?.dataSourceId &&
            existing.dataSourceId !==
              goalSource.id
          ) {
            throw new Error(
              `Team statistic ownership conflict for team ${teamId}.`,
            );
          }

          const data = {
            dataSourceId:
              goalSource.id,

            possession:
              statistic.possession,

            shots:
              statistic.shots,

            shotsOnTarget:
              statistic.shotsOnTarget,

            shotsOffTarget:
              statistic.shotsOffTarget,

            blockedShots:
              statistic.blockedShots,

            shotsInsideBox:
              statistic.shotsInsideBox,

            shotsOutsideBox:
              statistic.shotsOutsideBox,

            xG:
              null,

            passes:
              statistic.passes,

            completedPasses:
              statistic.completedPasses,

            passAccuracy:
              statistic.passAccuracy,

            corners:
              statistic.corners,

            fouls:
              statistic.fouls,

            offsides:
              statistic.offsides,

            yellowCards:
              statistic.yellowCards,

            redCards:
              statistic.redCards,

            saves:
              statistic.saves,

            attacks:
              statistic.attacks,

            dangerousAttacks:
              statistic.dangerousAttacks,

            freeKicks:
              statistic.freeKicks,

            goalKicks:
              statistic.goalKicks,

            throwIns:
              statistic.throwIns,

            substitutions:
              statistic.substitutions,

            rawData: {
              provider:
                "goal-api",

              fullTime:
                statistic.raw,
            },
          };

          await ensureSimpleRow(
            counts.teamStatistics,
            existing,
            data,

            () =>
              orm.public.MatchStatistic.create({
                matchId:
                  match.id,

                teamId,

                ...data,
              }),

            () =>
              orm.public.MatchStatistic
                .where({
                  id:
                    existing!.id,
                })
                .update(
                  data,
                ),
          );
        }

        const bigBallsTeams =
          new Map([
            [
              bigBalls.homeTeamProviderId,
              match.homeTeamId,
            ],

            [
              bigBalls.awayTeamProviderId,
              match.awayTeamId,
            ],
          ]);

        for (
          const [
            providerId,
            teamId,
          ]
          of bigBallsTeams
        ) {
          await ensureMapping(
            orm,
            counts,
            {
              dataSourceId:
                bigBallsSource.id,

              entityType:
                "team",

              internalId:
                teamId,

              providerId,
            },
          );
        }

        const unresolved: UnresolvedIdentity[] =
          [];

        for (
          const statistic
          of bigBalls.players
        ) {
          const teamId =
            bigBallsTeams.get(
              statistic.teamProviderId,
            );

          if (!teamId) {
            unresolved.push({
              providerId:
                statistic.providerId,

              name:
                statistic.name,

              teamProviderId:
                statistic.teamProviderId,

              shirtNumber:
                statistic.shirtNumber,

              position:
                statistic.position,

              reason:
                "team_identity_not_resolved",
            });

            continue;
          }

          const identity =
            await resolveBigBallsPlayer(
              orm,
              bigBallsSource.id,
              statistic,
              teamId,
              resolvedGoalPlayers,
            );

          if (
            !identity.resolved ||
            !identity.method
          ) {
            unresolved.push({
              providerId:
                statistic.providerId,

              name:
                statistic.name,

              teamProviderId:
                statistic.teamProviderId,

              shirtNumber:
                statistic.shirtNumber,

              position:
                statistic.position,

              reason:
                "no_unique_safe_player_match",
            });

            continue;
          }

          await ensureMapping(
            orm,
            counts,
            {
              dataSourceId:
                bigBallsSource.id,

              entityType:
                "player",

              internalId:
                identity.resolved.playerId,

              providerId:
                statistic.providerId,

              metadata: {
                identityMethod:
                  identity.method,
              },
            },
          );

          const existing =
            await orm.public.PlayerMatchStatistic
              .where({
                matchId:
                  match.id,

                playerId:
                  identity.resolved.playerId,
              })
              .first();

          if (
            existing?.dataSourceId &&
            existing.dataSourceId !==
              bigBallsSource.id
          ) {
            throw new Error(
              `Player statistic ownership conflict for player ${identity.resolved.playerId}.`,
            );
          }

          const data = {
            teamId,

            dataSourceId:
              bigBallsSource.id,

            minutes:
              statistic.minutes,

            goals:
              statistic.goals,

            assists:
              statistic.assists,

            shots:
              statistic.shots,

            shotsOnTarget:
              statistic.shotsOnTarget,

            xG:
              null,

            xA:
              null,

            passes:
              statistic.passes,

            completedPasses:
              statistic.completedPasses,

            passAccuracy:
              statistic.passAccuracy,

            keyPasses:
              statistic.keyPasses,

            tackles:
              statistic.tackles,

            blocks:
              statistic.blocks,

            interceptions:
              statistic.interceptions,

            duelsWon:
              statistic.duelsWon,

            duelsTotal:
              statistic.duelsTotal,

            dribblesAttempted:
              statistic.dribblesAttempted,

            successfulDribbles:
              statistic.successfulDribbles,

            fouls:
              statistic.fouls,

            yellowCards:
              statistic.yellowCards,

            redCards:
              statistic.redCards,

            saves:
              statistic.saves,

            goalsConceded:
              null,

            cleanSheet:
              null,

            rating:
              statistic.rating,

            rawData: {
              provider:
                "big-balls-data",

              providerPlayerId:
                statistic.providerId,

              identityMethod:
                identity.method,

              rawStatistics:
                statistic.raw,
            },
          };

          await ensureSimpleRow(
            counts.playerStatistics,
            existing,
            data,

            () =>
              orm.public.PlayerMatchStatistic.create({
                matchId:
                  match.id,

                playerId:
                  identity.resolved!.playerId,

                ...data,
              }),

            () =>
              orm.public.PlayerMatchStatistic
                .where({
                  id:
                    existing!.id,
                })
                .update(
                  data,
                ),
          );
        }

        unresolved.sort(
          (
            left,
            right,
          ) =>
            left.providerId.localeCompare(
              right.providerId,
            ),
        );

        await ensureMapping(
          orm,
          counts,
          {
            dataSourceId:
              bigBallsSource.id,

            entityType:
              "match",

            internalId:
              match.id,

            providerId:
              bigBalls.providerMatchId,

            metadata: {
              ownership: [
                "player_match_statistics",
                "ratings",
              ],

              richerTeamStatistics:
                bigBalls.teamStatistics,

              unresolvedPlayerIdentities:
                unresolved,
            },
          },
        );

        return {
          counts,
          unresolved,
        };
      },
    );

  return {
    dryRun:
      false,

    matchId:
      match.id,

    providers: {
      goal: {
        matchId:
          goal.providerMatchId,

        requests:
          goal.requestCount,
      },

      bigBalls: {
        matchId:
          bigBalls.providerMatchId,

        requests:
          bigBalls.requestCount,
      },
    },

    preview,

    persisted:
      true,

    counts:
      result.counts,

    unresolvedIdentities:
      result.unresolved,
  };
}