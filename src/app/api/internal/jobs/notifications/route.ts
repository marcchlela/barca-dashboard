import { runNotificationWorker } from "../../../../../lib/notifications/worker";

export async function POST(request: Request) {
  const secret = process.env.INTERNAL_JOB_SECRET;
  if (!secret) return Response.json({ ok: false, error: "Internal job authentication is not configured." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  const result = await runNotificationWorker();
  return Response.json({ ok: result.status !== "failed", ...result }, { headers: { "cache-control": "no-store" } });
}
