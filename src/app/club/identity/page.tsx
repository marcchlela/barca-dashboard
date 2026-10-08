import ClubIdentityStory from "../../../components/club/ClubIdentityStory";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Club identity | FC Barcelona", description: "The crest, the blaugrana colours, La Masia, and Més que un club." };

export default function ClubIdentityPage() {
  return <ClubIdentityStory />;
}
