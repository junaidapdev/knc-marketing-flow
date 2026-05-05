// Chunk 1: scaffold-only page. The filter form, results grid, and Apify
// integration land in subsequent chunks. Title + intro copy only for now so
// the route + sidebar entry are demoable.

export default function InfluencerSearchPage(): JSX.Element {
  return (
    <div className="px-4 md:px-9 pt-5 md:pt-8 pb-12 space-y-4">
      <header>
        <h1 className="h-greeting text-[24px] md:text-[30px]">
          Influencer <em>Search</em>
        </h1>
        <p className="text-[13px] md:text-[14px] text-ink-2 mt-1 md:mt-1.5">
          Discover GCC creators across TikTok, Instagram, and YouTube. Filters,
          results, and AI-scored fit ranking land in the next chunks.
        </p>
      </header>
    </div>
  );
}
