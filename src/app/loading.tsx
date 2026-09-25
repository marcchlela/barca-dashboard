export default function Loading() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#07111F] px-5 py-5 text-[#F2F3F5]">
      {/* environment */}

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

      <div className="pointer-events-none fixed left-0 top-0 h-full w-[5px]">
        <div className="h-1/2 bg-[#6B1D2F]" />
        <div className="h-1/2 bg-[#0B1A30]" />
      </div>

      <div className="relative mx-auto max-w-[1700px]">
        {/* header */}

        <header className="mb-5">
          <div className="h-3 w-28 animate-pulse bg-[#16263A]" />

          <div className="mt-3 h-8 w-80 animate-pulse bg-[#16263A]" />
        </header>

        {/* shell */}

        <div className="grid grid-cols-[170px_minmax(0,1fr)_320px] gap-x-5">
          {/* nav skeleton */}

          <div className="min-h-[650px] border-r border-[#23344D] pr-5">
            <div className="h-12 w-28 animate-pulse bg-[#16263A]" />

            <div className="mt-12 space-y-6">
              {Array.from({
                length: 7,
              }).map(
                (_, index) => (
                  <div
                    key={index}
                    className="h-4 w-24 animate-pulse bg-[#16263A]"
                  />
                ),
              )}
            </div>
          </div>

          {/* match stage skeleton */}

          <div className="min-h-[520px] border border-[#23344D] bg-[#0D1B2E]">
            <div className="border-b border-[#23344D] px-7 py-5">
              <div className="h-3 w-24 animate-pulse bg-[#16263A]" />

              <div className="mt-3 h-4 w-36 animate-pulse bg-[#16263A]" />
            </div>

            <div className="flex min-h-[430px] items-center justify-center">
              <div className="flex items-center gap-20">
                <TeamSkeleton />

                <div className="h-2 w-2 animate-pulse rounded-full bg-[#D39C43]" />

                <TeamSkeleton />
              </div>
            </div>
          </div>

          {/* pulse skeleton */}

          <div className="border-l border-[#23344D] pl-6">
            <div className="h-3 w-24 animate-pulse bg-[#16263A]" />

            <div className="mt-4 h-8 w-36 animate-pulse bg-[#16263A]" />

            <div className="mt-8 border-t border-[#23344D] pt-6">
              <div className="h-4 w-16 animate-pulse bg-[#16263A]" />

              <div className="mt-5 grid grid-cols-2 gap-px bg-[#23344D]">
                <div className="h-20 animate-pulse bg-[#0D1B2E]" />
                <div className="h-20 animate-pulse bg-[#0D1B2E]" />
              </div>
            </div>
          </div>

          {/* season story */}

          <div className="col-span-2 mt-8 border-t border-[#23344D] pt-5">
            <div className="h-3 w-28 animate-pulse bg-[#16263A]" />

            <div className="mt-3 h-6 w-20 animate-pulse bg-[#16263A]" />

            <div className="mt-12 h-px w-full bg-[#23344D]" />
          </div>
        </div>
      </div>
    </main>
  );
}

function TeamSkeleton() {
  return (
    <div className="flex flex-col items-center">
      <div className="h-24 w-24 animate-pulse bg-[#16263A]" />

      <div className="mt-4 h-5 w-20 animate-pulse bg-[#16263A]" />

      <div className="mt-2 h-2 w-14 animate-pulse bg-[#16263A]" />
    </div>
  );
}