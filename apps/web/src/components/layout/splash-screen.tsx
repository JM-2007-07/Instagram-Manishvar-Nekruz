import { BrandLogo } from '@/components/layout/brand-logo';
import { APP_NAME } from '@/lib/config';

// Заставка: знак по центру, название внизу (SCREENS.md, F-UX-02).
export function SplashScreen() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background">
      <BrandLogo variant="mark" className="size-20 text-30" />
      <p className="absolute bottom-8 text-14 text-muted-foreground">{APP_NAME}</p>
    </div>
  );
}
