import { HomeFeed } from '@/features/feed/components/home-feed';

// Главная: данные грузит Client Component (RTK Query).
export default function HomePage() {
  return <HomeFeed />;
}
