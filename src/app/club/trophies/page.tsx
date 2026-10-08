import ClubTrophyMuseum from "../../../components/club/ClubTrophyMuseum";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Trophy gallery | FC Barcelona", description: "A guided museum walk through Barça's major honours and complete first-team trophy record." };

export default function ClubTrophiesPage() {
  return <ClubTrophyMuseum />;
}
