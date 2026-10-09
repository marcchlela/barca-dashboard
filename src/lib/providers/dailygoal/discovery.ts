import "server-only";

import { db } from "../../../prisma/db";
import { discoverBarcelonaMatchLinks, fetchDailyGoalFixture } from "./adapter";
import { applyDailyGoalImport, previewDailyGoalImport } from "./import";
import { dueForDiscovery, duplicateFixtureIds, resolveFixture, type CanonicalFixture, type DiscoveryRetryState } from "./match";

const MAX_MATCH_PAGES = 12;

/** Recent finished games only; the authenticated job invokes this through the flagged worker. */
export function backgroundEligibleFixtures(fixtures: CanonicalFixture[], states: ReadonlyMap<string, DiscoveryRetryState>, now = Date.now(), lookbackDays = 14) {
  return fixtures.filter((fixture) => dueForDiscovery(fixture.kickoff, now, states.get(fixture.id) ?? null, lookbackDays));
}

export async function discoverDailyGoalMatches(input: { mode: "preview" | "apply"; preRoll: number; scope?: "season" | "recent"; retryStates?: ReadonlyMap<string, DiscoveryRetryState>; eligibleMatchIds?: ReadonlySet<string>; skipUrls?: ReadonlySet<string> }) {
  if (!Number.isInteger(input.preRoll) || input.preRoll < 0 || input.preRoll > 10) throw new Error("Pre-roll must be 0–10 seconds.");
  const season = await db.orm.public.Season.where({ isCurrent: true }).first();
  if (!season) throw new Error("No current season exists.");
  const matches = await db.orm.public.Match.where({ seasonId: season.id, status: "finished" }).include("homeTeam").include("awayTeam").include("competition").orderBy((match) => match.kickoff.desc()).all();
  const fixtures: CanonicalFixture[] = matches.filter((match) => match.homeTeam.isBarcelona || match.awayTeam.isBarcelona).map((match) => ({
    id: match.id, kickoff: match.kickoff.toString(), home: match.homeTeam.name, away: match.awayTeam.name,
    competition: match.competition.code, homeScore: match.homeScore, awayScore: match.awayScore,
  }));
  const eligible = input.eligibleMatchIds ? fixtures.filter((fixture) => input.eligibleMatchIds!.has(fixture.id)) : input.scope === "recent" ? backgroundEligibleFixtures(fixtures, input.retryStates ?? new Map()) : fixtures;
  const links = await discoverBarcelonaMatchLinks();
  const skippedCached = links.filter((url) => input.skipUrls?.has(url)).length;
  const inspectedLinks = links.filter((url) => !input.skipUrls?.has(url)).slice(0, MAX_MATCH_PAGES);
  const results: Array<{
    url: string; status: "matched" | "missing-video" | "ambiguous" | "rejected" | "unavailable";
    reason: string; matchId: string | null; fixture: string | null; canonicalFixture: string | null; date: string | null;
    competition: string | null; videoId: string | null; officialFilm: boolean;
    accepted: number; review: number; rejected: number;
    published: number; preserved: number; queued: number;
  }> = [];
  const prepared = new Map<string, Awaited<ReturnType<typeof previewDailyGoalImport>>>();
  let stopped = false;
  for (const url of inspectedLinks) {
    try {
      const source = await fetchDailyGoalFixture(url);
      const resolved = resolveFixture(source, eligible);
      if (resolved.status !== "matched" || !resolved.fixture) {
        results.push({ url, status: resolved.status, reason: resolved.reason, matchId: null, canonicalFixture: null,
          fixture: `${source.home} ${source.homeScore}-${source.awayScore} ${source.away}`,
          date: source.date, competition: source.competition, videoId: null, officialFilm: false,
          accepted: 0, review: 0, rejected: 0, published: 0, preserved: 0, queued: 0 });
        continue;
      }
      let preview: Awaited<ReturnType<typeof previewDailyGoalImport>>;
      try {
        preview = await previewDailyGoalImport(url, input.preRoll);
      } catch (error) {
        const reason = error instanceof Error ? error.message : "Goal metadata could not be inspected.";
        const missingVideo = /VideoObject|YouTube metadata is incomplete|goal clips were published/i.test(reason);
        results.push({ url, status: missingVideo ? "missing-video" : "unavailable", reason, matchId: resolved.fixture.id,
          canonicalFixture: `${resolved.fixture.home} ${resolved.fixture.homeScore}-${resolved.fixture.awayScore} ${resolved.fixture.away}`,
          fixture: `${source.home} ${source.homeScore}-${source.awayScore} ${source.away}`,
          date: source.date, competition: source.competition, videoId: null, officialFilm: false,
          accepted: 0, review: 0, rejected: 0, published: 0, preserved: 0, queued: 0 });
        if (/403|429|importing stopped/i.test(reason)) { stopped = true; break; }
        continue;
      }
      // This is the existing importer, including its official-film check and goal matcher.
      if (resolved.status === "matched" && resolved.fixture) {
        prepared.set(url, preview);
      }
      results.push({ url, status: resolved.status, reason: resolved.reason, matchId: resolved.fixture?.id ?? null,
        canonicalFixture: `${resolved.fixture.home} ${resolved.fixture.homeScore}-${resolved.fixture.awayScore} ${resolved.fixture.away}`,
        fixture: `${preview.source.home} ${preview.source.homeScore}–${preview.source.awayScore} ${preview.source.away}`,
        date: preview.source.date, competition: preview.source.competition, videoId: preview.source.videoId,
        officialFilm: Boolean(preview.mediaItem), accepted: resolved.status === "matched" ? preview.summary.accepted : 0,
        review: resolved.status === "matched" ? preview.summary.review : 0, rejected: resolved.status === "matched" ? preview.summary.rejected : preview.source.clips.length,
        published: 0, preserved: 0, queued: 0 });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "DailyGoal page could not be inspected.";
      results.push({ url, status: "unavailable", reason, matchId: null, fixture: null, canonicalFixture: null, date: null,
        competition: null, videoId: null, officialFilm: false, accepted: 0, review: 0, rejected: 0,
        published: 0, preserved: 0, queued: 0 });
      if (/403|429|importing stopped/i.test(reason)) { stopped = true; break; }
    }
  }
  const duplicateIds = duplicateFixtureIds(results.map((result) => result.matchId));
  for (const result of results) {
    if (result.status !== "matched" || !result.matchId) continue;
    if (duplicateIds.has(result.matchId)) {
      result.status = "ambiguous";
      result.reason = "Multiple DailyGoal pages map to this canonical fixture; neither is applied.";
      result.accepted = 0;
      result.review = 0;
      continue;
    }
    if (input.mode === "apply" && !stopped) {
      try {
        const applied = (await applyDailyGoalImport(result.url, input.preRoll, prepared.get(result.url))).applied;
        result.published = applied.published;
        result.preserved = applied.preserved;
        result.queued = applied.queued;
      } catch (error) {
        result.status = "unavailable";
        result.reason = `Apply failed; a repeat is safe: ${error instanceof Error ? error.message : "unknown error"}`;
      }
    }
  }
  const matchedIds = new Set(results.filter((result) => (result.status === "matched" || result.status === "missing-video") && result.matchId).map((result) => result.matchId));
  return {
    mode: input.mode, season: season.label, source: "https://dailygoal.tv/team/13/barcelona",
    listed: links.length, inspected: results.length, skippedCached, uninspected: links.length - results.length - skippedCached,
    stopped, results,
    missingCoverage: eligible.filter((fixture) => !matchedIds.has(fixture.id)).map((fixture) => ({
      matchId: fixture.id, fixture: `${fixture.home} ${fixture.homeScore}–${fixture.awayScore} ${fixture.away}`,
      kickoff: fixture.kickoff, competition: fixture.competition,
    })),
    totals: {
      matched: results.filter((result) => result.status === "matched").length,
      missingVideo: results.filter((result) => result.status === "missing-video").length,
      ambiguous: results.filter((result) => result.status === "ambiguous").length,
      rejected: results.filter((result) => result.status === "rejected").length,
      unavailable: results.filter((result) => result.status === "unavailable").length,
      acceptedGoals: results.reduce((sum, result) => sum + result.accepted, 0),
      reviewGoals: results.reduce((sum, result) => sum + result.review, 0),
      published: results.reduce((sum, result) => sum + result.published, 0),
      preserved: results.reduce((sum, result) => sum + result.preserved, 0),
      queued: results.reduce((sum, result) => sum + result.queued, 0),
    },
  };
}
