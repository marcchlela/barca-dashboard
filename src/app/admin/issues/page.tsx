import AdminDataIssues from "../../../components/admin/AdminDataIssues";

import {
  getAdminDataIssues,
} from "../../../lib/admin/issues";

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

export default async function AdminIssuesPage() {
  const data =
    await getAdminDataIssues();

  return (
    <AdminDataIssues
      data={data}
    />
  );
}