import type { DailyGoalClip, DailyGoalFixture, DailyGoalMatch } from "./adapter";

export type CanonicalGoal = { id: string; minute: number | null; type: string; scorer: string | null; rawScorer?: string | null };
export type CanonicalFixture = { id: string; kickoff: string; home: string; away: string; competition: string; homeScore: number | null; awayScore: number | null };
export type VideoEvidence = { id: string; title: string; channelId: string; durationSeconds: number | null; embeddable: boolean; publishedAt: string | null };
export type GoalDecision = { clip: DailyGoalClip; status: "accepted" | "review" | "rejected"; confidence: string; reasons: string[]; matchEventId: string | null; startSecond: number };

/** Provider metadata must never rewrite an already curated timestamp. */
export function shouldPreserveGoalMoment(existing: { verificationBasis: string; startSecond: number | null } | null): boolean {
  return existing !== null;
}

export function normalizeName(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function sameTeam(a: string, b: string): boolean {
  const clean = (value: string) => normalizeName(value)
    .replace(/^real racing club de santander$/, "racing santander")
    .replace(/^rayo vallecano de madrid$/, "rayo vallecano")
    .replace(/\b(fc|cf|ud|club|rotterdam|de|football)\b/g, "").replace(/\s+/g, " ").trim();
  return clean(a) === clean(b);
}

function sameScorer(a: string, b: string): boolean {
  const aliases: Record<string, string> = { raphinha: "raphael dias belloli" };
  const canonical = (value: string) => aliases[normalizeName(value)] ?? normalizeName(value);
  return canonical(a) === canonical(b);
}

export function parseYouTubeDuration(input: string | undefined): number | null {
  const match = input?.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return null;
  const seconds = Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
  return Number.isSafeInteger(seconds) && seconds > 0 ? seconds : null;
}

function competitionKey(value: string): string | null {
  const name = normalizeName(value);
  if (name === "cl" || name === "uefa champions league" || name === "champions league") return "CL";
  if (name === "pd" || name === "la liga" || name === "laliga" || name === "primera division" || name === "laliga ea sports") return "PD";
  if (name === "cdr" || name === "copa del rey") return "CDR";
  if (name === "ssc" || name === "sc" || name === "spanish super cup" || name === "supercopa de espana") return "SSC";
  return null;
}

export function resolveFixture(source: DailyGoalFixture, fixtures: CanonicalFixture[]) {
  const competition = competitionKey(source.competition);
  if (!competition) return { status: "rejected" as const, fixture: null, reason: "Unknown DailyGoal competition; no automatic fixture mapping." };
  const sourceTime = Date.parse(source.date);
  const candidates = fixtures.filter((fixture) =>
    competitionKey(fixture.competition) === competition &&
    Math.abs(Date.parse(fixture.kickoff) - sourceTime) <= 18 * 60 * 60 * 1000 &&
    sameTeam(fixture.home, source.home) && sameTeam(fixture.away, source.away) &&
    fixture.homeScore === source.homeScore && fixture.awayScore === source.awayScore,
  );
  if (candidates.length === 1) return { status: "matched" as const, fixture: candidates[0], reason: "Date, teams, competition and final score agree." };
  return { status: candidates.length ? "ambiguous" as const : "rejected" as const, fixture: null, reason: candidates.length ? "More than one canonical fixture agrees; no automatic selection." : "No finished canonical fixture agrees on date, teams, competition and final score." };
}

export function findFixture(source: DailyGoalFixture, fixtures: CanonicalFixture[]): CanonicalFixture | null {
  return resolveFixture(source, fixtures).fixture;
}

export function duplicateFixtureIds(matchIds: Array<string | null>): Set<string> {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const id of matchIds) {
    if (!id) continue;
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  }
  return duplicates;
}

export type DiscoveryRetryState = { attempts: number; lastCheckedAt: string; complete: boolean };

/** Policy for a future worker; its caller must persist state before any schedule is enabled. */
export function dueForDiscovery(kickoff: string, now: number, state: DiscoveryRetryState | null, lookbackDays = 14): boolean {
  const age = now - Date.parse(kickoff);
  if (!Number.isFinite(age) || age < 0 || age > lookbackDays * 86_400_000 || state?.complete) return false;
  if (!state) return true;
  const delays = [1, 3, 6, 12, 24, 48];
  const hours = delays[Math.min(Math.max(0, state.attempts - 1), delays.length - 1)];
  return now - Date.parse(state.lastCheckedAt) >= hours * 3_600_000;
}

export function decideGoals(source: DailyGoalMatch, fixture: CanonicalFixture | null, goals: CanonicalGoal[], video: VideoEvidence | null, mediaItemId: string | null, preRoll = 1): GoalDecision[] {
  const used = new Set<string>();
  const duplicate = new Set<string>();
  return source.clips.map((clip) => {
    const reasons: string[] = [];
    const startSecond = Math.max(0, clip.startOffset - preRoll);
    if (clip.addedMinute !== null) reasons.push("Stoppage-time notation needs manual comparison with the canonical event.");
    if (!fixture) reasons.push("No unique canonical fixture with the same date, teams and score.");
    if (!video) reasons.push("YouTube video metadata is unavailable.");
    else {
      if (video.id !== source.videoId) reasons.push("YouTube video ID contradicts DailyGoal.");
      if (video.channelId !== "UC14UlmYlSNiQCBe9Eookf_A") reasons.push("Video is not on the verified FC Barcelona channel.");
      if (!video.embeddable) reasons.push("YouTube does not allow embedding this video.");
      if (video.durationSeconds === null || clip.startOffset >= video.durationSeconds) reasons.push("Timestamp is outside or cannot be checked against video duration.");
      const title = normalizeName(video.title);
      if (!title.includes(normalizeName(source.home)) || !title.includes(normalizeName(source.away))) reasons.push("Video title does not identify both teams.");
      const score = video.title.match(/(\d{1,2})\s*(?:vs\.?|[-–:])\s*(\d{1,2})/i);
      if (!score || Number(score[1]) !== source.homeScore || Number(score[2]) !== source.awayScore) reasons.push("Video title does not confirm the fixture score.");
      if (video.publishedAt && fixture && Date.parse(video.publishedAt) < Date.parse(fixture.kickoff)) reasons.push("Video predates the match.");
    }
    if (!mediaItemId) reasons.push("The official video is not attached to this canonical fixture.");
    const candidates = fixture ? goals.filter((goal) => goal.minute === clip.minute && (goal.scorer && sameScorer(goal.scorer, clip.scorer) || goal.rawScorer && sameScorer(goal.rawScorer, clip.scorer))) : [];
    const goal = candidates.length === 1 ? candidates[0] : null;
    if (!goal) reasons.push(candidates.length ? "More than one canonical goal has this scorer and minute." : "No canonical goal has this scorer and exact minute.");
    if (goal && goal.type !== clip.kind) {
      reasons.push(goal.type === "own_goal" || goal.type === "penalty_goal" ? "Canonical goal type needs manual confirmation against the clip." : "Clip goal type contradicts the canonical event.");
    }
    if (goal && used.has(goal.id)) { duplicate.add(goal.id); reasons.push("Multiple clips point to the same canonical goal."); }
    if (goal) used.add(goal.id);
    const fatal = !fixture || (video && video.id !== source.videoId) || (video?.durationSeconds !== null && video && clip.startOffset >= video.durationSeconds);
    const status: GoalDecision["status"] = fatal ? "rejected" : reasons.length ? "review" : "accepted";
    return { clip, status, confidence: status === "accepted" ? "high · metadata" : status === "review" ? "needs review" : "rejected", reasons: status === "accepted" ? ["Fixture, scorer, minute, official video, title, score and duration agree; footage not visually inspected."] : reasons, matchEventId: goal?.id ?? null, startSecond };
  }).map((decision) => duplicate.has(decision.matchEventId ?? "") ? { ...decision, status: "review" as const, confidence: "needs review", reasons: [...decision.reasons, "Duplicate canonical goal mapping; no automatic publication."] } : decision);
}
