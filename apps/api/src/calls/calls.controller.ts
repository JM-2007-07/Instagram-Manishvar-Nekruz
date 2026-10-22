import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle, minutes } from '@nestjs/throttler';
import { ParseUuidPipe } from '@/common/pipes/parse-uuid.pipe';
import { CurrentUser } from '@/common/session/current-user.decorator';
import type { SessionUser } from '@/common/session/session-user';
import { CallDto, IceServersDto, StartCallDto } from './calls.dto';
import { CallsService } from './calls.service';

@ApiTags('calls')
@Controller()
export class CallsController {
  constructor(private readonly calls: CallsService) {}

  @Get('calls/ice-servers')
  @ApiOkResponse({ type: IceServersDto, description: 'STUN и временные учётные данные TURN' })
  iceServers(@CurrentUser() user: SessionUser): IceServersDto {
    return this.calls.iceServers(user.id);
  }

  @Post('chats/:chatId/calls')
  @Throttle({ default: { limit: 10, ttl: minutes(1) } })
  @ApiCreatedResponse({ type: CallDto, description: 'RINGING; участникам уходит call:incoming' })
  @ApiNotFoundResponse({ description: 'Чат не найден, вы не участник или есть блокировка' })
  @ApiConflictResponse({ description: 'CALL_BUSY: кто-то уже на звонке' })
  start(
    @CurrentUser() user: SessionUser,
    @Param('chatId', ParseUuidPipe) chatId: string,
    @Body() dto: StartCallDto,
  ): Promise<CallDto> {
    return this.calls.start(user.id, chatId, dto.type);
  }

  @Post('calls/:callId/accept')
  @HttpCode(200)
  @ApiOkResponse({ type: CallDto })
  @ApiNotFoundResponse()
  @ApiConflictResponse({ description: 'Звонок уже не RINGING' })
  accept(
    @CurrentUser() user: SessionUser,
    @Param('callId', ParseUuidPipe) callId: string,
  ): Promise<CallDto> {
    return this.calls.accept(user.id, callId);
  }

  @Post('calls/:callId/decline')
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  decline(
    @CurrentUser() user: SessionUser,
    @Param('callId', ParseUuidPipe) callId: string,
  ): Promise<void> {
    return this.calls.decline(user.id, callId);
  }

  @Post('calls/:callId/end')
  @HttpCode(200)
  @ApiOkResponse({ type: CallDto })
  @ApiNotFoundResponse()
  end(
    @CurrentUser() user: SessionUser,
    @Param('callId', ParseUuidPipe) callId: string,
  ): Promise<CallDto> {
    return this.calls.end(user.id, callId);
  }

  @Get('calls/:callId')
  @ApiOkResponse({ type: CallDto })
  @ApiNotFoundResponse()
  get(
    @CurrentUser() user: SessionUser,
    @Param('callId', ParseUuidPipe) callId: string,
  ): Promise<CallDto> {
    return this.calls.get(user.id, callId);
  }
}
