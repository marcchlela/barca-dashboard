export type PitchPosition = { x: number; y: number };

const LAYOUTS: Record<string, PitchPosition[]> = {
  "4-3-3": [
    { x: 0.5, y: 0.08 },
    { x: 0.14, y: 0.28 },
    { x: 0.38, y: 0.28 },
    { x: 0.62, y: 0.28 },
    { x: 0.86, y: 0.28 },
    { x: 0.22, y: 0.53 },
    { x: 0.5, y: 0.53 },
    { x: 0.78, y: 0.53 },
    { x: 0.18, y: 0.78 },
    { x: 0.5, y: 0.78 },
    { x: 0.82, y: 0.78 },
  ],
  "4-2-3-1": [
    { x: 0.5, y: 0.08 },
    { x: 0.14, y: 0.25 },
    { x: 0.38, y: 0.25 },
    { x: 0.62, y: 0.25 },
    { x: 0.86, y: 0.25 },
    { x: 0.35, y: 0.47 },
    { x: 0.65, y: 0.47 },
    { x: 0.18, y: 0.66 },
    { x: 0.5, y: 0.66 },
    { x: 0.82, y: 0.66 },
    { x: 0.5, y: 0.84 },
  ],
};

export function normalizeFormation(value: string | null | undefined) {
  if (!value) return null;
  const normalized = value.trim().replace(/[–—]/g, "-").replace(/\s+/g, "");
  return LAYOUTS[normalized] ? normalized : null;
}

/** UI-only formation placement. These are not provider tracking coordinates. */
export function formationPosition(
  formation: string | null | undefined,
  ordinal: number,
): PitchPosition | null {
  const key = normalizeFormation(formation);
  if (!key || ordinal < 1 || ordinal > 11) return null;
  return LAYOUTS[key][ordinal - 1] ?? null;
}
