import { CollectionPage } from '@/features/saved/components/collection-page';

export default async function Page({
  params,
}: {
  params: Promise<{ username: string; collection: string }>;
}) {
  const { username, collection } = await params;
  return <CollectionPage username={decodeURIComponent(username)} collectionId={collection} />;
}
