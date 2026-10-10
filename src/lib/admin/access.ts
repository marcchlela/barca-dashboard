import "server-only";

import { notFound } from "next/navigation";
import { getViewer, requireSameOrigin, type Viewer } from "../auth/session";

export function isAllowlistedAdmin(viewer: Viewer | null, allowedSubjects: readonly string[]): boolean {
  return Boolean(viewer && viewer.role === "admin" && allowedSubjects.includes(viewer.id));
}

function adminAllowed(viewer: Viewer | null): boolean {
  if (!viewer || viewer.role !== "admin") return false;
  if (process.env.NODE_ENV !== "production") return true;
  const subjects = (process.env.BARCA_ADMIN_SUBJECTS ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  return isAllowlistedAdmin(viewer, subjects);
}

export async function requireAdminPage(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!adminAllowed(viewer)) notFound();
  return viewer!;
}

export async function guardAdminRequest(request: Request): Promise<Response | null> {
  const viewer = await getViewer();
  if (!adminAllowed(viewer)) return Response.json({ ok: false, error: "Not found." }, { status: 404, headers: { "cache-control": "no-store" } });
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase())) {
    const denied = requireSameOrigin(request);
    if (denied) return denied;
    if (process.env.NODE_ENV === "production") {
      return Response.json({ ok: false, error: "Production admin editing is not activated yet." }, { status: 503, headers: { "cache-control": "no-store" } });
    }
  }
  return null;
}

export async function guardPersonalWrite(request: Request): Promise<Response | null> {
  if (!await getViewer()) return Response.json({ ok: false, error: "Sign in to save your personal choices." }, { status: 401, headers: { "cache-control": "no-store" } });
  return requireSameOrigin(request);
}
