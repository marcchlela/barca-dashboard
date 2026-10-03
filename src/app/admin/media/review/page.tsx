import AdminMediaReviewQueue from "../../../../components/admin/AdminMediaReviewQueue";

import {
  getAdminMediaReviewData,
} from "../../../../lib/admin/media-review";

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

export default async function MediaReviewPage() {
  const data =
    await getAdminMediaReviewData();

  return (
    <AdminMediaReviewQueue
      data={data}
    />
  );
}