import {
  NextResponse,
} from "next/server";

import {
  db,
} from "../../../prisma/db";

export const dynamic =
  "force-dynamic";

export async function GET() {
  try {
    await db.orm.public.Season
      .all();

    return NextResponse.json({
      ok:
        true,

      database:
        true,

      service:
        "barca-dashboard",
    });
  } catch (
    error
  ) {
    console.error(
      "HEALTH CHECK FAILED:",
      error,
    );

    return NextResponse.json(
      {
        ok:
          false,

        database:
          false,

        service:
          "barca-dashboard",
      },
      {
        status:
          503,
      },
    );
  }
}