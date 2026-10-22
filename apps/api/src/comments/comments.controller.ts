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
import { CommentsService } from './comments.service';
import {
  CommentDto,
  CommentLikerPageDto,
  CommentPageDto,
  CommentsQueryDto,
  CreateCommentDto,
  UpdateCommentDto,
} from './dto/comments.dto';

@ApiTags('comments')
@Controller()
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get('posts/:postId/comments')
  @ApiOkResponse({ type: CommentPageDto })
  @ApiForbiddenResponse({ description: 'PRIVATE_ACCOUNT' })
  @ApiNotFoundResponse()
  list(
    @CurrentUser() user: SessionUser,
    @Param('postId', ParseUuidPipe) postId: string,
    @Query() query: CommentsQueryDto,
  ): Promise<CommentPageDto> {
    return this.comments.list(user.id, postId, query);
  }

  @Post('posts/:postId/comments')
  @Throttle({ default: { limit: 60, ttl: minutes(1) } })
  @ApiCreatedResponse({ type: CommentDto })
  @ApiBadRequestResponse({ description: 'Пустой текст, ответ на ответ, больше 5 упоминаний' })
  @ApiForbiddenResponse({
    description: 'Комментарии отключены / запрещены настройками / PRIVATE_ACCOUNT',
  })
  @ApiNotFoundResponse()
  @ApiTooManyRequestsResponse()
  create(
    @CurrentUser() user: SessionUser,
    @Param('postId', ParseUuidPipe) postId: string,
    @Body() dto: CreateCommentDto,
  ): Promise<CommentDto> {
    return this.comments.create(user, postId, dto);
  }

  @Get('comments/:commentId/replies')
  @ApiOkResponse({ type: CommentPageDto })
  @ApiNotFoundResponse()
  replies(
    @CurrentUser() user: SessionUser,
    @Param('commentId', ParseUuidPipe) commentId: string,
    @Query() query: CursorQueryDto,
  ): Promise<CommentPageDto> {
    return this.comments.replies(user.id, commentId, query);
  }

  @Patch('comments/:commentId')
  @ApiOkResponse({ type: CommentDto })
  @ApiForbiddenResponse({ description: 'Не автор' })
  @ApiNotFoundResponse()
  @ApiConflictResponse({ description: 'EDIT_WINDOW_EXPIRED — прошло больше 15 минут' })
  update(
    @CurrentUser() user: SessionUser,
    @Param('commentId', ParseUuidPipe) commentId: string,
    @Body() dto: UpdateCommentDto,
  ): Promise<CommentDto> {
    return this.comments.update(user, commentId, dto);
  }

  @Delete('comments/:commentId')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Вместе с ответами' })
  @ApiForbiddenResponse({ description: 'Не автор комментария и не автор поста' })
  @ApiNotFoundResponse()
  remove(
    @CurrentUser() user: SessionUser,
    @Param('commentId', ParseUuidPipe) commentId: string,
  ): Promise<void> {
    return this.comments.remove(user, commentId);
  }

  @Put('comments/:commentId/like')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Повторный вызов тоже 204' })
  @ApiNotFoundResponse()
  like(
    @CurrentUser() user: SessionUser,
    @Param('commentId', ParseUuidPipe) commentId: string,
  ): Promise<void> {
    return this.comments.like(user.id, commentId);
  }

  @Delete('comments/:commentId/like')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Повторный вызов тоже 204' })
  @ApiNotFoundResponse()
  unlike(
    @CurrentUser() user: SessionUser,
    @Param('commentId', ParseUuidPipe) commentId: string,
  ): Promise<void> {
    return this.comments.unlike(user.id, commentId);
  }

  @Get('comments/:commentId/likes')
  @ApiOkResponse({ type: CommentLikerPageDto })
  @ApiNotFoundResponse()
  likes(
    @CurrentUser() user: SessionUser,
    @Param('commentId', ParseUuidPipe) commentId: string,
    @Query() query: CursorQueryDto,
  ): Promise<CommentLikerPageDto> {
    return this.comments.likes(user.id, commentId, query);
  }

  @Put('comments/:commentId/pin')
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiBadRequestResponse({ description: 'Ответ закрепить нельзя' })
  @ApiForbiddenResponse({ description: 'Не автор поста' })
  @ApiNotFoundResponse()
  @ApiConflictResponse({ description: 'LIMIT_REACHED — уже закреплено 3 комментария' })
  pin(
    @CurrentUser() user: SessionUser,
    @Param('commentId', ParseUuidPipe) commentId: string,
  ): Promise<void> {
    return this.comments.setPinned(user.id, commentId, true);
  }

  @Delete('comments/:commentId/pin')
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiForbiddenResponse({ description: 'Не автор поста' })
  @ApiNotFoundResponse()
  unpin(
    @CurrentUser() user: SessionUser,
    @Param('commentId', ParseUuidPipe) commentId: string,
  ): Promise<void> {
    return this.comments.setPinned(user.id, commentId, false);
  }

  @Post('comments/:commentId/approve')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Показать комментарий ограниченного пользователя' })
  @ApiNotFoundResponse({ description: 'Нет такого комментария к вашему посту' })
  approve(
    @CurrentUser() user: SessionUser,
    @Param('commentId', ParseUuidPipe) commentId: string,
  ): Promise<void> {
    return this.comments.approve(user.id, commentId);
  }
}
