// Типы DTO берутся из schema.d.ts (генерируется командой `npm run contract`, руками не правится).
import type { components } from './schema';

export type Schemas = components['schemas'];

export type Me = Schemas['MeDto'];
export type UserSummary = Schemas['UserSummaryDto'];
export type Profile = Schemas['ProfileDto'];
export type Chat = Schemas['ChatDto'];
export type Message = Schemas['MessageDto'];
export type Notification = Schemas['NotificationDto'];
export type Settings = Schemas['SettingsDto'];

/**
 * Тело ошибки backend — API_CONTRACT §1.2. Ручной тип: фильтр исключений NestJS
 * не описан в OpenAPI, поэтому в schema.d.ts такой схемы нет.
 */
export type ApiErrorBody = {
  statusCode: number;
  code: string;
  message: string;
  /** Только у VALIDATION_ERROR. */
  details?: { field: string; message: string }[];
  requestId?: string;
};

/**
 * Страница списка с курсором — API_CONTRACT §1.3. Обобщённый тип для общего кода:
 * в OpenAPI страницы конкретные (NotificationPageDto и т.д.), в features используются они.
 */
export type Page<T> = { items: T[]; nextCursor: string | null };
