'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { showApiError } from '@/lib/api/errors';

// Кнопка строки списка: выполняет действие, блокируется на время запроса, ошибку показывает тостом.
export function ActionButton({
  label,
  onAction,
  variant = 'secondary',
}: {
  label: string;
  onAction: () => Promise<unknown>;
  variant?: 'default' | 'secondary';
}) {
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    try {
      await onAction();
    } catch (error) {
      showApiError(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant={variant} disabled={busy} onClick={handleClick}>
      {label}
    </Button>
  );
}
