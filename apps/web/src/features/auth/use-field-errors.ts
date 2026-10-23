import { useState } from 'react';

// Ошибки полей формы (из VALIDATION_ERROR.details). Объект совместим с FormErrorTarget в showApiError.
export function useFieldErrors() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  return {
    errors,
    setError(name: string, error: { message: string }) {
      setErrors((prev) => ({ ...prev, [name]: error.message }));
    },
    clear() {
      setErrors({});
    },
  };
}
