import { FollowListDialog } from '@/features/users/components/follow-list-dialog';
import { ProfilePage } from '@/features/profile/components/profile-page';

// Прямая ссылка: профиль на фоне и окно списка поверх него.
export default async function Page({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return (
    <>
      <ProfilePage userName={username} tab="posts" />
      <FollowListDialog userName={username} kind="followers" />
    </>
  );
}
