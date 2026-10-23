import { SingleReel } from '@/features/reels/components/single-reel';

export default async function ReelPage({ params }: { params: Promise<{ shortcode: string }> }) {
  const { shortcode } = await params;
  return <SingleReel shortcode={shortcode} />;
}
