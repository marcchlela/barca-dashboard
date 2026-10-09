import test from "node:test";
import assert from "node:assert/strict";
import { parseDailyGoalHtml, parseDailyGoalFixtureHtml, dailyGoalUrl, parseBarcelonaMatchLinks } from "../src/lib/providers/dailygoal/adapter.ts";
import { decideGoals, dueForDiscovery, duplicateFixtureIds, findFixture, parseYouTubeDuration, resolveFixture, shouldPreserveGoalMoment } from "../src/lib/providers/dailygoal/match.ts";

const url = "https://dailygoal.tv/m/HRgVQ8cdgO5/barcelona-vs-feyenoord";
const fixture = { id: "match", kickoff: "2026-09-09T16:45:00Z", home: "FC Barcelona", away: "Feyenoord Rotterdam", competition: "CL", homeScore: 5, awayScore: 1 };
const video = { id: "XqSrz6MKVlk", title: "HIGHLIGHTS | FC BARCELONA 5 vs 1 FEYENOORD", channelId: "UC14UlmYlSNiQCBe9Eookf_A", durationSeconds: 219, embeddable: true, publishedAt: "2026-09-10T19:00:09Z" };
const goals = [
  { id: "raphinha-3", minute: 3, type: "goal", scorer: "Raphinha" },
  { id: "raphinha-57", minute: 57, type: "goal", scorer: "Raphinha" },
  { id: "yamal-77", minute: 77, type: "goal", scorer: "Lamine Yamal" },
];
const source = { url, home: "Barcelona", away: "Feyenoord", homeScore: 5, awayScore: 1, date: fixture.kickoff, competition: "UEFA Champions League", videoId: video.id, warnings: [], clips: [
  { scorer: "Raphael Dias Belloli", minute: 3, addedMinute: null, kind: "goal", startOffset: 7, permalink: `${url}?i=1` },
  { scorer: "Raphael Dias Belloli", minute: 57, addedMinute: null, kind: "goal", startOffset: 51, permalink: `${url}?i=3` },
  { scorer: "Lamine Yamal", minute: 77, addedMinute: null, kind: "goal", startOffset: 71, permalink: `${url}?i=4` },
] };
function html(match = source, clips = match.clips) {
  const event = { "@type": "SportsEvent", name: `${match.home} ${match.homeScore}-${match.awayScore} ${match.away}`, eventStatus: "https://schema.org/EventCompleted", startDate: match.date, homeTeam: { name: match.home }, awayTeam: { name: match.away }, organizer: { name: match.competition }, url };
  const object = { "@type": "VideoObject", embedUrl: `https://www.youtube.com/embed/${match.videoId}`, url, hasPart: clips.map((clip) => ({ "@type": "Clip", name: `Goal: ${clip.scorer} ${clip.minute}' - Barcelona vs Feyenoord`, startOffset: clip.startOffset, url: clip.permalink })) };
  return `<script type="application/ld+json">${JSON.stringify(event)}</script><script type="application/ld+json">${JSON.stringify(object)}</script>`;
}

test("public JSON-LD extracts distinct goals and pre-roll is applied once", () => {
  const parsed = parseDailyGoalHtml(html(), url);
  assert.equal(parsed.clips.length, 3);
  assert.equal(findFixture(parsed, [fixture])?.id, "match");
  const decisions = decideGoals(parsed, fixture, goals, video, "media");
  assert.deepEqual(decisions.map((item) => item.matchEventId), ["raphinha-3", "raphinha-57", "yamal-77"]);
  assert.deepEqual(decisions.map((item) => item.startSecond), [6, 50, 70]);
  assert.ok(decisions.every((item) => item.status === "accepted"));
});

test("wrong score/date/team cannot select a canonical fixture", () => {
  assert.equal(findFixture({ ...source, homeScore: 4 }, [fixture]), null);
  assert.equal(findFixture({ ...source, date: "2026-09-10T16:45:00Z" }, [fixture]), null);
  assert.equal(findFixture({ ...source, away: "Sevilla" }, [fixture]), null);
  assert.equal(findFixture({ ...source, competition: "La Liga" }, [fixture]), null);
});

test("public listing extracts actual match links once and rejects off-host links", () => {
  const html = `<a href="/m/HRgVQ8cdgO5/barcelona-vs-feyenoord">one</a><a href="${url}">duplicate</a><a href="https://evil.test/m/abc/barcelona-vs-feyenoord">bad</a><a href="/team/13/barcelona">team</a>`;
  assert.deepEqual(parseBarcelonaMatchLinks(html), [url]);
});

test("two distinct discovered pages for one canonical fixture block bulk publication", () => {
  assert.deepEqual([...duplicateFixtureIds(["feyenoord", "seville", "feyenoord", null])], ["feyenoord"]);
});

test("future background retries back off and never scan historical fixtures", () => {
  const now = Date.parse("2026-09-10T16:45:00Z");
  assert.equal(dueForDiscovery(fixture.kickoff, now, null), true);
  assert.equal(dueForDiscovery(fixture.kickoff, now, { attempts: 2, lastCheckedAt: "2026-09-10T15:45:00Z", complete: false }), false);
  assert.equal(dueForDiscovery(fixture.kickoff, now, { attempts: 2, lastCheckedAt: "2026-09-10T13:45:00Z", complete: false }), true);
  assert.equal(dueForDiscovery(fixture.kickoff, now, { attempts: 2, lastCheckedAt: "2026-09-10T13:45:00Z", complete: true }), false);
  assert.equal(dueForDiscovery(fixture.kickoff, now + 15 * 86_400_000, null), false);
});

test("home and away fixtures require score, competition and bounded kickoff agreement", () => {
  const away = { ...fixture, id: "away", home: "Sevilla FC", away: "FC Barcelona", homeScore: 1, awayScore: 3, competition: "PD" };
  const awaySource = { ...source, home: "Sevilla", away: "Barcelona", homeScore: 1, awayScore: 3, competition: "La Liga", date: "2026-09-09T19:45:00+03:00" };
  assert.equal(findFixture(awaySource, [away])?.id, "away");
  assert.equal(findFixture({ ...awaySource, homeScore: 2 }, [away]), null);
  assert.equal(findFixture({ ...awaySource, date: "2026-09-10T20:45:00Z" }, [away]), null);
  assert.equal(resolveFixture(awaySource, [away, { ...away, id: "duplicate" }]).status, "ambiguous");
});

test("canonical long names map to published short names only for known aliases", () => {
  const racing = { ...fixture, home: "FC Barcelona", away: "Real Racing Club de Santander", homeScore: 7, awayScore: 2, competition: "PD" };
  const rayo = { ...fixture, home: "FC Barcelona", away: "Rayo Vallecano de Madrid", homeScore: 5, awayScore: 2, competition: "PD" };
  assert.equal(findFixture({ ...source, away: "Racing Santander", homeScore: 7, awayScore: 2, competition: "La Liga" }, [racing])?.id, "match");
  assert.equal(findFixture({ ...source, away: "Rayo Vallecano", homeScore: 5, awayScore: 2, competition: "La Liga" }, [rayo])?.id, "match");
});

test("a completed fixture remains identifiable when a video has not been published", () => {
  const fixtureOnly = html().replace(/<script type="application\/ld\+json">\{"@type":"VideoObject"[\s\S]*?<\/script>/, "");
  assert.equal(parseDailyGoalFixtureHtml(fixtureOnly, url).home, "Barcelona");
  assert.throws(() => parseDailyGoalHtml(fixtureOnly, url), /VideoObject/);
});

test("duplicate scorer and minute stays in review, not auto-published", () => {
  const decisions = decideGoals(source, fixture, [...goals, { id: "extra", minute: 3, type: "goal", scorer: "Raphinha" }], video, "media");
  assert.equal(decisions[0].status, "review");
  const duplicatedClip = { ...source, clips: [source.clips[0], { ...source.clips[0], permalink: `${url}?i=9` }] };
  assert.ok(decideGoals(duplicatedClip, fixture, goals, video, "media").every((item) => item.status === "review"));
  const ambiguousName = { ...source, clips: [{ ...source.clips[2], scorer: "L. Yamal" }] };
  assert.equal(decideGoals(ambiguousName, fixture, goals, video, "media")[0].status, "review");
});

test("penalty/own-goal mismatch and absent video metadata need review", () => {
  const penalty = [{ id: "penalty", minute: 3, type: "penalty_goal", scorer: "Raphinha" }];
  assert.equal(decideGoals({ ...source, clips: [source.clips[0]] }, fixture, penalty, video, "media")[0].status, "review");
  assert.equal(decideGoals({ ...source, clips: [source.clips[0]] }, fixture, goals, null, "media")[0].status, "review");
  assert.equal(decideGoals({ ...source, clips: [source.clips[0]] }, fixture, goals, { ...video, durationSeconds: 7 }, "media")[0].status, "rejected");
});

test("malformed JSON-LD and unsafe URLs do not import", () => {
  assert.throws(() => dailyGoalUrl("https://dailygoal.tv.evil.test/m/id/a"));
  assert.throws(() => parseDailyGoalHtml("<script type='application/ld+json'>{oops</script>", url));
  const missing = html().replace("startOffset", "missingOffset");
  assert.equal(parseDailyGoalHtml(missing, url).clips.length, 2);
  const hostile = html().replace(`${url}?i=1`, "https://evil.test/goal?i=1");
  assert.equal(parseDailyGoalHtml(hostile, url).clips.length, 2);
});

test("explicit penalty and own-goal markers retain their canonical type", () => {
  const marked = html().replace("Goal: Raphael Dias Belloli 3'", "Own Goal: Raphael Dias Belloli 3'").replace("Goal: Raphael Dias Belloli 57'", "Penalty Goal: Raphael Dias Belloli 57'");
  assert.deepEqual(parseDailyGoalHtml(marked, url).clips.slice(0, 2).map((item) => item.kind), ["own_goal", "penalty_goal"]);
});

test("YouTube duration parser rejects unknown forms", () => {
  assert.equal(parseYouTubeDuration("PT3M39S"), 219);
  assert.equal(parseYouTubeDuration(undefined), null);
  assert.equal(parseYouTubeDuration("bad"), null);
});

test("manual and prior metadata timestamps are never overwritten automatically", () => {
  assert.equal(shouldPreserveGoalMoment({ verificationBasis: "manual_visual", startSecond: 70 }), true);
  assert.equal(shouldPreserveGoalMoment({ verificationBasis: "dailygoal_metadata", startSecond: 70 }), true);
  assert.equal(shouldPreserveGoalMoment(null), false);
});
