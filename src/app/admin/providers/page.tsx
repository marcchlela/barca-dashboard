import AdminProvidersOverview from "../../../components/admin/AdminProvidersOverview";

import {
  getAdminProvidersData,
} from "../../../lib/admin/providers";

export const dynamic = "force-dynamic";

export const revalidate = 0;

export default async function AdminProvidersPage() {
  const data =
    await getAdminProvidersData();

  return (
    <AdminProvidersOverview
      data={data}
    />
  );
}