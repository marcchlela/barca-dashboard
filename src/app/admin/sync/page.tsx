import AdminSyncControl from "../../../components/admin/AdminSyncControl";

import {
  getAdminSyncData,
} from "../../../lib/admin/sync";

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

export default async function AdminSyncPage() {
  const data =
    await getAdminSyncData();

  return (
    <AdminSyncControl
      data={data}
    />
  );
}