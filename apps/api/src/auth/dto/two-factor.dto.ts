import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class TwoFactorSetupDto {
  @ApiProperty({ description: 'otpauth://… для QR-кода' })
  otpauthUrl!: string;

  @ApiProperty({ description: 'Секрет для ручного ввода (base32)' })
  secret!: string;
}

export class TwoFactorEnableDto {
  @ApiProperty({ example: '123456', description: '6 цифр из приложения-аутентификатора' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(16)
  code!: string;
}

export class BackupCodesDto {
  @ApiProperty({ type: [String], description: 'Показываются один раз' })
  backupCodes!: string[];
}

export class TwoFactorDisableDto {
  @ApiProperty({ description: 'Текущий пароль' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password!: string;
}

export class TwoFactorLoginDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  challengeId!: string;

  @ApiProperty({ description: '6 цифр из приложения или резервный код' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(16)
  code!: string;
}

export class TwoFactorRequiredDto {
  @ApiProperty({ example: true })
  twoFactorRequired!: true;

  @ApiProperty({ format: 'uuid' })
  challengeId!: string;
}
