#!/usr/bin/env node
// Read-only, bounded search within the verified FC Barcelona YouTube channel.
import "dotenv/config";

const query = process.argv.slice(2).join(" ").trim();
if (!process.env.YOUTUBE_API_KEY || !query || query.length > 100) throw new Error("Provide one short search phrase and configure YOUTUBE_API_KEY.");
const url = new URL("https://www.googleapis.com/youtube/v3/search");
url.search = new URLSearchParams({ part: "snippet", channelId: "UC14UlmYlSNiQCBe9Eookf_A", q: query, type: "video", order: "relevance", maxResults: "15", key: process.env.YOUTUBE_API_KEY }).toString();
const response = await fetch(url);
if (!response.ok) throw new Error(`Official-channel search failed (${response.status}).`);
const data = await response.json();
console.log(JSON.stringify({ query, totalResults: data.pageInfo?.totalResults, items: (data.items ?? []).map((item) => ({ id: item.id.videoId, channelId: item.snippet.channelId, title: item.snippet.title, publishedAt: item.snippet.publishedAt, description: item.snippet.description.slice(0, 250) })) }, null, 2));
