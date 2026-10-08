import type { Metadata } from "next";
import MediaScreeningRoom from "../../components/media/MediaScreeningRoom";
import { getMediaLibrary } from "../../lib/media/get-media-library";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = { title: "Media | FC Barcelona", description: "Watch and relive official Barça match films, moments, and archive stories." };

export default async function MediaPage() {
  const data = await getMediaLibrary();
  return <MediaScreeningRoom data={data} />;
}
