import { NextResponse } from "next/server";

import {
  getDashboardOverview,
} from "../../../../lib/dashboard/overview";

export async function GET() {
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