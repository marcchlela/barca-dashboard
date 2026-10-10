import {
  NextResponse,
} from "next/server";
import { guardAdminRequest } from "../../../../../lib/admin/access";

import {
  Temporal,
} from "temporal-polyfill";

import {
  db,
} from "../../../../../prisma/db";

import {
  ADMIN_MEDIA_TYPES,
  type AdminMediaType,
} from "../../../../../lib/admin/media";

const OFFICIAL_CHANNEL_ID =
  "UC14UlmYlSNiQCBe9Eookf_A";

const DATA_SOURCE = {
  code:
    "youtube-fcbarcelona-official",

  name:
    "FC Barcelona Official YouTube",

  baseUrl:
    "https://www.youtube.com/@FCBarcelona",
} as const;

/*
|--------------------------------------------------------------------------
| Request
|--------------------------------------------------------------------------
*/

type Body = {
  url?:
    unknown;

  matchId?:
    unknown;

  type?:
    unknown;
};

/*
|--------------------------------------------------------------------------
| YouTube response types
|--------------------------------------------------------------------------
*/

type YouTubeThumbnail = {
  url:
    string;

  width?:
    number;

  height?:
    number;
};

type YouTubeThumbnails = {
  default?:
    YouTubeThumbnail;

  medium?:
    YouTubeThumbnail;

  high?:
    YouTubeThumbnail;

  standard?:
    YouTubeThumbnail;

  maxres?:
    YouTubeThumbnail;
};

type YouTubeVideoItem = {
  id:
    string;

  snippet: {
    channelId:
      string;

    channelTitle?:
      string;

    title:
      string;

    description:
      string;

    publishedAt:
      string;

    thumbnails?:
      YouTubeThumbnails;
  };
};

type YouTubeVideoResponse = {
  items?:
    YouTubeVideoItem[];
};

/*
|--------------------------------------------------------------------------
| POST
|--------------------------------------------------------------------------
|
| Manually attach an official FC Barcelona YouTube video to a Barça match.
|
| We still fetch canonical metadata ourselves instead of trusting:
| - title
| - thumbnail
| - publication date
| - channel identity
|--------------------------------------------------------------------------
*/

export async function POST(
  request:
    Request,
) {
  const denied = await guardAdminRequest(request);
  if (denied) return denied;
  try {
    const body =
      (
        await request.json()
      ) as Body;

    /*
    |--------------------------------------------------------------------------
    | Validate URL
    |--------------------------------------------------------------------------
    */

    if (
      typeof body.url !==
        "string" ||
      body.url.trim() ===
        ""
    ) {
      return badRequest(
        "A YouTube URL is required.",
      );
    }

    const videoId =
      parseYouTubeVideoId(
        body.url,
      );

    if (!videoId) {
      return badRequest(
        "Could not read a YouTube video ID from that URL.",
      );
    }

    /*
    |--------------------------------------------------------------------------
    | Validate match
    |--------------------------------------------------------------------------
    */

    if (
      typeof body.matchId !==
        "string" ||
      body.matchId.trim() ===
        ""
    ) {
      return badRequest(
        "A match is required.",
      );
    }

    const match =
      await db.orm.public.Match
        .where({
          id:
            body.matchId,
        })
        .include(
          "homeTeam",
        )
        .include(
          "awayTeam",
        )
        .first();

    if (!match) {
      return badRequest(
        "Match was not found.",
      );
    }

    if (
      !match.homeTeam
        .isBarcelona &&
      !match.awayTeam
        .isBarcelona
    ) {
      return badRequest(
        "Match is not an FC Barcelona fixture.",
      );
    }

    /*
    |--------------------------------------------------------------------------
    | Validate media type
    |--------------------------------------------------------------------------
    */

    if (
      typeof body.type !==
        "string" ||
      !isMediaType(
        body.type,
      )
    ) {
      return badRequest(
        "A valid media type is required.",
      );
    }

    const mediaType:
      AdminMediaType =
      body.type;

    /*
    |--------------------------------------------------------------------------
    | YouTube API
    |--------------------------------------------------------------------------
    */

    const apiKey =
      process.env
        .YOUTUBE_API_KEY;

    if (!apiKey) {
      throw new Error(
        "YOUTUBE_API_KEY is not configured.",
      );
    }

    const youtubeUrl =
      new URL(
        "https://www.googleapis.com/youtube/v3/videos",
      );

    youtubeUrl.searchParams.set(
      "part",
      "snippet",
    );

    youtubeUrl.searchParams.set(
      "id",
      videoId,
    );

    youtubeUrl.searchParams.set(
      "key",
      apiKey,
    );

    const response =
      await fetch(
        youtubeUrl,
        {
          cache:
            "no-store",
        },
      );

    if (!response.ok) {
      const details =
        await response
          .text()
          .catch(
            () =>
              "",
          );

      throw new Error(
        `YouTube metadata request failed (${response.status})${
          details
            ? `: ${details}`
            : ""
        }`,
      );
    }

    const payload =
      (
        await response.json()
      ) as YouTubeVideoResponse;

    const video =
      payload.items?.[0];

    if (!video) {
      return badRequest(
        "YouTube video was not found.",
      );
    }

    /*
    |--------------------------------------------------------------------------
    | Channel safety
    |--------------------------------------------------------------------------
    |
    | Manual Add currently accepts only uploads belonging to FC Barcelona's
    | official YouTube channel.
    |--------------------------------------------------------------------------
    */

    if (
      video.snippet
        .channelId !==
      OFFICIAL_CHANNEL_ID
    ) {
      return badRequest(
        "Manual Media Add currently accepts official FC Barcelona YouTube videos only.",
      );
    }

    /*
    |--------------------------------------------------------------------------
    | Data source
    |--------------------------------------------------------------------------
    */

    const source =
      await ensureDataSource();

    /*
    |--------------------------------------------------------------------------
    | Existing media check
    |--------------------------------------------------------------------------
    */

    const existing =
      await db.orm.public.MediaItem
        .where({
          dataSourceId:
            source.id,

          externalMediaId:
            videoId,
        })
        .first();

    /*
     * Don't silently move a canonical video from one fixture to another.
     * That should be handled explicitly through the Media Inspector.
     */

    if (
      existing?.matchId &&
      existing.matchId !==
        match.id
    ) {
      return NextResponse.json(
        {
          ok:
            false,

          error:
            "This video is already attached to another match. Use Media Manager if you want to relink it.",
        },
        {
          status:
            409,
        },
      );
    }

    /*
    |--------------------------------------------------------------------------
    | Canonical media data
    |--------------------------------------------------------------------------
    */

    const thumbnailUrl =
      bestThumbnail(
        video.snippet
          .thumbnails,
      );

    const mediaData = {
      type:
        mediaType,

      title:
        video.snippet
          .title,

      description:
        video.snippet
          .description ||
        null,

      url:
        `https://www.youtube.com/watch?v=${videoId}`,

      externalMediaId:
        videoId,

      thumbnailUrl,

      isOfficial:
        true,

      publishedAt:
        Temporal.Instant.from(
          video.snippet
            .publishedAt,
        ),

      seasonId:
        match.seasonId,

      matchId:
        match.id,

      playerId:
        null,

      dataSourceId:
        source.id,
    };

    /*
    |--------------------------------------------------------------------------
    | Create / update
    |--------------------------------------------------------------------------
    */

    const media =
      existing
        ? await db.orm.public.MediaItem
            .where({
              id:
                existing.id,
            })
            .update(
              mediaData,
            )
        : await db.orm.public.MediaItem
            .create(
              mediaData,
            );

    if (!media) {
      throw new Error(
        "Media item could not be saved.",
      );
    }

    /*
    |--------------------------------------------------------------------------
    | Resolve matching review candidate
    |--------------------------------------------------------------------------
    |
    | If this exact video was sitting in the review queue, a manual add is
    | effectively a human approval.
    |--------------------------------------------------------------------------
    */

    const reviewCandidate =
      await db.orm.public.MediaReviewCandidate
        .where({
          dataSourceId:
            source.id,

          externalMediaId:
            videoId,

          matchId:
            match.id,
        })
        .first();

    if (reviewCandidate) {
      await db.orm.public.MediaReviewCandidate
        .where({
          id:
            reviewCandidate.id,
        })
        .update({
          status:
            "approved",

          reviewedAt:
            Temporal.Now.instant(),

          reviewNote:
            "Approved through Manual Media Add",
        });
    }

    /*
    |--------------------------------------------------------------------------
    | Audit trail
    |--------------------------------------------------------------------------
    */

    await recordManualOverride({
      mediaItemId:
        media.id,

      videoId,

      matchId:
        match.id,

      mediaType,

      sourceUrl:
        mediaData.url,

      operation:
        existing
          ? "update"
          : "create",
    });

    /*
    |--------------------------------------------------------------------------
    | Response
    |--------------------------------------------------------------------------
    */

    return NextResponse.json({
      ok:
        true,

      result: {
        id:
          media.id,

        title:
          media.title,

        videoId,

        thumbnailUrl,

        matchId:
          match.id,

        type:
          mediaType,

        created:
          !existing,

        official:
          true,
      },
    });
  } catch (
    error
  ) {
    console.error(
      "ADMIN MANUAL MEDIA ADD FAILED:",
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

/*
|--------------------------------------------------------------------------
| Data source
|--------------------------------------------------------------------------
*/

async function ensureDataSource() {
  const existing =
    await db.orm.public.DataSource
      .where({
        code:
          DATA_SOURCE.code,
      })
      .first();

  if (existing) {
    return existing;
  }

  return db.orm.public.DataSource
    .create({
      code:
        DATA_SOURCE.code,

      name:
        DATA_SOURCE.name,

      baseUrl:
        DATA_SOURCE.baseUrl,

      isOfficial:
        true,

      isEnabled:
        true,

      licenseNotes:
        "Official FC Barcelona YouTube channel. Metadata only; video playback remains hosted by YouTube.",
    });
}

/*
|--------------------------------------------------------------------------
| Manual override audit
|--------------------------------------------------------------------------
*/

async function recordManualOverride(
  input: {
    mediaItemId:
      string;

    videoId:
      string;

    matchId:
      string;

    mediaType:
      AdminMediaType;

    sourceUrl:
      string;

    operation:
      "create" |
      "update";
  },
) {
  try {
    await db.orm.public.ManualOverride
      .create({
        entityType:
          "media_item",

        entityId:
          input.mediaItemId,

        fieldName:
          "manual_add",

        payload: {
          action:
            input.operation,

          videoId:
            input.videoId,

          matchId:
            input.matchId,

          type:
            input.mediaType,
        },

        reason:
          "Admin Manual Media Add",

        sourceUrl:
          input.sourceUrl,
      });
  } catch (
    error
  ) {
    /*
     * Don't claim that the actual media write failed just because the audit
     * record failed. Surface it loudly in server logs instead.
     */

    console.error(
      "ADMIN MANUAL MEDIA AUDIT FAILED:",
      error,
    );
  }
}

/*
|--------------------------------------------------------------------------
| YouTube ID parser
|--------------------------------------------------------------------------
*/

function parseYouTubeVideoId(
  value:
    string,
) {
  try {
    const url =
      new URL(
        value.trim(),
      );

    const hostname =
      url.hostname
        .toLowerCase()
        .replace(
          /^www\./,
          "",
        );

    /*
     * youtu.be/<id>
     */

    if (
      hostname ===
      "youtu.be"
    ) {
      const id =
        url.pathname
          .split(
            "/",
          )
          .filter(
            Boolean,
          )[0];

      return validVideoId(
        id,
      );
    }

    /*
     * youtube.com formats
     */

    if (
      hostname !==
        "youtube.com" &&
      hostname !==
        "m.youtube.com" &&
      hostname !==
        "music.youtube.com"
    ) {
      return null;
    }

    /*
     * youtube.com/watch?v=<id>
     */

    const queryId =
      url.searchParams.get(
        "v",
      );

    if (queryId) {
      return validVideoId(
        queryId,
      );
    }

    /*
     * youtube.com/shorts/<id>
     * youtube.com/embed/<id>
     * youtube.com/live/<id>
     */

    const parts =
      url.pathname
        .split(
          "/",
        )
        .filter(
          Boolean,
        );

    if (
      parts[0] ===
        "shorts" ||
      parts[0] ===
        "embed" ||
      parts[0] ===
        "live"
    ) {
      return validVideoId(
        parts[1],
      );
    }
  } catch {
    return null;
  }

  return null;
}

function validVideoId(
  value:
    string |
    undefined |
    null,
) {
  if (!value) {
    return null;
  }

  /*
   * Standard YouTube video IDs are 11 characters.
   */

  if (
    !/^[A-Za-z0-9_-]{11}$/.test(
      value,
    )
  ) {
    return null;
  }

  return value;
}

/*
|--------------------------------------------------------------------------
| Thumbnail selection
|--------------------------------------------------------------------------
*/

function bestThumbnail(
  thumbnails:
    YouTubeThumbnails |
    undefined,
) {
  if (!thumbnails) {
    return null;
  }

  return (
    thumbnails
      .maxres
      ?.url ??
    thumbnails
      .standard
      ?.url ??
    thumbnails
      .high
      ?.url ??
    thumbnails
      .medium
      ?.url ??
    thumbnails
      .default
      ?.url ??
    null
  );
}

/*
|--------------------------------------------------------------------------
| Media type
|--------------------------------------------------------------------------
*/

function isMediaType(
  value:
    string,
): value is AdminMediaType {
  return (
    ADMIN_MEDIA_TYPES as
      string[]
  ).includes(
    value,
  );
}

/*
|--------------------------------------------------------------------------
| Errors
|--------------------------------------------------------------------------
*/

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
