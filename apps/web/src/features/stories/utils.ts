// Короткое время как в Instagram: «5 мин», «5 ч», «2 д».
export function timeAgo(iso: string, now = Date.now()): string {
  const minutes = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return 'сейчас';
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч`;
  return `${Math.floor(hours / 24)} д`;
}

// Адрес истории для кнопки «Поделиться».
export const storyPath = (userName: string, storyId: string) => `/stories/${userName}/${storyId}/`;
