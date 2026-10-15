import { ExternalLink } from "lucide-react";
import type { MatchCenterData } from "../../lib/matches/get-match-center";
import type { KitTheme } from "../../lib/themes";

export default function MatchdaySquad({ squad, theme }: {
  squad: NonNullable<MatchCenterData["matchdaySquad"]>;
  theme: KitTheme;
}) {
  return (
    <div>
      <p className="mb-4 text-sm leading-6" style={{ color: theme.colors.textMuted }}>
        Barça’s announced matchday squad. Starting XI and bench positions will appear when confirmed.
      </p>
      <ol className="grid gap-2 sm:grid-cols-2" aria-label="Selected FC Barcelona matchday squad">
        {squad.names.map((name, index) => (
          <li key={`${name}-${index}`} className="flex min-w-0 items-center gap-3 border px-3 py-2 text-sm" style={{ borderColor: theme.colors.border, backgroundColor: theme.colors.backgroundElevated }}>
            <span className="w-6 shrink-0 text-xs tabular-nums" style={{ color: theme.colors.accent }}>{String(index + 1).padStart(2, "0")}</span>
            <span className="truncate">{name}</span>
          </li>
        ))}
      </ol>
      <a href={squad.sourceUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex cursor-pointer items-center gap-2 text-xs underline underline-offset-4" style={{ color: theme.colors.accent }}>
        Official Barça squad announcement <ExternalLink size={13} aria-hidden="true" />
      </a>
    </div>
  );
}
