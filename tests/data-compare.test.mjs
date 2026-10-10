import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { EXCLUDED_AUTH_TABLES, TABLES, SNAPSHOT_VERSION } from "../tools/data-compare/catalog.mjs";
import { compareSnapshots, validateSnapshot, markdownReport } from "../tools/data-compare/compare-core.mjs";
import { buildTransferPlan } from "../tools/data-compare/transfer-plan-core.mjs";

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

test("comparison catalog covers every Prisma model table", () => {
  const contract = readFileSync(new URL("../src/prisma/contract.prisma", import.meta.url), "utf8");
  const mapped = [...contract.matchAll(/^\s*@@map\("([^"]+)"\)/gm)].map((match) => match[1]);
  assert.deepEqual([...TABLES, ...EXCLUDED_AUTH_TABLES].sort(), mapped.sort());
});
test("account-era snapshots can be compared but cannot become a transfer plan", () => {
  const local = envelope("local");
  const production = envelope("production");
  local.snapshot.authIsolation = "excluded; account-era snapshots are comparison-only";
  local.snapshot.ownerAccounts = [];
  local.sha256 = createHash("sha256").update(JSON.stringify(local.snapshot)).digest("hex");
  assert.equal(compareSnapshots(local, production).errors.length, 0);
  assert.match(buildTransferPlan(local, production).errors.join(" "), /ownership mapping/);
});
test("personal rows never match another owner without explicit account mapping", () => {
  const localOwner = id(80), productionOwner = id(81), otherProductionOwner = id(82);
  const local = envelope("local", { ...base, match_diary_entry: [{ id: id(90), userId: localOwner, matchId: id(5), rating: 5 }] });
  const production = envelope("production", { ...base, match_diary_entry: [
    { id: id(91), userId: productionOwner, matchId: id(5), rating: 5 },
    { id: id(92), userId: otherProductionOwner, matchId: id(5), rating: 3 },
  ] });
  local.snapshot.ownerAccounts = [{ id: localOwner, username: "owner" }];
  production.snapshot.ownerAccounts = [{ id: productionOwner, username: "owner" }, { id: otherProductionOwner, username: "other" }];
  local.snapshot.authIsolation = production.snapshot.authIsolation = "excluded";
  for (const envelope_ of [local, production]) envelope_.sha256 = createHash("sha256").update(JSON.stringify(envelope_.snapshot)).digest("hex");
  const unmapped = compareSnapshots(local, production);
  assert.equal(unmapped.tables.match_diary_entry.commonCount, 0);
  assert.equal(unmapped.tables.match_diary_entry.onlyProduction.length, 2);
  const mapped = compareSnapshots(local, production, { localOwnerId: localOwner, productionOwnerId: productionOwner });
  assert.equal(mapped.tables.match_diary_entry.commonCount, 1);
  assert.equal(mapped.tables.match_diary_entry.onlyProduction.length, 1);
  assert.equal(mapped.tables.match_diary_entry.onlyProduction[0].id, id(92));
  assert.match(compareSnapshots(local, production, { localOwnerId: localOwner, productionOwnerId: id(999) }).errors.join(" "), /absent/);
});
function envelope(environment, values = {}) {
  const snapshot = { version: SNAPSHOT_VERSION, environment, generatedAt: "2026-10-09T00:00:00.000Z",
    scope: "all application rows", schema: TABLES.map((table) => ({ table, column: "id", type: "uuid", nullable: "NO" })),
    rows: Object.fromEntries(TABLES.map((table) => [table, values[table] ?? []])), assets: { status: "scanned_source_public_directory", files: [] } };
  return { snapshot, sha256: createHash("sha256").update(JSON.stringify(snapshot)).digest("hex") };
}
const base = {
  season: [{ id: id(1), label: "2026/27" }],
  competition: [{ id: id(2), code: "PD" }],
  team: [{ id: id(3), code: "FCB" }, { id: id(4), code: "SEV" }],
  football_match: [{ id: id(5), seasonId: id(1), competitionId: id(2), homeTeamId: id(4), awayTeamId: id(3), kickoff: "2026-09-19T19:00:00.000Z", status: "finished", homeScore: 1, awayScore: 3 }],
};

test("identical UUID cannot establish a fixture whose teams contradict", () => {
  const local = envelope("local", base);
  const production = envelope("production", { ...base, team: [...base.team, { id: id(6), code: "VAL" }],
    football_match: [{ ...base.football_match[0], homeTeamId: id(6) }] });
  const report = compareSnapshots(local, production);
  assert.equal(report.tables.football_match.commonCount, 0);
  assert.equal(report.tables.football_match.ambiguous.length, 1);
});

test("scorer correction, exact timestamp, portrait and Top 3 slot changes are reported", () => {
  const players = [
    { id: id(10), displayName: "Player A", birthDate: "2000-01-01T00:00:00.000Z", portraitUrl: "https://example.com/old.png" },
    { id: id(11), displayName: "Player B", birthDate: "2001-01-01T00:00:00.000Z" },
  ];
  const events = [{ id: id(12), matchId: id(5), teamId: id(3), type: "goal", period: 2, minute: 79, second: null, eventOrder: 5,
    primaryPlayerId: id(10), confidence: "manual_verified" }];
  const media = [{ id: id(13), matchId: id(5), url: "https://youtube.com/watch?v=ABC", externalMediaId: "ABC", title: "Highlights" }];
  const moments = [{ id: id(14), mediaItemId: id(13), matchEventId: id(12), startSecond: 70, endSecond: null,
    verificationBasis: "manual_visual" }];
  const values = { ...base, player: players, match_event: events, media_item: media, media_moment: moments,
    favourite_match: [{ id: id(15), seasonId: id(1), matchId: id(5), slot: 1 }] };
  const otherMatch = { ...base.football_match[0], id: id(16), kickoff: "2026-09-20T19:00:00.000Z" };
  const local = envelope("local", values);
  const production = envelope("production", { ...values,
    football_match: [...base.football_match, otherMatch],
    player: [{ ...players[0], portraitUrl: "https://example.com/new.png" }, players[1]],
    match_event: [{ ...events[0], primaryPlayerId: id(11) }],
    media_moment: [{ ...moments[0], startSecond: 71 }],
    favourite_match: [{ ...values.favourite_match[0], matchId: id(16) }],
  });
  const report = compareSnapshots(local, production);
  assert.deepEqual(report.tables.player.different[0].fields, ["portraitUrl"]);
  assert.ok(report.tables.match_event.different[0].fields.includes("primaryPlayerId"));
  assert.deepEqual(report.tables.media_moment.different[0].fields, ["startSecond"]);
  assert.deepEqual(report.tables.favourite_match.different[0].fields, ["matchId"]);
  assert.match(markdownReport(report), /Only production — preserve\/review/);
});

test("broken references and tampered snapshots are detected", () => {
  const local = envelope("local", { ...base, match_diary_entry: [{ id: id(20), matchId: id(999), notes: "private note" }],
    manual_override: [{ id: id(21), entityType: "media_item", entityId: id(999), fieldName: "title", createdAt: "2026-10-09T00:00:00.000Z" }] });
  assert.equal(validateSnapshot(local).broken.length, 1);
  assert.equal(validateSnapshot(local).softReferences.length, 1);
  local.snapshot.rows.match_diary_entry[0].notes = "changed";
  assert.match(validateSnapshot(local).errors.join(" "), /SHA-256 mismatch/);
});

test("production-only personal data and public assets remain visible", () => {
  const local = envelope("local", base);
  const production = envelope("production", { ...base, match_diary_entry: [{ id: id(21), matchId: id(5), rating: 5 }] });
  production.snapshot.assets.files.push({ path: "images/extra.png", bytes: 1, sha256: "abc" });
  production.sha256 = createHash("sha256").update(JSON.stringify(production.snapshot)).digest("hex");
  const report = compareSnapshots(local, production);
  assert.equal(report.tables.match_diary_entry.onlyProduction.length, 1);
  assert.deepEqual(report.assets.onlyProduction, ["images/extra.png"]);
});

test("different subordinate UUIDs match only through independent relationships", () => {
  const player = { id: id(10), displayName: "Player A", birthDate: "2000-01-01T00:00:00.000Z" };
  const event = { id: id(12), matchId: id(5), teamId: id(3), type: "goal", minute: 42, period: 1, second: null, eventOrder: 1,
    primaryPlayerId: id(10) };
  const media = { id: id(13), matchId: id(5), externalMediaId: "VIDEO", url: "https://youtube.com/watch?v=VIDEO" };
  const lineup = { id: id(14), matchId: id(5), teamId: id(3), isConfirmed: false };
  const local = envelope("local", { ...base, player: [player], match_event: [event], media_item: [media], lineup: [lineup],
    lineup_player: [{ id: id(15), lineupId: id(14), playerId: id(10), role: "starter" }],
    media_moment: [{ id: id(16), mediaItemId: id(13), matchEventId: id(12), startSecond: 41, endSecond: null }],
    match_diary_entry: [{ id: id(17), matchId: id(5), watched: true, rating: 5, notes: "private" }] });
  const production = envelope("production", {
    season: [{ id: id(101), label: "2026/27" }], competition: [{ id: id(102), code: "PD" }],
    team: [{ id: id(103), code: "FCB" }, { id: id(104), code: "SEV" }],
    football_match: [{ ...base.football_match[0], id: id(105), seasonId: id(101), competitionId: id(102), homeTeamId: id(104), awayTeamId: id(103) }],
    player: [{ ...player, id: id(110) }],
    match_event: [{ ...event, id: id(112), matchId: id(105), teamId: id(103), primaryPlayerId: id(110) }],
    media_item: [{ ...media, id: id(113), matchId: id(105) }],
    lineup: [{ ...lineup, id: id(114), matchId: id(105), teamId: id(103) }],
    lineup_player: [{ id: id(115), lineupId: id(114), playerId: id(110), role: "starter" }],
    media_moment: [{ id: id(116), mediaItemId: id(113), matchEventId: id(112), startSecond: 41, endSecond: null }],
    match_diary_entry: [{ id: id(117), matchId: id(105), watched: true, rating: 5, notes: "private" }],
  });
  const report = compareSnapshots(local, production);
  for (const table of ["football_match", "player", "match_event", "media_item", "lineup", "lineup_player", "media_moment", "match_diary_entry"]) {
    assert.equal(report.tables[table].commonCount, 1, table);
    assert.equal(report.tables[table].different.length, 0, table);
  }
});

test("equal UUIDs never validate an unidentifiable player relationship", () => {
  const values = { ...base,
    player: [{ id: id(10), displayName: "Unmapped Player", birthDate: null }],
    match_event: [{ id: id(12), matchId: id(5), teamId: id(3), type: "goal", period: 1, minute: 10,
      second: null, eventOrder: 1, primaryPlayerId: id(10) }] };
  const report = compareSnapshots(envelope("local", values), envelope("production", values));
  assert.equal(report.tables.player.commonCount, 0);
  assert.equal(report.tables.player.ambiguous.length, 1);
  assert.equal(report.tables.match_event.commonCount, 0);
  assert.deepEqual(report.tables.match_event.relationshipReview[0].fields, ["primaryPlayerId"]);
});
