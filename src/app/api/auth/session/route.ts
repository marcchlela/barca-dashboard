import { getViewer } from "../../../../lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const viewer = await getViewer();
  return Response.json({ authenticated: Boolean(viewer), user: viewer ? { id: viewer.id, username: viewer.username, role: viewer.role } : null }, { headers: { "cache-control": "private, no-store" } });
}
