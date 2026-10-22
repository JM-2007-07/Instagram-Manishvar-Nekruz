import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { USER_NAME_REGEX } from '@/auth/auth.rules';

const GENDERS = ['FEMALE', 'MALE', 'CUSTOM', 'PREFER_NOT_TO_SAY'] as const;
export type GenderValue = (typeof GENDERS)[number];

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;
const normalize = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;
// Для необязательных текстов: пустая строка = «очистить поле».
const trimOrNull = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() || null : value;

// Только перечисленные поля: role, status и прочие дают 400 (forbidNonWhitelisted).
export class UpdateProfileDto {
  @ApiPropertyOptional({ maxLength: 64 })
  @ValidateIf((_, value) => value !== undefined)
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  fullName?: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 150,
    description: 'Переносы строк сохраняются; null или пустая строка очищает',
  })
  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @MaxLength(150)
  bio?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 50,
    description: 'Свободная строка (Q-new-2)',
  })
  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @MaxLength(50)
  pronouns?: string | null;

  @ApiPropertyOptional({ enum: GENDERS, nullable: true })
  @IsOptional()
  @IsIn(GENDERS)
  gender?: GenderValue | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 30,
    description: 'Для gender = CUSTOM',
  })
  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @MaxLength(30)
  genderCustom?: string | null;

  @ApiPropertyOptional()
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  isPrivate?: boolean;
}

export class ChangeUserNameDto {
  @ApiProperty({ example: 'ivan.petrov', description: '1–30 символов: a–z, 0–9, «.», «_»' })
  @Transform(normalize)
  @Matches(USER_NAME_REGEX, { message: 'userName has an invalid format' })
  userName!: string;
}

export class ChangeEmailDto {
  @ApiProperty({ example: 'new@example.com', maxLength: 254 })
  @Transform(normalize)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiPropertyOptional({ description: 'Обязателен, если у аккаунта есть пароль' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  password?: string;
}

export class VerifyEmailChangeDto {
  @ApiProperty({ example: '123456' })
  @Transform(trim)
  @Matches(/^\d{6}$/, { message: 'code must be 6 digits' })
  code!: string;
}

export class LinkInputDto {
  @ApiProperty({ example: 'https://example.com', maxLength: 2048 })
  @Transform(trim)
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2048)
  url!: string;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 30 })
  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @Length(1, 30)
  title?: string | null;
}

export class SetLinksDto {
  // Лимит 5 проверяет сервис: по контракту превышение — 409 LIMIT_REACHED, а не 400.
  @ApiProperty({ type: [LinkInputDto], description: 'Список целиком, до 5' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LinkInputDto)
  links!: LinkInputDto[];
}
