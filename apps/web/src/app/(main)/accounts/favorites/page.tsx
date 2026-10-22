import { FavoritesEditor } from '@/features/users/components/close-friends-and-favorites';

export default function Page() {
  return (
    <section>
      <h1 className="text-20 font-semibold">Избранное</h1>
      <p className="mt-1 mb-4 text-14 text-muted-foreground">
        Публикации избранных аккаунтов показываются в отдельной ленте. До 50 аккаунтов.
      </p>
      <FavoritesEditor />
    </section>
  );
}
