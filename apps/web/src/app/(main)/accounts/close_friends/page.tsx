import { CloseFriendsEditor } from '@/features/users/components/close-friends-and-favorites';

export default function Page() {
  return (
    <section>
      <h1 className="text-20 font-semibold">Близкие друзья</h1>
      <p className="mt-1 mb-4 text-14 text-muted-foreground">
        Только они видят истории, которые вы отправляете близким друзьям. Они не узнают, что вы
        добавили их в список.
      </p>
      <CloseFriendsEditor />
    </section>
  );
}
