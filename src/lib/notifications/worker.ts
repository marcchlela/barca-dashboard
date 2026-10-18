import "server-only";

import { Temporal } from "temporal-polyfill";
import { db } from "../../prisma/db";
import { deliverNotification, queueNotification, pushConfiguration } from "./delivery";
import { formatNotificationKickoffTime, type NotificationKind } from "./catalog";
import { discoverOfficialSquad } from "./official-squad";
import { confirmedLineupNotificationDue } from "./policy";
import { liveEventSemanticKey } from "../providers/shared/live-event-identity";

const LOCK = "scheduled-notification-worker";
const GOALS = new Set(["goal", "penalty_goal", "own_goal"]);
type Snapshot = { status: string; kickoff: string; homeScore: number | null; awayScore: number | null; events: Record<string, string>; media: string[]; lineup: boolean; reminderSent: boolean; period: number | null };

function instant() { return Temporal.Instant.from(new Date().toISOString()); }
function object(value: unknown): Record<string, unknown> | null { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null; }
function snapshot(value: unknown): Snapshot | null {
  const row = object(value);
  if (!row || typeof row.status !== "string" || typeof row.kickoff !== "string" || !row.events || !Array.isArray(row.media)) return null;
  return row as Snapshot;
}
function playerName(rawData: unknown) {
  const raw = object(rawData);
  return typeof raw?.scorerName === "string" ? raw.scorerName : null;
}

function notificationEventKey(event: {
  type: string;
  teamId: string | null;
  minute: number | null;
  primaryPlayerId: string | null;
  relatedPlayerId: string | null;
  rawData: unknown;
}) {
  const raw = object(event.rawData);
  return typeof raw?.semanticKey === "string" ? raw.semanticKey : liveEventSemanticKey({
    type: event.type,
    teamId: event.teamId,
    minute: event.minute,
    primaryPlayerId: event.primaryPlayerId,
    relatedPlayerId: event.relatedPlayerId,
    primaryName: typeof raw?.scorerName === "string" ? raw.scorerName : typeof raw?.offName === "string" ? raw.offName : null,
    relatedName: typeof raw?.assistName === "string" ? raw.assistName : typeof raw?.onName === "string" ? raw.onName : null,
  });
}

export async function runNotificationWorker(now = Date.now()) {
  if (process.env.PUSH_NOTIFICATIONS_ENABLED !== "true") return { status: "disabled" as const };
  if (!pushConfiguration()) return { status: "unconfigured" as const };
  const active = await db.orm.public.GoalMediaSyncRun.where({ lockKey: LOCK }).first();
  if (active && now - Date.parse(active.startedAt.toString()) < 15 * 60_000) return { status: "already-running" as const };
  if (active) await db.orm.public.GoalMediaSyncRun.where({ id: active.id }).update({ lockKey: null, status: "interrupted", finishedAt: instant(), error: "Notification worker lease expired." });
  let run;
  try { run = await db.orm.public.GoalMediaSyncRun.create({ lockKey: LOCK, mode: "notification-worker", status: "running", startedAt: instant() }); }
  catch { return { status: "already-running" as const }; }
  let queued = 0;
  try {
    const season = await db.orm.public.Season.where({ isCurrent: true }).first();
    if (!season) throw new Error("Current season unavailable.");
    const matches = await db.orm.public.Match.where({ seasonId: season.id }).include("homeTeam").include("awayTeam").orderBy((match) => match.kickoff.asc()).all();
    const relevant = matches.filter((match) => (match.homeTeam.isBarcelona || match.awayTeam.isBarcelona) &&
      Math.abs(Date.parse(match.kickoff.toString()) - now) < 3 * 86_400_000);
    for (const match of relevant) {
      const key = `match:${match.id}`;
      const priorRow = await db.orm.public.NotificationCursor.where({ key }).first();
      const previous = snapshot(priorRow?.snapshot);
      const [events, media, lineups] = await Promise.all([
        db.orm.public.MatchEvent.where({ matchId: match.id }).include("primaryPlayer").all(),
        db.orm.public.MediaItem.where({ matchId: match.id }).include("dataSource").all(),
        db.orm.public.Lineup.where({ matchId: match.id }).include("players").all(),
      ]);
      const eventValues = Object.fromEntries(events.map((event) => [notificationEventKey(event),
        `${event.type}:${event.primaryPlayerId ?? ""}:${event.relatedPlayerId ?? ""}:${event.minute ?? ""}:${event.teamId ?? ""}:${event.outcome ?? ""}`]));
      const lineup = lineups.length >= 2 && lineups.every((row) => row.isConfirmed && row.players.filter((player) => player.role === "starter").length === 11);
      const mediaIds = media.map((item) => item.id);
      const liveRun = await db.orm.public.GoalMediaSyncRun.where({ mode: "live-match-sync" }).orderBy((row) => row.startedAt.desc()).first();
      const liveResult = object(liveRun?.result);
      const period = liveResult?.matchId === match.id && typeof liveResult.providerPeriod === "number" &&
        now - Date.parse(liveRun!.startedAt.toString()) < 10 * 60_000 ? liveResult.providerPeriod : null;
      const kickoff = match.kickoff.toString();
      const reminderDue = match.status === "scheduled" && Date.parse(kickoff) > now && Date.parse(kickoff) - now <= 30 * 60_000;
      const current: Snapshot = { status: match.status, kickoff, homeScore: match.homeScore, awayScore: match.awayScore,
        events: eventValues, media: mediaIds, lineup, reminderSent: previous?.reminderSent || reminderDue, period };
      // First observation establishes a baseline. Existing goals and media must never blast users on activation.
      const opponent = match.homeTeam.isBarcelona ? match.awayTeam.name : match.homeTeam.name;
      const values = { home: match.homeTeam.name, away: match.awayTeam.name, opponent,
        homeScore: String(match.homeScore ?? "–"), awayScore: String(match.awayScore ?? "–"),
        kickoff: new Date(kickoff).toLocaleString("en-GB", { timeZone: "Asia/Beirut", dateStyle: "medium", timeStyle: "short" }),
        kickoffTime: formatNotificationKickoffTime(kickoff) };
      const url = `/matches/${match.id}`;
      const emit = async (kind: NotificationKind, suffix: string, more: Record<string, string> = {}, iconUrl?: string | null) => {
        const result = await queueNotification({ key: `${kind}:${match.id}:${suffix}`, kind, matchId: match.id, values: { ...values, ...more }, url, iconUrl });
        if (result.created) queued += 1;
      };
      if (reminderDue && !previous?.reminderSent) await emit("match_reminder", kickoff);
      if (match.status === "scheduled" && Date.parse(kickoff) - now < 3 * 86_400_000 && Date.parse(kickoff) > now) {
        const article = await discoverOfficialSquad({ matchId: match.id, opponent, kickoff, now });
        if (article) {
          const result = await queueNotification({ key: `official_squad:${match.id}:${article.url}`, kind: "official_squad",
            matchId: match.id, values, url: article.url });
          if (result.created) queued += 1;
        }
      }
      if (previous) {
        if (previous.kickoff !== kickoff && match.status === "scheduled") await emit("kickoff_changed", kickoff);
        if (previous.status !== match.status) {
          if (match.status === "live" && previous.status === "scheduled") await emit("kickoff", "started");
          if (match.status === "halftime") await emit("halftime", "halftime");
          if (match.status === "finished") await emit("fulltime", "fulltime");
          if (match.status === "cancelled" || match.status === "postponed") await emit("fixture_cancelled", match.status, { status: match.status });
        }
        if (confirmedLineupNotificationDue({ previousLineup: previous.lineup, currentLineup: lineup,
          status: match.status, kickoff, now })) await emit("confirmed_lineup", "confirmed");
        if (period === 2 && previous.period !== 2 && ["live", "halftime"].includes(previous.status)) await emit("second_half", "started");
        const scoreReduced = (match.homeScore !== null && previous.homeScore !== null && match.homeScore < previous.homeScore) ||
          (match.awayScore !== null && previous.awayScore !== null && match.awayScore < previous.awayScore);
        const correctionKey = `score:${match.homeScore ?? "?"}-${match.awayScore ?? "?"}`;
        if (scoreReduced) await emit("goal_corrected", correctionKey);
        for (const event of events) {
          const semanticKey = notificationEventKey(event);
          const before = previous.events[semanticKey];
          const after = eventValues[semanticKey];
          if (before && before !== after && GOALS.has(event.type)) { await emit("goal_corrected", correctionKey); continue; }
          if (before || event.confidence === "unknown" || now - Date.parse(event.createdAt.toString()) > 30 * 60_000) continue;
          const barcaEvent = event.teamId === (match.homeTeam.isBarcelona ? match.homeTeamId : match.awayTeamId);
          const extraType = object(event.rawData)?.notificationType;
          const kind: NotificationKind | null = extraType === "penalty_awarded" ? "penalty_awarded" : extraType === "var_overturned" ? "goal_corrected" :
            event.type === "missed_penalty" ? "penalty_missed" : event.type === "own_goal" ? "own_goal" : event.type === "penalty_goal" ? "penalty_scored" :
            event.type === "goal" ? (barcaEvent ? "barca_goal" : "opponent_goal") :
            event.type === "red_card" ? (barcaEvent ? "barca_red" : "opponent_red") : null;
          if (!kind) continue;
          const name = event.primaryPlayer?.displayName ?? playerName(event.rawData);
          const icon = event.primaryPlayer?.portraitUrl ?? null;
          await emit(kind, kind === "goal_corrected" ? correctionKey : semanticKey, { player: name ?? (barcaEvent ? "Barça scorer not confirmed" : "Scorer not confirmed"),
            minute: event.minute === null ? "?" : String(event.minute), team: barcaEvent ? "Barça" : opponent }, icon);
        }
        for (const item of media) {
          if (previous.media.includes(item.id) || item.type !== "match_highlight") continue;
          if (item.isOfficial) await emit("official_highlights", item.id);
          else if (item.dataSource?.code === "bein-sports-mena") await emit("bein_highlights", item.id);
        }
      }
      if (priorRow) await db.orm.public.NotificationCursor.where({ key }).update({ snapshot: current });
      else await db.orm.public.NotificationCursor.create({ key, snapshot: current });
      const age = now - Date.parse(kickoff);
      if (match.status === "finished" && age > 30 * 60_000 && age < 48 * 3_600_000) {
        const expected = (match.homeScore ?? 0) + (match.awayScore ?? 0);
        const covered = events.filter((event) => GOALS.has(event.type)).length;
        if (expected > covered) {
          const result = await queueNotification({ key: `fixture_incomplete:${match.id}`, kind: "fixture_incomplete",
            values: { detail: `${match.homeTeam.name} vs ${match.awayTeam.name}: ${covered} of ${expected} goal events recorded.` },
            url: `/admin/sync`, matchId: match.id });
          if (result.created) queued += 1;
        }
      }
    }
    queued += await scanAdminNotifications();
    // Retry temporary push-service failures even after the fixture cursor advances.
    const failedDeliveries = await db.orm.public.NotificationDelivery.where({ status: "failed" })
      .orderBy((row) => row.createdAt.desc()).limit(100).all();
    for (const eventId of new Set(failedDeliveries.map((row) => row.eventId))) await deliverNotification(eventId);
    await db.orm.public.GoalMediaSyncRun.where({ id: run.id }).update({ lockKey: null, status: "success", finishedAt: instant(), result: { matchesChecked: relevant.length, queued } });
    return { status: "success" as const, matchesChecked: relevant.length, queued };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    await db.orm.public.GoalMediaSyncRun.where({ id: run.id }).update({ lockKey: null, status: "failed", finishedAt: instant(), error: detail.slice(0, 500) });
    return { status: "failed" as const, error: detail.slice(0, 500), queued };
  }
}

async function scanAdminNotifications() {
  let queued = 0;
  const runs = await db.orm.public.GoalMediaSyncRun.orderBy((row) => row.startedAt.desc()).limit(120).all();
  const latest = new Map<string, (typeof runs)[number]>();
  for (const row of runs) {
    if (row.mode === "notification-worker" || row.status === "running") continue;
    if (!latest.has(row.mode)) latest.set(row.mode, row);
    if (latest.size > 40) break;
  }
  for (const [mode, run] of latest) {
    const key = `job:${mode}`;
    const prior = await db.orm.public.NotificationCursor.where({ key }).first();
    const before = object(prior?.snapshot);
    let failureStreak = Number(before?.failureStreak ?? 0);
    let alerted = before?.alerted === true;
    if (before?.id !== run.id && before) {
      const failed = ["failed", "blocked", "partial", "interrupted"].includes(run.status);
      const wasFailed = ["failed", "blocked", "partial", "interrupted"].includes(String(before.status));
      failureStreak = failed ? (wasFailed ? Math.max(1, Number(before.failureStreak ?? 1)) + 1 : 1) : 0;
      const recovered = alerted && run.status === "success";
      const shouldAlertFailure = failed && !alerted && (run.status === "blocked" || failureStreak >= 2);
      const kind: NotificationKind | null = recovered ? "worker_recovered" : shouldAlertFailure
        ? (run.status === "blocked" ? "provider_blocked" : "sync_failed") : null;
      if (kind) {
        const result = await queueNotification({ key: `job:${run.id}:${kind}`, kind,
          values: { detail: `${mode}: ${run.error ?? run.status}` }, url: "/admin/sync" });
        if (result.created) queued += 1;
        alerted = kind !== "worker_recovered";
      }
      if (!failed) alerted = false;
    }
    const state = { id: run.id, status: run.status, failureStreak, alerted };
    if (prior) await db.orm.public.NotificationCursor.where({ key }).update({ snapshot: state });
    else await db.orm.public.NotificationCursor.create({ key, snapshot: state });
  }
  const [mediaRows, goalRows] = await Promise.all([
    db.orm.public.MediaReviewCandidate.where({ status: "pending" }).all(),
    db.orm.public.GoalTimestampCandidate.where({ status: "pending" }).all(),
  ]);
  for (const [kind, count] of [["media_review", mediaRows.length], ["goal_review", goalRows.length]] as const) {
    const key = `review:${kind}`;
    const prior = await db.orm.public.NotificationCursor.where({ key }).first();
    const before = object(prior?.snapshot);
    if (before && count > Number(before.count ?? 0) && count > 0) {
      const result = await queueNotification({ key: `${kind}:${count}:${new Date().toISOString().slice(0, 10)}`, kind,
        values: { count: String(count) }, url: "/admin/media/review" });
      if (result.created) queued += 1;
    }
    if (prior) await db.orm.public.NotificationCursor.where({ key }).update({ snapshot: { count } });
    else await db.orm.public.NotificationCursor.create({ key, snapshot: { count } });
  }
  return queued;
}
