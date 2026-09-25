"use client";

import {
  DatabaseZap,
  RefreshCw,
} from "lucide-react";

import {
  useRouter,
} from "next/navigation";

export default function DashboardUnavailable() {
  const router =
    useRouter();

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#07111F] px-6 py-6 text-[#F2F3F5]">
      {/* BACKGROUND GRID */}

      <div
        className="pointer-events-none fixed inset-0 opacity-[0.035]"
        style={{
          backgroundImage: `
            linear-gradient(
              to right,
              #35506D 1px,
              transparent 1px
            ),
            linear-gradient(
              to bottom,
              #35506D 1px,
              transparent 1px
            )
          `,

          backgroundSize:
            "72px 72px",
        }}
      />

      {/* BARÇA IDENTITY STRIPE */}

      <div className="pointer-events-none fixed left-0 top-0 h-full w-[5px]">
        <div className="h-1/2 bg-[#6B1D2F]" />

        <div className="h-1/2 bg-[#0B1A30]" />
      </div>

      {/* CONTENT */}

      <div className="relative mx-auto max-w-[1700px]">
        {/* HEADER */}

        <header>
          <p className="text-xs uppercase tracking-[0.32em] text-[#8D9AAF]">
            FC Barcelona
          </p>

          <h1 className="mt-2 text-3xl font-medium tracking-[-0.03em]">
            Barça Command Center
          </h1>
        </header>

        {/* ERROR STATE */}

        <div className="flex min-h-[72vh] items-center justify-center">
          <div className="w-full max-w-xl">
            <div className="border-y border-[#23344D] py-10">
              <div className="flex items-start gap-5">
                {/* ICON */}

                <div className="flex h-12 w-12 shrink-0 items-center justify-center border border-[#23344D]">
                  <DatabaseZap
                    size={21}
                    strokeWidth={1.5}
                    className="text-[#D39C43]"
                  />
                </div>

                {/* COPY */}

                <div>
                  <p className="text-[10px] uppercase tracking-[0.25em] text-[#8D9AAF]">
                    Data Connection
                  </p>

                  <h2 className="mt-2 text-2xl font-medium tracking-[-0.025em]">
                    Command Center unavailable
                  </h2>

                  <p className="mt-4 max-w-md text-sm leading-6 text-[#8D9AAF]">
                    Barça data could not be loaded right now.
                    The dashboard itself is still available,
                    but its local data service may currently be offline.
                  </p>

                  {/* RETRY */}

                  <button
                    type="button"
                    onClick={() => {
                      router.refresh();
                    }}
                    className="mt-7 flex items-center gap-3 border border-[#6B1D2F] bg-[#6B1D2F] px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.16em] transition-transform hover:translate-x-1"
                  >
                    <RefreshCw
                      size={14}
                      strokeWidth={1.7}
                    />

                    Retry Connection
                  </button>
                </div>
              </div>
            </div>

            {/* FOOTER NOTE */}

            <p className="mt-4 text-[9px] uppercase tracking-[0.16em] text-[#8D9AAF]">
              No placeholder statistics are shown while real data is unavailable
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}