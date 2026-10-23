import { PostModal } from '@/features/posts/components/post-modal';

// Перехват /p/{shortcode}/ при переходе из ленты, профиля и т.д.: показываем окно поверх страницы.
export default async function PostModalPage({
  params,
}: {
  params: Promise<{ shortcode: string }>;
}) {
  const { shortcode } = await params;
  return <PostModal shortcode={shortcode} />;
}
