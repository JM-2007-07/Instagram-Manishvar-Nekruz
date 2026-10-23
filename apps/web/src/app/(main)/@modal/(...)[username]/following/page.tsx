import { FollowListDialog } from '@/features/users/components/follow-list-dialog';

// Переход из профиля: окно поверх уже открытой страницы (перехват маршрута).
export default async function Page({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return <FollowListDialog userName={username} kind="following" intercepted />;
}
