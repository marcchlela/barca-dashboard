import {
  NextResponse,
} from "next/server";

import {
  runAutomaticMatchMediaWorker,
} from "../../../../lib/providers/youtube-fcbarcelona/automatic-worker";

type RequestBody = {
  dryRun?:
    unknown;

  forceAllFinished?:
    unknown;

  extraMediaWindowHours?:
    unknown;

  missingHighlightLookbackDays?:
    unknown;
};

export async function POST(
  request:
    Request,
) {
  if (
    process.env
      .NODE_ENV ===
    "production"
  ) {
    return NextResponse.json(
      {
        ok:
          false,

        error:
          "This development endpoint is disabled in production.",
      },
      {
        status:
          404,
      },
    );
  }

  try {
    const body =
      (
        await request.json()
      ) as RequestBody;

    if (
      body.dryRun !==
        undefined &&
      typeof body.dryRun !==
        "boolean"
    ) {
      return badRequest(
        "dryRun must be a boolean when supplied.",
      );
    }

    if (
      body.forceAllFinished !==
        undefined &&
      typeof body.forceAllFinished !==
        "boolean"
    ) {
      return badRequest(
        "forceAllFinished must be a boolean when supplied.",
      );
    }

    const extraMediaWindowHours =
      optionalPositiveNumber(
        body.extraMediaWindowHours,
        "extraMediaWindowHours",
      );

    if (
      extraMediaWindowHours.error
    ) {
      return badRequest(
        extraMediaWindowHours.error,
      );
    }

    const missingHighlightLookbackDays =
      optionalPositiveNumber(
        body.missingHighlightLookbackDays,
        "missingHighlightLookbackDays",
      );

    if (
      missingHighlightLookbackDays.error
    ) {
      return badRequest(
        missingHighlightLookbackDays.error,
      );
    }

    const result =
      await runAutomaticMatchMediaWorker({
        dryRun:
          body.dryRun ??
          true,

        forceAllFinished:
          body.forceAllFinished ??
          false,

        extraMediaWindowHours:
          extraMediaWindowHours.value,

        missingHighlightLookbackDays:
          missingHighlightLookbackDays.value,
      });

    return NextResponse.json({
      ok:
        true,

      result,
    });
  } catch (
    error
  ) {
    console.error(
      "AUTOMATIC MATCH MEDIA WORKER FAILED:",
      error,
    );

    return NextResponse.json(
      {
        ok:
          false,

        error:
          error instanceof Error
            ? error.message
            : String(
                error,
              ),
      },
      {
        status:
          500,
      },
    );
  }
}

function optionalPositiveNumber(
  value:
    unknown,

  name:
    string,
):
  | {
      value:
        number | undefined;

      error:
        null;
    }
  | {
      value:
        undefined;

      error:
        string;
    } {
  if (
    value ===
    undefined
  ) {
    return {
      value:
        undefined,

      error:
        null,
    };
  }

  if (
    typeof value !==
      "number" ||
    !Number.isFinite(
      value,
    ) ||
    value <=
      0
  ) {
    return {
      value:
        undefined,

      error:
        `${name} must be a positive number when supplied.`,
    };
  }

  return {
    value,

    error:
      null,
  };
}

function badRequest(
  error:
    string,
) {
  return NextResponse.json(
    {
      ok:
        false,

      error,
    },
    {
      status:
        400,
    },
  );
}