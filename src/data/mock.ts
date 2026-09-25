export const mockMatch = {
  id: "barca-valencia-2026-27",

  competition: "La Liga",
  matchday: 11,

  homeTeam: {
    name: "FC Barcelona",
    shortName: "Barcelona",
    code: "BAR",
  },

  awayTeam: {
    name: "Valencia CF",
    shortName: "Valencia",
    code: "VAL",
  },

  venue: "Spotify Camp Nou",

  kickoff: {
    day: "Saturday",
    time: "20:00",
  },

  countdown: {
    days: 3,
    hours: 14,
    minutes: 22,
  },

  live: {
    minute: 37,
    homeScore: 2,
    awayScore: 0,

    events: [
      {
        minute: 17,
        type: "goal",
        player: "Lamine Yamal",
        team: "barcelona",
      },
      {
        minute: 31,
        type: "goal",
        player: "Pedri",
        team: "barcelona",
      },
    ],

    stats: {
      possession: 62,
      shots: 11,
      xg: 1.74,
    },
  },

  fulltime: {
    homeScore: 3,
    awayScore: 1,

    scorers: [
      "Lamine Yamal 17'",
      "Pedri 31'",
      "Raphinha 71'",
    ],
  },

  prediction: {
    barcelona: 64,
    draw: 21,
    opponent: 15,
  },
};