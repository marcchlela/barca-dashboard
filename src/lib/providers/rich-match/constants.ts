export const RICH_MATCH_TARGET = {
  id: "dc0f3ba4-90ae-439d-b839-f15e15854fd4",
  kickoff: "2026-09-19T19:00:00Z",
  homeTeam: "Sevilla FC",
  awayTeam: "FC Barcelona",
  homeScore: 1,
  awayScore: 3,
} as const;

export const RICH_DATA_SOURCES = {
  goal: {
    code: "goal-api",
    name: "GOAL API",
    baseUrl: "https://api.goal-api.com/v1",
    isOfficial: false,
    isEnabled: true,
    licenseNotes: "Licensed third-party football data; usage is subject to GOAL API terms.",
  },
  bigBalls: {
    code: "big-balls-data",
    name: "Big Balls Sports Data",
    baseUrl: "https://api.bigballsdata.com",
    isOfficial: false,
    isEnabled: true,
    licenseNotes: "Documented authenticated API; review reuse terms before production use.",
  },
  statsHawk: {
    code: "statshawk",
    name: "StatsHawk",
    baseUrl: "https://api.statshawk.ai/v1",
    isOfficial: false,
    isEnabled: true,
    licenseNotes: "Verified future fallback for player match statistics; coverage is availability-limited.",
  },
} as const;
