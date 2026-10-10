import AdminMediaReviewQueue from "../../../../components/admin/AdminMediaReviewQueue";
import { requireAdminPage } from "../../../../lib/admin/access";

import {
  getAdminMediaReviewData,
} from "../../../../lib/admin/media-review";

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

export default async function MediaReviewPage() {
  await requireAdminPage();
  const data =
    await getAdminMediaReviewData();

  return (
    <AdminMediaReviewQueue
      data={data}
    />
  );
}
