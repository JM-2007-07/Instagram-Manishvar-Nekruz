import type { Metadata } from 'next';
import { ExploreGrid } from '@/features/explore/components/explore-grid';
import { SearchContent } from '@/features/search/components/search-content';

export const metadata: Metadata = { title: 'Интересное' };

// «Интересное»: сверху поиск на всю ширину; пока поле пустое — сетка, при вводе — результаты
// (аккаунты, хэштеги, места). Данные грузят Client Components, страница — только каркас.
export default function ExplorePage() {
  return (
    <div className="mx-auto w-full pt-4 md:max-w-[840px] md:px-5 md:pt-6">
      <SearchContent idle={<ExploreGrid />} />
    </div>
  );
}
