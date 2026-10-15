type Variant = "overview" | "matches" | "match" | "squad" | "analytics" | "media" | "club" | "personal" | "admin";

function Bar({ className = "w-32" }: { className?: string }) {
  return <span aria-hidden="true" className={`block h-3 rounded-sm bg-[#30435b] motion-safe:animate-pulse ${className}`} />;
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`border border-[#30435b] bg-[#0d1b2e] p-5 sm:p-7 ${className}`}>{children}</div>;
}

export default function PageLoading({ title, variant }: { title: string; variant: Variant }) {
  return (
    <main role="status" aria-label={`Loading ${title}`} aria-busy="true" className="min-h-screen bg-[#07111f] px-3 py-4 text-[#f2f3f5] sm:px-4 lg:px-5 lg:py-5">
      <div className="mx-auto max-w-[1700px]">
        <header className="mb-5 flex items-end justify-between gap-4 px-1">
          <div><p className="text-xs uppercase tracking-[0.18em] text-[#aebdd1]">FC Barcelona</p><h1 className="mt-2 text-2xl sm:text-3xl">{title}</h1></div>
          <Bar className="w-24" />
        </header>
        <div className="mb-5 flex gap-4 overflow-hidden border-y border-[#30435b] py-3 lg:hidden" aria-hidden="true"><Bar className="w-16" /><Bar className="w-20" /><Bar className="w-16" /><Bar className="w-20" /></div>
        <div className="grid gap-5 lg:grid-cols-[150px_minmax(0,1fr)] xl:grid-cols-[160px_minmax(0,1fr)]">
          <aside className="hidden border-r border-[#30435b] pr-5 lg:block" aria-hidden="true">
            <div className="mb-10 flex items-center gap-3"><span className="h-10 w-10 rounded-lg bg-[#30435b]" /><Bar className="w-16" /></div>
            <div className="space-y-7">{Array.from({ length: 8 }, (_, index) => <Bar key={index} className={index % 3 === 0 ? "w-20" : "w-24"} />)}</div>
          </aside>
          <div className="min-w-0 space-y-5">
            {variant === "overview" ? <><div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(260px,0.7fr)]"><Panel className="min-h-[460px]"><Bar className="w-28" /><div className="mt-20 flex items-center justify-around"><span className="h-20 w-20 rounded-full bg-[#30435b]" /><Bar className="w-12" /><span className="h-20 w-20 rounded-full bg-[#30435b]" /></div></Panel><Panel className="min-h-[460px]"><Bar className="w-28" /><div className="mt-8"><Bar className="h-7 w-40" /></div></Panel></div><Panel className="min-h-48"><Bar className="w-36" /></Panel></> : null}
            {variant === "matches" ? <><Panel><Bar className="h-7 w-48" /><div className="mt-6 flex gap-3"><Bar className="h-10 w-28" /><Bar className="h-10 w-28" /></div></Panel><Panel><Rows count={5} /></Panel></> : null}
            {variant === "match" ? <><Panel className="min-h-44"><Bar className="w-32" /><div className="mt-10 flex justify-around"><Bar className="h-9 w-32" /><Bar className="h-9 w-32" /></div></Panel><div className="grid gap-5 xl:grid-cols-2"><Panel className="min-h-80"><Bar className="w-36" /><div className="mx-auto mt-10 h-48 max-w-64 bg-[#18304a]" /></Panel><Panel className="min-h-80"><Bar className="w-36" /><div className="mt-8"><Rows count={3} /></div></Panel></div></> : null}
            {variant === "squad" ? <><Panel><Bar className="h-8 w-56" /><div className="mt-6"><Bar className="h-10 w-48" /></div></Panel><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <Panel key={index} className="min-h-48"><div className="mx-auto h-24 w-24 rounded-full bg-[#30435b]" /><div className="mt-5"><Bar className="w-3/4" /></div></Panel>)}</div></> : null}
            {variant === "analytics" ? <><div className="grid gap-4 sm:grid-cols-3">{Array.from({ length: 3 }, (_, index) => <Panel key={index}><Bar className="w-24" /><div className="mt-5"><Bar className="h-8 w-20" /></div></Panel>)}</div><div className="grid gap-5 xl:grid-cols-2"><Panel className="min-h-72"><Bar className="w-40" /></Panel><Panel className="min-h-72"><Bar className="w-40" /></Panel></div></> : null}
            {variant === "media" ? <><Panel className="min-h-56"><Bar className="w-28" /><div className="mt-5"><Bar className="h-9 w-64" /></div></Panel><div className="flex gap-4 overflow-hidden">{Array.from({ length: 3 }, (_, index) => <Panel key={index} className="min-h-52 min-w-[220px] flex-1"><div className="h-24 bg-[#30435b]" /><div className="mt-4"><Bar /></div></Panel>)}</div></> : null}
            {variant === "club" ? <><Panel className="min-h-72"><Bar className="w-24" /><div className="mt-10"><Bar className="h-10 w-3/5" /></div></Panel><div className="grid gap-4 sm:grid-cols-2"><Panel className="min-h-44"><Bar /></Panel><Panel className="min-h-44"><Bar /></Panel></div></> : null}
            {variant === "personal" ? <div className="grid gap-5 xl:grid-cols-2"><Panel><Bar className="h-7 w-32" /><div className="mt-8"><Rows count={3} /></div></Panel><Panel className="min-h-64"><Bar className="h-7 w-40" /></Panel></div> : null}
            {variant === "admin" ? <><div className="grid gap-4 sm:grid-cols-3">{Array.from({ length: 3 }, (_, index) => <Panel key={index}><Bar className="w-32" /><div className="mt-5"><Bar className="h-7 w-20" /></div></Panel>)}</div><Panel className="min-h-72"><Bar className="h-7 w-48" /><div className="mt-8"><Rows count={3} /></div></Panel></> : null}
          </div>
        </div>
      </div>
    </main>
  );
}

function Rows({ count }: { count: number }) {
  return <div className="space-y-3">{Array.from({ length: count }, (_, index) => <div key={index} className="flex items-center justify-between border-b border-[#30435b] py-3"><Bar className="w-16" /><Bar className="h-5 w-2/5" /><Bar className="w-12" /></div>)}</div>;
}
