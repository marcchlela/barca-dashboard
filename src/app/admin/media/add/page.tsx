import AdminMediaAddForm from "../../../../components/admin/AdminMediaAddForm";
import { requireAdminPage } from "../../../../lib/admin/access";

import {
  getAdminMediaData,
} from "../../../../lib/admin/media";

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

export default async function AddMediaPage() {
  await requireAdminPage();
  const data =
    await getAdminMediaData();

  return (
    <AdminMediaAddForm
      data={data}
    />
  );
}
