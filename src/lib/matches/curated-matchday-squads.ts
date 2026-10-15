/** Match-specific selections published by the club before the starting XI.
 * Names are kept as published; this does not imply a starter, substitute, or
 * canonical Player identity. Add only a verified official source per fixture.
 */
const selections: Record<string, { teamSide: "home" | "away"; sourceUrl: string; publishedAt: string; names: readonly string[] }> = {
  "17395982-6758-46fc-975e-27ad5054abe1": {
    teamSide: "away",
    sourceUrl: "https://www.fcbarcelona.com/en/news/4590653/the-fc-barcelona-squad-for-the-game-against-galatasaray",
    publishedAt: "2026-10-12",
    names: [
      "Joan Garcia", "Cancelo", "Balde", "Fariñas", "Cubarsí", "Gavi",
      "Fermín", "Pedri", "Gabriel Jesus", "Lamine Yamal", "Xavi Espart",
      "Szczesny", "Adeyemi", "Rodrigo", "Gordon", "Gerard Martin", "Olmo",
      "Bernal", "Kounde", "Eric Garcia", "Livakovic", "Abdelkarim",
    ],
  },
};

export function getCuratedMatchdaySquad(matchId: string) {
  return selections[matchId] ?? null;
}
