import MediaCuration from "../../../../components/admin/MediaCuration";
import { getMediaCuration } from "../../../../lib/media/get-media-curation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MediaCurationPage() {
  return <MediaCuration data={await getMediaCuration()} />;
}
