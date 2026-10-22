import { BlockedList } from '@/features/privacy/components/privacy-lists';

export default function Page() {
  return (
    <section>
      <h1 className="text-20 font-semibold">Заблокированные аккаунты</h1>
      <p className="mt-1 mb-4 text-14 text-muted-foreground">
        Заблокированные не видят ваш профиль и публикации и не узнают о блокировке.
      </p>
      <BlockedList />
    </section>
  );
}
