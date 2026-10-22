import { SearchContent } from '@/features/search/components/search-content';

// Мобильная страница поиска (на десктопе поиск — панель слева).
export default function Page() {
  return (
    <div className="mx-auto w-full max-w-[600px] pt-4">
      <SearchContent />
    </div>
  );
}
