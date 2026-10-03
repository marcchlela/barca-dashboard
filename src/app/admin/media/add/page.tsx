import AdminMediaAddForm from "../../../../components/admin/AdminMediaAddForm";

import {
  getAdminMediaData,
} from "../../../../lib/admin/media";

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

export default async function AddMediaPage() {
  const data =
    await getAdminMediaData();

  return (
    <AdminMediaAddForm
      data={data}
    />
  );
}