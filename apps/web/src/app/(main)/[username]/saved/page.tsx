import { ProfilePage } from '@/features/profile/components/profile-page';

// «Сохранённое» — вкладка профиля, как у Instagram.
export default async function Page({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return <ProfilePage userName={decodeURIComponent(username)} tab="saved" />;
}
