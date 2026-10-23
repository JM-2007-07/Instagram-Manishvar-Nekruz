import type { Metadata } from 'next';
import { ExploreGrid } from '@/features/explore/components/explore-grid';
import { SearchBox } from '@/features/explore/components/search-box';

export const metadata: Metadata = { title: 'Интересное' };

// Данные грузит Client Component, страница — только каркас.
export default function ExplorePage() {
  return (
    <div className="mx-auto w-full pt-4 md:max-w-[840px] md:px-5 md:pt-6">
      <div className="mb-4 md:mb-6">
        <SearchBox />
      </div>
      <ExploreGrid />
    </div>
  );
}
