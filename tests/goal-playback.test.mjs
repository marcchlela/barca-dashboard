import test from "node:test";
import assert from "node:assert/strict";
import { getYouTubeId, goalEmbedUrl, goalYouTubeUrl, selectPlayableGoals } from "../src/lib/matches/goal-playback.ts";

const film = (overrides = {}) => ({
  id: "highlight", type: "match_highlight", title: "Official highlights",
  url: "https://www.youtube.com/watch?v=XqSrz6MKVlk", externalMediaId: "XqSrz6MKVlk", isOfficial: true,
  verifiedGoals: [], ...overrides,
});
const moment = (id, startSecond, basis = "dailygoal_metadata", endSecond = null) => ({ id, label: `${id}' Goal`, startSecond, endSecond, verificationBasis: basis });

test("Feyenoord's six canonical event IDs each resolve to their own stored start", () => {
  const starts = [6, 28, 50, 70, 84, 97];
  const events = starts.map((_, index) => ({ id: `f-${index}`, type: index === 5 ? "own_goal" : "goal" }));
  const playable = selectPlayableGoals(events, [film({ verifiedGoals: starts.map((start, index) => moment(`f-${index}`, start)) })]);
  assert.equal(playable.size, 6);
  assert.deepEqual([...playable.values()].map((goal) => goal.startSecond), starts);
  assert.match(goalEmbedUrl(playable.get("f-3")), /start=70/);
});

test("four Sevilla goals resolve; missing footage and non-goals do not", () => {
  const events = [0, 1, 2, 3].map((index) => ({ id: `s-${index}`, type: index === 2 ? "penalty_goal" : "goal" }));
  events.push({ id: "card", type: "yellow_card" }, { id: "unlinked", type: "goal" });
  const playable = selectPlayableGoals(events, [film({ verifiedGoals: [0, 1, 2, 3].map((index) => moment(`s-${index}`, index * 15)) .concat(moment("card", 80)) })]);
  assert.equal(playable.size, 4);
  assert.equal(playable.has("card"), false);
  assert.equal(playable.has("unlinked"), false);
});

test("manual visual verification wins over metadata without changing either moment", () => {
  const events = [{ id: "goal", type: "goal" }];
  const metadata = film({ verifiedGoals: [moment("goal", 70)] });
  const manual = film({ id: "manual", url: "https://youtu.be/aaaaaaaaaaa", externalMediaId: "aaaaaaaaaaa", verifiedGoals: [moment("goal", 64, "manual_visual", 78)] });
  const selected = selectPlayableGoals(events, [metadata, manual]).get("goal");
  assert.equal(selected.startSecond, 64);
  assert.equal(selected.endSecond, 78);
  assert.equal(selected.videoId, "aaaaaaaaaaa");
  assert.match(goalEmbedUrl(selected), /end=78/);
  assert.equal(metadata.verifiedGoals[0].startSecond, 70);
});

test("invalid, unofficial and unbounded highlight moments cannot look playable", () => {
  const events = [{ id: "goal", type: "goal" }];
  assert.equal(selectPlayableGoals(events, [film({ isOfficial: false, verifiedGoals: [moment("goal", 4)] })]).size, 0);
  assert.equal(selectPlayableGoals(events, [film({ verifiedGoals: [moment("goal", null)] })]).size, 0);
  assert.equal(selectPlayableGoals(events, [film({ url: "https://youtube.com.evil.test/watch?v=XqSrz6MKVlk", verifiedGoals: [moment("goal", 4)] })]).size, 0);
  assert.equal(getYouTubeId(film({ externalMediaId: "aaaaaaaaaaa" })), null);
});

test("standalone goal clips may start at zero; YouTube fallback keeps the timestamp", () => {
  const selected = selectPlayableGoals([{ id: "own", type: "own_goal" }], [film({ type: "goal_clip", verifiedGoals: [moment("own", null, "manual_visual")] })]).get("own");
  assert.equal(selected.startSecond, 0);
  assert.equal(goalYouTubeUrl(selected), "https://www.youtube.com/watch?v=XqSrz6MKVlk&t=0s");
});
