import test from "node:test";
import assert from "node:assert/strict";
import { RATING_BINS, ratingHistogram, seasonSummary, mostPickedPlayers } from "./archive-math.ts";

test("all ten half-star bars remain, including empty bins", () => {
  const bars = ratingHistogram([{ rating: .5 }, { rating: 5 }, { rating: null }]);
  assert.deepEqual(bars.map((bar) => bar.rating), RATING_BINS);
  assert.equal(bars[0].count, 1);
  assert.equal(bars[9].count, 1);
  assert.equal(bars[4].count, 0);
});
test("watched and rated counts stay distinct; missing ratings do not dilute average", () => {
  assert.deepEqual(seasonSummary([]), { finished: 0, watched: 0, rated: 0, average: null });
  assert.deepEqual(seasonSummary([{ watched: true, rating: null }, { watched: false, rating: 2 }, { watched: true, rating: 4 }]), { finished: 3, watched: 2, rated: 2, average: 3 });
});
test("joint player picks are stable and unwatched picks are excluded", () => {
  const a = { id: "a", name: "A" }, b = { id: "b", name: "B" };
  assert.deepEqual(mostPickedPlayers([]), []);
  assert.deepEqual(mostPickedPlayers([{ watched: true, favouritePlayer: b }, { watched: true, favouritePlayer: a }, { watched: false, favouritePlayer: b }]).map((item) => item.player.id), ["a", "b"]);
});
