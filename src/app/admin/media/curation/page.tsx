import MediaCuration from "../../../../components/admin/MediaCuration";
import { requireAdminPage } from "../../../../lib/admin/access";
import { getMediaCuration } from "../../../../lib/media/get-media-curation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MediaCurationPage() {
  await requireAdminPage();
  return <MediaCuration data={await getMediaCuration()} />;
}
