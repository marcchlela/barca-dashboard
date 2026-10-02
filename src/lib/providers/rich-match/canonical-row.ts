import "server-only";

function asObject(
  value: unknown,
):
  | Record<string, unknown>
  | null {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  return value as Record<
    string,
    unknown
  >;
}

/*
 * Canonical player statistics are the final merged product of
 * Big Balls + StatsHawk.
 *
 * Once a Barça PlayerMatchStatistic contains canonicalMerge
 * provenance, lower-level provider syncs must not overwrite it.
 *
 * The canonical persistence layer remains responsible for
 * refreshing that row after all provider reads have completed.
 */
export function hasCanonicalPlayerMerge(
  rawData: unknown,
) {
  const root =
    asObject(
      rawData,
    );

  if (!root) {
    return false;
  }

  const canonicalMerge =
    asObject(
      root.canonicalMerge,
    );

  return canonicalMerge !==
    null;
}