function key(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

/** An official article must explicitly identify 11 distinct starters. */
export function extractOfficialStartingEleven(text: string) {
  const clause = text.match(/(?:bar[cç]a|fc barcelona|blaugrana)(?:'s)?\s+(?:confirmed\s+)?(?:starting\s+(?:xi|eleven)|line-?up)\s*(?:is|are|:|-|–)\s*([^\n]{50,500})/i)
    ?? text.match(/(?:confirmed\s+)?(?:starting\s+(?:xi|eleven)|line-?up)\s*(?:is|are|:|-|–)\s*([^\n]{50,500})/i);
  if (!clause || /\b(?:predicted|probable|possible|expected|likely|could|might)\b/i.test(text.slice(Math.max(0, (clause.index ?? 0) - 80), (clause.index ?? 0) + clause[0].length))) return [];
  const names = clause[1].replace(/\s+and\s+/i, ", ").split(",").map((name) => name.trim().replace(/\s*\([^)]*\)\s*$/, "").replace(/[.!]+$/, ""));
  return names.length === 11 && new Set(names.map(key)).size === 11 && names.every((name) => /^[\p{L}.'’ -]{2,45}$/u.test(name)) ? names : [];
}
