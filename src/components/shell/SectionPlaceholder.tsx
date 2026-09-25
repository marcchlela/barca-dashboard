import Link from "next/link";

import {
  ArrowLeft,
} from "lucide-react";

type SectionPlaceholderProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export default function SectionPlaceholder({
  eyebrow,
  title,
  description,
}: SectionPlaceholderProps) {
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

        <div className="mt-16 border-y border-[#23344D] py-8">
          <p className="text-[10px] uppercase tracking-[0.28em] text-[#8D9AAF]">
            {eyebrow}
          </p>

          <h1 className="mt-3 text-4xl font-medium tracking-[-0.04em]">
            {title}
          </h1>

          <p className="mt-5 max-w-xl text-sm leading-6 text-[#8D9AAF]">
            {description}
          </p>
        </div>

        <p className="mt-7 text-[10px] uppercase tracking-[0.18em] text-[#8D9AAF]">
          This section will be built after Overview is locked.
        </p>
      </div>
    </main>
  );
}