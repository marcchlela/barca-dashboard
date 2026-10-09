/** Read-only canonical lineup coverage audit for finished Barcelona matches. */
import "dotenv/config";
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const { rows } = await client.query(`
    SELECT m.id, m.kickoff, m.status, m."homeScore", m."awayScore",
      home.name AS home, away.name AS away, competition.name AS competition,
      competition.code AS "competitionCode", m."homeTeamId", m."awayTeamId",
      lineup.id AS "lineupId", lineup."teamId", team.name AS "lineupTeam",
      lineup.formation, lineup."isConfirmed",
      count(player.id)::int AS players,
      count(player.id) FILTER (WHERE player.role = 'starter')::int AS starters,
      count(player.id) FILTER (WHERE player.role = 'substitute')::int AS substitutes
    FROM football_match m
    JOIN team home ON home.id = m."homeTeamId"
    JOIN team away ON away.id = m."awayTeamId"
    JOIN competition ON competition.id = m."competitionId"
    LEFT JOIN lineup ON lineup."matchId" = m.id
    LEFT JOIN team ON team.id = lineup."teamId"
    LEFT JOIN lineup_player player ON player."lineupId" = lineup.id
    WHERE (home."isBarcelona" OR away."isBarcelona") AND m.status = 'finished'
    GROUP BY m.id, home.name, away.name, competition.name, competition.code,
      lineup.id, team.name
    ORDER BY m.kickoff DESC, lineup."teamId"
  `);
  const byMatch = new Map();
  for (const row of rows) {
    const match = byMatch.get(row.id) ?? {
      id: row.id, kickoff: row.kickoff, home: row.home, away: row.away,
      score: `${row.homeScore}-${row.awayScore}`, competition: row.competition,
      competitionCode: row.competitionCode, homeLineup: null, awayLineup: null,
    };
    if (row.lineupId) {
      const side = row.teamId === row.homeTeamId ? "homeLineup" : "awayLineup";
      match[side] = { team: row.lineupTeam, formation: row.formation,
        confirmed: row.isConfirmed, players: row.players, starters: row.starters,
        substitutes: row.substitutes };
    }
    byMatch.set(row.id, match);
  }
  const matches = [...byMatch.values()];
  const incomplete = matches.filter((match) => !match.homeLineup || !match.awayLineup ||
    match.homeLineup.starters !== 11 || match.awayLineup.starters !== 11);
  if (process.argv.includes("--provider-mappings")) {
    const providerRows = await client.query(`
      SELECT m.id AS "matchId", source.name AS source, mapping."providerId"
      FROM football_match m
      JOIN provider_mapping mapping ON mapping."internalId" = m.id
      JOIN data_source source ON source.id = mapping."dataSourceId"
      WHERE m.id = ANY($1::uuid[])
      ORDER BY m.kickoff DESC, source.name
    `, [matches.map((match) => match.id)]);
    for (const match of matches) {
      match.providerMappings = providerRows.rows.filter((row) => row.matchId === match.id)
        .map(({ source, providerId }) => ({ source, providerId }));
    }
  }
  if (process.argv.includes("--details")) {
    for (const match of incomplete) {
      const [mappings, counts] = await Promise.all([
        client.query('select source.name as source, mapping."entityType", mapping."providerId" from provider_mapping mapping join data_source source on source.id = mapping."dataSourceId" where mapping."internalId" = $1 order by source.name', [match.id]),
        client.query('select (select count(*)::int from match_event where "matchId" = $1) as events, (select count(*)::int from match_statistic where "matchId" = $1) as team_stats, (select count(*)::int from player_match_statistic where "matchId" = $1) as player_stats, (select "updatedAt" from football_match where id = $1) as updated_at', [match.id]),
      ]);
      const competitionMappings = await client.query('select source.name as source, mapping."providerId" from provider_mapping mapping join data_source source on source.id = mapping."dataSourceId" where mapping."internalId" = (select "competitionId" from football_match where id = $1)', [match.id]);
      const events = await client.query('select event.id, event.type, event.minute, source.name as source, (select count(*)::int from media_moment media where media."matchEventId" = event.id) as moments from match_event event left join data_source source on source.id = event."dataSourceId" where event."matchId" = $1 order by event."eventOrder"', [match.id]);
      match.diagnostics = { mappings: mappings.rows, competitionMappings: competitionMappings.rows,
        eventSources: events.rows, ...counts.rows[0] };
    }
  }
  console.log(JSON.stringify({ total: matches.length,
    incomplete,
    all: process.argv.includes("--all") ? matches : undefined }, null, 2));
} finally {
  await client.end();
}
