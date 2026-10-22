import { MutedList } from '@/features/privacy/components/privacy-lists';

export default function Page() {
  return (
    <section>
      <h1 className="text-20 font-semibold">Скрытые аккаунты</h1>
      <p className="mt-1 mb-4 text-14 text-muted-foreground">
        Публикации и истории этих аккаунтов не показываются в ленте.
      </p>
      <MutedList />
    </section>
  );
}
