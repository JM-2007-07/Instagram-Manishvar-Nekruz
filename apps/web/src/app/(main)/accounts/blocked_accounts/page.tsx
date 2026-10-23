import { SettingsHeading } from '@/features/settings/components/fields';
import { BlockedList } from '@/features/privacy/components/privacy-lists';

export default function Page() {
  return (
    <section>
      <SettingsHeading>Заблокированные аккаунты</SettingsHeading>
      <p className="mb-4 text-14 text-muted-foreground md:-mt-7">
        Заблокированные не видят ваш профиль и публикации и не узнают о блокировке.
      </p>
      <BlockedList />
    </section>
  );
}
