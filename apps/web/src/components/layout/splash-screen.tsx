import { BrandLogo } from '@/components/layout/brand-logo';
import { APP_NAME } from '@/lib/config';

// Заставка: логотип по центру, подпись внизу (SCREENS.md, F-UX-02).
export function SplashScreen() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background">
      <BrandLogo />
      <p className="absolute bottom-8 text-14 text-muted-foreground">{APP_NAME}</p>
    </div>
  );
}
