import { fetchJson, safeErrorMessage } from "../http";
import { SOURCE_PROFILES } from "../source-status";
import { emptyCoverage, type InternalMatch, type ProviderProbe } from "../types";

const COMPETITIONS_URL =
  "https://raw.githubusercontent.com/statsbomb/open-data/master/data/competitions.json";

type CompetitionRow = {
  competition_id: number;
  season_id: number;
  country_name: string;
  competition_name: string;
  competition_gender: string;
  season_name: string;
  match_updated: string;
  match_available_360: string | null;
  match_available: string;
};

export async function probeStatsBomb(
  internal: InternalMatch,
): Promise<ProviderProbe> {
  const provider = SOURCE_PROFILES.statsBomb;

  try {
    const rows = await fetchJson<CompetitionRow[]>(COMPETITIONS_URL);
    const laLiga = rows.filter((row) =>
      row.competition_name.toLowerCase().includes("la liga"),
    );
    const targetSeasonStart = Number(internal.kickoff.slice(0, 4)) -
      (Number(internal.kickoff.slice(5, 7)) < 7 ? 1 : 0);
    const targetSeason = `${targetSeasonStart}/${String(targetSeasonStart + 1).slice(-2)}`;
    const current = laLiga.find((row) => row.season_name === targetSeason);
    const sorted = [...laLiga].sort((a, b) =>
      b.season_name.localeCompare(a.season_name),
    );

    return {
      provider,
      status: "not_available",
      testedAutomatically: true,
      currentSeasonAvailable: Boolean(current),
      match: null,
      resolution: null,
      coverage: emptyCoverage(),
      completeness: {
        currentFixture: "absent",
        historicalEvents: laLiga.length ? "complete" : "unknown",
      },
      evidence: [
        `Inspected ${rows.length} official competition-season records.`,
        current
          ? `The target season ${targetSeason} exists, but the selected match was not resolved by this catalogue-only probe.`
          : `The target season ${targetSeason} is absent; newest published La Liga season is ${sorted[0]?.season_name ?? "unknown"}.`,
      ],
      sanitizedSample: {
        targetSeason,
        currentSeasonEntry: current ?? null,
        newestLaLigaEntries: sorted.slice(0, 3),
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
