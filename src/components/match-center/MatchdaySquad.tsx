import { ExternalLink } from "lucide-react";
import type { MatchCenterData } from "../../lib/matches/get-match-center";
import type { KitTheme } from "../../lib/themes";

export default function MatchdaySquad({ squad, theme }: {
  squad: NonNullable<MatchCenterData["matchdaySquad"]>;
  theme: KitTheme;
}) {
  const positionOrder = ["goalkeeper", "defender", "midfielder", "forward", "unknown"] as const;
  const labels = { goalkeeper: "Goalkeepers", defender: "Defenders", midfielder: "Midfielders", forward: "Forwards", unknown: "Other selections" };
  const players = squad.players?.length
    ? squad.players
    : squad.names.map((name) => ({ name, position: "unknown" }));
  return (
    <div>
      <p className="mb-4 text-sm leading-6" style={{ color: theme.colors.textMuted }}>
        Barça’s announced matchday squad. Starting XI and bench positions will appear when confirmed.
      </p>
      <div className="space-y-5" aria-label="Selected FC Barcelona matchday squad">
        {positionOrder.map((position) => {
          const group = players.filter((player) => player.position === position);
          if (!group.length) return null;
          return <section key={position}>
            <div className="mb-2 flex items-center gap-3">
              <h4 className="text-[11px] uppercase tracking-[0.18em]" style={{ color: theme.colors.accent }}>{labels[position]}</h4>
              <span className="text-[10px] tabular-nums" style={{ color: theme.colors.textMuted }}>{group.length}</span>
              <span className="h-px flex-1" style={{ backgroundColor: theme.colors.border }} />
            </div>
            <ol className="grid gap-2 sm:grid-cols-2">
              {group.map((player, index) => (
                <li key={`${player.name}-${index}`} className="flex min-w-0 items-center gap-3 border px-3 py-2 text-sm" style={{ borderColor: theme.colors.border, backgroundColor: theme.colors.backgroundElevated }}>
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: theme.colors.accent }} />
                  <span className="truncate">{player.name}</span>
                </li>
              ))}
            </ol>
          </section>;
        })}
      </div>
      <a href={squad.sourceUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex cursor-pointer items-center gap-2 text-xs underline underline-offset-4" style={{ color: theme.colors.accent }}>
        Official Barça squad announcement <ExternalLink size={13} aria-hidden="true" />
      </a>
    </div>
  );
}
