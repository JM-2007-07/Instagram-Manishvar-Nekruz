import type { Metadata } from 'next';
import { ExploreGrid } from '@/features/explore/components/explore-grid';
import { SearchContent } from '@/features/search/components/search-content';

export const metadata: Metadata = { title: 'Интересное' };

// «Интересное» (сверено с instagram.com 2026-10-23): сверху поле «Поиск», ниже сетка 5 колонок.
// Ширина как у Instagram: 74,2vw − 14 px (1000 px на экране 1366), центр смещён влево на 43 px —
// справа место под кнопкой «Сообщения». Данные грузят Client Components, страница — только каркас.
export default function ExplorePage() {
  return (
    <div className="pt-2 md:pt-6 md:pr-[87px]">
      <div className="mx-auto w-full md:w-[calc(74.2vw-14px)]">
        <SearchContent idle={<ExploreGrid />} />
      </div>
    </div>
  );
}
