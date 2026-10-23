'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

// Полоса загрузки при переходе между страницами, как у Instagram (DESIGN_SYSTEM §5):
// 3 px сверху, въезжает слева, внутри бежит градиент. Старт — клик по внутренней ссылке,
// конец — смена адреса. Без библиотек: только состояние и CSS.
type Phase = 'idle' | 'loading' | 'done';

export function NavigationProgress() {
  const pathname = usePathname();
  const [phase, setPhase] = useState<Phase>('idle');
  const startedFrom = useRef<string | null>(null);

  // Клик по ссылке на другую страницу нашего сайта — начинаем.
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as HTMLElement | null)?.closest('a');
      if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname.startsWith('/api/')) return;
      if (url.pathname === window.location.pathname) return;
      startedFrom.current = window.location.pathname;
      setPhase('loading');
    }
    // Фаза перехвата: Link из Next.js сам вызывает preventDefault, поэтому слушаем раньше него.
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  // Адрес сменился — дотягиваем полосу до конца и прячем.
  useEffect(() => {
    if (startedFrom.current === null || startedFrom.current === pathname) return;
    startedFrom.current = null;
    setPhase('done');
    const timer = setTimeout(() => setPhase('idle'), 400);
    return () => clearTimeout(timer);
  }, [pathname]);

  if (phase === 'idle') return null;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px] overflow-hidden"
    >
      <div
        className="h-full w-full overflow-hidden"
        style={
          phase === 'loading'
            ? { animation: 'nav-progress-enter 8s cubic-bezier(0.1, 0.6, 0.2, 1) forwards' }
            : {
                transform: 'translateX(0)',
                opacity: 0,
                transition: 'transform 200ms ease-out, opacity 200ms ease-out 200ms',
              }
        }
      >
        <div className="nav-progress-strip h-full w-full" />
      </div>
    </div>
  );
}
