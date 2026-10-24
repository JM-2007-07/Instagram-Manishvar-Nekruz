'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

// Адреса, которые открываются окном поверх страницы (перехватывающие маршруты в (main)/@modal).
const MODAL_PATH = /^\/(create|p\/[^/]+|[^/]+\/(followers|following))\/?$/;

const trim = (path: string) => (path.length > 1 ? path.replace(/\/+$/, '') : path);

/**
 * Слот @modal: окно видно, только пока адрес — адрес окна. При клиентском переходе на другую
 * страницу Next.js сохраняет прежнее содержимое слота — без этой проверки окно осталось бы открытым.
 * (Раньше это делал catch-all @modal/[...catchAll], но он перехватывал и адреса группы (auth):
 * /accounts/login отвечал 404.)
 *
 * Ссылка из окна на страницу, которая лежит под ним (автор поста в его же профиле), у Next.js
 * не срабатывает: такой переход ничего не меняет в дереве маршрутов. Для неё просто закрываем окно.
 */
export function ModalSlot({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isModal = MODAL_PATH.test(pathname);
  const [underlying, setUnderlying] = useState(pathname);
  if (!isModal && underlying !== pathname) setUnderlying(pathname);

  if (!isModal) return null;

  function onClickCapture(event: React.MouseEvent) {
    const link = (event.target as HTMLElement).closest('a');
    if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
    const url = new URL(link.href, window.location.href);
    if (url.origin !== window.location.origin || trim(url.pathname) !== trim(underlying)) return;
    event.preventDefault();
    event.stopPropagation();
    router.back();
  }

  return <div onClickCapture={onClickCapture}>{children}</div>;
}
