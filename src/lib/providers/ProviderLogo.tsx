type ProviderLogoProps = {
  provider:
    | "football-data"
    | "goal"
    | "big-balls"
    | "statshawk"
    | "barca-youtube";
  size?: number;
};

const providerConfig = {
  "football-data": {
    label: "FD",
    image: "/providers/football-data.png",
  },
  goal: {
    label: "G",
    image: "/providers/goal.png",
  },
  "big-balls": {
    label: "BB",
    image: "/providers/big-balls.png",
  },
  statshawk: {
    label: "SH",
    image: "/providers/statshawk.png",
  },
  "barca-youtube": {
    label: "YT",
    image: "/providers/youtube.png",
  },
} satisfies Record<
  ProviderLogoProps["provider"],
  {
    label: string;
    image: string;
  }
>;

export function ProviderLogo({
  provider,
  size = 28,
}: ProviderLogoProps) {
  const config = providerConfig[provider];

  return (
    <span
      className="group/provider-logo relative inline-flex shrink-0 items-center justify-center overflow-hidden border border-slate-700/90 bg-[#081525]"
      style={{
        width: size,
        height: size,
      }}
      aria-label={`${provider} logo`}
    >
      <span className="absolute inset-0 flex items-center justify-center font-mono text-[8px] font-semibold tracking-[0.12em] text-slate-500">
        {config.label}
      </span>

      <img
        src={config.image}
        alt=""
        className="relative z-10 h-[72%] w-[72%] object-contain"
        onError={(event) => {
          event.currentTarget.style.display = "none";
        }}
      />
    </span>
  );
}