export type JsonObject = Record<string, unknown>;

export function asObject(value: unknown): JsonObject | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

export function asArray(value: unknown, ...keys: string[]): unknown[] {
  if (Array.isArray(value)) return value;
  const object = asObject(value);
  for (const key of keys) {
    if (Array.isArray(object?.[key])) return object[key] as unknown[];
  }
  return [];
}

export function stringValue(value: JsonObject | null, ...keys: string[]) {
  for (const key of keys) {
    const candidate = value?.[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return String(candidate);
    }
  }
  return null;
}

export function numberValue(value: JsonObject | null, ...keys: string[]) {
  for (const key of keys) {
    const candidate = value?.[key];
    if (typeof candidate === "number" && Number.isFinite(candidate)) return candidate;
    if (
      typeof candidate === "string" &&
      candidate.trim() &&
      Number.isFinite(Number(candidate.replace(/%/g, "").trim()))
    ) {
      return Number(candidate.replace(/%/g, "").trim());
    }
  }
  return null;
}

export function booleanValue(value: JsonObject | null, ...keys: string[]) {
  for (const key of keys) {
    const candidate = value?.[key];
    if (typeof candidate === "boolean") return candidate;
    if (candidate === 1 || candidate === "1" || candidate === "true") return true;
    if (candidate === 0 || candidate === "0" || candidate === "false") return false;
  }
  return null;
}

export function nestedScalar(value: unknown): unknown {
  const object = asObject(value);
  if (!object) return value;
  return object.value ?? object.total ?? object.count ?? null;
}
