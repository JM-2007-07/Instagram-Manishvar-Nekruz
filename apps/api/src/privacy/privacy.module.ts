import { Global, Module } from '@nestjs/common';
import { BlocksService } from './blocks.service';
import { PrivacyController } from './privacy.controller';
import { VisibilityService } from './visibility.service';

// Глобальный: VisibilityService используют все модули с выдачей, импортировать модуль не нужно.
// FollowsService и UsersService (для BlocksService) тоже глобальные/экспортируются своими модулями.
@Global()
@Module({
  controllers: [PrivacyController],
  providers: [VisibilityService, BlocksService],
  exports: [VisibilityService],
})
export class PrivacyModule {}
