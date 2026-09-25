import Link from "next/link";

import {
  notFound,
} from "next/navigation";

import {
  ArrowLeft,
} from "lucide-react";

import {
  getMatchById,
} from "../../../lib/matches/get-match-by-id";

type MatchPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function MatchPage({
  params,
}: MatchPageProps) {
  const {
    id,
  } = await params;

  const match =
    await getMatchById(
      id,
    );

  if (!match) {
    notFound();
  }

  const kickoff =
    new Date(
      match.kickoff,
    );

  return (
    <main className="min-h-screen bg-[#07111F] px-8 py-8 text-[#F4F2ED]">
      <div className="mx-auto max-w-5xl">

        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-[#8D9AAF]"
        >
          <ArrowLeft
            size={14}
          />

          Overview
        </Link>

        <div className="mt-12 border-y border-[#23344D] py-5">
          <p className="text-[10px] uppercase tracking-[0.25em] text-[#8D9AAF]">
            Match Center
          </p>

          <p className="mt-2 text-sm text-[#8D9AAF]">
            {match.competition.shortName ??
              match.competition.name}

            {match.matchday
              ? ` • Matchday ${match.matchday}`
              : ""}
          </p>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-12 py-20">
          <Team
            team={
              match.homeTeam
            }
            align="right"
          />

          <div className="text-center">
            {match.status ===
            "finished" ? (
              <p className="text-5xl font-medium tabular-nums">
                {match.homeScore}
                {" – "}
                {match.awayScore}
              </p>
            ) : (
              <p className="text-sm uppercase tracking-[0.25em] text-[#8D9AAF]">
                VS
              </p>
            )}
          </div>

          <Team
            team={
              match.awayTeam
            }
            align="left"
          />
        </div>

        <div className="border-y border-[#23344D] py-5 text-center">
          <p className="text-sm">
            {kickoff.toLocaleDateString(
              "en-GB",
              {
                weekday:
                  "long",

                day:
                  "numeric",

                month:
                  "long",

                year:
                  "numeric",
              },
            )}
          </p>

          <p className="mt-2 text-xl font-medium">
            {kickoff.toLocaleTimeString(
              "en-US",
              {
                hour:
                  "numeric",

                minute:
                  "2-digit",

                hour12:
                  true,
              },
            )}
          </p>
        </div>

        <p className="mt-10 text-center text-xs uppercase tracking-[0.18em] text-[#8D9AAF]">
          Full Match Center will be built when we reach the Matches page.
        </p>
      </div>
    </main>
  );
}

function Team({
  team,
  align,
}: {
  team: {
    name: string;

    shortName:
      string | null;

    crestUrl:
      string | null;
  };

  align:
    | "left"
    | "right";
}) {
  return (
    <div
      className={
        align === "right"
          ? "text-right"
          : "text-left"
      }
    >
      <div
        className={`flex ${
          align === "right"
            ? "justify-end"
            : "justify-start"
        }`}
      >
        {team.crestUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={
                team.crestUrl
              }
              alt={
                team.name
              }
              className="h-24 w-24 object-contain"
            />
          </>
        ) : null}
      </div>

      <p className="mt-4 text-2xl font-medium">
        {team.shortName ??
          team.name}
      </p>
    </div>
  );
}