import AdminEmailDesk from "../../../components/admin/AdminEmailDesk";
import { requireAdminPage } from "../../../lib/admin/access";
import { getAdminEmailData } from "../../../lib/email/admin";
import { renderDashboardEmail } from "../../../lib/email/templates";

export const dynamic = "force-dynamic";

export default async function AdminEmailPage() {
  const viewer = await requireAdminPage();
  let data: Awaited<ReturnType<typeof getAdminEmailData>> | null = null;
  try { data = await getAdminEmailData(); }
  catch { console.error("ADMIN EMAIL STATUS UNAVAILABLE"); }
  return <AdminEmailDesk data={data} ownEmail={viewer.email} previews={{
    reset: renderDashboardEmail("password_reset", { resetUrl: "https://example.invalid/account/reset-password?token=PREVIEW_ONLY", origin: "https://example.invalid" }).html,
    welcome: renderDashboardEmail("welcome", { origin: "https://example.invalid", username: viewer.username }).html,
    test: renderDashboardEmail("admin_test", { origin: "https://example.invalid" }).html,
  }} />;
}
