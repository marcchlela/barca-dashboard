import "server-only";

import type {
  StatsHawkRequestRecord,
  StatsHawkUsage,
} from "./types";

export type StatsHawkEnvelope = {
  data?: unknown;

  meta?: {
    cache?: string;
    request_id?: string;
    fetched_at?: string;
    source?: string | null;
  };

  error?: unknown;
};

const DEFAULT_BASE_URL =
  "https://api.statshawk.ai/v1";

const REQUEST_TIMEOUT_MS =
  12_000;

function headerNumber(
  response: Response,
  name: string,
) {
  const raw =
    response.headers.get(
      name,
    );

  if (raw === null) {
    return null;
  }

  const parsed =
    Number(raw);

  return Number.isFinite(
    parsed,
  )
    ? parsed
    : null;
}

export class StatsHawkClient {
  private readonly records:
    StatsHawkRequestRecord[] =
      [];

  private expectedUnits =
    0;

  private readonly baseUrl:
    string;

  constructor(
    private readonly hardBudget = 12,
  ) {
    this.baseUrl =
      (
        process.env
          .STATSHAWK_BASE_URL ??
        DEFAULT_BASE_URL
      ).replace(
        /\/$/,
        "",
      );
  }

  async get(
    path: string,
    expectedUnits: number,
  ): Promise<StatsHawkEnvelope> {
    const apiKey =
      process.env
        .STATSHAWK_API_KEY;

    if (!apiKey) {
      throw new Error(
        "STATSHAWK_API_KEY is not configured.",
      );
    }

    if (
      this.expectedUnits +
        expectedUnits >
      this.hardBudget
    ) {
      throw new Error(
        `StatsHawk request budget would exceed ${this.hardBudget} weighted units.`,
      );
    }

    this.expectedUnits +=
      expectedUnits;

    let response:
      | Response
      | null = null;

    let recorded = false;

    try {
      response =
        await fetch(
          this.baseUrl +
            path,
          {
            cache:
              "no-store",

            headers: {
              Accept:
                "application/json",

              "X-API-Key":
                apiKey,
            },

            signal:
              AbortSignal.timeout(
                REQUEST_TIMEOUT_MS,
              ),
          },
        );

      const text =
        await response.text();

      let body:
        StatsHawkEnvelope =
        {};

      if (text) {
        try {
          body =
            JSON.parse(
              text,
            ) as StatsHawkEnvelope;
        } catch {
          body = {
            error:
              text.slice(
                0,
                300,
              ),
          };
        }
      }

      this.records.push({
        path,

        status:
          response.status,

        expectedUnits,

        quotaRemaining:
          headerNumber(
            response,
            "x-account-quota-remaining",
          ),

        error:
          response.ok
            ? null
            : JSON.stringify(
                body.error ??
                  body,
              ).slice(
                0,
                300,
              ),
      });

      recorded = true;

      if (!response.ok) {
        throw new Error(
          `StatsHawk ${path} returned HTTP ${response.status}.`,
        );
      }

      return body;
    } catch (error) {
      if (!recorded) {
        this.records.push({
          path,

          status:
            response?.status ??
            null,

          expectedUnits,

          quotaRemaining:
            response
              ? headerNumber(
                  response,
                  "x-account-quota-remaining",
                )
              : null,

          error:
            error instanceof
            Error
              ? error.message
              : String(
                  error,
                ),
        });
      }

      throw error;
    }
  }

  usage(): StatsHawkUsage {
    const remaining =
      this.records
        .map(
          (record) =>
            record.quotaRemaining,
        )
        .filter(
          (
            value,
          ): value is number =>
            value !== null,
        );

    return {
      requestCount:
        this.records.length,

      expectedUnits:
        this.expectedUnits,

      quotaRemaining:
        remaining.length
          ? Math.min(
              ...remaining,
            )
          : null,

      requests:
        this.records,
    };
  }
}