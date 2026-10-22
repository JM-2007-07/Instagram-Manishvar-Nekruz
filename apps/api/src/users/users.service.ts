import { Injectable } from '@nestjs/common';
import { UserSummaryDto } from './dto/user-summary.dto';
import type { UserSummaryRow } from './user-summary.select';

@Injectable()
export class UsersService {
  // Заглушка до T1.A3 / T2.B1: avatarUrl = null (аватары — после MediaService), истории не учитываются
  // (hasActiveStory = false, isCloseFriendStory = false).
  toSummary(user: UserSummaryRow): UserSummaryDto {
    return {
      id: user.id,
      userName: user.userName,
      fullName: user.fullName,
      avatarUrl: null,
      isVerified: user.isVerified,
      isPrivate: user.isPrivate,
      hasActiveStory: false,
      isCloseFriendStory: false,
    };
  }
}
