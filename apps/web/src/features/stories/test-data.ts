import type { Story, StoryTrayItem } from './types';

// Данные для тестов историй.
export const author = {
  id: 'u-alice',
  userName: 'alice',
  fullName: 'Alice',
  avatarUrl: null,
  isVerified: false,
  isPrivate: false,
  hasActiveStory: true,
  isCloseFriendStory: false,
};

export const meDto = { ...author, id: 'u-me', userName: 'me' };

export function makeStory(id: string, patch: Partial<Story> = {}): Story {
  return {
    id,
    author,
    media: {
      id: `m-${id}`,
      kind: 'IMAGE',
      status: 'READY',
      url: `/api/v1/media/${id}`,
      thumbnailUrl: null,
      width: 1080,
      height: 1920,
      durationSec: null,
    },
    sharedPost: null,
    audience: 'EVERYONE',
    stickers: [],
    durationSec: 5,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    isViewedByMe: false,
    isLikedByMe: false,
    viewerCount: null,
    likeCount: null,
    ...patch,
  };
}

export function makeTrayItem(patch: Partial<StoryTrayItem> & { userName: string; id: string }) {
  const { userName, id, ...rest } = patch;
  return {
    author: { ...author, id, userName },
    storyIds: [`s-${userName}`],
    hasUnseen: true,
    isCloseFriends: false,
    latestAt: new Date().toISOString(),
    ...rest,
  } satisfies StoryTrayItem;
}
