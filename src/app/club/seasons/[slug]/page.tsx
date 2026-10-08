import { notFound } from "next/navigation";
import ClubSeasonExhibit from "../../../../components/club/ClubSeasonExhibit";
import { getClubSeason } from "../../../../lib/club/get-club-archive";
import { clubSeasonFromSlug } from "../../../../lib/club/history";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const season = clubSeasonFromSlug(slug);
  return { title: season ? `${season.label} season | FC Barcelona` : "Season not found | FC Barcelona" };
}

export default async function ClubSeasonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const season = await getClubSeason(slug);
  if (!season) notFound();
  return <ClubSeasonExhibit season={season} />;
}
