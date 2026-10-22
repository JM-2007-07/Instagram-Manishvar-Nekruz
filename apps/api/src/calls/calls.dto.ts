import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { UserSummaryDto } from '@/users/dto/user-summary.dto';

export const CALL_TYPES = ['AUDIO', 'VIDEO'] as const;
export const CALL_STATUSES = ['RINGING', 'ONGOING', 'ENDED', 'MISSED', 'DECLINED'] as const;

export class StartCallDto {
  @ApiProperty({ enum: CALL_TYPES })
  @IsIn(CALL_TYPES)
  type!: 'AUDIO' | 'VIDEO';
}

export class CallDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  chatId!: string;

  @ApiProperty({ enum: CALL_TYPES })
  type!: 'AUDIO' | 'VIDEO';

  @ApiProperty({ enum: CALL_STATUSES })
  status!: 'RINGING' | 'ONGOING' | 'ENDED' | 'MISSED' | 'DECLINED';

  @ApiProperty({ type: UserSummaryDto })
  initiator!: UserSummaryDto;

  @ApiProperty({ format: 'date-time' })
  startedAt!: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  answeredAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  endedAt!: string | null;
}

export class IceServerDto {
  @ApiProperty({ type: [String] })
  urls!: string[];

  @ApiPropertyOptional()
  username?: string;

  @ApiPropertyOptional()
  credential?: string;
}

export class IceServersDto {
  @ApiProperty({ type: [IceServerDto] })
  iceServers!: IceServerDto[];
}
