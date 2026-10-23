// Типы публикаций из сгенерированной схемы (общие для лент, окна поста, Reels и «Интересного»).
import type { Schemas } from '@/lib/api/types';

export type Post = Schemas['PostDto'];
export type PostItem = Schemas['PostItemDto'];
export type PostPage = Schemas['PostPageDto'];
export type MediaItem = Schemas['MediaItemDto'];
export type Location = Schemas['LocationDto'];
export type Comment = Schemas['CommentDto'];
