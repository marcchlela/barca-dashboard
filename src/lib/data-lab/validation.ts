import {
  matchTeamIdentity,
  resolveMatchCandidate,
} from "./match-resolver";
import { selectBarcelonaSportsDbRows } from "./providers/the-sports-db";
import type {
  InternalMatch,
  MatchCandidate,
} from "./types";

const INTERNAL_MATCH: InternalMatch = {
  id: "validation-match",
  kickoff: "2026-09-19T19:00:00Z",
  status: "finished",
  competition: {
    id: "validation-competition",
    name: "La Liga",
    code: "PD",
  },
  seasonId: "validation-season",
  matchday: 5,
  homeTeam: { id: "sevilla", name: "Sevilla FC" },
  awayTeam: { id: "barcelona", name: "FC Barcelona" },
  score: { home: 1, away: 3 },
  providerIds: { mapped: "provider-match-1" },
};

function candidate(
  overrides: Partial<MatchCandidate> = {},
): MatchCandidate {
  return {
    providerMatchId: null,
    kickoff: "2026-09-19T19:00:00Z",
    calendarDate: "2026-09-19",
    localTime: null,
    temporalPrecision: "exact",
    homeTeam: "Sevilla",
    awayTeam: "Barcelona",
    homeScore: 1,
    awayScore: 3,
    competition: "LaLiga",
    ...overrides,
  };
}

export function runDataLabDeterministicValidation() {
  const exact = resolveMatchCandidate(INTERNAL_MATCH, candidate());
  const outsideTolerance = resolveMatchCandidate(
    INTERNAL_MATCH,
    candidate({ kickoff: "2026-09-19T19:31:00Z" }),
  );
  const localUnknownZone = resolveMatchCandidate(
    INTERNAL_MATCH,
    candidate({
      kickoff: null,
      localTime: "22:00:00",
      temporalPrecision: "local_time_unknown_zone",
    }),
  );
  const dateOnly = resolveMatchCandidate(
    INTERNAL_MATCH,
    candidate({
      kickoff: null,
      localTime: null,
      temporalPrecision: "date_only",
    }),
  );
  const mapped = resolveMatchCandidate(
    INTERNAL_MATCH,
    candidate({
      providerMatchId: "provider-match-1",
      kickoff: "2026-09-20T03:00:00Z",
      calendarDate: "2026-09-20",
    }),
    "mapped",
  );
  const upcoming: InternalMatch = {
    ...INTERNAL_MATCH,
    status: "scheduled",
    score: { home: null, away: null },
  };
  const upcomingExactTeams = resolveMatchCandidate(
    upcoming,
    candidate({
      kickoff: null,
      localTime: null,
      temporalPrecision: "date_only",
      homeScore: null,
      awayScore: null,
    }),
  );
  const upcomingAliasOnly = resolveMatchCandidate(
    upcoming,
    candidate({
      kickoff: null,
      localTime: null,
      temporalPrecision: "date_only",
      awayTeam: "Barça",
      homeScore: null,
      awayScore: null,
    }),
  );
  const sportsDbHome = selectBarcelonaSportsDbRows(
    {
      strHomeTeam: "FC Barcelona",
      strAwayTeam: "Real Madrid",
      idHomeTeam: "barca-home",
      idAwayTeam: "madrid-away",
    },
    [
      { idTeam: "madrid-away", strTeam: "Real Madrid", idPlayer: "madrid-player" },
      { idTeam: "barca-home", strTeam: "Barcelona", idPlayer: "barca-player" },
    ],
  );
  const sportsDbAway = selectBarcelonaSportsDbRows(
    {
      strHomeTeam: "Sevilla",
      strAwayTeam: "Barcelona",
      idHomeTeam: "sevilla-home",
      idAwayTeam: "barca-away",
    },
    [
      { idTeam: "sevilla-home", strTeam: "Sevilla", idPlayer: "sevilla-player" },
      { idTeam: "barca-away", strTeam: "FC Barcelona", idPlayer: "barca-player" },
    ],
  );

  const cases = [
    {
      name: "timezone-aware kickoff at zero minutes resolves exactly",
      passed:
        exact.matched &&
        exact.criteria.exactKickoff &&
        exact.criteria.kickoffDeltaMinutes === 0,
    },
    {
      name: "timezone-aware kickoff outside 30 minutes does not fall back to date-only",
      passed: !outsideTolerance.matched && !outsideTolerance.criteria.exactKickoff,
    },
    {
      name: "timezone-naive local time is not compared as an instant",
      passed:
        localUnknownZone.matched &&
        !localUnknownZone.criteria.exactKickoff &&
        localUnknownZone.criteria.sameCalendarDate,
    },
    {
      name: "date-only finished result resolves with teams, score, and competition",
      passed:
        dateOnly.matched &&
        dateOnly.criteria.temporalPrecision === "date_only" &&
        !dateOnly.criteria.exactKickoff,
    },
    {
      name: "exact provider mapping remains strongest when teams agree",
      passed: mapped.matched && mapped.criteria.providerId,
    },
    {
      name: "upcoming date-only match requires exact normalized team identities",
      passed: upcomingExactTeams.matched && !upcomingAliasOnly.matched,
    },
    {
      name: "Barcelona first team does not match Barcelona B",
      passed: !matchTeamIdentity("FC Barcelona", "Barcelona B").matched,
    },
    {
      name: "Barcelona first team does not match Barcelona U19",
      passed: !matchTeamIdentity("FC Barcelona", "FC Barcelona U19").matched,
    },
    {
      name: "Barcelona first team does not match Barcelona women",
      passed: !matchTeamIdentity("FC Barcelona", "FC Barcelona W").matched,
    },
    {
      name: "TheSportsDB home-side Barcelona selects home team and player",
      passed:
        sportsDbHome.side === "home" &&
        sportsDbHome.teamId === "barca-home" &&
        sportsDbHome.player?.idPlayer === "barca-player",
    },
    {
      name: "TheSportsDB away-side Barcelona selects away team and player",
      passed:
        sportsDbAway.side === "away" &&
        sportsDbAway.teamId === "barca-away" &&
        sportsDbAway.player?.idPlayer === "barca-player",
    },
  ];

  return {
    allPassed: cases.every((testCase) => testCase.passed),
    cases,
  };
}
