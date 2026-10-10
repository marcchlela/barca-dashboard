import AccountScreen from "../../components/auth/AccountScreen";
import { getViewer } from "../../lib/auth/session";
import { validReturnPath } from "../../lib/auth/policy";

export const dynamic = "force-dynamic";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const [viewer, query] = await Promise.all([getViewer(), searchParams]);
  return <AccountScreen viewer={viewer ? { username: viewer.username, email: viewer.email, role: viewer.role } : null} next={validReturnPath(query.next)} signupOpen={process.env.NODE_ENV !== "production" || process.env.BARCA_SIGNUP_ENABLED === "1"} />;
}
