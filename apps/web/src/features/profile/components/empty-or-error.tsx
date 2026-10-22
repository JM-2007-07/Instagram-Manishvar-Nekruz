import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Props = {
  icon?: LucideIcon;
  title?: string;
  hint?: string;
  onRetry?: () => void;
};

// Пустое состояние (иконка в круге, заголовок, пояснение) или ошибка с «Повторить» — SCREENS §4.
export function EmptyOrError({ icon: Icon, title, hint, onRetry }: Props) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
      {Icon && (
        <div className="flex size-24 items-center justify-center rounded-full border-2 border-foreground">
          <Icon className="size-12" />
        </div>
      )}
      <p className="text-20 font-semibold">{title ?? 'Не удалось загрузить данные'}</p>
      {hint && <p className="text-14 text-muted-foreground">{hint}</p>}
      {onRetry && (
        <Button onClick={onRetry} variant="secondary">
          Повторить
        </Button>
      )}
    </div>
  );
}
