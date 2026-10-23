import { SuggestionsPanel } from '@/features/users/components/suggestions-panel';

export default function Page() {
  return (
    <div className="mx-auto w-full max-w-[600px] py-4">
      <SuggestionsPanel limit={30} showSeeAll={false} />
    </div>
  );
}
