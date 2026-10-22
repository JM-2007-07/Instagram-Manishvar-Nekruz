import { FollowRequestsList } from '@/features/users/components/follow-requests-list';

export default function Page() {
  return (
    <section>
      <h1 className="text-20 font-semibold">Запросы на подписку</h1>
      <p className="mt-1 mb-4 text-14 text-muted-foreground">
        Эти люди хотят подписаться на ваш закрытый аккаунт.
      </p>
      <FollowRequestsList />
    </section>
  );
}
