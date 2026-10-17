export function candidateSquadLinks(html: string) {
  return [...html.matchAll(/<a\s+[^>]*href="([^"]+)"/gi)].map((match) => match[1]).filter((path) =>
    path.startsWith("/en/football/first-team/news/") && /(?:squad|convocat)/i.test(path));
}

export function opponentTokens(name: string) {
  return name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 5 && !["club", "futbol", "barcelona", "deportivo", "sporting"].includes(token));
}

export function matchingSquadLinks(links: string[], opponent: string) {
  const tokens = opponentTokens(opponent);
  return links.filter((link) => tokens.some((token) => link.toLowerCase().includes(token)) &&
    /(?:the-squad|squad-for|squad-to|squad-for-the|fc-barcelona-squad)/i.test(link));
}
