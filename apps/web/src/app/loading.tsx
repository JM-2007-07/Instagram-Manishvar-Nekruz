import { SplashScreen } from '@/components/layout/splash-screen';

// Корневой: (main)/loading.tsx не покрывает ожидание serverFetch в самом layout.
export default function Loading() {
  return <SplashScreen />;
}
