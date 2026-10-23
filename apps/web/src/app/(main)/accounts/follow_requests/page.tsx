import { SettingsHeading } from '@/features/settings/components/fields';
import { FollowRequestsList } from '@/features/users/components/follow-requests-list';

export default function Page() {
  return (
    <section>
      <SettingsHeading>Запросы на подписку</SettingsHeading>
      <p className="mb-4 text-14 text-muted-foreground md:-mt-7">
        Эти люди хотят подписаться на ваш закрытый аккаунт.
      </p>
      <FollowRequestsList />
    </section>
  );
}
