// PitchAPI stores acting_ltr coordinates. The screen's top edge represents the
// attacking team's left flank, so display rows are intentionally inverted.
export function displayHeatmapRow(row: number, rows: number) {
  return rows - 1 - row;
}

export function displayHeatmapY(y: number) {
  return 1 - y;
}

const stops: { at: number; color: [number, number, number] }[] = [
  { at: 0, color: [15, 118, 110] },
  { at: .24, color: [34, 166, 153] },
  { at: .48, color: [211, 156, 67] },
  { at: .66, color: [240, 138, 36] },
  { at: .82, color: [225, 79, 57] },
  { at: 1, color: [199, 44, 72] },
];

export const HEATMAP_CUTOFF = .045;

export function heatmapStrength(raw: number) {
  if (raw <= HEATMAP_CUTOFF) return null;
  return Math.pow(Math.max(0, Math.min(1, (raw - HEATMAP_CUTOFF) / (1 - HEATMAP_CUTOFF))), .96);
}

export function heatmapColor(strength: number): [number, number, number] {
  const right = stops.find((item) => item.at >= strength) ?? stops[stops.length - 1];
  const index = Math.max(0, stops.indexOf(right) - 1);
  const left = stops[index];
  const part = right.at === left.at ? 0 : (strength - left.at) / (right.at - left.at);
  return left.color.map((value, i) => Math.round(value + (right.color[i] - value) * part)) as [number, number, number];
}

export function heatmapDisplayStyle(raw: number) {
  const strength = heatmapStrength(raw);
  if (strength === null) return null;
  const rgb = heatmapColor(strength);
  return { fill: `rgb(${rgb.join(",")})`, opacity: Math.round(Math.min(.84, .035 + strength * .76) * 1000) / 1000 };
}
