import { fetchJson, safeErrorMessage } from "../http";
import { matchTeamIdentity, resolveMatchCandidate } from "../match-resolver";
import { SOURCE_PROFILES } from "../source-status";
import {
  emptyCoverage,
  type InternalMatch,
  type MatchCandidate,
  type ProviderProbe,
} from "../types";

const BASE_URL = "https://www.thesportsdb.com/api/v1/json/123";

type SportsDbEvent = Record<string, string | null> & {
  idEvent: string;
  strEvent: string | null;
  strHomeTeam: string;
  strAwayTeam: string;
  intHomeScore: string | null;
  intAwayScore: string | null;
  dateEvent: string;
  strTime: string | null;
  strTimestamp: string | null;
  strLeague: string | null;
  strVenue: string | null;
  strHomeFormation: string | null;
  strAwayFormation: string | null;
  idHomeTeam: string | null;
  idAwayTeam: string | null;
};

type SportsDbRow = Record<string, string | null>;

export type SportsDbTeamIdentity = Pick<
  SportsDbEvent,
  "strHomeTeam" | "strAwayTeam" | "idHomeTeam" | "idAwayTeam"
>;

export type SportsDbLineupIdentity = {
  idTeam?: string | null;
  strTeam?: string | null;
  idPlayer?: string | null;
};

function numeric(value: string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toCandidate(event: SportsDbEvent): MatchCandidate {
  return {
    providerMatchId: event.idEvent,
    // The public payload's match clock has produced a three-hour offset in
    // this fixture and does not establish a reliable UTC instant.
    kickoff: null,
    calendarDate: event.dateEvent || null,
    localTime: event.strTime ?? event.strTimestamp?.slice(11, 19) ?? null,
    temporalPrecision: event.strTime || event.strTimestamp
      ? "local_time_unknown_zone"
      : event.dateEvent
        ? "date_only"
        : "unknown",
    homeTeam: event.strHomeTeam,
    awayTeam: event.strAwayTeam,
    homeScore: numeric(event.intHomeScore),
    awayScore: numeric(event.intAwayScore),
    competition: event.strLeague,
  };
}

export function selectBarcelonaSportsDbRows(
  detail: SportsDbTeamIdentity,
  lineup: readonly SportsDbLineupIdentity[],
) {
  const homeIsBarcelona = matchTeamIdentity(
    "FC Barcelona",
    detail.strHomeTeam,
  ).matched;
  const awayIsBarcelona = matchTeamIdentity(
    "FC Barcelona",
    detail.strAwayTeam,
  ).matched;

  if (homeIsBarcelona === awayIsBarcelona) {
    return { side: null, teamId: null, player: null } as const;
  }

  const side = homeIsBarcelona ? "home" : "away";
  const teamId = side === "home" ? detail.idHomeTeam : detail.idAwayTeam;
  const player = lineup.find((row) => {
    if (teamId && row.idTeam) return row.idTeam === teamId;
    return Boolean(
      row.strTeam && matchTeamIdentity("FC Barcelona", row.strTeam).matched,
    );
  }) ?? null;

  return { side, teamId: teamId ?? player?.idTeam ?? null, player } as const;
}

function searchName(value: string) {
  return value
    .replace(/\bFC\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function statNames(rows: SportsDbRow[]) {
  return rows.map((row) => (row.strStat ?? row.strStatName ?? "").toLowerCase());
}

function lineupSample(row: SportsDbRow) {
  return {
    idLineup: row.idLineup,
    idPlayer: row.idPlayer,
    strPlayer: row.strPlayer,
    idTeam: row.idTeam,
    strTeam: row.strTeam,
    strPosition: row.strPosition,
    strHome: row.strHome,
    strSubstitute: row.strSubstitute,
    intSquadNumber: row.intSquadNumber,
  };
}

function timelineSample(row: SportsDbRow) {
  return {
    idTimeline: row.idTimeline,
    strTimeline: row.strTimeline,
    strTimelineDetail: row.strTimelineDetail,
    strHome: row.strHome,
    idPlayer: row.idPlayer,
    strPlayer: row.strPlayer,
    idAssist: row.idAssist,
    strAssist: row.strAssist,
    intTime: row.intTime,
    idTeam: row.idTeam,
    strTeam: row.strTeam,
  };
}

function statisticSample(row: SportsDbRow) {
  return {
    idStatistic: row.idStatistic,
    strStat: row.strStat,
    intHome: row.intHome,
    intAway: row.intAway,
  };
}

function teamSample(row: SportsDbRow | null) {
  if (!row) return null;

  return {
    idTeam: row.idTeam,
    strTeam: row.strTeam,
    strLeague: row.strLeague,
    strStadium: row.strStadium,
    intStadiumCapacity: row.intStadiumCapacity,
    strLocation: row.strLocation,
    strCountry: row.strCountry,
    strWebsite: row.strWebsite,
  };
}

function playerSample(row: SportsDbRow | null) {
  if (!row) return null;

  return {
    idPlayer: row.idPlayer,
    strPlayer: row.strPlayer,
    strPosition: row.strPosition,
    strNumber: row.strNumber,
    dateBorn: row.dateBorn,
    strNationality: row.strNationality,
    idTeam: row.idTeam,
    strTeam: row.strTeam,
    strHeight: row.strHeight,
    strWeight: row.strWeight,
  };
}

export async function probeTheSportsDb(
  internal: InternalMatch,
): Promise<ProviderProbe> {
  const provider = SOURCE_PROFILES.theSportsDb;

  try {
    const search = `${searchName(internal.homeTeam.name)}_vs_${searchName(internal.awayTeam.name)}`;
    const seasonStart = Number(internal.kickoff.slice(0, 4)) -
      (Number(internal.kickoff.slice(5, 7)) < 7 ? 1 : 0);
    const season = `${seasonStart}-${seasonStart + 1}`;
    const searchResponse = await fetchJson<{ event?: SportsDbEvent[] | null }>(
      `${BASE_URL}/searchevents.php?e=${encodeURIComponent(search)}&s=${encodeURIComponent(season)}`,
    );
    const candidates = searchResponse.event ?? [];
    const found = candidates.find((event) =>
      resolveMatchCandidate(internal, toCandidate(event)).matched,
    );

    if (!found) {
      return {
        provider,
        status: "not_available",
        testedAutomatically: true,
        currentSeasonAvailable: candidates.length > 0,
        match: null,
        resolution: null,
        coverage: emptyCoverage(),
        completeness: {},
        evidence: ["The event search returned no candidate meeting the resolver threshold."],
        sanitizedSample: { candidateCount: candidates.length },
        error: null,
      };
    }

    const id = encodeURIComponent(found.idEvent);
    const [detailResponse, lineupResponse, timelineResponse, statsResponse] =
      await Promise.all([
        fetchJson<{ events?: SportsDbEvent[] | null }>(`${BASE_URL}/lookupevent.php?id=${id}`),
        fetchJson<{ lineup?: SportsDbRow[] | null }>(`${BASE_URL}/lookuplineup.php?id=${id}`),
        fetchJson<{ timeline?: SportsDbRow[] | null }>(`${BASE_URL}/lookuptimeline.php?id=${id}`),
        fetchJson<{ eventstats?: SportsDbRow[] | null }>(`${BASE_URL}/lookupeventstats.php?id=${id}`),
      ]);

    const detail = detailResponse.events?.[0] ?? found;
    const lineup = lineupResponse.lineup ?? [];
    const timeline = timelineResponse.timeline ?? [];
    const stats = statsResponse.eventstats ?? [];
    const barcelona = selectBarcelonaSportsDbRows(detail, lineup);
    const teamId = barcelona.teamId;
    const playerId = barcelona.player?.idPlayer ?? null;
    const [teamResponse, playerResponse] = await Promise.all([
      teamId
        ? fetchJson<{ teams?: SportsDbRow[] | null }>(
            `${BASE_URL}/lookupteam.php?id=${encodeURIComponent(teamId)}`,
          )
        : Promise.resolve({ teams: null }),
      playerId
        ? fetchJson<{ players?: SportsDbRow[] | null }>(
            `${BASE_URL}/lookupplayer.php?id=${encodeURIComponent(playerId)}`,
          )
        : Promise.resolve({ players: null }),
    ]);
    const team = teamResponse.teams?.[0] ?? null;
    const player = playerResponse.players?.[0] ?? null;
    const names = statNames(stats);
    const eventTypes = timeline.map((row) =>
      (row.strTimeline ?? row.strEventType ?? row.strEvent ?? "").toLowerCase(),
    );
    const match = toCandidate(detail);
    const resolution = resolveMatchCandidate(internal, match);
    const hasStarter = lineup.some((row) =>
      [row.strSubstitute, row.strSubstitutePosition]
        .filter(Boolean)
        .some((value) => value?.toLowerCase() === "no" || value?.toLowerCase() === "starter"),
    );
    const hasSubstitute = lineup.some((row) =>
      [row.strSubstitute, row.strSubstitutePosition]
        .filter(Boolean)
        .some((value) => value?.toLowerCase() === "yes" || value?.toLowerCase() === "substitute"),
    );

    return {
      provider,
      status: resolution.matched ? "ok" : "not_available",
      testedAutomatically: true,
      currentSeasonAvailable: true,
      match,
      resolution,
      coverage: emptyCoverage({
        fixturesResults: true,
        teamProfiles: Boolean(team),
        playerProfiles: Boolean(player),
        venue: Boolean(detail.strVenue),
        referee: Boolean(detail.strReferee),
        attendance: Boolean(detail.intSpectators),
        lineups: lineup.length > 0 && (hasStarter || !hasSubstitute),
        bench: hasSubstitute,
        formation: Boolean(detail.strHomeFormation || detail.strAwayFormation),
        events: timeline.length > 0,
        goalsAssists: eventTypes.some((name) => name.includes("goal")),
        cards: eventTypes.some((name) => name.includes("card")),
        substitutions: eventTypes.some((name) => name.includes("subst")),
        teamStatistics: stats.length > 0,
        possession: names.some((name) => name.includes("possession")),
        shots: names.some((name) => name.includes("shot")),
        passes: names.some((name) => name.includes("pass")),
      }),
      completeness: {
        fixture: "complete",
        venue: detail.strVenue ? "complete" : "absent",
        lineups: lineup.length ? "partial" : "absent",
        events: timeline.length ? "partial" : "absent",
        teamStatistics: stats.length ? "partial" : "absent",
      },
      evidence: [
        `Resolved TheSportsDB event ${found.idEvent}.`,
        `Free responses returned ${lineup.length} lineup, ${timeline.length} timeline, and ${stats.length} statistic rows.`,
        `Team and player profile lookups returned ${team ? "one team" : "no team"} and ${player ? "one player" : "no player"}.`,
        `Barcelona was the ${barcelona.side ?? "unresolved"} side; profile IDs were selected only from that side.`,
        "The documented five-row free cap makes all three rich collections incomplete.",
      ],
      sanitizedSample: {
        event: {
          idEvent: detail.idEvent,
          dateEvent: detail.dateEvent,
          strTime: detail.strTime,
          strHomeTeam: detail.strHomeTeam,
          strAwayTeam: detail.strAwayTeam,
          intHomeScore: detail.intHomeScore,
          intAwayScore: detail.intAwayScore,
          strVenue: detail.strVenue,
          strHomeFormation: detail.strHomeFormation,
          strAwayFormation: detail.strAwayFormation,
        },
        lineup: lineup.slice(0, 5).map(lineupSample),
        timeline: timeline.slice(0, 5).map(timelineSample),
        eventstats: stats.slice(0, 5).map(statisticSample),
        team: teamSample(team),
        player: playerSample(player),
      },
      error: null,
    };
  } catch (error) {
    return {
      provider,
      status: "error",
      testedAutomatically: true,
      currentSeasonAvailable: null,
      match: null,
      resolution: null,
      coverage: emptyCoverage(),
      completeness: {},
      evidence: ["The provider failed independently; other probes were allowed to continue."],
      sanitizedSample: null,
      error: safeErrorMessage(error),
    };
  }
}
