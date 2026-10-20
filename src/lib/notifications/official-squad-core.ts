export function candidateSquadLinks(html: string) {
  return [...html.matchAll(/<a\s+[^>]*href="([^"]+)"/gi)].map((match) => match[1]).filter((path) =>
    path.startsWith("/en/football/first-team/news/") && /(?:squad|convocat)/i.test(path));
}

export function opponentTokens(name: string) {
  const words = name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().split(/[^a-z0-9]+/)
    .filter((token) => token && !["fc", "cf", "club", "futbol", "de", "barcelona", "deportivo", "sporting"].includes(token));
  const acronym = words.length >= 2 ? words.map((word) => word[0]).join("") : "";
  return [...new Set([...words.filter((token) => token.length >= 5), acronym].filter((token) => token.length >= 2))];
}

export function matchingSquadLinks(links: string[], opponent: string) {
  const tokens = opponentTokens(opponent);
  return links.filter((link) => tokens.some((token) => link.toLowerCase().includes(token)) &&
    /(?:the-squad|squad-for|squad-to|squad-for-the|fc-barcelona-squad)/i.test(link));
}

function decodeText(value: string) {
  return value
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&aacute;/gi, "á").replace(/&eacute;/gi, "é").replace(/&iacute;/gi, "í")
    .replace(/&oacute;/gi, "ó").replace(/&uacute;/gi, "ú").replace(/&ntilde;/gi, "ñ");
}

/** Extracts only an explicitly introduced official squad list. */
export function extractOfficialSquadNames(html: string) {
  const articleBodyMatch = html.match(/"articleBody"\s*:\s*("(?:\\.|[^"\\])*")/i);
  let text = "";
  if (articleBodyMatch) {
    try { text = JSON.parse(articleBodyMatch[1]); } catch { /* fall through to visible HTML */ }
  }
  if (!text) {
    const paragraph = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
      .map((match) => match[1])
      .find((value) => /full list|squad list|named .* players/i.test(value));
    text = paragraph?.replace(/<[^>]+>/g, " ") ?? "";
  }
  text = decodeText(text).replace(/\s+/g, " ").trim();
  const introduced = text.match(/(?:full (?:squad )?list|squad list)[^:]{0,160}(?:as follows|is as follows)?\s*:\s*(.+)/i)?.[1];
  if (!introduced) return [];
  const list = introduced.split(/(?:\.(?=\s+[A-Z][a-z]+\s)|\n|\r|\s{2,})/)[0]
    .replace(/[.!]+$/, "")
    .replace(/,?\s+and\s+/i, ", ");
  const names = list.split(",").map((name) => name.trim()).filter(Boolean);
  return names.length >= 15 && names.length <= 30 ? names : [];
}
