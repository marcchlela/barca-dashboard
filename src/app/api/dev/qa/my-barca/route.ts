import { NextResponse } from "next/server";
import { db } from "../../../../../prisma/db";
import { getMyBarca } from "../../../../../lib/my-barca/get-my-barca";
import { seasonSummary } from "../../../../../lib/my-barca/archive-math";

export async function GET() {
  if (process.env.NODE_ENV === "production") return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  try {
    const [archive, clips] = await Promise.all([
      getMyBarca(),
      db.orm.public.MediaItem.where({ type: "goal_clip" }).all(),
    ]);
    const currentEntries = archive.entries.filter((entry) => entry.seasonId === archive.currentSeasonId);
    return NextResponse.json({
      ok: true,
      season: archive.seasonOptions.find((season) => season.id === archive.currentSeasonId)?.label ?? null,
      summary: seasonSummary(currentEntries),
      diaryEntries: currentEntries.filter((entry) => entry.hasDiary).length,
      favouriteGoals: currentEntries.filter((entry) => entry.favouriteGoal).length,
      favouritePlayers: archive.favouritePlayers.length,
      favouriteMatches: archive.favouriteMatches.filter((pick) => pick.seasonId === archive.currentSeasonId).length,
      liveEntriesUsingKickoffDate: currentEntries.filter((entry) => entry.watched && entry.watchType === "live" && entry.watchedAt === entry.kickoff).length,
      goalClipAudit: {
        officialMatchGoalClips: clips.filter((clip) => clip.isOfficial && clip.matchId !== null).length,
        exactEventLinks: 0,
        reason: "MediaItem has no MatchEvent relation; match-level goal clips cannot be asserted as a particular favourite goal.",
      },
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
