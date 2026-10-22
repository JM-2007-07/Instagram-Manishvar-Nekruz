import { RestrictedList } from '@/features/privacy/components/privacy-lists';

export default function Page() {
  return (
    <section>
      <h1 className="text-20 font-semibold">Ограниченные аккаунты</h1>
      <p className="mt-1 mb-4 text-14 text-muted-foreground">
        Комментарии ограниченных видны только им и вам, их сообщения уходят в запросы.
      </p>
      <RestrictedList />
    </section>
  );
}
