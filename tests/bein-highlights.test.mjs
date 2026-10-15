import test from "node:test";
import assert from "node:assert/strict";
import { normalizeBeinHighlight, normalizeBeinYoutubeHighlight } from "../src/lib/providers/goal-api/bein-normalize.ts";

const fixture = { home: "Galatasaray SK", away: "FC Barcelona" };

test("accepts an exact official beIN MENA fixture highlight", () => {
  const result = normalizeBeinHighlight({
    id: "bein-1",
    title: "Galatasaray 1-4 Barcelona | Match Highlights",
    url: "https://www.beinsports.com/ar-mena/videos/galatasaray-barcelona-highlights",
    thumbnailUrl: "https://assets.example/thumb.jpg",
  }, fixture);
  assert.equal(result?.externalId, "bein-1");
  assert.ok(normalizeBeinHighlight({
    id: "bein-ar",
    title: "ملخص مباراة غلطة سراي وبرشلونة",
    url: "https://www.beinsports.com/ar-mena/videos/galatasaray-barcelona",
  }, fixture));
});

test("accepts only Barça highlights from the verified beIN SPORTS YouTube channel", () => {
  const result = normalizeBeinYoutubeHighlight({
    id: { videoId: "youtube-bein-1" },
    snippet: {
      channelId: "UCJUCcJUeh0Cz2xyKwkw5Q1w",
      title: "ملخص مباراة غلطة سراي وبرشلونة",
      publishedAt: "2026-10-13T22:00:00Z",
      thumbnails: { high: { url: "https://i.ytimg.com/vi/youtube-bein-1/hqdefault.jpg" } },
    },
  });
  assert.equal(result?.url, "https://www.youtube.com/watch?v=youtube-bein-1");
  assert.equal(normalizeBeinYoutubeHighlight({ id: { videoId: "x" }, snippet: { channelId: "not-bein", title: "Barcelona highlights" } }), null);
});

test("rejects non-beIN, wrong-opponent and non-highlight videos", () => {
  assert.equal(normalizeBeinHighlight({ title: "Galatasaray Barcelona highlights", url: "https://youtube.com/watch?v=x" }, fixture), null);
  assert.equal(normalizeBeinHighlight({ title: "Barcelona Real Madrid highlights", url: "https://www.beinsports.com/ar-mena/videos/x" }, fixture), null);
  assert.equal(normalizeBeinHighlight({ title: "Galatasaray Barcelona interview", url: "https://www.beinsports.com/ar-mena/videos/x" }, fixture), null);
});
