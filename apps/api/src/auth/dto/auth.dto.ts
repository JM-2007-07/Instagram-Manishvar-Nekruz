import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { USER_NAME_REGEX } from '../auth.rules';

// Пробелы по краям убираем; нестроки оставляем как есть, их отклонит валидатор.
const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;
const normalize = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class UserNameAvailabilityQueryDto {
  @ApiProperty({ description: '1–30 символов: a–z, 0–9, «.», «_»', example: 'ivan.petrov' })
  @Transform(normalize)
  @Matches(USER_NAME_REGEX, { message: 'userName has an invalid format' })
  userName!: string;
}

export class UserNameAvailabilityDto {
  @ApiProperty()
  available!: boolean;

  @ApiProperty({ type: [String], description: 'До 3 свободных вариантов, если имя занято' })
  suggestions!: string[];
}

export class RegisterDto {
  @ApiProperty({ example: 'ivan@example.com', maxLength: 254 })
  @Transform(normalize)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ minLength: 6, maxLength: 128 })
  @IsString()
  @MinLength(6)
  @MaxLength(128)
  password!: string;

  @ApiProperty({ maxLength: 64 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  fullName!: string;

  @ApiProperty({ example: 'ivan.petrov' })
  @Transform(normalize)
  @Matches(USER_NAME_REGEX, { message: 'userName has an invalid format' })
  userName!: string;

  @ApiProperty({ example: '2000-01-31', description: 'YYYY-MM-DD, возраст не меньше 13 лет' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'birthday must be in YYYY-MM-DD format' })
  birthday!: string;
}

export class RegisterResponseDto {
  @ApiProperty()
  email!: string;

  @ApiProperty({ format: 'date-time' })
  codeSentAt!: string;
}

export class VerifyEmailDto {
  @ApiProperty()
  @Transform(normalize)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ example: '123456', description: '6 цифр из письма' })
  @Transform(trim)
  @Matches(/^\d{6}$/, { message: 'code must be 6 digits' })
  code!: string;
}

export class EmailDto {
  @ApiProperty()
  @Transform(normalize)
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

export class LoginDto {
  @ApiProperty({ description: 'Имя пользователя или email', maxLength: 254 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(254)
  login!: string;

  @ApiProperty({ maxLength: 128 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password!: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ description: 'Имя пользователя или email', maxLength: 254 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(254)
  login!: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: 'Токен из ссылки в письме' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  token!: string;

  @ApiProperty({ minLength: 6, maxLength: 128 })
  @IsString()
  @MinLength(6)
  @MaxLength(128)
  newPassword!: string;
}

export class ChangePasswordDto {
  @ApiPropertyOptional({ description: 'Не нужен, если у аккаунта ещё нет пароля (соцвход)' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  currentPassword?: string;

  @ApiProperty({ minLength: 6, maxLength: 128 })
  @IsString()
  @MinLength(6)
  @MaxLength(128)
  newPassword!: string;
}

export class SessionDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, nullable: true })
  userAgent!: string | null;

  @ApiPropertyOptional({ description: 'Город по IP; пока не определяется' })
  ipCity?: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  lastUsedAt!: string;

  @ApiProperty({ description: 'Это сессия, из которой сделан запрос' })
  isCurrent!: boolean;
}
