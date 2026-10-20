import test from "node:test";
import assert from "node:assert/strict";
import { candidateSquadLinks, extractOfficialSquadNames, matchingSquadLinks } from "../src/lib/notifications/official-squad-core.ts";

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

test("official squad discovery understands opponent acronyms", () => {
  const link = "/en/football/first-team/news/4594106/fc-barcelona-squad-for-the-trip-to-psg/featured";
  assert.deepEqual(matchingSquadLinks([link], "Paris Saint-Germain"), [link]);
});

test("official squad names are extracted only from an introduced full list", () => {
  const names = Array.from({ length: 23 }, (_, index) => `Player ${index + 1}`);
  const body = `The full list named by coach Hansi Flick is as follows: ${names.slice(0, -1).join(", ")} and ${names.at(-1)}.`;
  const html = `<script type="application/ld+json">${JSON.stringify({ articleBody: body })}</script>`;
  assert.deepEqual(extractOfficialSquadNames(html), names);
  assert.deepEqual(extractOfficialSquadNames("<p>Possible squad: Player One, Player Two.</p>"), []);
});
