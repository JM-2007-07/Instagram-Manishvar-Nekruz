import { SavedPage } from '@/features/saved/components/saved-page';

export default async function Page({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return <SavedPage username={decodeURIComponent(username)} />;
}
