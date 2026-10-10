import AdminSyncControl from "../../../components/admin/AdminSyncControl";
import { requireAdminPage } from "../../../lib/admin/access";

import {
  getAdminSyncData,
} from "../../../lib/admin/sync";

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

export default async function AdminSyncPage() {
  await requireAdminPage();
  const data =
    await getAdminSyncData();

  return (
    <AdminSyncControl
      data={data}
    />
  );
}
