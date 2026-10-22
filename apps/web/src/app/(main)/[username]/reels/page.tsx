import { ProfilePage } from '@/features/profile/components/profile-page';

export default async function Page({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return <ProfilePage userName={username} tab="reels" />;
}
