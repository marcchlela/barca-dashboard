import { NextResponse } from "next/server";
import { guardPersonalWrite } from "../../../../lib/admin/access";
import { getViewer } from "../../../../lib/auth/session";
import { db } from "../../../../prisma/db";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Body = { mediaItemId?: unknown; field?: unknown; value?: unknown };

export async function PUT(request: Request) {
  const denied = await guardPersonalWrite(request);
  if (denied) return denied;
  const userId = (await getViewer())!.id;
  try {
    const body = await request.json() as Body;
    if (typeof body.mediaItemId !== "string" || !uuid.test(body.mediaItemId) || !["favourite", "watchLater"].includes(String(body.field)) || typeof body.value !== "boolean") {
      return NextResponse.json({ ok: false, error: "Choose a video and a valid save action." }, { status: 400 });
    }
    const media = await db.orm.public.MediaItem.where({ id: body.mediaItemId }).first();
    if (!media) return NextResponse.json({ ok: false, error: "Video not found." }, { status: 404 });
    const existing = await db.orm.public.MediaSave.where({ userId, mediaItemId: media.id }).first();
    const field = body.field as "favourite" | "watchLater";
    const next = { favourite: existing?.favourite ?? false, watchLater: existing?.watchLater ?? false, [field]: body.value };
    if (existing && !next.favourite && !next.watchLater) await db.orm.public.MediaSave.where({ id: existing.id }).delete();
    else if (existing) await db.orm.public.MediaSave.where({ id: existing.id }).update(next);
    else await db.orm.public.MediaSave.create({ userId, mediaItemId: media.id, ...next });
    return NextResponse.json({ ok: true, mediaItemId: media.id, ...next });
  } catch (error) {
    console.error("MEDIA SAVE FAILED:", error);
    return NextResponse.json({ ok: false, error: "Could not save this video." }, { status: 500 });
  }
}
