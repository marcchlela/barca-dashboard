export function confirmedLineupNotificationDue(input: {
  previousLineup: boolean;
  currentLineup: boolean;
  status: string;
  kickoff: string;
  now: number;
}) {
  return !input.previousLineup &&
    input.currentLineup &&
    input.status === "scheduled" &&
    Date.parse(input.kickoff) > input.now;
}
