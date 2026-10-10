import test from "node:test";
import assert from "node:assert/strict";
import { digestPayload, validateTransferEnvelope, validateTransferPayload } from "../tools/goal-transfer/bundle.mjs";

const id = (suffix) => `00000000-0000-4000-8000-${String(suffix).padStart(12, "0")}`;
function sample() {
  return {
    version: 1, generatedAt: "2026-10-09T00:00:00.000Z", scope: {},
    seasons: [{ id: id(1), label: "2026/27" }],
    competitions: [{ id: id(2), code: "PD", name: "La Liga" }],
    teams: [{ id: id(3), code: "FCB", name: "FC Barcelona", isBarcelona: true },
      { id: id(4), code: "LEV", name: "Levante UD", isBarcelona: false }],
    players: [{ id: id(5), displayName: "Iván Romero" }],
    dataSources: [{ id: id(6), code: "laliga-report", name: "LaLiga match report" }],
    matches: [{ id: id(7), seasonId: id(1), competitionId: id(2), homeTeamId: id(4),
      awayTeamId: id(3), kickoff: "2026-09-13T14:15:00.000Z", status: "finished", homeScore: 2, awayScore: 4 }],
    events: [{ id: id(8), matchId: id(7), teamId: id(4), primaryPlayerId: id(5), relatedPlayerId: null,
      dataSourceId: id(6), type: "goal", minute: 79, confidence: "manual_verified",
      rawData: { correctionSourceUrl: "https://example.com/report" } }],
    lineups: [], lineupPlayers: [],
    mediaItems: [{ id: id(9), matchId: id(7), playerId: null, dataSourceId: id(6),
      type: "match_highlight", url: "https://www.youtube.com/watch?v=AbCdEfGh123", isOfficial: true }],
    moments: [{ id: id(10), mediaItemId: id(9), matchEventId: id(8), startSecond: 60,
      endSecond: null, verificationBasis: "manual_visual", verifiedAt: "2026-10-09T00:00:00.000Z" }],
    goalReviews: [], mappings: [{ id: id(11), dataSourceId: id(6), entityType: "player",
      internalId: id(5), providerId: "source-player-5" }],
  };
}

test("selective bundle validates its local graph and checksum without target ID assumptions", () => {
  const payload = sample();
  const envelope = { payload, sha256: digestPayload(payload) };
  assert.deepEqual(validateTransferEnvelope(envelope).errors, []);
  assert.equal(validateTransferEnvelope(envelope).details.eventConfidence.manual_verified, 1);
  payload.moments[0].startSecond = 61;
  assert.match(validateTransferEnvelope(envelope).errors.join(" "), /SHA-256/);
});

test("wrong goal/media linkage and untrusted lineup shape block export", () => {
  const payload = sample();
  payload.mediaItems[0].matchId = id(99);
  assert.match(validateTransferPayload(payload).errors.join(" "), /cross-fixture/);
  payload.mediaItems[0].matchId = id(7);
  payload.lineups.push({ id: id(12), matchId: id(7), teamId: id(4), isConfirmed: true });
  payload.lineupPlayers.push(...Array.from({ length: 10 }, (_, index) => ({
    id: id(20 + index), lineupId: id(12), playerId: id(5), role: "starter",
  })));
  assert.match(validateTransferPayload(payload).errors.join(" "), /11 starters/);
});

test("a standalone goal clip may have a null start, but a highlight may not", () => {
  const payload = sample();
  payload.moments[0].startSecond = null;
  assert.match(validateTransferPayload(payload).errors.join(" "), /playback bounds/);
  payload.mediaItems[0].type = "goal_clip";
  assert.deepEqual(validateTransferPayload(payload).errors, []);
});
