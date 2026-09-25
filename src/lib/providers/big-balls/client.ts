import "server-only";

import {
  asObject,
  stringValue,
  type JsonObject,
} from "../shared/json";

const BASE_URL =
  "https://api.bigballsdata.com";

const TIMEOUT_MS =
  15_000;

function headerValue(
  response: Response,
  ...names: string[]
) {
  for (
    const name
    of names
  ) {
    const value =
      response.headers.get(
        name,
      );

    if (value) {
      return value;
    }
  }

  return null;
}

function numericHeader(
  response: Response,
  ...names: string[]
) {
  const raw =
    headerValue(
      response,
      ...names,
    );

  if (!raw) {
    return null;
  }

  const value =
    Number(raw);

  return Number.isFinite(
    value,
  )
    ? value
    : null;
}

export class BigBallsQuotaError
  extends Error {
  readonly status =
    429;

  constructor(
    message: string,

    readonly remaining:
      | number
      | null,

    readonly reset:
      | string
      | null,

    readonly retryAfter:
      | string
      | null,
  ) {
    super(message);

    this.name =
      "BigBallsQuotaError";
  }
}

export function isBigBallsQuotaError(
  error: unknown,
): error is BigBallsQuotaError {
  if (
    error instanceof
    BigBallsQuotaError
  ) {
    return true;
  }

  if (
    !(error instanceof Error)
  ) {
    return false;
  }

  return (
    error.name ===
      "BigBallsQuotaError" ||
    error.message.includes(
      "Big Balls request failed (429)",
    ) ||
    error.message
      .toLowerCase()
      .includes(
        "big balls daily quota",
      )
  );
}

export class BigBallsClient {
  requestCount =
    0;

  private apiKey() {
    const value =
      process.env
        .BBS_API_KEY;

    if (!value) {
      throw new Error(
        "BBS_API_KEY is missing from the environment.",
      );
    }

    return value;
  }

  async get(
    path: string,
  ): Promise<JsonObject> {
    this.requestCount +=
      1;

    const response =
      await fetch(
        `${BASE_URL}${path}`,
        {
          cache:
            "no-store",

          headers: {
            Accept:
              "application/json",

            Authorization:
              `Bearer ${this.apiKey()}`,
          },

          signal:
            AbortSignal.timeout(
              TIMEOUT_MS,
            ),
        },
      );

    const raw =
      await response.text();

    let body:
      JsonObject = {};

    if (raw) {
      try {
        const parsed =
          JSON.parse(raw);

        body =
          asObject(
            parsed,
          ) ?? {
            data:
              parsed,
          };
      } catch {
        body = {
          message:
            raw.slice(
              0,
              300,
            ),
        };
      }
    }

    if (
      response.status ===
      429
    ) {
      const error =
        asObject(
          body.error,
        );

      const providerMessage =
        stringValue(
          error,
          "message",
        ) ??
        stringValue(
          body,
          "message",
        ) ??
        "Daily request quota exhausted.";

      const remaining =
        numericHeader(
          response,
          "x-ratelimit-remaining",
          "x-rate-limit-remaining",
          "ratelimit-remaining",
        );

      const reset =
        headerValue(
          response,
          "x-ratelimit-reset",
          "x-rate-limit-reset",
          "ratelimit-reset",
        );

      const retryAfter =
        headerValue(
          response,
          "retry-after",
        );

      throw new BigBallsQuotaError(
        `Big Balls daily quota exhausted: ${providerMessage}`,
        remaining,
        reset,
        retryAfter,
      );
    }

    if (!response.ok) {
      const error =
        asObject(
          body.error,
        );

      throw new Error(
        `Big Balls request failed (${response.status}): ${
          stringValue(
            error,
            "message",
          ) ??
          stringValue(
            body,
            "message",
          ) ??
          response.statusText
        }`,
      );
    }

    return body;
  }
}