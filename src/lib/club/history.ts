/** Checked-in museum curation. No content is fetched when a Club page renders. */
export const CHRONOLOGY_SOURCE = "https://players.fcbarcelona.com/en/chronology";
export const HONOURS_SOURCE = "https://www.fcbarcelona.com/en/football/first-team/honours";
export const HISTORY_SOURCE = "https://www.fcbarcelona.com/en/club/history/decade-by-decade";

export type ClubEra = { id: string; start: number; end: number; title: string; description: string; source: string; accent: string };

export const CLUB_ERAS: ClubEra[] = [
  { id: "origins", start: 1899, end: 1908, title: "A club is born", description: "From Gamper's founding circle to a club with a place in Barcelona's sporting life.", source: "https://www.fcbarcelona.com/en/card/643865/1899-1909-foundation-and-survival", accent: "#bd8c52" },
  { id: "consolidation", start: 1909, end: 1918, title: "Finding a home", description: "The Carrer Indústria ground and the beginnings of a growing social institution.", source: "https://www.fcbarcelona.com/en/card/682785/1909-19-consolidation-at-carrer-industria", accent: "#8d3850" },
  { id: "golden-age", start: 1919, end: 1929, title: "First golden age", description: "A celebrated team, rising crowds and the first Spanish league championship.", source: HISTORY_SOURCE, accent: "#d3a65e" },
  { id: "turbulence", start: 1930, end: 1938, title: "Against the tide", description: "The club endured the political and social upheaval of the 1930s.", source: HISTORY_SOURCE, accent: "#6b829e" },
  { id: "perseverance", start: 1939, end: 1949, title: "Years of perseverance", description: "Barça's identity survived a difficult post-war period.", source: "https://www.fcbarcelona.com/en/card/643898/1939-50-years-of-perseverance", accent: "#8d3850" },
  { id: "kubala", start: 1950, end: 1960, title: "Kubala & a new home", description: "Membership grew and Camp Nou opened in 1957.", source: HISTORY_SOURCE, accent: "#d3a65e" },
  { id: "social", start: 1961, end: 1968, title: "A wider reach", description: "The club's social base expanded through a leaner period on the pitch.", source: HISTORY_SOURCE, accent: "#698c98" },
  { id: "cruyff", start: 1969, end: 1977, title: "Cruyff arrives", description: "A landmark signing and a new chapter in club and Catalan public life.", source: HISTORY_SOURCE, accent: "#8d3850" },
  { id: "stars", start: 1978, end: 1987, title: "More members, more stars", description: "The club grew and pursued domestic and European honours.", source: HISTORY_SOURCE, accent: "#6b829e" },
  { id: "dream-team", start: 1988, end: 1995, title: "The Dream Team", description: "Cruyff's side reshaped the football and reached its first European Cup.", source: "https://www.fcbarcelona.com/en/card/643913/1988-1996-the-era-of-the-dream-team", accent: "#d3a65e" },
  { id: "century", start: 1996, end: 2007, title: "A century of Barça", description: "Centenary celebrations, reinvention and the road back to European glory.", source: HISTORY_SOURCE, accent: "#8d3850" },
  { id: "global", start: 2008, end: 2020, title: "A global standard", description: "An era of landmark football and three more Champions League titles.", source: "https://www.fcbarcelona.com/en/card/643923/2008-20-the-best-years-in-our-history", accent: "#d3a65e" },
  { id: "new-horizon", start: 2021, end: 2026, title: "A new horizon", description: "An unfinished chapter: renewal, a new generation and the stadium's transformation.", source: HISTORY_SOURCE, accent: "#6b829e" },
];

type HonourCategory = { name: string; published: string };
const honourCategories: HonourCategory[] = [
  { name: "Champions League", published: "1991-92, 2005-06, 2008-09, 2010-11, 2014-15" },
  { name: "FIFA Club World Cup", published: "2009-10, 2011-12, 2015-16" },
  { name: "European Cup Winners' Cup", published: "1978-79, 1981-82, 1988-89, 1996-97" },
  { name: "Fairs Cup", published: "1957-58, 1959-60, 1965-66" },
  { name: "Fairs Super Cup", published: "1971-72" },
  { name: "European Super Cup", published: "1992-93, 1997-98, 2009-10, 2011-12, 2015-16" },
  { name: "Latin Cup", published: "1948-49, 1951-52" },
  { name: "Pyrenees Cup", published: "1909-10, 1910-11, 1911-12, 1912-13" },
  { name: "Spanish League Championship", published: "1928-29, 1944-45, 1947-48, 1948-49, 1951-52, 1952-53, 1958-59, 1959-60, 1973-74, 1984-85, 1990-91, 1991-92, 1992-93, 1993-94, 1997-98, 1998-99, 2004-05, 2005-06, 2008-09, 2009-10, 2010-11, 2012-13, 2014-15, 2015-16, 2017-18, 2018-19, 2022-23, 2024-25, 2025-26" },
  { name: "Copa del Rey", published: "1909-10, 1911-12, 1912-13, 1919-20, 1921-22, 1924-25, 1925-26, 1927-28, 1941-42, 1950-51, 1951-52, 1952-53, 1956-57, 1958-59, 1962-63, 1967-68, 1970-71, 1977-78, 1980-81, 1982-83, 1987-88, 1989-90, 1996-97, 1997-98, 2008-09, 2011-12, 2014-15, 2015-16, 2016-17, 2017-18, 2020-21, 2024-25" },
  { name: "Spanish Super Cup", published: "1983-84, 1991-92, 1992-93, 1994-95, 1996-97, 2005-06, 2006-07, 2009-10, 2010-11, 2011-12, 2013-14, 2016-17, 2018-19, 2022-23, 2024-25, 2025-26" },
  { name: "Spanish League Cup", published: "1982-83, 1985-86" },
  { name: "Mediterranean League", published: "1937" },
  { name: "Catalan League", published: "1937-38" },
  { name: "Catalan League Championship", published: "1901-1902, 1902-03, 1904-05, 1908-09, 1909-10, 1910-11, 1912-13, 1915-16, 1918-19, 1919-20, 1920-21, 1921-22, 1923-24, 1924-25, 1925-26, 1926-27, 1927-28, 1929-30, 1930-31, 1931-32, 1934-35, 1935-36, 1937-38" },
  { name: "Catalan Super Cup", published: "2014-15, 2017-18" },
  { name: "Catalan Cup", published: "1990-91, 1992-93, 1999-00, 2003-04, 2004-05, 2006-07, 2012-13, 2013-14" },
  { name: "Eva Duarte Cup", published: "1948-49, 1951-52, 1952-53" },
];

export type CuratedHonour = { name: string; publishedLabel: string; source: string; startYear: number | null };
const honourCompetitionCodes: Record<string, string> = {
  "Champions League": "CL",
  "Spanish League Championship": "PD",
  "Copa del Rey": "CDR",
  "Spanish Super Cup": "SSC",
};

export function clubHonourCompetitionCode(name: string): string | null {
  return honourCompetitionCodes[name] ?? null;
}

export function clubHonourDisplayName(name: string): string {
  return name === "Spanish League Championship" ? "La Liga" : name;
}

export const CLUB_HONOURS: CuratedHonour[] = honourCategories.flatMap(({ name, published }) => published.split(", ").map((publishedLabel) => {
  const match = /^(\d{4})-(\d{2}|\d{4})$/.exec(publishedLabel);
  const startYear = match ? Number(match[1]) : null;
  const expectedEnd = startYear === null ? null : startYear + 1;
  const unambiguous = expectedEnd !== null && (match![2].length === 4 ? Number(match![2]) === expectedEnd : Number(match![2]) === expectedEnd % 100);
  return { name, publishedLabel, source: HONOURS_SOURCE, startYear: unambiguous ? startYear : null };
}));

export type CuratedMoment = { id: string; startYear: number; title: string; description: string; source: string; occurredAt: string; preciseDate: boolean };
export const CLUB_MOMENTS: CuratedMoment[] = [
  { id: "founding", startYear: 1899, title: "The club is founded", description: "Joan Gamper and eleven others established Futbol Club Barcelona at the Solé Gymnasium.", source: CLUB_ERAS[0].source, occurredAt: "1899-11-29T12:00:00Z", preciseDate: true },
  { id: "first-league", startYear: 1928, title: "First Spanish league title", description: "Barça won the inaugural Spanish league championship.", source: HONOURS_SOURCE, occurredAt: "1929-06-01T12:00:00Z", preciseDate: false },
  { id: "camp-nou", startYear: 1957, title: "Camp Nou opens", description: "The club opened its new stadium on 24 September 1957.", source: "https://www.fcbarcelona.com/en/club/facilities/spotify-camp-nou/history", occurredAt: "1957-09-24T12:00:00Z", preciseDate: true },
  { id: "first-european-cup", startYear: 1991, title: "Wembley, 1992", description: "The Dream Team brought Barça its first European Cup.", source: CLUB_ERAS[9].source, occurredAt: "1992-05-20T12:00:00Z", preciseDate: true },
  { id: "second-european-cup", startYear: 2005, title: "Paris, 2006", description: "Barça won its second Champions League title.", source: HONOURS_SOURCE, occurredAt: "2006-05-01T12:00:00Z", preciseDate: false },
  { id: "rome", startYear: 2008, title: "Rome, 2009", description: "A Champions League title joined the league and cup in a landmark season.", source: CLUB_ERAS[11].source, occurredAt: "2009-05-01T12:00:00Z", preciseDate: false },
  { id: "berlin", startYear: 2014, title: "Berlin, 2015", description: "A fifth Champions League title capped another league-and-cup-winning season.", source: HONOURS_SOURCE, occurredAt: "2015-06-01T12:00:00Z", preciseDate: false },
];

export type ClubSeason = { startYear: number; endYear: number; label: string; slug: string; era: ClubEra; honours: CuratedHonour[]; moments: CuratedMoment[]; isCurrent: boolean };
export const CLUB_SEASONS: ClubSeason[] = Array.from({ length: 2026 - 1899 + 1 }, (_, index) => {
  const startYear = 1899 + index;
  const suffix = String((startYear + 1) % 100).padStart(2, "0");
  return {
    startYear, endYear: startYear + 1, label: `${startYear}/${suffix}`, slug: `${startYear}-${suffix}`,
    era: CLUB_ERAS.find((era) => startYear >= era.start && startYear <= era.end)!,
    honours: CLUB_HONOURS.filter((honour) => honour.startYear === startYear),
    moments: CLUB_MOMENTS.filter((moment) => moment.startYear === startYear),
    isCurrent: startYear === 2026,
  };
});

export function clubSeasonFromSlug(slug: string) { return CLUB_SEASONS.find((season) => season.slug === slug) ?? null; }
