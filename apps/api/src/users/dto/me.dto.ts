import { ApiProperty } from '@nestjs/swagger';
import { UserSummaryDto } from './user-summary.dto';

export class LinkDto {
  @ApiProperty()
  url!: string;

  @ApiProperty({ type: String, nullable: true })
  title!: string | null;
}

export class MutedDto {
  @ApiProperty()
  posts!: boolean;

  @ApiProperty()
  stories!: boolean;
}

export class MutualFollowersDto {
  @ApiProperty({ type: [UserSummaryDto] })
  users!: UserSummaryDto[];

  @ApiProperty()
  total!: number;
}

// Me = Profile & { email, emailVerified, birthday, gender, genderCustom, hasPassword, role } (API_CONTRACT §1.4).
// Поля «отношений» (followStatus, isBlocked…) для себя фиксированные; счётчики подписок и постов — 0 до T1.A4 / PostsService.
export class MeDto extends UserSummaryDto {
  @ApiProperty({ type: String, nullable: true })
  bio!: string | null;

  @ApiProperty({ type: String, nullable: true })
  pronouns!: string | null;

  @ApiProperty({ type: [LinkDto] })
  links!: LinkDto[];

  @ApiProperty()
  postCount!: number;

  @ApiProperty()
  followerCount!: number;

  @ApiProperty()
  followingCount!: number;

  @ApiProperty({ enum: ['NONE', 'FOLLOWING', 'REQUESTED'] })
  followStatus!: 'NONE' | 'FOLLOWING' | 'REQUESTED';

  @ApiProperty()
  followsMe!: boolean;

  @ApiProperty()
  isBlocked!: boolean;

  @ApiProperty()
  isRestricted!: boolean;

  @ApiProperty({ type: MutedDto })
  isMuted!: MutedDto;

  @ApiProperty({ type: MutualFollowersDto })
  mutualFollowers!: MutualFollowersDto;

  @ApiProperty()
  canViewContent!: boolean;

  @ApiProperty()
  isMe!: boolean;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  emailVerified!: boolean;

  @ApiProperty({ example: '2000-01-31', description: 'YYYY-MM-DD' })
  birthday!: string;

  @ApiProperty({
    enum: ['FEMALE', 'MALE', 'CUSTOM', 'PREFER_NOT_TO_SAY'],
    nullable: true,
  })
  gender!: 'FEMALE' | 'MALE' | 'CUSTOM' | 'PREFER_NOT_TO_SAY' | null;

  @ApiProperty({ type: String, nullable: true })
  genderCustom!: string | null;

  @ApiProperty({ description: 'false у аккаунта только с соцвходом' })
  hasPassword!: boolean;

  @ApiProperty({ enum: ['USER', 'ADMIN'] })
  role!: 'USER' | 'ADMIN';
}
