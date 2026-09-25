import type { DataLabReport } from "./types";

export const DATA_LAB_CACHE_TTL_SECONDS = 15 * 60;

type Entry = {
  expiresAt: number;
  value: DataLabReport;
};

const cache = new Map<string, Entry>();

export function readDataLabCache(key: string) {
  const entry = cache.get(key);

  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }

  return entry.value;
}

export function writeDataLabCache(key: string, value: DataLabReport) {
  cache.set(key, {
    value,
    expiresAt: Date.now() + DATA_LAB_CACHE_TTL_SECONDS * 1_000,
  });
}
