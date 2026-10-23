import { StoryViewer } from '@/features/stories/components/story-viewer';

export default async function StoryPage({
  params,
}: {
  params: Promise<{ username: string; storyId: string }>;
}) {
  const { username, storyId } = await params;
  return <StoryViewer username={username} storyId={storyId} />;
}
