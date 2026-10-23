import { SearchContent } from '@/features/search/components/search-content';

// Мобильная страница поиска (на десктопе поиск — панель слева).
export default function Page() {
  return (
    <div className="mx-auto w-full max-w-[508px] pt-6">
      <SearchContent />
    </div>
  );
}
