import type { Metadata } from 'next';
import { HashtagPage } from '@/features/explore/components/hashtag-page';

type Props = { params: Promise<{ tag: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tag } = await params;
  return { title: `#${decodeURIComponent(tag)} • хэштег` };
}

export default async function Page({ params }: Props) {
  const { tag } = await params;
  return <HashtagPage tag={decodeURIComponent(tag)} />;
}
