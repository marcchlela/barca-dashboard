import test from "node:test";
import assert from "node:assert/strict";
import { candidateSquadLinks, matchingSquadLinks } from "../src/lib/notifications/official-squad-core.ts";

test("official club squad discovery requires a first-team news link and the opponent", () => {
  const html = '<a href="/en/football/first-team/news/123/the-squad-for-betis-v-fc-barcelona">Betis</a>' +
    '<a href="/en/football/first-team/news/456/the-squad-for-real-madrid-v-fc-barcelona">Madrid</a>' +
    '<a href="/en/football/womens-first-team/news/789/the-squad-for-betis">Women</a>';
  const links = candidateSquadLinks(html);
  assert.equal(links.length, 2);
  assert.deepEqual(matchingSquadLinks(links, "Real Betis Balompié"), [links[0]]);
  assert.deepEqual(matchingSquadLinks(links, "Real Madrid CF"), [links[1]]);
  assert.deepEqual(matchingSquadLinks(links, "Galatasaray SK"), []);
});
