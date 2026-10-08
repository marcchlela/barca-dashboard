#!/usr/bin/env node
// Read-only metadata check for explicit IDs. Never prints the configured API key.
import "dotenv/config";

const ids = process.argv.slice(2).filter((id) => /^[A-Za-z0-9_-]{11}$/.test(id));
if (!process.env.YOUTUBE_API_KEY || !ids.length || ids.length > 50) throw new Error("Provide 1–50 YouTube IDs and configure YOUTUBE_API_KEY.");
const url = new URL("https://www.googleapis.com/youtube/v3/videos");
url.search = new URLSearchParams({ part: "snippet,contentDetails,status", id: ids.join(","), key: process.env.YOUTUBE_API_KEY }).toString();
const response = await fetch(url);
if (!response.ok) throw new Error(`YouTube metadata request failed (${response.status}).`);
const data = await response.json();
console.log(JSON.stringify({ returned: data.items?.length ?? 0, videos: (data.items ?? []).map((video) => ({ id: video.id, channelId: video.snippet.channelId, publishedAt: video.snippet.publishedAt, title: video.snippet.title, description: video.snippet.description.slice(0, 900), duration: video.contentDetails.duration, embeddable: video.status.embeddable, privacy: video.status.privacyStatus })) }, null, 2));
