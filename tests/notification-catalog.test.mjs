import test from "node:test";
import assert from "node:assert/strict";
import { formatNotificationKickoffTime, notificationKinds, renderNotificationTemplate } from "../src/lib/notifications/catalog.ts";

test("all user-selected notification types have unique templates and safe bounded rendering", () => {
  assert.equal(notificationKinds.length, 26);
  assert.equal(new Set(notificationKinds.map((kind) => kind.id)).size, 26);
  assert.equal(renderNotificationTemplate("Goal: {player} ({minute}′)", { player: "Pedri", minute: "53" }), "Goal: Pedri (53′)");
  assert.equal(renderNotificationTemplate("{player}", {}), "{player}");
  assert.equal(renderNotificationTemplate("x".repeat(300), {}).length, 240);
  assert.equal(formatNotificationKickoffTime("2026-10-17T16:30:00.000Z"), "7:30 PM");
  assert.equal(notificationKinds.find((kind) => kind.id === "match_reminder")?.body, "{home} vs {away} starts at {kickoffTime}.");
});
