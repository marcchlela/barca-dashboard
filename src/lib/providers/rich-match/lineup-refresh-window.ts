const BEFORE_KICKOFF_MS = 150 * 60_000;
const AFTER_KICKOFF_MS = 4 * 60 * 60_000;

/** Keep checking a missing confirmed XI throughout a live fixture, even if
 * the canonical status is still scheduled because the score feed is delayed. */
export function lineupRefreshWindow(status: string, kickoff: string, now: number) {
  if (!["scheduled", "live", "halftime", "extra_time", "penalties"].includes(status)) return false;
  const untilKickoff = Date.parse(kickoff) - now;
  return Number.isFinite(untilKickoff) && untilKickoff <= BEFORE_KICKOFF_MS && untilKickoff >= -AFTER_KICKOFF_MS;
}
