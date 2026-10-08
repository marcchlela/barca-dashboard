import ClubSeasonsIndex from "../../../components/club/ClubSeasonsIndex";
import { getClubArchive } from "../../../lib/club/get-club-archive";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Season archive | FC Barcelona", description: "Explore every men's first-team season from 1899/00 to today." };

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ClubSeasonsPage() {
  return <ClubSeasonsIndex data={await getClubArchive()} />;
}
