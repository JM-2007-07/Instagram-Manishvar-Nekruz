import { StoryHiddenList } from '@/features/privacy/components/privacy-lists';

export default function Page() {
  return (
    <section>
      <h1 className="text-20 font-semibold">Скрыть истории</h1>
      <p className="mt-1 mb-4 text-14 text-muted-foreground">Эти люди не видят ваши истории.</p>
      <StoryHiddenList />
    </section>
  );
}
