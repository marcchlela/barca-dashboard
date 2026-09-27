import "server-only";

import { db } from "../../../prisma/db";

type Orm =
  typeof db.orm;

type GoalEventRow = {
  id: string;

  eventOrder:
    number | null;

  createdAt: {
    toString():
      string;
  };
};

function eventSort(
  left:
    GoalEventRow,

  right:
    GoalEventRow,
) {
  const created =
    left.createdAt
      .toString()
      .localeCompare(
        right.createdAt
          .toString(),
      );

  if (
    created !== 0
  ) {
    return created;
  }

  return left.id.localeCompare(
    right.id,
  );
}

/*
 * GOAL owns the complete scoring-event set for matches where
 * it has verified coverage.
 *
 * We observed historical duplicate rows where the provider's
 * event ID changed between syncs while the football event
 * itself remained identical.
 *
 * eventOrder is assigned from GOAL's chronological scoring
 * feed and represents the canonical scoring slot:
 *
 *   1 = first goal
 *   2 = second goal
 *   ...
 *
 * There must therefore be exactly one GOAL-owned MatchEvent
 * for each eventOrder.
 *
 * When duplicates exist:
 *
 * - preserve the oldest internal MatchEvent UUID
 * - repoint every GOAL ProviderMapping to that keeper
 * - repoint MatchDiaryEntry favourite-goal references
 * - delete only the redundant MatchEvent
 *
 * Keeping the oldest internal row prevents provider-ID churn
 * from changing our canonical internal event identity.
 */
export async function dedupeGoalScoringEvents(
  orm:
    Orm,

  input: {
    matchId:
      string;

    dataSourceId:
      string;
  },
) {
  const events =
    await orm.public.MatchEvent
      .where({
        matchId:
          input.matchId,

        dataSourceId:
          input.dataSourceId,
      })
      .all();

  const byOrder =
    new Map<
      number,
      GoalEventRow[]
    >();

  for (
    const event
    of events
  ) {
    if (
      event.eventOrder ===
      null
    ) {
      throw new Error(
        `GOAL MatchEvent ${event.id} for match ${input.matchId} has no eventOrder.`,
      );
    }

    const group =
      byOrder.get(
        event.eventOrder,
      ) ?? [];

    group.push(
      event,
    );

    byOrder.set(
      event.eventOrder,
      group,
    );
  }

  let duplicateGroups =
    0;

  let eventsDeleted =
    0;

  let mappingsRepointed =
    0;

  let diaryReferencesRepointed =
    0;

  const reconciledOrders:
    Array<{
      eventOrder:
        number;

      keeperEventId:
        string;

      removedEventIds:
        string[];
    }> = [];

  for (
    const [
      eventOrder,
      group,
    ]
    of byOrder
  ) {
    if (
      group.length <= 1
    ) {
      continue;
    }

    duplicateGroups +=
      1;

    const ordered =
      [...group].sort(
        eventSort,
      );

    const keeper =
      ordered[0];

    const duplicates =
      ordered.slice(
        1,
      );

    const removedEventIds:
      string[] = [];

    for (
      const duplicate
      of duplicates
    ) {
      /*
       * Preserve user diary relationships before removing
       * the redundant event row.
       */
      const diaryEntries =
        await orm.public.MatchDiaryEntry
          .where({
            favouriteGoalEventId:
              duplicate.id,
          })
          .all();

      for (
        const diary
        of diaryEntries
      ) {
        const updated =
          await orm.public.MatchDiaryEntry
            .where({
              id:
                diary.id,
            })
            .update({
              favouriteGoalEventId:
                keeper.id,
            });

        if (!updated) {
          throw new Error(
            `MatchDiaryEntry ${diary.id} disappeared while reconciling GOAL event duplicates.`,
          );
        }

        diaryReferencesRepointed +=
          1;
      }

      /*
       * Provider IDs may have changed across provider
       * snapshots. Preserve every known provider mapping,
       * but point all of them to the same canonical event.
       */
      const mappings =
        await orm.public.ProviderMapping
          .where({
            dataSourceId:
              input.dataSourceId,

            entityType:
              "event",

            internalId:
              duplicate.id,
          })
          .all();

      for (
        const mapping
        of mappings
      ) {
        const updated =
          await orm.public.ProviderMapping
            .where({
              id:
                mapping.id,
            })
            .update({
              internalId:
                keeper.id,
            });

        if (!updated) {
          throw new Error(
            `ProviderMapping ${mapping.id} disappeared while reconciling GOAL event duplicates.`,
          );
        }

        mappingsRepointed +=
          1;
      }

      const deleted =
        await orm.public.MatchEvent
          .where({
            id:
              duplicate.id,
          })
          .delete();

      if (!deleted) {
        throw new Error(
          `Duplicate GOAL MatchEvent ${duplicate.id} disappeared before it could be deleted.`,
        );
      }

      removedEventIds.push(
        duplicate.id,
      );

      eventsDeleted +=
        1;
    }

    reconciledOrders.push({
      eventOrder,

      keeperEventId:
        keeper.id,

      removedEventIds,
    });
  }

  /*
   * Verify the database invariant before the transaction is
   * allowed to complete.
   */
  const remaining =
    await orm.public.MatchEvent
      .where({
        matchId:
          input.matchId,

        dataSourceId:
          input.dataSourceId,
      })
      .all();

  const remainingOrders =
    new Set<number>();

  for (
    const event
    of remaining
  ) {
    if (
      event.eventOrder ===
      null
    ) {
      throw new Error(
        `GOAL MatchEvent ${event.id} still has no eventOrder after reconciliation.`,
      );
    }

    if (
      remainingOrders.has(
        event.eventOrder,
      )
    ) {
      throw new Error(
        `GOAL scoring-event reconciliation failed: eventOrder ${event.eventOrder} still has multiple rows for match ${input.matchId}.`,
      );
    }

    remainingOrders.add(
      event.eventOrder,
    );
  }

  return {
    before:
      events.length,

    after:
      remaining.length,

    duplicateGroups,

    eventsDeleted,

    mappingsRepointed,

    diaryReferencesRepointed,

    reconciledOrders,
  };
}