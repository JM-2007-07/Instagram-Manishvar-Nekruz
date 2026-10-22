import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class PasswordConfirmDto {
  @ApiPropertyOptional({
    description: 'Текущий пароль; не нужен аккаунту без пароля (только соцвход)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  password?: string;
}

export class DeletionScheduledDto {
  @ApiProperty({ format: 'date-time' })
  deletionScheduledAt!: string;
}
