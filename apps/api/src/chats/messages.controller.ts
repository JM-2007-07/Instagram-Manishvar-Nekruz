import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { Throttle, minutes } from '@nestjs/throttler';
import { CursorQueryDto } from '@/common/pagination/cursor-query.dto';
import { ParseUuidPipe } from '@/common/pipes/parse-uuid.pipe';
import { CurrentUser } from '@/common/session/current-user.decorator';
import type { SessionUser } from '@/common/session/session-user';
import {
  EditMessageDto,
  MessageDto,
  MessagePageDto,
  ReactionDto,
  SendMessageDto,
  ShareMessageDto,
  ShareResultDto,
} from './dto/chats.dto';
import { MessagesService } from './messages.service';

@ApiTags('chats')
@Controller()
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get('chats/:chatId/messages')
  @ApiOkResponse({ type: MessagePageDto, description: 'Новые сначала' })
  @ApiNotFoundResponse()
  list(
    @CurrentUser() user: SessionUser,
    @Param('chatId', ParseUuidPipe) chatId: string,
    @Query() query: CursorQueryDto,
  ): Promise<MessagePageDto> {
    return this.messages.list(chatId, user.id, query);
  }

  @Post('chats/:chatId/messages')
  @Throttle({ default: { limit: 60, ttl: minutes(1) } })
  @ApiCreatedResponse({ type: MessageDto, description: 'Рассылает message:new' })
  @ApiBadRequestResponse({ description: 'Ошибка валидации или тип пока не поддерживается' })
  @ApiNotFoundResponse()
  @ApiTooManyRequestsResponse({ description: 'Больше 60 сообщений в минуту' })
  send(
    @CurrentUser() user: SessionUser,
    @Param('chatId', ParseUuidPipe) chatId: string,
    @Body() dto: SendMessageDto,
  ): Promise<MessageDto> {
    return this.messages.send(chatId, user.id, dto);
  }

  @Patch('chats/:chatId/messages/:messageId')
  @ApiOkResponse({ type: MessageDto, description: 'Рассылает message:updated' })
  @ApiForbiddenResponse({ description: 'Чужое сообщение' })
  @ApiNotFoundResponse()
  @ApiConflictResponse({ description: 'EDIT_WINDOW_EXPIRED (15 минут)' })
  edit(
    @CurrentUser() user: SessionUser,
    @Param('chatId', ParseUuidPipe) chatId: string,
    @Param('messageId', ParseUuidPipe) messageId: string,
    @Body() dto: EditMessageDto,
  ): Promise<MessageDto> {
    return this.messages.edit(chatId, messageId, user.id, dto.text);
  }

  @Delete('chats/:chatId/messages/:messageId')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Отправка отменена у всех; рассылает message:unsent' })
  @ApiForbiddenResponse({ description: 'Чужое сообщение' })
  @ApiNotFoundResponse()
  unsend(
    @CurrentUser() user: SessionUser,
    @Param('chatId', ParseUuidPipe) chatId: string,
    @Param('messageId', ParseUuidPipe) messageId: string,
  ): Promise<void> {
    return this.messages.unsend(chatId, messageId, user.id);
  }

  @Put('chats/:chatId/messages/:messageId/reaction')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Рассылает message:reaction' })
  @ApiNotFoundResponse()
  react(
    @CurrentUser() user: SessionUser,
    @Param('chatId', ParseUuidPipe) chatId: string,
    @Param('messageId', ParseUuidPipe) messageId: string,
    @Body() dto: ReactionDto,
  ): Promise<void> {
    return this.messages.react(chatId, messageId, user.id, dto.emoji);
  }

  @Delete('chats/:chatId/messages/:messageId/reaction')
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  unreact(
    @CurrentUser() user: SessionUser,
    @Param('chatId', ParseUuidPipe) chatId: string,
    @Param('messageId', ParseUuidPipe) messageId: string,
  ): Promise<void> {
    return this.messages.unreact(chatId, messageId, user.id);
  }

  @Post('messages/share')
  @Throttle({ default: { limit: 60, ttl: minutes(1) } })
  @ApiCreatedResponse({ type: ShareResultDto })
  @ApiBadRequestResponse({ description: 'Публикации и истории — после модулей B' })
  @ApiNotFoundResponse()
  share(@CurrentUser() user: SessionUser, @Body() dto: ShareMessageDto): Promise<ShareResultDto> {
    return this.messages.share(user.id, dto);
  }
}
