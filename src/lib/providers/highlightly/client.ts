import "server-only";

import { asObject, stringValue, type JsonObject } from "../shared/json";

const BASE_URL = "https://soccer.highlightly.net";
const TIMEOUT_MS = 15_000;

export class HighlightlyHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAfterMs: number | null,
  ) {
    super(message);
    this.name = "HighlightlyHttpError";
  }
}

function retryDelay(response: Response) {
  const retryAfter = response.headers.get("retry-after");
  if (!retryAfter) return null;
  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
  const date = Date.parse(retryAfter);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : null;
}

export class HighlightlyClient {
  requestCount = 0;

  private apiKey() {
    const value = process.env.HIGHLIGHTLY_API_KEY;
    if (!value) throw new Error("HIGHLIGHTLY_API_KEY is missing from the environment.");
    return value;
  }

  async get(path: string): Promise<JsonObject> {
    this.requestCount += 1;
    const response = await fetch(`${BASE_URL}${path}`, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "x-rapidapi-key": this.apiKey(),
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
      throw new HighlightlyHttpError(
        `Highlightly request failed (${response.status}): ${
          stringValue(error, "message") ?? stringValue(body, "message") ?? response.statusText
        }`,
        response.status,
        retryDelay(response),
      );
    }
    return body;
  }
}
