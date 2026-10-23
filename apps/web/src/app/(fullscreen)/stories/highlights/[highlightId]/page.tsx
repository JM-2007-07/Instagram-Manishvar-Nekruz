import { HighlightViewer } from '@/features/stories/components/story-viewer';

export default async function HighlightPage({
  params,
}: {
  params: Promise<{ highlightId: string }>;
}) {
  const { highlightId } = await params;
  return <HighlightViewer highlightId={highlightId} />;
}
