// TODO(T0.5): заменить на типы из schema.d.ts (Schemas['ApiErrorDto'] и т.д.)

/** Тело ошибки backend — API_CONTRACT §1.2. */
export type ApiErrorBody = {
  statusCode: number;
  code: string;
  message: string;
  /** Только у VALIDATION_ERROR. */
  details?: { field: string; message: string }[];
  requestId?: string;
};

/** Страница списка с курсором — API_CONTRACT §1.3. */
export type Page<T> = { items: T[]; nextCursor: string | null };
