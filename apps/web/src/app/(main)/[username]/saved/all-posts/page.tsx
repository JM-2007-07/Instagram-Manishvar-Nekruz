import { AllPostsPage } from '@/features/saved/components/all-posts-page';

export default async function Page({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return <AllPostsPage username={decodeURIComponent(username)} />;
}
