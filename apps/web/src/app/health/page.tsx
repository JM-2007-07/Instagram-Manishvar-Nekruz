import { cookies } from 'next/headers';
import { BrandLogo } from '@/components/layout/brand-logo';
import { Button } from '@/components/ui/button';

// Временная страница T0.4; убрать в T0.7 (конфликт с /<username>).
export default async function HealthPage() {
  const theme = (await cookies()).get('theme')?.value === 'dark' ? 'тёмная' : 'светлая';

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-6">
      <BrandLogo />
      <p className="text-16 font-semibold">Frontend работает</p>
      <p className="text-muted-foreground">Тема: {theme}</p>
      <div className="flex flex-wrap gap-2">
        <Button>Основная</Button>
        <Button variant="secondary">Вторичная</Button>
        <Button variant="ghost">Прозрачная</Button>
        <Button variant="link">Ссылка</Button>
        <Button variant="destructive">Удалить</Button>
        <Button disabled>Отключена</Button>
      </div>
      <p className="text-foreground">Основной текст (foreground)</p>
      <p className="text-muted-foreground">Вторичный текст (muted)</p>
      <p className="text-link">Текст ссылки (link)</p>
    </main>
  );
}
