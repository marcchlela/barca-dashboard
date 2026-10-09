import { NextResponse } from "next/server";
import { discoverDailyGoalMatches } from "../../../../../../lib/providers/dailygoal/discovery";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { mode?: unknown; preRoll?: unknown };
    if (body.mode !== "preview" && body.mode !== "apply") return NextResponse.json({ ok: false, error: "Choose preview or apply." }, { status: 400 });
    const preRoll = body.preRoll === undefined ? 1 : Number(body.preRoll);
    const result = await discoverDailyGoalMatches({ mode: body.mode, preRoll, scope: "season" });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Discovery failed." }, { status: 400 });
  }
}
