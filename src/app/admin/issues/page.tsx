import AdminDataIssues from "../../../components/admin/AdminDataIssues";
import { requireAdminPage } from "../../../lib/admin/access";

import {
  getAdminDataIssues,
} from "../../../lib/admin/issues";

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

export default async function AdminIssuesPage() {
  await requireAdminPage();
  const data =
    await getAdminDataIssues();

  return (
    <AdminDataIssues
      data={data}
    />
  );
}
