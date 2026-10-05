import test from "node:test";
import assert from "node:assert/strict";
import { average, displayPercent, observed, rollingAverage } from "./analytics-math.ts";
import { validateHistoricalTable } from "./standings-validation.ts";
import { missingHistoricalRounds } from "./standings-plan.ts";
import { confirmedWinner, confirmedNextFixture } from "./bracket.ts";
import { displayHeatmapRow, displayHeatmapY, heatmapDisplayStyle } from "../squad/heatmap-display.ts";

test("partial coverage preserves zero and leaves missing values blank", () => {
  assert.deepEqual(observed([null, 0, 2]), { value: 2, matches: 2 });
  assert.deepEqual(observed([null, null]), { value: null, matches: 0 });
  assert.deepEqual(average([null, 0, 6]), { value: 3, matches: 2 });
  assert.deepEqual(average([null, null]), { value: null, matches: 0 });
});

test("stored fractions display as percentages without losing zero or gaps", () => {
  assert.equal(displayPercent(.71), 71);
  assert.equal(displayPercent(.856), 85.6);
  assert.equal(displayPercent(0), 0);
  assert.equal(displayPercent(null), null);
  assert.equal(displayPercent(71), 71);
});

test("rolling trend requires all three observed matches and keeps zero", () => {
  assert.deepEqual(rollingAverage([0, 3, 0, null, 3, 3, 0], 3), [null, null, 1, null, null, null, 2]);
  assert.deepEqual(rollingAverage([null, null], 3), [null, null]);
});

const table = Array.from({ length: 20 }, (_, index) => ({
  position: index + 1,
  team: { id: index + 100 },
  playedGames: 1, won: 1, draw: 0, lost: 0,
  goalsFor: 2, goalsAgainst: 1, goalDifference: 1, points: 3,
}));
const response = {
  competition: { code: "PD" }, season: { startDate: "2026-08-01" },
  filters: { season: "2026", matchday: "3" },
  standings: [{ type: "TOTAL", table }],
};
const expected = { seasonStart: 2026, matchday: 3, teamIds: new Set(table.map((row) => row.team.id)) };

test("validates all 20 canonical positions and provider filters", () => {
  assert.equal(validateHistoricalTable(response, expected).length, 20);
  assert.throws(() => validateHistoricalTable({ ...response, filters: { season: "2025", matchday: "3" } }, expected));
  assert.throws(() => validateHistoricalTable({ ...response, standings: [{ type: "TOTAL", table: table.slice(1) }] }, expected));
  assert.throws(() => validateHistoricalTable({ ...response, standings: [{ type: "TOTAL", table: table.map((row, index) => index === 1 ? { ...row, position: 1 } : row) }] }, expected));
  assert.throws(() => validateHistoricalTable({ ...response, standings: [{ type: "TOTAL", table: table.map((row, index) => index === 1 ? { ...row, team: { id: 9999 } } : row) }] }, expected));
});

test("preview, first write, and repeat write plan only missing historical rounds", () => {
  const stored = new Map([[1, 20], [2, 19], [4, 20]]);
  assert.deepEqual(missingHistoricalRounds(5, stored), [2, 3]);
  const preview = missingHistoricalRounds(5, stored);
  assert.deepEqual(preview, [2, 3]);
  stored.set(2, 20);
  stored.set(3, 20);
  assert.deepEqual(missingHistoricalRounds(5, stored), []);
  assert.deepEqual(missingHistoricalRounds(1, new Map()), []);
});

test("heatmap display flips the lateral row without changing intensity semantics", () => {
  assert.equal(displayHeatmapRow(9, 12), 2);
  assert.equal(displayHeatmapRow(2, 12), 9);
  assert.ok(Math.abs(displayHeatmapY(.8) - .2) < 1e-12);
  assert.equal(heatmapDisplayStyle(0), null);
  assert.equal(heatmapDisplayStyle(.04), null);
  assert.ok(heatmapDisplayStyle(.6)?.opacity > heatmapDisplayStyle(.2)?.opacity);
});

test("bracket only connects observed single-leg, penalty, or completed aggregate winners", () => {
  const base = { id: "semi", stage: "Semi-finals", kickoff: "2027-02-02T19:00:00Z", status: "scheduled",
    leg: null, homeProviderId: "barca", awayProviderId: "atleti", homeScore: null, awayScore: null,
    homePenaltyScore: null, awayPenaltyScore: null };
  const final = { ...base, id: "final", stage: "Final", kickoff: "2027-02-10T19:00:00Z",
    homeProviderId: "barca", awayProviderId: "madrid" };
  assert.equal(confirmedWinner(base, [base, final]), null);
  assert.equal(confirmedNextFixture(base, [base, final], "Final"), null);
  const won = { ...base, status: "finished", homeScore: 2, awayScore: 1 };
  assert.equal(confirmedWinner(won, [won, final]), "barca");
  assert.equal(confirmedNextFixture(won, [won, final], "Final")?.id, "final");
  assert.equal(confirmedWinner({ ...won, homeScore: 1, awayScore: 1 }, [won, final]), null);
  assert.equal(confirmedWinner({ ...won, homeScore: 1, awayScore: 1, homePenaltyScore: 4, awayPenaltyScore: 3 }, [won, final]), "barca");
  const firstLeg = { ...won, leg: 1 };
  const secondLeg = { ...won, id: "reverse", leg: 2, kickoff: "2027-02-09T19:00:00Z", homeProviderId: "atleti", awayProviderId: "barca", homeScore: 1, awayScore: 1 };
  assert.equal(confirmedWinner(firstLeg, [firstLeg]), null);
  assert.equal(confirmedWinner(firstLeg, [firstLeg, { ...secondLeg, status: "scheduled" }]), null);
  assert.equal(confirmedWinner(firstLeg, [firstLeg, secondLeg]), "barca");
  assert.equal(confirmedNextFixture(firstLeg, [firstLeg, secondLeg], "Final"), null);
});
