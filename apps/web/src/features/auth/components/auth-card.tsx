/* eslint-disable @next/next/no-img-element -- локальная картинка бренда, оптимизация не нужна */
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { BrandLogo } from '@/components/layout/brand-logo';
import { APP_NAME, AUTH_HERO_SRC } from '@/lib/config';
import { cn } from '@/lib/utils';
import { AuthHeroArt } from './auth-hero-art';

// Экраны входа повторяют instagram.com (2026): кнопки-«таблетки» 44 px, поля 60 px, синий #0064e0.
// Значения — DESIGN_SYSTEM.md §2.5 и §4.6. Ширины: телефон < 640, планшет 640–1063, компьютер ≥ 1064.

const pill =
  'inline-flex h-11 w-full items-center justify-center gap-2 rounded-[22px] px-5 text-15 font-medium outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40';

export const authButton = {
  primary: cn(pill, 'bg-auth-button text-auth-button-text hover:opacity-90'),
  secondary: cn(pill, 'bg-auth-secondary text-auth-secondary-text hover:opacity-90'),
  outline: cn(pill, 'border-[0.8px] border-auth-outline text-auth-outline hover:opacity-80'),
  link: cn(pill, 'text-auth-text hover:opacity-70'),
};

// Подвал страниц входа: серые подписи в одну строку, как у Instagram (без ссылок на чужие сервисы).
export function AuthFooter() {
  const items = ['Информация', 'Помощь', 'Конфиденциальность', 'Условия', 'Места', 'Популярное'];
  return (
    <footer className="hidden bg-background px-4 pt-[22px] pb-12 text-12 text-auth-footer min-[640px]:block">
      <ul className="flex flex-wrap justify-center gap-x-4 gap-y-[7px]">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <div className="mt-5 flex justify-center gap-4">
        <span>Русский</span>
        <span>
          © {new Date().getFullYear()} {APP_NAME}
        </span>
      </div>
    </footer>
  );
}

// Картинка слева на широком экране. Своя картинка — файл из .env.local (NEXT_PUBLIC_AUTH_HERO),
// иначе — своя иллюстрация (auth-hero-art.tsx).
function HeroPicture() {
  if (AUTH_HERO_SRC) {
    return <img src={AUTH_HERO_SRC} alt="" className="h-[530px] w-full object-contain" />;
  }
  return <AuthHeroArt />;
}

// Страница входа: на компьютере две колонки (слоган + картинка | форма), на телефоне — одна.
export function AuthHeroPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-auth-panel font-auth min-[1064px]:bg-background">
      <div className="flex min-h-dvh flex-1 min-[640px]:min-h-[calc(100dvh-70px)]">
        <section className="relative hidden min-w-0 flex-1 basis-1/2 flex-col px-5 min-[1064px]:flex">
          <BrandLogo
            variant="mark"
            className="absolute top-[46px] left-[46px] size-[60px] text-30"
          />
          <h2 className="mx-auto mt-[79px] max-w-[512px] text-center font-display text-hero font-normal text-auth-text">
            Посмотрите, какими моментами из жизни поделились ваши{' '}
            <span className="bg-(image:--auth-gradient) bg-clip-text text-transparent">
              близкие друзья
            </span>
            .
          </h2>
          <div className="-mt-[9px] -mb-[29px]">
            <HeroPicture />
          </div>
        </section>
        <div aria-hidden="true" className="hidden w-[2px] bg-auth-divider min-[1064px]:block" />
        <main className="flex min-w-0 flex-1 basis-1/2 flex-col bg-auth-panel px-4 min-[640px]:items-center min-[640px]:justify-center min-[1064px]:px-[52px]">
          {children}
        </main>
      </div>
      <AuthFooter />
    </div>
  );
}

// Остальные экраны (регистрация, коды, пароль): одна колонка 560 px с кнопкой «назад».
export function AuthPage({
  children,
  backHref = '/accounts/login/',
}: {
  children: React.ReactNode;
  backHref?: string;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-auth-panel font-auth">
      <main className="mx-auto flex w-full max-w-[592px] flex-1 flex-col px-4 pt-5 pb-10 min-[640px]:pt-11">
        <Link
          href={backHref}
          aria-label="Назад"
          className="-ml-[7px] flex size-6 items-center justify-center text-auth-label hover:text-auth-text"
        >
          <ChevronLeft className="size-6" />
        </Link>
        <BrandLogo className="mt-3 h-6 text-24 leading-6 text-auth-text" />
        {children}
      </main>
      <AuthFooter />
    </div>
  );
}

// Заголовок и пояснение одноколоночного экрана.
export function AuthHeading({
  title,
  description,
}: {
  title: string;
  description?: React.ReactNode;
}) {
  return (
    <div className="mt-6 mb-4 flex flex-col gap-2.5">
      <h1 className="text-24 leading-7 font-semibold text-auth-text">{title}</h1>
      {description && <p className="text-15 text-auth-text">{description}</p>}
    </div>
  );
}

// Подпись раздела над полем (у Instagram — «Пароль», «Дата рождения»…), 17/22, вес 600.
export function AuthSection({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p
        aria-hidden="true"
        className="flex items-center gap-1 text-17 font-semibold text-auth-text"
      >
        {title}
        {aside}
      </p>
      {children}
    </div>
  );
}

export function FormError({ children }: { children?: string | null }) {
  if (!children) return null;
  return (
    <p role="alert" className="text-center text-15 text-destructive">
      {children}
    </p>
  );
}
