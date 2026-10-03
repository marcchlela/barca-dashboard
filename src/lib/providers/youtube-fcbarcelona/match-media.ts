import "server-only";

import {
  Temporal,
} from "temporal-polyfill";

import {
  makeEmptyReviewQueuePlan,
  syncMediaReviewQueue,
  type ReviewQueuePlan,
} from "./review-queue";

import {
  db,
} from "../../../prisma/db";

const YOUTUBE_CHANNEL_ID =
  "UC14UlmYlSNiQCBe9Eookf_A";

const DATA_SOURCE = {
  code:
    "youtube-fcbarcelona-official",

  name:
    "FC Barcelona Official YouTube",

  baseUrl:
    "https://www.youtube.com/@FCBarcelona",

  isOfficial:
    true,

  isEnabled:
    true,

  licenseNotes:
    "Official FC Barcelona YouTube channel. Metadata only; video playback remains hosted by YouTube.",
} as const;

const WINDOW_BEFORE_HOURS =
  24;

const WINDOW_AFTER_HOURS =
  72;

const MAX_UPLOAD_PAGES =
  12;

type MediaType =
  | "match_highlight"
  | "match_feature"
  | "match_preview"
  | "goal_clip"
  | "interview"
  | "press_conference"
  | "training"
  | "historical"
  | "other";

type YouTubeThumbnail = {
  url:
    string;

  width?:
    number;

  height?:
    number;
};

type YouTubePlaylistItem = {
  snippet: {
    publishedAt:
      string;

    title:
      string;

    description:
      string;

    thumbnails?: {
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
  };

  contentDetails: {
    videoId:
      string;
  };
};

type YouTubePlaylistResponse = {
  nextPageToken?:
    string;

  items?:
    YouTubePlaylistItem[];
};

type YouTubeChannelResponse = {
  items?: Array<{
    id:
      string;

    snippet: {
      title:
        string;
    };

    contentDetails: {
      relatedPlaylists: {
        uploads:
          string;
      };
    };
  }>;
};

type YouTubeVideo = {
  id:
    string;

  snippet: {
    publishedAt:
      string;

    title:
      string;

    description:
      string;

    liveBroadcastContent?:
      string;

    thumbnails?: {
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
  };

  contentDetails: {
    duration:
      string;
  };

  status: {
    embeddable?:
      boolean;

    privacyStatus?:
      string;
  };
};

type YouTubeVideosResponse = {
  items?:
    YouTubeVideo[];
};

type MatchContext = {
  id:
    string;

  seasonId:
    string;

  kickoff:
    string;

  competition: {
    code:
      string;

    name:
      string;

    shortName:
      string | null;
  };

  homeTeam: {
    id:
      string;

    name:
      string;

    shortName:
      string | null;

    code:
      string;

    isBarcelona:
      boolean;
  };

  awayTeam: {
    id:
      string;

    name:
      string;

    shortName:
      string | null;

    code:
      string;

    isBarcelona:
      boolean;
  };

  score: {
    home:
      number;

    away:
      number;
  };
};

type UsageTracker = {
  requests:
    number;

  uploadPages:
    number;

  videosInspected:
    number;
};

type WritePlan = {
  created:
    number;

  updated:
    number;

  unchanged:
    number;
};

export type MatchMediaCandidate = {
  videoId:
    string;

  title:
    string;

  publishedAt:
    string;

  url:
    string;

  thumbnailUrl:
    string | null;

  durationSeconds:
    number | null;

  embeddable:
    boolean;

  type:
    MediaType;

  score:
    number;

  accepted:
    boolean;

  reasons:
    string[];
};

export type MatchMediaSyncResult = {
  dryRun:
    boolean;

  matchId:
    string;

  fixture: {
    kickoff:
      string;

    home:
      string;

    away:
      string;

    score:
      string;
  };

  youtube: {
    channelId:
      string;

    channelName:
      string;

    uploadsPlaylist:
      string;

    requests:
      number;

    uploadPages:
      number;

    videosInspected:
      number;
  };

  accepted:
    MatchMediaCandidate[];

  rejected:
    MatchMediaCandidate[];

  writePlan:
  WritePlan;

  reviewPlan:
    ReviewQueuePlan;

  persisted:
    boolean;
};

export type MatchMediaBatchResult = {
  dryRun:
    boolean;

  matches:
    number;

  youtube: {
    channelId:
      string;

    channelName:
      string;

    uploadsPlaylist:
      string;

    requests:
      number;

    uploadPages:
      number;

    videosInspected:
      number;
  };

  writePlan:
    WritePlan;

  results: Array<{
    matchId:
      string;

    fixture: {
      kickoff:
        string;

      home:
        string;

      away:
        string;

      score:
        string;
    };

    ok:
      boolean;

    accepted:
      MatchMediaCandidate[];

    rejectedCount:
      number;

    writePlan:
      WritePlan;

    persisted:
      boolean;

    error:
      string | null;
  }>;
};

export async function syncOfficialMatchMedia(
  input: {
    matchId:
      string;

    dryRun:
      boolean;
  },
): Promise<MatchMediaSyncResult> {
  const apiKey =
    requireYouTubeApiKey();

  const match =
    await loadMatch(
      input.matchId,
    );

  if (
    match.status !==
    "finished"
  ) {
    throw new Error(
      `Match media sync currently accepts finished matches only. Match status is "${match.status}".`,
    );
  }

  if (
    match.homeScore ===
      null ||
    match.awayScore ===
      null
  ) {
    throw new Error(
      "Finished match is missing its final score.",
    );
  }

  const context =
    makeMatchContext(
      match,
    );

  const usage:
    UsageTracker = {
      requests:
        0,

      uploadPages:
        0,

      videosInspected:
        0,
    };

  const channel =
    await fetchOfficialChannel(
      apiKey,
      usage,
    );

  const kickoffMs =
    new Date(
      context.kickoff,
    ).getTime();

  const start =
    new Date(
      kickoffMs -
        WINDOW_BEFORE_HOURS *
          60 *
          60 *
          1000,
    ).toISOString();

  const end =
    new Date(
      kickoffMs +
        WINDOW_AFTER_HOURS *
          60 *
          60 *
          1000,
    ).toISOString();

  const videos =
    await fetchOfficialYoutubeVideosBetween(
      apiKey,
      channel.uploadsPlaylist,
      start,
      end,
      usage,
    );

  const evaluated =
    videos.map(
      (
        video,
      ) =>
        evaluateVideo(
          video,
          context,
        ),
    );

  const accepted =
    evaluated
      .filter(
        (
          candidate,
        ) =>
          candidate.accepted,
      )
      .sort(
        compareCandidates,
      );

  const rejected =
    evaluated
      .filter(
        (
          candidate,
        ) =>
          !candidate.accepted,
      )
      .sort(
        compareCandidates,
      );

  const writePlan =
    makeEmptyWritePlan();
  
  let reviewPlan =
    makeEmptyReviewQueuePlan();

  if (
    input.dryRun
  ) {
    const existingSource =
      await db.orm.public.DataSource
        .where({
          code:
            DATA_SOURCE.code,
        })
        .first();

    await calculateDryRunWritePlan({
      accepted,
      context,
      existingSourceId:
        existingSource?.id ??
        null,
      writePlan,
    });
  } else {
  const dataSource =
    await ensureDataSource();

  for (
    const candidate
    of accepted
  ) {
    await persistCandidate({
      candidate,
      context,
      dataSourceId:
        dataSource.id,
      writePlan,
    });
  }

  reviewPlan =
    await syncMediaReviewQueue({
      seasonId:
        context.seasonId,

      matchId:
        context.id,

      dataSourceId:
        dataSource.id,

      accepted,

      rejected,
    });
}

  return {
    dryRun:
      input.dryRun,

    matchId:
      context.id,

    fixture:
      fixtureSummary(
        context,
      ),

    youtube: {
      channelId:
        YOUTUBE_CHANNEL_ID,

      channelName:
        channel.channelName,

      uploadsPlaylist:
        channel.uploadsPlaylist,

      requests:
        usage.requests,

      uploadPages:
        usage.uploadPages,

      videosInspected:
        usage.videosInspected,
    },

    accepted,

    rejected:
      rejected.slice(
        0,
        30,
      ),

    writePlan,

    reviewPlan,

    persisted:
      !input.dryRun,
  };
}

/*
 * Batched version used by the automatic worker.
 *
 * Instead of fetching the official Barça upload feed independently
 * for every fixture, we:
 *
 * 1. load every requested match;
 * 2. calculate one overall YouTube time range;
 * 3. fetch that upload range once;
 * 4. filter the same video pool per match;
 * 5. run the exact same trusted candidate scorer;
 * 6. persist idempotently.
 */
export async function syncOfficialMatchMediaBatch(
  input: {
    matchIds:
      string[];

    dryRun:
      boolean;
  },
): Promise<MatchMediaBatchResult> {
  const apiKey =
    requireYouTubeApiKey();

  const uniqueMatchIds =
    Array.from(
      new Set(
        input.matchIds,
      ),
    );

  if (
    uniqueMatchIds.length ===
    0
  ) {
    return emptyBatchResult(
      input.dryRun,
    );
  }

  const contexts:
    MatchContext[] =
    [];

  for (
    const matchId
    of uniqueMatchIds
  ) {
    const match =
      await loadMatch(
        matchId,
      );

    if (
      match.status !==
      "finished"
    ) {
      continue;
    }

    if (
      match.homeScore ===
        null ||
      match.awayScore ===
        null
    ) {
      continue;
    }

    contexts.push(
      makeMatchContext(
        match,
      ),
    );
  }

  if (
    contexts.length ===
    0
  ) {
    return emptyBatchResult(
      input.dryRun,
    );
  }

  const kickoffTimes =
    contexts.map(
      (
        context,
      ) =>
        new Date(
          context.kickoff,
        ).getTime(),
    );

  const rangeStart =
    new Date(
      Math.min(
        ...kickoffTimes,
      ) -
        WINDOW_BEFORE_HOURS *
          60 *
          60 *
          1000,
    ).toISOString();

  const rangeEnd =
    new Date(
      Math.max(
        ...kickoffTimes,
      ) +
        WINDOW_AFTER_HOURS *
          60 *
          60 *
          1000,
    ).toISOString();

  const usage:
    UsageTracker = {
      requests:
        0,

      uploadPages:
        0,

      videosInspected:
        0,
    };

  const channel =
    await fetchOfficialChannel(
      apiKey,
      usage,
    );

  const pooledVideos =
    await fetchOfficialYoutubeVideosBetween(
      apiKey,
      channel.uploadsPlaylist,
      rangeStart,
      rangeEnd,
      usage,
    );

  const dataSource =
    input.dryRun
      ? null
      : await ensureDataSource();

  const existingSource =
    input.dryRun
      ? await db.orm.public.DataSource
          .where({
            code:
              DATA_SOURCE.code,
          })
          .first()
      : null;

  const results:
    MatchMediaBatchResult[
      "results"
    ] =
    [];

  for (
    const context
    of contexts
  ) {
    const kickoffMs =
      new Date(
        context.kickoff,
      ).getTime();

    const matchWindowStart =
      kickoffMs -
      WINDOW_BEFORE_HOURS *
        60 *
        60 *
        1000;

    const matchWindowEnd =
      kickoffMs +
      WINDOW_AFTER_HOURS *
        60 *
        60 *
        1000;

    const videosForMatch =
      pooledVideos.filter(
        (
          video,
        ) => {
          const publishedMs =
            new Date(
              video.snippet
                .publishedAt,
            ).getTime();

          return (
            publishedMs >=
              matchWindowStart &&
            publishedMs <=
              matchWindowEnd
          );
        },
      );

    const evaluated =
      videosForMatch.map(
        (
          video,
        ) =>
          evaluateVideo(
            video,
            context,
          ),
      );

    const accepted =
      evaluated
        .filter(
          (
            candidate,
          ) =>
            candidate.accepted,
        )
        .sort(
          compareCandidates,
        );
      const rejected =
        evaluated
          .filter(
            (
              candidate,
            ) =>
              !candidate.accepted,
          )
          .sort(
            compareCandidates,
          );

    const writePlan =
      makeEmptyWritePlan();

    try {
      if (
        input.dryRun
      ) {
        await calculateDryRunWritePlan({
          accepted,
          context,
          existingSourceId:
            existingSource?.id ??
            null,
          writePlan,
        });
      } else {
        if (!dataSource) {
          throw new Error(
            "Official YouTube data source was not initialized.",
          );
        }

        for (
          const candidate
          of accepted
        ) {
          await persistCandidate({
            candidate,
            context,
            dataSourceId:
              dataSource.id,
            writePlan,
          });
        }
        await syncMediaReviewQueue({
          seasonId:
            context.seasonId,

          matchId:
            context.id,

          dataSourceId:
            dataSource.id,

          accepted,

          rejected,
        });
      }

      results.push({
        matchId:
          context.id,

        fixture:
          fixtureSummary(
            context,
          ),

        ok:
          true,

        accepted,

        rejectedCount:
          evaluated.length -
          accepted.length,

        writePlan,

        persisted:
          !input.dryRun,

        error:
          null,
      });
    } catch (
      error
    ) {
      results.push({
        matchId:
          context.id,

        fixture:
          fixtureSummary(
            context,
          ),

        ok:
          false,

        accepted,

        rejectedCount:
          evaluated.length -
          accepted.length,

        writePlan,

        persisted:
          false,

        error:
          error instanceof Error
            ? error.message
            : String(
                error,
              ),
      });
    }
  }

  const totalWritePlan =
    results.reduce(
      (
        total,
        result,
      ) => ({
        created:
          total.created +
          result.writePlan
            .created,

        updated:
          total.updated +
          result.writePlan
            .updated,

        unchanged:
          total.unchanged +
          result.writePlan
            .unchanged,
      }),
      makeEmptyWritePlan(),
    );

  return {
    dryRun:
      input.dryRun,

    matches:
      contexts.length,

    youtube: {
      channelId:
        YOUTUBE_CHANNEL_ID,

      channelName:
        channel.channelName,

      uploadsPlaylist:
        channel.uploadsPlaylist,

      requests:
        usage.requests,

      uploadPages:
        usage.uploadPages,

      videosInspected:
        usage.videosInspected,
    },

    writePlan:
      totalWritePlan,

    results,
  };
}

async function loadMatch(
  matchId:
    string,
) {
  const match =
    await db.orm.public.Match
      .where({
        id:
          matchId,
      })
      .include(
        "homeTeam",
      )
      .include(
        "awayTeam",
      )
      .include(
        "competition",
      )
      .first();

  if (!match) {
    throw new Error(
      `Match ${matchId} was not found.`,
    );
  }

  if (
    !match.homeTeam
      .isBarcelona &&
    !match.awayTeam
      .isBarcelona
  ) {
    throw new Error(
      "Match is not an FC Barcelona fixture.",
    );
  }

  return match;
}

function makeMatchContext(
  match:
    Awaited<
      ReturnType<
        typeof loadMatch
      >
    >,
): MatchContext {
  if (
    match.homeScore ===
      null ||
    match.awayScore ===
      null
  ) {
    throw new Error(
      "Finished match is missing its final score.",
    );
  }

  return {
    id:
      match.id,

    seasonId:
      match.seasonId,

    kickoff:
      match.kickoff
        .toString(),

    competition: {
      code:
        match.competition
          .code,

      name:
        match.competition
          .name,

      shortName:
        match.competition
          .shortName,
    },

    homeTeam: {
      id:
        match.homeTeam.id,

      name:
        match.homeTeam
          .name,

      shortName:
        match.homeTeam
          .shortName,

      code:
        match.homeTeam
          .code,

      isBarcelona:
        match.homeTeam
          .isBarcelona,
    },

    awayTeam: {
      id:
        match.awayTeam.id,

      name:
        match.awayTeam
          .name,

      shortName:
        match.awayTeam
          .shortName,

      code:
        match.awayTeam
          .code,

      isBarcelona:
        match.awayTeam
          .isBarcelona,
    },

    score: {
      home:
        match.homeScore,

      away:
        match.awayScore,
    },
  };
}

function fixtureSummary(
  context:
    MatchContext,
) {
  return {
    kickoff:
      context.kickoff,

    home:
      context.homeTeam
        .name,

    away:
      context.awayTeam
        .name,

    score:
      `${context.score.home}-${context.score.away}`,
  };
}

function requireYouTubeApiKey() {
  const apiKey =
    process.env
      .YOUTUBE_API_KEY;

  if (!apiKey) {
    throw new Error(
      "YOUTUBE_API_KEY is not configured.",
    );
  }

  return apiKey;
}

async function fetchOfficialChannel(
  apiKey:
    string,

  usage:
    Pick<
      UsageTracker,
      "requests"
    >,
) {
  const url =
    new URL(
      "https://www.googleapis.com/youtube/v3/channels",
    );

  url.searchParams.set(
    "part",
    "snippet,contentDetails",
  );

  url.searchParams.set(
    "id",
    YOUTUBE_CHANNEL_ID,
  );

  url.searchParams.set(
    "key",
    apiKey,
  );

  usage.requests +=
    1;

  const payload =
    await fetchJson<
      YouTubeChannelResponse
    >(
      url,
    );

  const channel =
    payload.items?.[0];

  if (!channel) {
    throw new Error(
      "Official FC Barcelona YouTube channel was not returned.",
    );
  }

  const uploadsPlaylist =
    channel.contentDetails
      .relatedPlaylists
      .uploads;

  if (!uploadsPlaylist) {
    throw new Error(
      "FC Barcelona uploads playlist was not returned.",
    );
  }

  return {
    channelName:
      channel.snippet
        .title,

    uploadsPlaylist,
  };
}

async function fetchOfficialYoutubeVideosBetween(
  apiKey:
    string,

  uploadsPlaylist:
    string,

  start:
    string,

  end:
    string,

  usage:
    UsageTracker,
) {
  const startMs =
    new Date(
      start,
    ).getTime();

  const endMs =
    new Date(
      end,
    ).getTime();

  const playlistItems:
    YouTubePlaylistItem[] =
    [];

  let pageToken:
    string | undefined;

  for (
    let page = 0;
    page <
    MAX_UPLOAD_PAGES;
    page += 1
  ) {
    const url =
      new URL(
        "https://www.googleapis.com/youtube/v3/playlistItems",
      );

    url.searchParams.set(
      "part",
      "snippet,contentDetails",
    );

    url.searchParams.set(
      "playlistId",
      uploadsPlaylist,
    );

    url.searchParams.set(
      "maxResults",
      "50",
    );

    url.searchParams.set(
      "key",
      apiKey,
    );

    if (pageToken) {
      url.searchParams.set(
        "pageToken",
        pageToken,
      );
    }

    usage.requests +=
      1;

    usage.uploadPages +=
      1;

    const payload =
      await fetchJson<
        YouTubePlaylistResponse
      >(
        url,
      );

    const items =
      payload.items ??
      [];

    if (
      items.length ===
      0
    ) {
      break;
    }

    for (
      const item
      of items
    ) {
      const publishedMs =
        new Date(
          item.snippet
            .publishedAt,
        ).getTime();

      if (
        publishedMs >=
          startMs &&
        publishedMs <=
          endMs
      ) {
        playlistItems.push(
          item,
        );
      }
    }

    const oldestMs =
      Math.min(
        ...items.map(
          (
            item,
          ) =>
            new Date(
              item.snippet
                .publishedAt,
            ).getTime(),
        ),
      );

    /*
     * Upload playlists are newest-first.
     *
     * Once the oldest item on the current page is older than the
     * earliest time we care about, all following pages are older too.
     */
    if (
      Number.isFinite(
        oldestMs,
      ) &&
      oldestMs <
        startMs
    ) {
      break;
    }

    pageToken =
      payload.nextPageToken;

    if (!pageToken) {
      break;
    }
  }

  const ids =
    Array.from(
      new Set(
        playlistItems.map(
          (
            item,
          ) =>
            item.contentDetails
              .videoId,
        ),
      ),
    );

  const videos:
    YouTubeVideo[] =
    [];

  for (
    let index = 0;
    index <
    ids.length;
    index += 50
  ) {
    const batch =
      ids.slice(
        index,
        index +
          50,
      );

    if (
      batch.length ===
      0
    ) {
      continue;
    }

    const url =
      new URL(
        "https://www.googleapis.com/youtube/v3/videos",
      );

    url.searchParams.set(
      "part",
      "snippet,contentDetails,status",
    );

    url.searchParams.set(
      "id",
      batch.join(
        ",",
      ),
    );

    url.searchParams.set(
      "key",
      apiKey,
    );

    usage.requests +=
      1;

    const payload =
      await fetchJson<
        YouTubeVideosResponse
      >(
        url,
      );

    videos.push(
      ...(
        payload.items ??
        []
      ),
    );
  }

  usage.videosInspected =
    videos.length;

  return videos;
}

function evaluateVideo(
  video:
    YouTubeVideo,

  match:
    MatchContext,
): MatchMediaCandidate {
  const title =
    video.snippet
      .title;

  const normalized =
    normalize(
      title,
    );

  const opponent =
    match.homeTeam
      .isBarcelona
      ? match.awayTeam
      : match.homeTeam;

  const opponentAliases =
    teamAliases(
      opponent,
    );

  const barcelonaAliases = [
    "fc barcelona",
    "barcelona",
    "barca",
  ];

  const opponentMention =
    containsAny(
      normalized,
      opponentAliases,
    );

  const barcelonaMention =
    containsAny(
      normalized,
      barcelonaAliases,
    );

  const exactScore =
    hasExactFixtureScore(
      title,
      match,
    );

  const competitionMention =
    containsAny(
      normalized,
      competitionAliases(
        match.competition,
      ),
    );

  const mediaType =
    classifyMedia(
      normalized,
      exactScore,
    );

  const durationSeconds =
    parseIsoDuration(
      video.contentDetails
        .duration,
    );

  const embeddable =
    video.status
      .embeddable !==
    false;

  const publishedAt =
    video.snippet
      .publishedAt;

  const publishedMs =
    new Date(
      publishedAt,
    ).getTime();

  const kickoffMs =
    new Date(
      match.kickoff,
    ).getTime();

  const deltaHours =
    (
      publishedMs -
      kickoffMs
    ) /
    (
      60 *
      60 *
      1000
    );

  const reasons:
    string[] = [];

  let score =
    0;

  const exclusion =
    exclusionReason(
      normalized,
    );

  if (exclusion) {
    return makeCandidate({
      video,
      mediaType,
      durationSeconds,
      embeddable,
      score:
        -999,

      accepted:
        false,

      reasons: [
        exclusion,
      ],
    });
  }

  if (
    opponentMention
  ) {
    score +=
      40;

    reasons.push(
      "opponent-name:+40",
    );
  }

  if (
    exactScore
  ) {
    score +=
      50;

    reasons.push(
      "exact-score:+50",
    );
  }

  if (
    barcelonaMention
  ) {
    score +=
      10;

    reasons.push(
      "barcelona-name:+10",
    );
  }

  if (
    competitionMention
  ) {
    score +=
      10;

    reasons.push(
      "competition:+10",
    );
  }

  if (
    deltaHours >=
      0 &&
    deltaHours <=
      8
  ) {
    score +=
      20;

    reasons.push(
      "published-0-8h-after:+20",
    );
  } else if (
    deltaHours >
      8 &&
    deltaHours <=
      36
  ) {
    score +=
      14;

    reasons.push(
      "published-8-36h-after:+14",
    );
  } else if (
    deltaHours >
      36 &&
    deltaHours <=
      72
  ) {
    score +=
      6;

    reasons.push(
      "published-36-72h-after:+6",
    );
  } else if (
    deltaHours >=
      -24 &&
    deltaHours <
      0
  ) {
    score +=
      4;

    reasons.push(
      "published-before-match:+4",
    );
  }

  if (
    mediaType ===
    "match_highlight"
  ) {
    score +=
      25;

    reasons.push(
      "highlight-signal:+25",
    );
  } else if (
    mediaType ===
      "press_conference" ||
    mediaType ===
      "interview" ||
    mediaType ===
      "training"
  ) {
    score +=
      8;

    reasons.push(
      `${mediaType}:+8`,
    );
  }

  if (
    embeddable
  ) {
    score +=
      5;

    reasons.push(
      "embeddable:+5",
    );
  } else {
    score -=
      50;

    reasons.push(
      "not-embeddable:-50",
    );
  }

  if (
    durationSeconds !==
      null &&
    durationSeconds >=
      90 &&
    durationSeconds <=
      1800
  ) {
    score +=
      5;

    reasons.push(
      "useful-duration:+5",
    );
  }

  if (
    containsAny(
      normalized,
      [
        "shorts",
        "short",
      ],
    )
  ) {
    score -=
      25;

    reasons.push(
      "short-form:-25",
    );
  }

  if (
    containsAny(
      normalized,
      [
        "barca live",
        "barcelona live",
        "live barca",
      ],
    )
  ) {
    score -=
      35;

    reasons.push(
      "live-show:-35",
    );
  }

  if (
    containsAny(
      normalized,
      [
        "match preview",
        "preview",
      ],
    )
  ) {
    score -=
      20;

    reasons.push(
      "preview:-20",
    );
  }

  const accepted =
    isSafeAutomaticMatch({
      score,
      mediaType,
      opponentMention,
      exactScore,
      embeddable,
    });

  reasons.push(
    accepted
      ? "AUTO-ACCEPT"
      : "AUTO-REJECT",
  );

  return makeCandidate({
    video,
    mediaType,
    durationSeconds,
    embeddable,
    score,
    accepted,
    reasons,
  });
}

function isSafeAutomaticMatch(
  input: {
    score:
      number;

    mediaType:
      MediaType;

    opponentMention:
      boolean;

    exactScore:
      boolean;

    embeddable:
      boolean;
  },
) {
  if (
    !input.embeddable
  ) {
    return false;
  }

    /*
  * Match previews are intentionally human-reviewed.
  *
  * They are related to the fixture, but they're pre-match content and should
  * never be attached automatically as post-match media.
  */
  if (
    input.mediaType ===
    "match_preview"
  ) {
    return false;
  }

  if (
    input.mediaType ===
    "match_highlight"
  ) {
    return (
      input.opponentMention &&
      (
        input.exactScore
          ? input.score >=
            90
          : input.score >=
            110
      )
    );
  }

  /*
   * Secondary match media such as Un Dia De Partit must still have
   * strong fixture evidence before it is linked automatically.
   */
  return (
    input.opponentMention &&
    input.score >=
      95
  );
}

function classifyMedia(
  normalizedTitle:
    string,

  exactScore:
    boolean,
): MediaType {
  /*
   * Pre-match editorial content.
   *
   * Keep this BEFORE the score/highlight checks so previews never get
   * accidentally classified as canonical highlights.
   */
  if (
    containsAny(
      normalizedTitle,
      [
        "match preview",
        "preview",
        "previa",
      ],
    )
  ) {
    return "match_preview";
  }

  if (
    containsAny(
      normalizedTitle,
      [
        "press conference",
        "pressconference",
        "roda de premsa",
        "rueda de prensa",
      ],
    )
  ) {
    return "press_conference";
  }

  if (
    containsAny(
      normalizedTitle,
      [
        "interview",
        "reaction",
        "reacts",
        "post match",
      ],
    )
  ) {
    return "interview";
  }

  if (
    containsAny(
      normalizedTitle,
      [
        "training",
        "training session",
        "entrenament",
        "entrenamiento",
      ],
    )
  ) {
    return "training";
  }

  /*
   * Barça match films / behind-the-scenes productions.
   */
  if (
    containsAny(
      normalizedTitle,
      [
        "un dia de partit",
        "un dia de partido",
        "matchday documentary",
        "matchday feature",
        "behind the scenes",
        "behind the scenes matchday",
      ],
    )
  ) {
    return "match_feature";
  }

  if (
    exactScore ||
    containsAny(
      normalizedTitle,
      [
        "highlights",
        "highlight",
        "resumen",
        "resum",
        "goals and highlights",
        "all goals",
      ],
    )
  ) {
    return "match_highlight";
  }

  if (
    containsAny(
      normalizedTitle,
      [
        "goal",
        "gol",
        "free kick",
        "penalty",
      ],
    )
  ) {
    return "goal_clip";
  }

  return "other";
}

function exclusionReason(
  normalizedTitle:
    string,
) {
  const blocked = [
    "barca live",
    "barcelona live",

    "women",
    "womens",
    "women s",
    "femeni",
    "femenino",
    "liga f",
    "uwcl",
    "uefa women",
    "barcelona w",
    "barca women",

    "la masia",
    "juvenil",
    "u 11",
    "u11",
    "u 12",
    "u12",
    "u 13",
    "u13",
    "u 14",
    "u14",
    "u 15",
    "u15",
    "u 16",
    "u16",
    "u 17",
    "u17",
    "u 18",
    "u18",
    "u 19",
    "u19",

    "barca athletic",
    "barcelona athletic",
    "barca atletic",
    "barcelona atletic",
    "barcelona b",

    "basketball",
    "basket",
    "handball",
    "futsal",
    "roller hockey",
  ];

  const found =
    blocked.find(
      (
        term,
      ) =>
        normalizedTitle.includes(
          term,
        ),
    );

  return found
    ? `excluded-category:${found}`
    : null;
}

function hasExactFixtureScore(
  title:
    string,

  match:
    MatchContext,
) {
  const normalizedTitle =
    normalize(
      title,
    );

  const homeAliases =
    teamAliases(
      match.homeTeam,
    );

  const awayAliases =
    teamAliases(
      match.awayTeam,
    );

  const homeMention =
    containsAny(
      normalizedTitle,
      homeAliases,
    );

  const awayMention =
    containsAny(
      normalizedTitle,
      awayAliases,
    );

  if (
    !homeMention ||
    !awayMention
  ) {
    return false;
  }

  /*
   * Keep score separators intact here.
   *
   * This prevents season strings such as "26/27" from accidentally
   * being treated as a 2–7 scoreline.
   */
  const scoreText =
    title
      .normalize(
        "NFD",
      )
      .replace(
        /[\u0300-\u036f]/g,
        "",
      )
      .toLowerCase();

  const pattern =
    /(?:^|[^0-9])(\d{1,2})\s*(?:vs|v|x|to|-|–|—|:)\s*(\d{1,2})(?=$|[^0-9])/g;

  for (
    const result
    of scoreText.matchAll(
      pattern,
    )
  ) {
    const first =
      Number(
        result[1],
      );

    const second =
      Number(
        result[2],
      );

    const forward =
      first ===
        match.score.home &&
      second ===
        match.score.away;

    const reversed =
      first ===
        match.score.away &&
      second ===
        match.score.home;

    if (
      forward ||
      reversed
    ) {
      return true;
    }
  }

  return false;
}

function teamAliases(
  team: {
    name:
      string;

    shortName:
      string | null;

    code:
      string;
  },
) {
  const aliases =
    new Set<string>();

  const candidates = [
    team.name,
    team.shortName,
  ];

  for (
    const value
    of candidates
  ) {
    if (!value) {
      continue;
    }

    const normalized =
      normalize(
        value,
      );

    if (
      normalized.length >=
      4
    ) {
      aliases.add(
        normalized,
      );
    }

    const reduced =
      normalized
        .split(
          " ",
        )
        .filter(
          (
            token,
          ) =>
            ![
              "fc",
              "cf",
              "ud",
              "cd",
              "club",
              "real",
              "de",
              "del",
              "the",
            ].includes(
              token,
            ),
        )
        .join(
          " ",
        )
        .trim();

    if (
      reduced.length >=
      4
    ) {
      aliases.add(
        reduced,
      );
    }

    const meaningfulTokens =
      reduced
        .split(
          " ",
        )
        .filter(
          (
            token,
          ) =>
            token.length >=
            4,
        );

    if (
      meaningfulTokens.length >=
      2
    ) {
      aliases.add(
        meaningfulTokens
          .slice(
            -2,
          )
          .join(
            " ",
          ),
      );
    }

    const distinctive =
      meaningfulTokens.filter(
        (
          token,
        ) =>
          token.length >=
          5,
      );

    if (
      distinctive.length ===
      1
    ) {
      aliases.add(
        distinctive[0],
      );
    }
  }

  if (
    team.name
      .toLowerCase()
      .includes(
        "barcelona",
      )
  ) {
    aliases.add(
      "fc barcelona",
    );

    aliases.add(
      "barcelona",
    );

    aliases.add(
      "barca",
    );
  }

  return Array.from(
    aliases,
  ).sort(
    (
      left,
      right,
    ) =>
      right.length -
      left.length,
  );
}

function competitionAliases(
  competition:
    MatchContext[
      "competition"
    ],
) {
  const aliases =
    new Set<string>();

  aliases.add(
    normalize(
      competition.name,
    ),
  );

  if (
    competition.shortName
  ) {
    aliases.add(
      normalize(
        competition.shortName,
      ),
    );
  }

  const code =
    competition.code
      .toUpperCase();

  if (
    code ===
    "PD"
  ) {
    aliases.add(
      "laliga",
    );

    aliases.add(
      "la liga",
    );
  }

  if (
    code ===
    "CL"
  ) {
    aliases.add(
      "champions league",
    );

    aliases.add(
      "uefa champions league",
    );

    aliases.add(
      "ucl",
    );
  }

  return Array.from(
    aliases,
  ).filter(
    (
      alias,
    ) =>
      alias.length >=
      3,
  );
}

function makeCandidate(
  input: {
    video:
      YouTubeVideo;

    mediaType:
      MediaType;

    durationSeconds:
      number | null;

    embeddable:
      boolean;

    score:
      number;

    accepted:
      boolean;

    reasons:
      string[];
  },
): MatchMediaCandidate {
  return {
    videoId:
      input.video.id,

    title:
      input.video
        .snippet
        .title,

    publishedAt:
      input.video
        .snippet
        .publishedAt,

    url:
      `https://www.youtube.com/watch?v=${input.video.id}`,

    thumbnailUrl:
      bestThumbnail(
        input.video
          .snippet
          .thumbnails,
      ),

    durationSeconds:
      input.durationSeconds,

    embeddable:
      input.embeddable,

    type:
      input.mediaType,

    score:
      input.score,

    accepted:
      input.accepted,

    reasons:
      input.reasons,
  };
}

async function calculateDryRunWritePlan(
  input: {
    accepted:
      MatchMediaCandidate[];

    context:
      MatchContext;

    existingSourceId:
      string | null;

    writePlan:
      WritePlan;
  },
) {
  for (
    const candidate
    of input.accepted
  ) {
    if (
      !input.existingSourceId
    ) {
      input.writePlan
        .created +=
        1;

      continue;
    }

    const existing =
      await db.orm.public.MediaItem
        .where({
          dataSourceId:
            input.existingSourceId,

          externalMediaId:
            candidate.videoId,
        })
        .first();

    if (!existing) {
      input.writePlan
        .created +=
        1;

      continue;
    }

    if (
      mediaRowMatches(
        existing,
        candidate,
        input.context,
      )
    ) {
      input.writePlan
        .unchanged +=
        1;
    } else {
      input.writePlan
        .updated +=
        1;
    }
  }
}

async function ensureDataSource() {
  const existing =
    await db.orm.public.DataSource
      .where({
        code:
          DATA_SOURCE.code,
      })
      .first();

  const data = {
    name:
      DATA_SOURCE.name,

    baseUrl:
      DATA_SOURCE.baseUrl,

    isOfficial:
      DATA_SOURCE.isOfficial,

    isEnabled:
      DATA_SOURCE.isEnabled,

    licenseNotes:
      DATA_SOURCE.licenseNotes,
  };

  if (!existing) {
    const created =
      await db.orm.public.DataSource
        .create({
          code:
            DATA_SOURCE.code,

          ...data,
        });

    if (!created) {
      throw new Error(
        "Could not create YouTube data source.",
      );
    }

    return created;
  }

  const changed =
    existing.name !==
      data.name ||
    existing.baseUrl !==
      data.baseUrl ||
    existing.isOfficial !==
      data.isOfficial ||
    existing.isEnabled !==
      data.isEnabled ||
    existing.licenseNotes !==
      data.licenseNotes;

  if (!changed) {
    return existing;
  }

  const updated =
    await db.orm.public.DataSource
      .where({
        id:
          existing.id,
      })
      .update(
        data,
      );

  if (!updated) {
    throw new Error(
      "Could not update YouTube data source.",
    );
  }

  return updated;
}

async function persistCandidate(
  input: {
    candidate:
      MatchMediaCandidate;

    context:
      MatchContext;

    dataSourceId:
      string;

    writePlan:
      WritePlan;
  },
) {
  const existing =
    await db.orm.public.MediaItem
      .where({
        dataSourceId:
          input.dataSourceId,

        externalMediaId:
          input.candidate
            .videoId,
      })
      .first();

  if (
    existing &&
    existing.matchId &&
    existing.matchId !==
      input.context.id
  ) {
    throw new Error(
      `YouTube video ${input.candidate.videoId} is already linked to another match (${existing.matchId}).`,
    );
  }

  const data = {
    type:
      input.candidate
        .type,

    title:
      input.candidate
        .title,

    description:
      null,

    url:
      input.candidate
        .url,

    externalMediaId:
      input.candidate
        .videoId,

    thumbnailUrl:
      input.candidate
        .thumbnailUrl,

    isOfficial:
      true,

    publishedAt:
      Temporal.Instant.from(
        input.candidate
          .publishedAt,
      ),

    seasonId:
      input.context
        .seasonId,

    matchId:
      input.context.id,

    playerId:
      null,

    dataSourceId:
      input.dataSourceId,
  };

  if (!existing) {
    const created =
      await db.orm.public.MediaItem
        .create(
          data,
        );

    if (!created) {
      throw new Error(
        `Could not create media item ${input.candidate.videoId}.`,
      );
    }

    input.writePlan
      .created +=
      1;

    return;
  }

  if (
    mediaRowMatches(
      existing,
      input.candidate,
      input.context,
    )
  ) {
    input.writePlan
      .unchanged +=
      1;

    return;
  }

  const updated =
    await db.orm.public.MediaItem
      .where({
        id:
          existing.id,
      })
      .update(
        data,
      );

  if (!updated) {
    throw new Error(
      `Could not update media item ${input.candidate.videoId}.`,
    );
  }

  input.writePlan
    .updated +=
    1;
}

function mediaRowMatches(
  existing: {
    type:
      string;

    title:
      string;

    url:
      string;

    externalMediaId:
      string | null;

    thumbnailUrl:
      string | null;

    isOfficial:
      boolean;

    publishedAt: {
      toString():
        string;
    } | null;

    seasonId:
      string | null;

    matchId:
      string | null;

    dataSourceId:
      string | null;
  },

  candidate:
    MatchMediaCandidate,

  context:
    MatchContext,
) {
  return (
    existing.type ===
      candidate.type &&
    existing.title ===
      candidate.title &&
    existing.url ===
      candidate.url &&
    existing.externalMediaId ===
      candidate.videoId &&
    existing.thumbnailUrl ===
      candidate.thumbnailUrl &&
    existing.isOfficial ===
      true &&
    existing.publishedAt
      ?.toString() ===
      Temporal.Instant.from(
        candidate.publishedAt,
      ).toString() &&
    existing.seasonId ===
      context.seasonId &&
    existing.matchId ===
      context.id
  );
}

function makeEmptyWritePlan():
  WritePlan {
  return {
    created:
      0,

    updated:
      0,

    unchanged:
      0,
  };
}

function emptyBatchResult(
  dryRun:
    boolean,
): MatchMediaBatchResult {
  return {
    dryRun,

    matches:
      0,

    youtube: {
      channelId:
        YOUTUBE_CHANNEL_ID,

      channelName:
        "FC Barcelona",

      uploadsPlaylist:
        "",

      requests:
        0,

      uploadPages:
        0,

      videosInspected:
        0,
    },

    writePlan:
      makeEmptyWritePlan(),

    results:
      [],
  };
}

async function fetchJson<T>(
  url:
    URL,
): Promise<T> {
  const response =
    await fetch(
      url,
      {
        cache:
          "no-store",
      },
    );

  if (!response.ok) {
    const body =
      await response.text();

    throw new Error(
      `YouTube request failed (${response.status}): ${body.slice(
        0,
        500,
      )}`,
    );
  }

  return (
    await response.json()
  ) as T;
}

function bestThumbnail(
  thumbnails:
    YouTubeVideo[
      "snippet"
    ]["thumbnails"],
) {
  return (
    thumbnails
      ?.maxres?.url ??
    thumbnails
      ?.standard?.url ??
    thumbnails
      ?.high?.url ??
    thumbnails
      ?.medium?.url ??
    thumbnails
      ?.default?.url ??
    null
  );
}

function parseIsoDuration(
  value:
    string,
) {
  const match =
    /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(
      value,
    );

  if (!match) {
    return null;
  }

  const hours =
    Number(
      match[1] ??
        0,
    );

  const minutes =
    Number(
      match[2] ??
        0,
    );

  const seconds =
    Number(
      match[3] ??
        0,
    );

  return (
    hours *
      3600 +
    minutes *
      60 +
    seconds
  );
}

function containsAny(
  text:
    string,

  terms:
    string[],
) {
  return terms.some(
    (
      term,
    ) =>
      text.includes(
        term,
      ),
  );
}

function normalize(
  value:
    string,
) {
  return value
    .normalize(
      "NFD",
    )
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .toLowerCase()
    .replace(
      /&/g,
      " and ",
    )
    .replace(
      /[^a-z0-9]+/g,
      " ",
    )
    .replace(
      /\s+/g,
      " ",
    )
    .trim();
}

function compareCandidates(
  left:
    MatchMediaCandidate,

  right:
    MatchMediaCandidate,
) {
  if (
    left.type ===
      "match_highlight" &&
    right.type !==
      "match_highlight"
  ) {
    return -1;
  }

  if (
    right.type ===
      "match_highlight" &&
    left.type !==
      "match_highlight"
  ) {
    return 1;
  }

  return (
    right.score -
    left.score
  );
}