import { PostView } from '@/features/posts/components/post-view';

// Страница публикации (прямая ссылка / обновление окна). Данные грузит Client Component.
export default async function PostPage({ params }: { params: Promise<{ shortcode: string }> }) {
  const { shortcode } = await params;
  return (
    <div className="px-4 py-6 md:px-8">
      <PostView shortcode={shortcode} variant="page" />
    </div>
  );
}
