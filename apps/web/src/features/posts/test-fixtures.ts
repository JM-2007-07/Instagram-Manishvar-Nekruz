import type { Post } from './types';

// Пост для тестов компонентов.
export function makePost(over: Partial<Post> = {}): Post {
  return {
    id: 'p1',
    shortcode: 'abc123',
    type: 'POST',
    status: 'PUBLISHED',
    author: {
      id: 'u1',
      userName: 'alice',
      fullName: 'Alice',
      avatarUrl: null,
      isVerified: false,
      isPrivate: false,
      hasActiveStory: false,
      isCloseFriendStory: false,
    },
    collaborators: [],
    items: [
      {
        position: 0,
        media: {
          id: 'm1',
          kind: 'IMAGE',
          status: 'READY',
          url: '/api/v1/media/m1',
          thumbnailUrl: null,
          width: 1080,
          height: 1440,
          durationSec: null,
        },
        altText: null,
        tags: [],
      },
    ],
    caption: 'Привет #мир',
    location: null,
    likeCount: 5,
    commentCount: 3,
    playCount: null,
    isLikedByMe: false,
    isSavedByMe: false,
    commentsDisabled: false,
    hideLikeCount: false,
    isPinned: false,
    isArchived: false,
    editedAt: null,
    publishedAt: new Date().toISOString(),
    previewComments: [],
    ...over,
  };
}
