import "dotenv/config";

const date = process.argv[2];
if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) throw new Error("Usage: node tools/qa/probe-goal-fixture.mjs YYYY-MM-DD");
if (!process.env.GOAL_API_KEY) throw new Error("GOAL_API_KEY is not configured locally.");

const path = `/fixtures/date/${date}?leagueId=cmr77dw3900f5rx06j05wgzv4&limit=100&offset=0`;
const response = await fetch(`https://api.goal-api.com/v1${path}`, {
  headers: { Accept: "application/json", Authorization: `Bearer ${process.env.GOAL_API_KEY}` },
  signal: AbortSignal.timeout(15000),
});
const body = await response.json();
const rows = Array.isArray(body.data) ? body.data : [];
const relevant = rows.map((row) => ({
  id: row.id ?? row.apiId,
  kickoff: row.kickoffUtc ?? row.kickoff_utc,
  home: row.homeTeam?.name ?? row.home?.name ?? row.homeTeamName,
  away: row.awayTeam?.name ?? row.away?.name ?? row.awayTeamName,
  competition: row.league?.name ?? row.leagueName,
  status: row.status,
})).filter((row) => /barcelona|galatasaray/i.test(`${row.home} ${row.away}`));
console.log(JSON.stringify({ status: response.status, total: rows.length, relevant, error: response.ok ? null : body.error?.message ?? body.message ?? null }, null, 2));

if (process.argv.includes("--detail") && response.ok && relevant.length === 1 && relevant[0].id) {
  const section = process.argv.find((arg) => arg.startsWith("--section="))?.slice("--section=".length);
  const suffixes = section ? section.split(",").map((name) => `/${name}`) : ["", "/events", "/lineups", "/statistics"];
  for (const suffix of suffixes) {
    const result = await fetch(`https://api.goal-api.com/v1/fixtures/${encodeURIComponent(relevant[0].id)}${suffix}`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${process.env.GOAL_API_KEY}` },
      signal: AbortSignal.timeout(15000),
    });
    const content = await result.json();
    const data = content.data;
    console.log(JSON.stringify({
      endpoint: suffix || "detail",
      status: result.status,
      dataType: Array.isArray(data) ? "array" : typeof data,
      dataKeys: data && !Array.isArray(data) ? Object.keys(data) : null,
      count: Array.isArray(data) ? data.length : null,
      hasLineups: data?.hasLineups ?? null,
      homeStarters: data?.home?.startingLineups?.length ?? null,
      awayStarters: data?.away?.startingLineups?.length ?? null,
      starterFields: data?.home?.startingLineups?.[0] ? Object.keys(data.home.startingLineups[0]) : null,
      hasStatistics: data?.hasStatistics ?? null,
      statisticRows: data?.match?.fullTime?.length ?? null,
      statisticPeriods: data?.match && typeof data.match === "object" ? Object.fromEntries(Object.entries(data.match).map(([key, value]) => [key, Array.isArray(value) ? value.length : typeof value])) : null,
      statisticSample: data?.match?.fullTime?.slice(0, 3) ?? null,
      sample: Array.isArray(data) ? data.slice(0, 2) : suffix === "" ? {
        status: data?.status,
        matchStatus: data?.matchStatus,
        matchPeriod: data?.matchPeriod,
        clock: data?.clock,
        homeTeamFtScore: data?.homeTeamFtScore,
        awayTeamFtScore: data?.awayTeamFtScore,
      } : null,
      error: result.ok ? null : content.error?.message ?? content.message ?? null,
    }, null, 2));
    if (result.status === 403 || result.status === 429) break;
  }
}

if (process.argv.includes("--videos") && response.ok && relevant.length === 1 && relevant[0].id) {
  const result = await fetch(`https://api.goal-api.com/v1/videos/match/${encodeURIComponent(relevant[0].id)}`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${process.env.GOAL_API_KEY}` },
    signal: AbortSignal.timeout(15000),
  });
  const content = await result.json();
  const videos = Array.isArray(content.data) ? content.data : [];
  console.log(JSON.stringify({
    endpoint: "/videos/match/:matchId",
    status: result.status,
    count: videos.length,
    videos: videos.map((video) => ({
      id: video.id ?? null,
      title: video.title ?? null,
      url: video.url ?? video.videoUrl ?? video.embedUrl ?? null,
      source: video.source ?? video.provider ?? video.publisher ?? null,
      publishedAt: video.publishedAt ?? video.createdAt ?? null,
    })),
    error: result.ok ? null : content.error?.message ?? content.message ?? null,
  }, null, 2));
}
