import { NextResponse } from "next/server";
import { Temporal } from "temporal-polyfill";
import { db } from "../../../../../prisma/db";
import { guardAdminRequest } from "../../../../../lib/admin/access";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const goalTypes = new Set(["goal", "own_goal", "penalty_goal"]);
type Body = { action?: unknown; mediaItemId?: unknown; matchEventId?: unknown; startSecond?: unknown; endSecond?: unknown; evidenceUrl?: unknown; reviewNote?: unknown };
const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

export async function PUT(request: Request) {
  const denied = await guardAdminRequest(request);
  if (denied) return denied;
  try {
    const body = await request.json() as Body;
    if (typeof body.mediaItemId !== "string" || !uuid.test(body.mediaItemId)) return bad("Choose a valid film.");
    const media = await db.orm.public.MediaItem.where({ id: body.mediaItemId }).first();
    if (!media) return bad("Stored film not found.", 404);
    if (!media.isOfficial && !media.dataSourceId) return bad("A non-official film needs a recorded publisher source before curation.");
    if (body.action === "feature") {
      const currentlyFeatured = await db.orm.public.MediaItem.all();
      for (const item of currentlyFeatured.filter((item) => item.featuredAt && item.id !== media.id)) {
        await db.orm.public.MediaItem.where({ id: item.id }).update({ featuredAt: null });
      }
      await db.orm.public.MediaItem.where({ id: media.id }).update({ featuredAt: Temporal.Now.instant() });
      return NextResponse.json({ ok: true });
    }
    if (body.action !== "verify-goal") return bad("Choose a curation action.");
    if (typeof body.matchEventId !== "string" || !uuid.test(body.matchEventId)) return bad("Choose a valid goal event.");
    if (!media.matchId) return bad("Attach this film to its canonical match first.");
    const event = await db.orm.public.MatchEvent.where({ id: body.matchEventId }).first();
    if (!event || event.matchId !== media.matchId || !goalTypes.has(event.type)) return bad("The chosen event is not a goal in this film's match.");
    const start = body.startSecond === "" || body.startSecond == null ? null : Number(body.startSecond);
    const end = body.endSecond === "" || body.endSecond == null ? null : Number(body.endSecond);
    if ((start !== null && (!Number.isInteger(start) || start < 0)) || (end !== null && (!Number.isInteger(end) || end <= 0))) return bad("Clip times must be whole seconds.");
    if ((start === null && end !== null) || (start !== null && end !== null && (end <= start || end - start > 180))) return bad("An end requires a start; when given, it must follow within three minutes.");
    if (media.type !== "goal_clip" && start === null) return bad("A match film needs a confirmed start time for this goal.");
    if (media.type !== "goal_clip" && end === null && (media.type !== "match_highlight" || !media.isOfficial || !media.externalMediaId || !/^[A-Za-z0-9_-]{11}$/.test(media.externalMediaId))) return bad("An open-ended goal moment requires an official YouTube match highlight.");
    if (typeof body.evidenceUrl !== "string" || !/^https:\/\//.test(body.evidenceUrl)) return bad("Provide an HTTPS source supporting this exact goal.");
    const note = typeof body.reviewNote === "string" ? body.reviewNote.trim().slice(0, 500) : "";
    const existing = await db.orm.public.MediaMoment.where({ mediaItemId: media.id, matchEventId: event.id }).first();
    const values = { startSecond: start, endSecond: end, evidenceUrl: body.evidenceUrl, reviewNote: note || null, verificationBasis: "manual_visual", verifiedAt: Temporal.Now.instant() };
    if (existing) await db.orm.public.MediaMoment.where({ id: existing.id }).update(values);
    else await db.orm.public.MediaMoment.create({ mediaItemId: media.id, matchEventId: event.id, ...values });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("MEDIA CURATION FAILED:", error);
    return bad("Could not save media curation.", 500);
  }
}

export async function DELETE(request: Request) {
  const denied = await guardAdminRequest(request);
  if (denied) return denied;
  try {
    const body = await request.json() as { id?: unknown };
    if (typeof body.id !== "string" || !uuid.test(body.id)) return bad("Choose a verified link.");
    const row = await db.orm.public.MediaMoment.where({ id: body.id }).first();
    if (!row) return bad("Goal link not found.", 404);
    await db.orm.public.MediaMoment.where({ id: row.id }).delete();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("MEDIA CURATION DELETE FAILED:", error);
    return bad("Could not remove this goal link.", 500);
  }
}

export async function PATCH(request: Request) {
  const denied = await guardAdminRequest(request);
  if (denied) return denied;
  try {
    const body = await request.json() as { action?: unknown; momentIds?: unknown };
    if (body.action !== "shelf-add" && body.action !== "shelf-remove") return bad("Choose a valid shelf action.");
    if (!Array.isArray(body.momentIds) || body.momentIds.length < 1 || body.momentIds.length > 50 || body.momentIds.some((id) => typeof id !== "string" || !uuid.test(id))) return bad("Choose between one and fifty valid goals.");
    const ids = [...new Set(body.momentIds as string[])];
    const allMoments = await db.orm.public.MediaMoment.all();
    const selected = allMoments.filter((moment) => ids.includes(moment.id));
    if (selected.length !== ids.length) return bad("One or more selected goal moments no longer exist.", 404);
    const now = Temporal.Now.instant();
    for (const moment of selected) {
      if (body.action === "shelf-add") {
        for (const duplicate of allMoments.filter((candidate) => candidate.matchEventId === moment.matchEventId && candidate.id !== moment.id && candidate.curatedAt !== null)) {
          await db.orm.public.MediaMoment.where({ id: duplicate.id }).update({ curatedAt: null });
        }
        await db.orm.public.MediaMoment.where({ id: moment.id }).update({ curatedAt: now });
      } else {
        await db.orm.public.MediaMoment.where({ id: moment.id }).update({ curatedAt: null });
      }
    }
    return NextResponse.json({ ok: true, updated: selected.length });
  } catch (error) {
    console.error("MEDIA GOAL SHELF UPDATE FAILED:", error);
    return bad("Could not update Goals worth another look.", 500);
  }
}
