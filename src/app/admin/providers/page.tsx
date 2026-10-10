import AdminProvidersOverview from "../../../components/admin/AdminProvidersOverview";
import { requireAdminPage } from "../../../lib/admin/access";

import {
  getAdminProvidersData,
} from "../../../lib/admin/providers";

export const dynamic = "force-dynamic";

export const revalidate = 0;

export default async function AdminProvidersPage() {
  await requireAdminPage();
  const data =
    await getAdminProvidersData();

  return (
    <AdminProvidersOverview
      data={data}
    />
  );
}
