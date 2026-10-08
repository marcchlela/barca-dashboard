import ClubMuseum from "../../components/club/ClubMuseum";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "The museum | FC Barcelona", description: "Enter the Club museum: trophies, every first-team season, and the identity of FC Barcelona." };

export default function ClubPage() {
  return <ClubMuseum />;
}
