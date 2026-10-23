import { MobileBottomBar, MobileTopBar } from '@/components/layout/mobile-nav';
import { CallManager } from '@/features/direct/components/call-manager';
import { MessagesDock } from '@/features/direct/components/messages-dock';
import { RealtimeBridge } from '@/features/notifications/components/realtime-bridge';
import { Sidebar } from '@/components/layout/sidebar';
import type { Me } from '@/lib/api/types';
import type { Theme } from '@/lib/theme';

// Оболочка: ≥ 768 px — боковое меню слева (72 px в потоке); < 768 px — верхняя и нижняя панели.
// Отступ <main> под нижнюю панель — pb-[50px] (= DESIGN.mobileBottomBarHeight); верхняя панель (только в ленте)
// сама оставляет место под собой.
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
    <CallManager>
      <div className="flex min-h-screen">
        <RealtimeBridge />
        <Sidebar me={me} theme={theme} />
        <main className="min-w-0 flex-1 pb-[50px] md:pb-0">
          <MobileTopBar />
          {children}
        </main>
        <MobileBottomBar me={me} />
        <MessagesDock meId={me.id} />
      </div>
    </CallManager>
  );
}
