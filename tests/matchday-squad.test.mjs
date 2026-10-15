import test from "node:test";
import assert from "node:assert/strict";
import { getCuratedMatchdaySquad } from "../src/lib/matches/curated-matchday-squads.ts";

test("the official Galatasaray selection is fixture-specific and does not invent lineup roles", () => {
  const squad = getCuratedMatchdaySquad("17395982-6758-46fc-975e-27ad5054abe1");
  assert.equal(squad?.teamSide, "away");
  assert.equal(squad?.names.length, 22);
  assert.equal(new Set(squad.names).size, squad.names.length);
  assert.match(squad.sourceUrl, /^https:\/\/www\.fcbarcelona\.com\/en\/news\//);
  assert.deepEqual(Object.keys(squad).sort(), ["names", "publishedAt", "sourceUrl", "teamSide"]);
  assert.equal(getCuratedMatchdaySquad("another-match"), null);
});
