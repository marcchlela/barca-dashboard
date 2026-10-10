import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { SNAPSHOT_VERSION, TABLES } from "../tools/data-compare/catalog.mjs";
import { buildTransferPlan, simulateTransfer, validateManifest } from "../tools/data-compare/transfer-plan-core.mjs";

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const seasons = Array.from({ length: 128 }, (_, index) => {
  const year = 1899 + index;
  return { id: id(index + 1), label: `${year}/${String((year + 1) % 100).padStart(2, "0")}`,
    startYear: year, endYear: year + 1, isCurrent: year === 2026 };
});
function envelope(environment, rows) {
  const snapshot = { version: SNAPSHOT_VERSION, environment, generatedAt: "2026-10-09T14:00:00.000Z",
    scope: "all application rows", schema: TABLES.map((table) => ({ table, column: "id", type: "uuid", nullable: "NO" })),
    rows: Object.fromEntries(TABLES.map((table) => [table, structuredClone(rows[table] ?? [])])), assets: { status: "not_scanned", files: [] } };
  return { snapshot, sha256: createHash("sha256").update(JSON.stringify(snapshot)).digest("hex") };
}
const source = {
  season: seasons, competition: [{ id: id(200), code: "PD" }],
  team: [{ id: id(201), code: "FCB" }, { id: id(202), code: "LEV" }],
  player: [{ id: id(203), displayName: "Player A", birthDate: "2000-01-01T00:00:00.000Z", portraitUrl: "https://example.com/new.png" }],
  football_match: [{ id: id(204), seasonId: id(128), competitionId: id(200), homeTeamId: id(202), awayTeamId: id(201),
    kickoff: "2026-09-13T19:00:00.000Z", status: "finished", homeScore: 2, awayScore: 4 }],
  match_event: [
    { id: id(205), matchId: id(204), teamId: id(201), type: "own_goal", minute: 36, period: 1, eventOrder: 1, primaryPlayerId: id(203) },
    { id: id(206), matchId: id(204), teamId: id(201), type: "goal", minute: 79, period: 2, eventOrder: 2, primaryPlayerId: id(203) },
  ],
  media_item: [{ id: id(207), matchId: id(204), externalMediaId: "VIDEO", url: "https://youtube.com/watch?v=VIDEO", title: "Video" }],
  media_moment: [{ id: id(208), mediaItemId: id(207), matchEventId: id(206), startSecond: 70, endSecond: null,
    verificationBasis: "manual_visual" }],
  lineup: [{ id: id(209), matchId: id(204), teamId: id(201), isConfirmed: false }],
  lineup_player: [{ id: id(210), lineupId: id(209), playerId: id(203), role: "starter" }],
  match_diary_entry: [{ id: id(211), matchId: id(204), favouritePlayerId: id(203), watched: true, notes: "local words" }],
  favourite_match: [{ id: id(212), seasonId: id(128), matchId: id(204), slot: 1 }],
  squad_membership: [{ id: id(213), seasonId: id(128), teamId: id(201), playerId: id(203), shirtNumber: 9 }],
  player_match_statistic: [{ id: id(214), matchId: id(204), teamId: id(201), playerId: id(203), goals: 1, rawData: { source: "new" } }],
  manual_override: [{ id: id(215), entityType: "media_item", entityId: id(999), fieldName: "title", createdAt: "2026-10-09T00:00:00.000Z" }],
};
const target = {
  season: [{ ...seasons[127], id: id(500) }], competition: [{ id: id(600), code: "PD" }],
  team: [{ id: id(601), code: "FCB" }, { id: id(602), code: "LEV" }],
  player: [{ id: id(603), displayName: "Player A", birthDate: "2000-01-01T00:00:00.000Z", portraitUrl: "https://example.com/old.png" }],
  football_match: [{ ...source.football_match[0], id: id(604), seasonId: id(500), competitionId: id(600), homeTeamId: id(602), awayTeamId: id(601) }],
  match_event: [{ ...source.match_event[0], matchId: id(604), teamId: id(601), type: "goal", primaryPlayerId: id(603) }],
  media_item: [{ ...source.media_item[0], id: id(607), matchId: id(604) }],
  match_diary_entry: [{ ...source.match_diary_entry[0], id: id(611), matchId: id(604), favouritePlayerId: id(603), notes: "production words" }],
  squad_membership: [{ ...source.squad_membership[0], id: id(613), seasonId: id(500), teamId: id(601), playerId: id(603) }],
  player_match_statistic: [{ ...source.player_match_statistic[0], id: id(614), matchId: id(604), teamId: id(601), playerId: id(603), rawData: { source: "old" } }],
};

test("planner remaps FKs, validates seasons, blocks contradictory and personal conflicts", () => {
  const local = envelope("local", source), production = envelope("production", target);
  const { errors, manifest } = buildTransferPlan(local, production);
  assert.deepEqual(errors, []);
  assert.equal(validateManifest(manifest), true);
  assert.equal(manifest.operations.filter((op) => op.table === "season" && op.action === "insert").length, 127);
  const moment = manifest.operations.find((op) => op.table === "media_moment");
  assert.equal(moment.values.mediaItemId, id(607));
  assert.equal(moment.values.matchEventId, id(206));
  const lineupPlayer = manifest.operations.find((op) => op.table === "lineup_player");
  assert.equal(lineupPlayer.values.playerId, id(603));
  assert.equal(manifest.blocked.some((row) => row.table === "match_event" && row.localId === id(205)), true);
  assert.equal(manifest.blocked.some((row) => row.table === "match_diary_entry" && /notes/.test(row.reason)), true);
  assert.equal(manifest.blocked.some((row) => row.table === "manual_override"), true);
  assert.equal(manifest.blocked.some((row) => row.table === "player_match_statistic"), true);
});

test("replanning a simulated application does not duplicate inserts", () => {
  const local = envelope("local", source), production = envelope("production", target);
  const first = buildTransferPlan(local, production).manifest;
  const after = envelope("production", simulateTransfer(production.snapshot, first).rows);
  const second = buildTransferPlan(local, after).manifest;
  assert.equal(second.operations.filter((op) => op.action === "insert").length, 0);
  assert.equal(second.operations.filter((op) => op.action === "update").length, 0);
  assert.equal(second.blocked.length, first.blocked.length);
});

test("checksums and invalid historical seasons stop a plan", () => {
  const local = envelope("local", source), production = envelope("production", target);
  const plan = buildTransferPlan(local, production).manifest;
  plan.operations[0].targetId = id(999);
  assert.equal(validateManifest(plan), false);
  local.snapshot.rows.season.pop();
  assert.ok(buildTransferPlan(local, production).errors.length);
});

test("current schema permits multiple provider IDs to map to one verified player", () => {
  const localRows = structuredClone(source), productionRows = structuredClone(target);
  localRows.data_source = [{ id: id(250), code: "goal-api" }];
  productionRows.data_source = [{ id: id(650), code: "goal-api" }];
  localRows.provider_mapping = [
    { id: id(251), dataSourceId: id(250), entityType: "player", providerId: "alias-one", internalId: id(203) },
    { id: id(252), dataSourceId: id(250), entityType: "player", providerId: "alias-two", internalId: id(203) },
  ];
  const plan = buildTransferPlan(envelope("local", localRows), envelope("production", productionRows));
  assert.deepEqual(plan.errors, []);
  assert.equal(plan.manifest.operations.filter((item) => item.table === "provider_mapping" && item.action === "insert").length, 2);
  assert.equal(plan.manifest.blocked.filter((item) => item.table === "provider_mapping").length, 0);
});
