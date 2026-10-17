import { requireAdminPage } from "../../../lib/admin/access";
import AdminNotifications from "../../../components/admin/AdminNotifications";

export const dynamic = "force-dynamic";

export default async function AdminNotificationsPage() {
  await requireAdminPage();
  return <AdminNotifications />;
}
