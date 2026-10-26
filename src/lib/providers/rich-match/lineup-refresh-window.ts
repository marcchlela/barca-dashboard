const BEFORE_KICKOFF_MS = 150 * 60_000;
const AFTER_KICKOFF_MS = 4 * 60 * 60_000;

/** Keep checking a missing confirmed XI throughout a live fixture, even if
 * the canonical status is still scheduled because the score feed is delayed. */
export function lineupRefreshWindow(status: string, kickoff: string, now: number) {
  if (!["scheduled", "live", "halftime", "extra_time", "penalties"].includes(status)) return false;
  const untilKickoff = Date.parse(kickoff) - now;
  return Number.isFinite(untilKickoff) && untilKickoff <= BEFORE_KICKOFF_MS && untilKickoff >= -AFTER_KICKOFF_MS;
}

/** A provider can expose the fixture before it publishes both complete XIs.
 * That is an expected pending state, not a failed synchronization attempt. */
export function lineupNotPublishedYet(error: string) {
  if (/(?:^|\D)(?:403|429)(?:\D|$)/.test(error)) return false;
  return /(?:GOAL|Highlightly) returned \d+ (?:home|away) starters; expected 11\./i.test(error) ||
    /(?:GOAL|Highlightly) did not supply exactly 11 starters for both sides\./i.test(error) ||
    /needed starting XI is not published yet|no explicitly confirmed starting XI published|no confirmed XI published for the needed side/i.test(error);
}
