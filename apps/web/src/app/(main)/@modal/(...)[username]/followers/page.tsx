import { FollowListDialog } from '@/features/users/components/follow-list-dialog';

// Переход из профиля: окно поверх уже открытой страницы (перехват маршрута).
export default async function Page({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  // Next.js 16 в перехваченном маршруте (...)[username] отдаёт параметр с маркером: «(...)(...)bob».
  const userName = decodeURIComponent(username).replace(/^(\(\.{1,3}\))+/, '');
  return <FollowListDialog userName={userName} kind="followers" intercepted />;
}
