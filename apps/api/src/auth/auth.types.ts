import type { MeDto } from '@/users/dto/me.dto';

// Результат входа или подтверждения email: контроллер кладёт token в cookie, me отдаёт в теле ответа.
export interface AuthResult {
  token: string;
  me: MeDto;
}
