import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Пути входа: гость может их открывать без сессии.
const PUBLIC_PATHS = [
  '/accounts/login',
  '/accounts/emailsignup',
  '/accounts/password/reset',
  '/accounts/oauth/complete',
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

// Быстрый редирект гостя; это не проверка прав — настоящая проверка
// в (main)/layout через serverFetch('/me'). Значение cookie не читаем, только наличие.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const hasSession = request.cookies.has('sid') || request.cookies.has('__Host-sid');
  if (!hasSession) {
    return NextResponse.redirect(new URL('/accounts/login/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\..*).*)'],
};
