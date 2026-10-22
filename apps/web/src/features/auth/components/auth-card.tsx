import Link from 'next/link';
import { BrandLogo } from '@/components/layout/brand-logo';
import { APP_NAME } from '@/lib/config';

// Основная карточка 350 px. На узких экранах без рамки (как у Instagram).
export function AuthCard({
  title,
  description,
  children,
}: {
  title?: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex w-full max-w-[350px] flex-col items-stretch gap-4 px-6 py-8 min-[450px]:border min-[450px]:border-border min-[450px]:bg-background">
      <div className="flex flex-col items-center gap-3 text-center">
        <BrandLogo className="text-30" />
        {title && <h1 className="text-16 font-semibold text-foreground">{title}</h1>}
        {description && <p className="text-14 text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  );
}

// Нижняя карточка: «Нет аккаунта? Зарегистрироваться» / «Есть аккаунт? Вход».
export function AuthSwitchCard({
  text,
  linkText,
  href,
}: {
  text: string;
  linkText: string;
  href: string;
}) {
  return (
    <div className="flex w-full max-w-[350px] items-center justify-center gap-1 px-6 py-5 text-14 text-foreground min-[450px]:border min-[450px]:border-border">
      <span>{text}</span>
      <Link
        href={href}
        className="font-semibold text-button-borderless hover:text-button-borderless-hover"
      >
        {linkText}
      </Link>
    </div>
  );
}

// Колонка страниц входа: по центру, с отступами; footer — рабочее название.
export function AuthPage({
  children,
  aside,
}: {
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-0 py-8 min-[875px]:flex-row min-[875px]:gap-8">
      {aside}
      <div className="flex w-full flex-col items-center gap-3 min-[875px]:w-auto">{children}</div>
      <p className="sr-only">{APP_NAME}</p>
    </main>
  );
}

// Телефон-превью слева на широком экране (без изображений Instagram: только знак и слоган).
export function PhonePreview() {
  return (
    <div
      aria-hidden="true"
      className="hidden h-[580px] w-[300px] shrink-0 flex-col items-center justify-center gap-4 rounded-[36px] border-8 border-border bg-background-secondary p-6 text-center min-[875px]:flex"
    >
      <BrandLogo variant="mark" className="size-16 text-30" />
      <BrandLogo className="text-28" />
      <p className="text-14 text-muted-foreground">Делитесь моментами с близкими людьми</p>
    </div>
  );
}

export function FormError({ children }: { children?: string | null }) {
  if (!children) return null;
  return (
    <p role="alert" className="text-center text-14 text-destructive">
      {children}
    </p>
  );
}
