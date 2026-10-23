import { SettingsHeading } from '@/features/settings/components/fields';
import { StoryHiddenList } from '@/features/privacy/components/privacy-lists';

export default function Page() {
  return (
    <section>
      <SettingsHeading>Скрыть истории</SettingsHeading>
      <p className="mb-4 text-14 text-muted-foreground md:-mt-7">Эти люди не видят ваши истории.</p>
      <StoryHiddenList />
    </section>
  );
}
