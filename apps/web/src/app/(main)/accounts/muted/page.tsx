import { SettingsHeading } from '@/features/settings/components/fields';
import { MutedList } from '@/features/privacy/components/privacy-lists';

export default function Page() {
  return (
    <section>
      <SettingsHeading>Скрытые аккаунты</SettingsHeading>
      <p className="mb-4 text-14 text-muted-foreground md:-mt-7">
        Публикации и истории этих аккаунтов не показываются в ленте.
      </p>
      <MutedList />
    </section>
  );
}
