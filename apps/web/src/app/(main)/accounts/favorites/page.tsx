import { SettingsHeading } from '@/features/settings/components/fields';
import { FavoritesEditor } from '@/features/users/components/close-friends-and-favorites';

export default function Page() {
  return (
    <section>
      <SettingsHeading>Избранное</SettingsHeading>
      <p className="mb-4 text-14 text-muted-foreground md:-mt-7">
        Публикации избранных аккаунтов показываются в отдельной ленте. До 50 аккаунтов.
      </p>
      <FavoritesEditor />
    </section>
  );
}
