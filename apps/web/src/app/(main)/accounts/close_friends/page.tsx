import { SettingsHeading } from '@/features/settings/components/fields';
import { CloseFriendsEditor } from '@/features/users/components/close-friends-and-favorites';

export default function Page() {
  return (
    <section>
      <SettingsHeading>Близкие друзья</SettingsHeading>
      <p className="mb-4 text-14 text-muted-foreground md:-mt-7">
        Только они видят истории, которые вы отправляете близким друзьям. Они не узнают, что вы
        добавили их в список.
      </p>
      <CloseFriendsEditor />
    </section>
  );
}
