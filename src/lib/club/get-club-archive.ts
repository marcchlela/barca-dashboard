import "server-only";

import { db } from "../../prisma/db";
import { CLUB_SEASONS, clubHonourCompetitionCode, clubHonourDisplayName, clubSeasonFromSlug } from "./history";

type MuseumRow = Awaited<ReturnType<typeof db.orm.public.SeasonMoment.all>>[number];

function museumRecord(row: MuseumRow) {
  const metadata = row.metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const record = metadata as Record<string, unknown>;
  if (typeof record.clubCurationId !== "string" || typeof record.sourceUrl !== "string" ||
      !record.sourceUrl.startsWith("https://")) return null;
  return { row, id: record.clubCurationId, source: record.sourceUrl, publishedLabel: typeof record.publishedLabel === "string" ? record.publishedLabel : null };
}

function exhibitRecords(rows: MuseumRow[]) {
  const records = rows.map(museumRecord).filter((item) => item !== null);
  return {
    honours: records.filter((item) => item.id.startsWith("honour:") && item.publishedLabel !== null)
      .map((item) => ({ name: item.row.title, publishedLabel: item.publishedLabel!, source: item.source })),
    moments: records.filter((item) => item.id.startsWith("moment:"))
      .map((item) => ({ id: item.id, title: item.row.title, description: item.row.description ?? "", source: item.source })),
    storedMomentCount: records.length,
  };
}

export async function getClubArchive() {
  const [canonical, moments] = await Promise.all([
    db.orm.public.Season.all(), db.orm.public.SeasonMoment.all(),
  ]);
  const byYear = new Map(canonical.map((season) => [season.startYear, season]));
  const bySeasonId = new Map<string, MuseumRow[]>();
  for (const moment of moments) {
    const group = bySeasonId.get(moment.seasonId) ?? [];
    group.push(moment);
    bySeasonId.set(moment.seasonId, group);
  }
  return {
    seasons: CLUB_SEASONS.map((season) => {
      const stored = byYear.get(season.startYear);
      return { ...season, ...exhibitRecords(stored ? bySeasonId.get(stored.id) ?? [] : []), canonicalId: stored?.id ?? null, isCurrent: stored?.isCurrent ?? season.isCurrent };
    }),
    storedCount: CLUB_SEASONS.filter((season) => byYear.has(season.startYear)).length,
  };
}

export async function getClubSeason(slug: string) {
  const curated = clubSeasonFromSlug(slug);
  if (!curated) return null;
  const [canonical, competitions] = await Promise.all([
    db.orm.public.Season.where({ startYear: curated.startYear }).first(),
    db.orm.public.Competition.all(),
  ]);
  const storedMoments = canonical ? await db.orm.public.SeasonMoment.where({ seasonId: canonical.id }).all() : [];
  const records = exhibitRecords(storedMoments);
  const competitionByCode = new Map(competitions.map((competition) => [competition.code, competition]));
  return {
    ...curated,
    ...records,
    honours: records.honours.map((honour) => {
      const competitionCode = clubHonourCompetitionCode(honour.name);
      return {
        ...honour,
        displayName: clubHonourDisplayName(honour.name),
        competitionCode,
        logoUrl: competitionCode ? competitionByCode.get(competitionCode)?.logoUrl ?? null : null,
      };
    }),
    canonicalId: canonical?.id ?? null,
    isCurrent: canonical?.isCurrent ?? curated.isCurrent,
  };
}

export type ClubArchiveData = Awaited<ReturnType<typeof getClubArchive>>;
export type ClubSeasonData = NonNullable<Awaited<ReturnType<typeof getClubSeason>>>;
