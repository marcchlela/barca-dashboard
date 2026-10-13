import "server-only";

import { asObject, stringValue, type JsonObject } from "../shared/json";

const BASE_URL = "https://api.goal-api.com/v1";
const TIMEOUT_MS = 15_000;

export class GoalApiHttpError extends Error {
  constructor(message: string, readonly status: number, readonly retryAfterMs: number | null) {
    super(message);
    this.name = "GoalApiHttpError";
  }
}

function retryDelay(response: Response) {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const date = Date.parse(retryAfter);
    if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  }
  const reset = response.headers.get("x-ratelimit-reset");
  const resetAt = reset ? Number(reset) : NaN;
  if (Number.isFinite(resetAt)) return Math.max(0, resetAt * 1000 - Date.now());
  return null;
}

export class GoalApiClient {
  requestCount = 0;

  private apiKey() {
    const value = process.env.GOAL_API_KEY;
    if (!value) throw new Error("GOAL_API_KEY is missing from the environment.");
    return value;
  }

  async get(path: string): Promise<JsonObject> {
    this.requestCount += 1;
    const response = await fetch(`${BASE_URL}${path}`, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${this.apiKey()}`,
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const raw = await response.text();
    let body: JsonObject = {};
    if (raw) {
      try {
        body = asObject(JSON.parse(raw)) ?? { data: JSON.parse(raw) };
      } catch {
        body = { message: raw.slice(0, 300) };
      }
    }
    if (!response.ok) {
      const error = asObject(body.error);
      throw new GoalApiHttpError(
        `GOAL API request failed (${response.status}): ${
          stringValue(error, "message") ?? stringValue(body, "message") ?? response.statusText
        }`,
        response.status,
        retryDelay(response),
      );
    }
    return body;
  }
}
