export function normalizedPersonName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function repairMojibake(value: string) {
  if (!/[ÃÂÄÅ]/.test(value)) return value;
  const bytes = Uint8Array.from([...value], (character) => character.charCodeAt(0) & 0xff);
  const repaired = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  return repaired.includes("�") ? value : repaired;
}

export function splitDisplayName(displayName: string) {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts.length > 1 ? parts[0] : null,
    lastName: parts.length > 1 ? parts.slice(1).join(" ") : parts[0] ?? null,
  };
}

export function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number(value.replace(/%/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

export function asInteger(value: unknown) {
  const parsed = asFiniteNumber(value);
  return parsed === null ? null : Math.round(parsed);
}

export function jsonEqual(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}
