export const notificationKinds = [
  { id: "match_reminder", label: "30-minute match reminder", group: "Matchday", title: "Kickoff in 30 minutes", body: "{home} vs {away} starts at {kickoffTime}.", ready: true },
  { id: "official_squad", label: "Official matchday squad", group: "Matchday", title: "Barça squad announced", body: "The official squad for {opponent} is available.", ready: true },
  { id: "confirmed_lineup", label: "Starting XI and substitutes", group: "Matchday", title: "Lineups confirmed", body: "The starting XI and bench for {home} vs {away} are ready.", ready: true },
  { id: "kickoff", label: "Kickoff", group: "Matchday", title: "Kickoff: {home} vs {away}", body: "The match is underway.", ready: true },
  { id: "halftime", label: "Half-time score", group: "Matchday", title: "Half-time: {home} {homeScore}–{awayScore} {away}", body: "Open Match Center for the first-half story.", ready: true },
  { id: "second_half", label: "Second half started (when period is reported)", group: "Matchday", title: "The second half is underway", body: "{home} {homeScore}–{awayScore} {away}", ready: true },
  { id: "fulltime", label: "Full-time score", group: "Matchday", title: "Full-time: {home} {homeScore}–{awayScore} {away}", body: "Open Match Center for the result.", ready: true },
  { id: "fixture_cancelled", label: "Postponed or cancelled", group: "Matchday", title: "Fixture update: {home} vs {away}", body: "The match is {status}. Check Match Center for details.", ready: true },
  { id: "kickoff_changed", label: "Kickoff time changed", group: "Matchday", title: "Kickoff time changed", body: "{home} vs {away} is now scheduled for {kickoff}.", ready: true },
  { id: "barca_goal", label: "Barcelona goal", group: "Live", title: "GOAL! Barça score", body: "{player} · {minute}′ · {home} {homeScore}–{awayScore} {away}", ready: true },
  { id: "opponent_goal", label: "Opponent goal", group: "Live", title: "Goal for {opponent}", body: "{player} · {minute}′ · {home} {homeScore}–{awayScore} {away}", ready: true },
  { id: "own_goal", label: "Own goal", group: "Live", title: "Own goal in {home} vs {away}", body: "{player} · {minute}′ · {home} {homeScore}–{awayScore} {away}", ready: true },
  { id: "penalty_awarded", label: "Penalty awarded (if reported)", group: "Live", title: "Penalty awarded", body: "{team} have a penalty in {home} vs {away}.", ready: true },
  { id: "penalty_scored", label: "Penalty scored", group: "Live", title: "Penalty scored by {team}", body: "{player} · {minute}′ · {home} {homeScore}–{awayScore} {away}", ready: true },
  { id: "penalty_missed", label: "Penalty missed (if reported)", group: "Live", title: "Penalty missed by {team}", body: "{player} · {minute}′ · {home} {homeScore}–{awayScore} {away}", ready: true },
  { id: "goal_corrected", label: "Goal overturned or corrected (if reported)", group: "Live", title: "Goal decision updated", body: "The score or scorer in {home} vs {away} changed. Open Match Center for the latest verified result.", ready: true },
  { id: "barca_red", label: "Barcelona red card", group: "Live", title: "Red card for Barça", body: "{player} · {minute}′", ready: true },
  { id: "opponent_red", label: "Opponent red card", group: "Live", title: "Red card for {opponent}", body: "{player} · {minute}′", ready: true },
  { id: "official_highlights", label: "Official Barça highlights", group: "Media", title: "Official highlights are ready", body: "Watch Barça's highlights from {home} vs {away}.", ready: true },
  { id: "bein_highlights", label: "beIN Arabic highlights", group: "Media", title: "beIN Arabic highlights are ready", body: "Watch the Arabic commentary for {home} vs {away}.", ready: true },
  { id: "sync_failed", label: "Automatic sync failed", group: "Admin", title: "Dashboard sync failed", body: "{detail}", ready: true },
  { id: "provider_blocked", label: "Provider unavailable or rate-limited", group: "Admin", title: "Provider access interrupted", body: "{detail}", ready: true },
  { id: "fixture_incomplete", label: "Fixture/events incomplete", group: "Admin", title: "Match data needs attention", body: "{detail}", ready: true },
  { id: "media_review", label: "Media awaiting review", group: "Admin", title: "Media review needed", body: "{count} media items are waiting for review.", ready: true },
  { id: "goal_review", label: "Goal timestamps awaiting review", group: "Admin", title: "Goal timestamp review needed", body: "{count} goal timestamps are waiting for review.", ready: true },
  { id: "worker_recovered", label: "Background worker recovered", group: "Admin", title: "Dashboard sync recovered", body: "{detail}", ready: true },
] as const;

export type NotificationKind = (typeof notificationKinds)[number]["id"];
export const notificationKindIds = new Set<string>(notificationKinds.map((item) => item.id));

export function renderNotificationTemplate(template: string, values: Record<string, string>) {
  return template.replace(/\{([A-Za-z][A-Za-z0-9]*)\}/g, (match, key: string) => values[key] ?? match).slice(0, 240);
}

export function formatNotificationKickoffTime(kickoff: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Beirut",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(kickoff));
}
