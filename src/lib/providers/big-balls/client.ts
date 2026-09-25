import "server-only";

import { asObject, stringValue, type JsonObject } from "../shared/json";

const BASE_URL = "https://api.bigballsdata.com";
const TIMEOUT_MS = 15_000;

export class BigBallsClient {
  requestCount = 0;

  private apiKey() {
    const value = process.env.BBS_API_KEY;
    if (!value) throw new Error("BBS_API_KEY is missing from the environment.");
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
      throw new Error(
        `Big Balls request failed (${response.status}): ${
          stringValue(error, "message") ?? stringValue(body, "message") ?? response.statusText
        }`,
      );
    }
    return body;
  }
}
