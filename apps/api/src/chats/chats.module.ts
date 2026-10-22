import { Global, Module } from '@nestjs/common';
import { ChatAccessService } from './chat-access.service';
import { ChatPresenter } from './chat.presenter';
import { ChatsController } from './chats.controller';
import { ChatsGateway } from './chats.gateway';
import { ChatsService } from './chats.service';
import { GroupsService } from './groups.service';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';

// Глобальный: ChatsService нужен историям (ответы) и значкам (непрочитанные чаты).
// Prisma, Users, Follows, Privacy, Realtime — глобальные модули.
@Global()
@Module({
  controllers: [ChatsController, MessagesController],
  providers: [
    ChatsService,
    MessagesService,
    GroupsService,
    ChatAccessService,
    ChatPresenter,
    ChatsGateway,
  ],
  exports: [ChatsService, MessagesService],
})
export class ChatsModule {}
