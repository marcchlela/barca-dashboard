import SettingsScreen from "../../../components/auth/SettingsScreen";
import { getViewer } from "../../../lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AccountSettingsPage() {
  const viewer = await getViewer();
  return <SettingsScreen viewer={viewer ? { username: viewer.username, email: viewer.email, role: viewer.role } : null} view="account" />;
}
