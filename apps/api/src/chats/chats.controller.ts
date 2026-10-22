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
  Res,
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
} from '@nestjs/swagger';
import type { Response } from 'express';
import { ParseUuidPipe } from '@/common/pipes/parse-uuid.pipe';
import { CurrentUser } from '@/common/session/current-user.decorator';
import type { SessionUser } from '@/common/session/session-user';
import { ChatsService } from './chats.service';
import {
  AddParticipantsDto,
  ChatDto,
  ChatListQueryDto,
  ChatPageDto,
  CreateChatDto,
  MuteChatDto,
  ReadChatDto,
  UpdateChatDto,
} from './dto/chats.dto';
import { GroupsService } from './groups.service';

@ApiTags('chats')
@Controller('chats')
export class ChatsController {
  constructor(
    private readonly chats: ChatsService,
    private readonly groups: GroupsService,
  ) {}

  @Get()
  @ApiOkResponse({ type: ChatPageDto })
  list(@CurrentUser() user: SessionUser, @Query() query: ChatListQueryDto): Promise<ChatPageDto> {
    return this.chats.list(user.id, query);
  }

  @Post()
  @ApiCreatedResponse({ type: ChatDto, description: 'Новый чат' })
  @ApiOkResponse({ type: ChatDto, description: 'Личный чат с этим пользователем уже есть' })
  @ApiBadRequestResponse({ description: 'Нельзя писать себе' })
  @ApiNotFoundResponse({ description: 'Нет такого пользователя или блокировка' })
  @ApiConflictResponse({ description: 'LIMIT_REACHED' })
  async create(
    @CurrentUser() user: SessionUser,
    @Body() dto: CreateChatDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ChatDto> {
    const { chat, created } = await this.chats.create(user.id, dto);
    res.status(created ? 201 : 200);
    return chat;
  }

  @Get(':chatId')
  @ApiOkResponse({ type: ChatDto })
  @ApiNotFoundResponse({ description: 'Чужой чат' })
  get(
    @CurrentUser() user: SessionUser,
    @Param('chatId', ParseUuidPipe) chatId: string,
  ): Promise<ChatDto> {
    return this.chats.get(chatId, user.id);
  }

  @Patch(':chatId')
  @ApiOkResponse({ type: ChatDto })
  @ApiNotFoundResponse()
  update(
    @CurrentUser() user: SessionUser,
    @Param('chatId', ParseUuidPipe) chatId: string,
    @Body() dto: UpdateChatDto,
  ): Promise<ChatDto> {
    return this.groups.update(chatId, user.id, dto);
  }

  @Post(':chatId/participants')
  @ApiCreatedResponse({ type: ChatDto })
  @ApiNotFoundResponse()
  @ApiConflictResponse({ description: 'Уже участник или LIMIT_REACHED' })
  addParticipants(
    @CurrentUser() user: SessionUser,
    @Param('chatId', ParseUuidPipe) chatId: string,
    @Body() dto: AddParticipantsDto,
  ): Promise<ChatDto> {
    return this.groups.addParticipants(chatId, user.id, dto.userIds);
  }

  @Delete(':chatId/participants/:userId')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Участник убран или вышел сам' })
  @ApiForbiddenResponse({ description: 'Убирать других может только администратор' })
  @ApiNotFoundResponse()
  removeParticipant(
    @CurrentUser() user: SessionUser,
    @Param('chatId', ParseUuidPipe) chatId: string,
    @Param('userId', ParseUuidPipe) userId: string,
  ): Promise<void> {
    return this.groups.removeMember(chatId, user.id, userId);
  }

  @Put(':chatId/participants/:userId/admin')
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  makeAdmin(
    @CurrentUser() user: SessionUser,
    @Param('chatId', ParseUuidPipe) chatId: string,
    @Param('userId', ParseUuidPipe) userId: string,
  ): Promise<void> {
    return this.groups.setAdmin(chatId, user.id, userId, true);
  }

  @Delete(':chatId/participants/:userId/admin')
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  removeAdmin(
    @CurrentUser() user: SessionUser,
    @Param('chatId', ParseUuidPipe) chatId: string,
    @Param('userId', ParseUuidPipe) userId: string,
  ): Promise<void> {
    return this.groups.setAdmin(chatId, user.id, userId, false);
  }

  @Post(':chatId/accept')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Запрос принят, чат в «Основном»' })
  @ApiNotFoundResponse()
  accept(
    @CurrentUser() user: SessionUser,
    @Param('chatId', ParseUuidPipe) chatId: string,
  ): Promise<void> {
    return this.chats.accept(chatId, user.id);
  }

  @Delete(':chatId')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Переписка скрыта у меня; группа — ещё и выход' })
  @ApiNotFoundResponse()
  remove(
    @CurrentUser() user: SessionUser,
    @Param('chatId', ParseUuidPipe) chatId: string,
  ): Promise<void> {
    return this.chats.deleteForMe(chatId, user.id);
  }

  @Put(':chatId/mute')
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  mute(
    @CurrentUser() user: SessionUser,
    @Param('chatId', ParseUuidPipe) chatId: string,
    @Body() dto: MuteChatDto,
  ): Promise<void> {
    return this.chats.mute(chatId, user.id, dto.until);
  }

  @Delete(':chatId/mute')
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  unmute(
    @CurrentUser() user: SessionUser,
    @Param('chatId', ParseUuidPipe) chatId: string,
  ): Promise<void> {
    return this.chats.unmute(chatId, user.id);
  }

  @Post(':chatId/read')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Прочитано; участники получают chat:read' })
  @ApiNotFoundResponse()
  read(
    @CurrentUser() user: SessionUser,
    @Param('chatId', ParseUuidPipe) chatId: string,
    @Body() dto: ReadChatDto,
  ): Promise<void> {
    return this.chats.markRead(chatId, user.id, dto.messageId);
  }
}
