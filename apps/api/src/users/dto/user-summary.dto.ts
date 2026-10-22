import { ApiProperty } from '@nestjs/swagger';

// Краткие данные пользователя для карточек, комментариев, списков (API_CONTRACT §1.4).
export class UserSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  userName!: string;

  @ApiProperty()
  fullName!: string;

  @ApiProperty({ type: String, nullable: true })
  avatarUrl!: string | null;

  @ApiProperty()
  isVerified!: boolean;

  @ApiProperty()
  isPrivate!: boolean;

  @ApiProperty({ description: 'Есть активная история (кольцо вокруг аватара)' })
  hasActiveStory!: boolean;

  @ApiProperty({ description: 'Активная история только для близких друзей (зелёное кольцо)' })
  isCloseFriendStory!: boolean;
}
