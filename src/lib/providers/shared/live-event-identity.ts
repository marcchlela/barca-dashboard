export type LiveEventIdentityInput = {
  type: string;
  teamId: string | null;
  minute: number | null;
  primaryPlayerId?: string | null;
  relatedPlayerId?: string | null;
  primaryName?: string | null;
  relatedName?: string | null;
};

function token(value: string | null | undefined) {
  return value
    ?.normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") ?? "";
}

function eventFamily(type: string) {
  if (["goal", "penalty_goal", "own_goal"].includes(type)) return "goal";
  if (type === "other") return "decision";
  return type;
}

function participant(input: LiveEventIdentityInput, kind: "primary" | "related") {
  if (kind === "primary") {
    return input.primaryPlayerId ?? token(input.primaryName);
  }
  return input.relatedPlayerId ?? token(input.relatedName);
}

/**
 * Some live feeds republish cards and substitutions with a corrected minute
 * and a new provider event id. Treat those as corrections, while keeping goal
 * identity strict so two genuine goals by the same player are never hidden.
 */
export function liveEventsLikelySame(
  left: LiveEventIdentityInput,
  right: LiveEventIdentityInput,
) {
  const family = eventFamily(left.type);
  if (family !== eventFamily(right.type) || left.teamId !== right.teamId) return false;
  if (!left.teamId || left.minute === null || right.minute === null) return false;

  const primary = participant(left, "primary");
  if (!primary || primary !== participant(right, "primary")) return false;

  const minuteDifference = Math.abs(left.minute - right.minute);
  if (family === "red_card") return minuteDifference <= 10;
  if (family === "yellow_card") return minuteDifference <= 3;
  if (family === "substitution") {
    const related = participant(left, "related");
    return Boolean(related && related === participant(right, "related") && minuteDifference <= 5);
  }
  return false;
}

/** Stable across provider IDs so the same real-world event is stored and
 * notified once even when a feed republishes it from another endpoint. */
export function liveEventSemanticKey(input: LiveEventIdentityInput) {
  return [
    eventFamily(input.type),
    input.teamId ?? "unknown-team",
    input.minute ?? "unknown-minute",
    input.primaryPlayerId ?? (token(input.primaryName) || "unknown-player"),
    input.relatedPlayerId ?? token(input.relatedName),
  ].join(":");
}
