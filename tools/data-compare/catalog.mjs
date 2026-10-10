// Every application table in src/prisma/contract.prisma. Keep this list explicit:
// a schema change must be reviewed before it enters a private comparison snapshot.
export const CATEGORIES = {
  "Football calendar": ["season", "competition", "team", "football_match", "competition_fixture_snapshot", "standing_snapshot"],
  "Players and squad": ["player", "squad_membership", "player_absence"],
  "Match detail": ["lineup", "lineup_player", "match_event", "match_statistic", "player_match_statistic"],
  "Media and goal timing": ["media_item", "media_moment", "media_review_candidate", "goal_timestamp_candidate"],
  "Personal archive": ["favourite_player", "favourite_match", "match_diary_entry", "media_save"],
  "Club and presentation": ["kit_theme", "trophy", "trophy_win", "season_moment"],
  "Sources and curation": ["data_source", "provider_mapping", "manual_override"],
  "Predictions": ["model_version", "prediction"],
  "Operational state": ["goal_media_sync_state", "goal_media_page_cache", "goal_media_sync_run"],
};
export const TABLES = Object.values(CATEGORIES).flat();
// Never export credentials, session tokens, or login-throttle identifiers.
// Account-era snapshots remain comparison-only until ownership mapping is designed.
export const EXCLUDED_AUTH_TABLES = ["app_user", "user_session", "auth_throttle"];
export const CATEGORY_QUESTIONS = {
  "Football calendar": "Which local-only or different fixtures, scores, standings and competition snapshots (if any) should be considered for a future change? Which production-only records must remain?",
  "Players and squad": "Which roster memberships and portrait URL differences reflect intended curation, and which are provider updates?",
  "Match detail": "For each affected fixture, which confirmed lineups, corrected scorers, events and observed statistics should remain authoritative?",
  "Media and goal timing": "Which video associations, exact timestamps and review decisions are curated? Should any different or production-only media records be preserved as-is?",
  "Personal archive": "Which Top 3 slots, favourites, watched dates, ratings, notes and saved films should remain or be considered for a later transfer?",
  "Club and presentation": "Are any club history, trophy or theme differences intentional, and are their referenced visual assets available in the running build?",
  "Sources and curation": "Do provider mapping or manual override differences represent distinct identities or deliberate corrections? Resolve these before considering any dependent row.",
  "Predictions": "If predictions exist, are they reproducible/derived or curated data worth preserving?",
  "Operational state": "Should retry/cache/job history remain environment-local? No operational state is assumed transferable.",
};
export const SNAPSHOT_VERSION = 1;
export const MAX_ROWS_PER_TABLE = 200_000;
export const MAX_SNAPSHOT_BYTES = 100 * 1024 * 1024;

// Foreign keys from the Prisma contract, including optional references.
// provider_mapping.internalId and manual_override.entityId are polymorphic.
export const REFERENCES = {
  squad_membership: { seasonId: "season", teamId: "team", playerId: "player" },
  football_match: { seasonId: "season", competitionId: "competition", homeTeamId: "team", awayTeamId: "team" },
  lineup: { matchId: "football_match", teamId: "team" },
  lineup_player: { lineupId: "lineup", playerId: "player" },
  match_event: { matchId: "football_match", teamId: "team", primaryPlayerId: "player", relatedPlayerId: "player", dataSourceId: "data_source" },
  match_statistic: { matchId: "football_match", teamId: "team", dataSourceId: "data_source" },
  player_match_statistic: { matchId: "football_match", playerId: "player", teamId: "team", dataSourceId: "data_source" },
  standing_snapshot: { seasonId: "season", competitionId: "competition", teamId: "team", dataSourceId: "data_source" },
  competition_fixture_snapshot: { seasonId: "season", competitionId: "competition", canonicalMatchId: "football_match" },
  media_item: { seasonId: "season", matchId: "football_match", playerId: "player", dataSourceId: "data_source" },
  media_save: { mediaItemId: "media_item" },
  media_moment: { mediaItemId: "media_item", matchEventId: "match_event" },
  goal_timestamp_candidate: { matchId: "football_match", mediaItemId: "media_item", matchEventId: "match_event" },
  goal_media_sync_state: { matchId: "football_match" },
  goal_media_page_cache: { matchId: "football_match" },
  media_review_candidate: { seasonId: "season", matchId: "football_match", dataSourceId: "data_source" },
  kit_theme: { seasonId: "season" },
  trophy_win: { trophyId: "trophy", seasonId: "season", competitionId: "competition" },
  favourite_player: { playerId: "player" },
  favourite_match: { seasonId: "season", matchId: "football_match" },
  match_diary_entry: { matchId: "football_match", favouritePlayerId: "player", favouriteGoalEventId: "match_event" },
  prediction: { matchId: "football_match", modelVersionId: "model_version" },
  provider_mapping: { dataSourceId: "data_source" },
  season_moment: { seasonId: "season", matchId: "football_match", playerId: "player", dataSourceId: "data_source" },
  player_absence: { seasonId: "season", playerId: "player", dataSourceId: "data_source" },
};
export const POLYMORPHIC = {
  season: "season", competition: "competition", team: "team", player: "player",
  match: "football_match", event: "match_event", media: "media_item", trophy: "trophy",
};
export const OVERRIDE_TARGETS = { ...POLYMORPHIC, lineup: "lineup", match_statistic: "match_statistic",
  player_match_statistic: "player_match_statistic", media_item: "media_item", media_review_candidate: "media_review_candidate" };
