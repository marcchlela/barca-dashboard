"use client";

import {
  AlertTriangle,
  RefreshCw,
} from "lucide-react";

type ErrorPageProps = {
  reset: () => void;
};

export default function ErrorPage({
  reset,
}: ErrorPageProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#07111F] px-6 text-[#F2F3F5]">
      <div className="w-full max-w-lg border-y border-[#23344D] py-10">
        <AlertTriangle
          size={22}
          strokeWidth={1.5}
          className="text-[#D39C43]"
        />

        <p className="mt-5 text-[10px] uppercase tracking-[0.24em] text-[#8D9AAF]">
          Command Center
        </p>

        <h1 className="mt-2 text-2xl font-medium">
          Something went wrong
        </h1>

        <p className="mt-3 text-sm leading-6 text-[#8D9AAF]">
          The dashboard hit an unexpected error while
          rendering this view.
        </p>

        <button
          type="button"
          onClick={reset}
          className="mt-7 flex items-center gap-3 border border-[#6B1D2F] bg-[#6B1D2F] px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.16em]"
        >
          <RefreshCw
            size={14}
          />

          Try Again
        </button>
      </div>
    </main>
  );
}