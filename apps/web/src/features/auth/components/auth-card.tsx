/* eslint-disable @next/next/no-img-element -- локальная картинка бренда, оптимизация не нужна */
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { BrandLogo } from '@/components/layout/brand-logo';
import { APP_NAME, AUTH_HERO_SRC } from '@/lib/config';
import { cn } from '@/lib/utils';
import { AuthHeroArt } from './auth-hero-art';
import { HeroHeading } from './hero-heading';

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
    return (
      <img
        src={AUTH_HERO_SRC}
        alt=""
        className="mx-auto aspect-[840/480] w-full max-w-[840px] object-contain"
      />
    );
  }
  return <AuthHeroArt />;
}

// Страница входа: на компьютере две колонки (слоган + картинка | форма), на телефоне — одна.
// Размеры сверены с instagram.com на 1100–1903 px (2026-10-23): правая колонка min(652 px, ½ экрана)
// с отступами 53 px; слоган 2,8vw / 64,8 px в блоке высотой 4 строки; картинка — ширина колонки − 40 px,
// не больше 840×480. Слоган у Instagram набран Instagram Sans, в которой нет кириллицы, — браузер
// показывает русский текст шрифтом с засечками по умолчанию (Times New Roman); повторяем это.
export function AuthHeroPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-auth-panel font-auth min-[1064px]:bg-background">
      <div className="flex min-h-dvh flex-1 min-[640px]:min-h-[calc(100dvh-70px)] min-[1064px]:h-[calc(100dvh-70px)] min-[1064px]:min-h-[560px] min-[1064px]:flex-none">
        <section className="relative hidden min-w-0 flex-1 flex-col overflow-hidden px-5 min-[1064px]:flex">
          <BrandLogo
            variant="mark"
            className="absolute top-[46px] left-[46px] size-[60px] text-30"
          />
          <HeroHeading picture={<HeroPicture />}>
            Посмотрите, какими моментами из жизни поделились ваши{' '}
            <span className="bg-(image:--auth-gradient) bg-clip-text text-transparent">
              близкие друзья
            </span>
            .
          </HeroHeading>
        </section>
        <div aria-hidden="true" className="hidden w-px bg-auth-divider min-[1064px]:block" />
        <main className="flex min-w-0 flex-1 flex-col bg-auth-panel px-4 min-[640px]:items-center min-[640px]:justify-center min-[1064px]:w-[min(652px,50vw)] min-[1064px]:flex-none min-[1064px]:px-[53px]">
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
