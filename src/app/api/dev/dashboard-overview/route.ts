import { NextResponse } from "next/server";

import {
  getDashboardOverview,
} from "../../../../lib/dashboard/overview";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { ok: false, error: "Not found." },
      { status: 404, headers: { "cache-control": "no-store" } },
    );
  }

  try {
    const overview =
      await getDashboardOverview();

    return NextResponse.json({
      ok: true,
      overview,
    });
  } catch (error) {
    console.error(
      "DASHBOARD OVERVIEW FAILED:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      {
        status: 500,
      },
    );
  }
}
