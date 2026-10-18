import Image from "next/image";
import Link from "next/link";

/** A predictable home link and page heading in the first top-left position. */
export default function BrandHomeLink({ title }: { title: string }) {
  return (
    <Link href="/" aria-label={`${title} — Barça Dashboard home`} className="inline-flex w-fit cursor-pointer items-center gap-3 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2">
      <Image src="/icon.png" alt="" width={36} height={36} className="h-9 w-9 shrink-0 object-contain" priority />
      <h1 className="truncate text-xl font-medium tracking-[-0.03em] sm:text-3xl">{title}</h1>
    </Link>
  );
}
