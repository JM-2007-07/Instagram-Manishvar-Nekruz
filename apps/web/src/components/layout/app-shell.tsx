import { MobileBottomBar, MobileTopBar } from '@/components/layout/mobile-nav';
import { Sidebar } from '@/components/layout/sidebar';
import type { Me } from '@/lib/api/types';
import type { Theme } from '@/lib/theme';

// Оболочка: ≥ 768 px — боковое меню слева (72 px в потоке); < 768 px — верхняя и нижняя панели.
// Отступы <main> под фиксированные панели заданы классами pt-[60px] / pb-[50px] (= DESIGN.mobile*BarHeight).
export function AppShell({
  me,
  theme,
  children,
}: {
  me: Me;
  theme: Theme;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar me={me} theme={theme} />
      <MobileTopBar />
      <main className="min-w-0 flex-1 pt-[60px] pb-[50px] md:pt-0 md:pb-0">{children}</main>
      <MobileBottomBar me={me} />
    </div>
  );
}
