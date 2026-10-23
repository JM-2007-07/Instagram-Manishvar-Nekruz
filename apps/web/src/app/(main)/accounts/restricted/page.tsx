import { SettingsHeading } from '@/features/settings/components/fields';
import { RestrictedList } from '@/features/privacy/components/privacy-lists';

export default function Page() {
  return (
    <section>
      <SettingsHeading>Ограниченные аккаунты</SettingsHeading>
      <p className="mb-4 text-14 text-muted-foreground md:-mt-7">
        Комментарии ограниченных видны только им и вам, их сообщения уходят в запросы.
      </p>
      <RestrictedList />
    </section>
  );
}
