"use client";

import Link from "next/link";
import DashboardSectionShell, { useDashboardSectionTheme } from "../shell/DashboardSectionShell";

export default function PersonalGate({ title }: { title: string }) {
  const { theme } = useDashboardSectionTheme("Your archive");
  return <DashboardSectionShell title={title} season="Your archive" theme={theme}>
    <section className="mx-auto mt-8 max-w-3xl border p-6 md:p-10" style={{ background: theme.colors.surface, borderColor: theme.colors.border }}>
      <p className="text-xs uppercase tracking-[.24em]" style={{ color: theme.colors.accent }}>The personal side</p>
      <h1 className="mt-4 text-3xl tracking-tight md:text-5xl">Your Barça, kept for you.</h1>
      <p className="mt-4 max-w-xl leading-7" style={{ color: theme.colors.textMuted }}>Matches, players, media and club history remain open to everyone. Sign in to keep your own ratings, diary, favourite matches and moments separate from other supporters.</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link className="border px-5 py-3 focus-visible:outline-2" style={{ borderColor: theme.colors.accent, color: theme.colors.accent }} href="/account?next=/my-barca">Account access</Link>
        <Link className="border px-5 py-3 focus-visible:outline-2" style={{ borderColor: theme.colors.border }} href="/matches">Explore matches</Link>
      </div>
    </section>
  </DashboardSectionShell>;
}
