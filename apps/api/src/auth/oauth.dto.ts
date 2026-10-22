import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Matches } from 'class-validator';
import { USER_NAME_REGEX } from './auth.rules';

export class OAuthProvidersDto {
  @ApiProperty()
  google!: boolean;

  @ApiProperty()
  facebook!: boolean;
}

// Завершение регистрации после соцвхода: email и имя берутся из профиля провайдера, остальное спрашиваем.
export class CompleteOAuthDto {
  @ApiProperty({ example: 'ivan.petrov' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @Matches(USER_NAME_REGEX, { message: 'userName has an invalid format' })
  userName!: string;

  @ApiProperty({ example: '2000-01-31', description: 'YYYY-MM-DD, возраст не меньше 13 лет' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'birthday must be in YYYY-MM-DD format' })
  birthday!: string;
}
