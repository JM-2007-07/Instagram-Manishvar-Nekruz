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
import { Throttle, hours } from '@nestjs/throttler';
import { ParseUuidPipe } from '@/common/pipes/parse-uuid.pipe';
import { CurrentUser } from '@/common/session/current-user.decorator';
import type { SessionUser } from '@/common/session/session-user';
import {
  CreatePostDto,
  LikerPageDto,
  LikesQueryDto,
  PostDto,
  UpdatePostDto,
} from './dto/posts.dto';
import { PostsService } from './posts.service';

@ApiTags('posts')
@Controller('posts')
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  @Post()
  @Throttle({ default: { limit: 25, ttl: hours(1) } })
  @ApiCreatedResponse({ type: PostDto })
  @ApiBadRequestResponse()
  @ApiConflictResponse({ description: 'MEDIA_NOT_READY / MEDIA_ALREADY_USED' })
  @ApiTooManyRequestsResponse({ description: 'Больше 25 публикаций в час' })
  create(@CurrentUser() user: SessionUser, @Body() dto: CreatePostDto): Promise<PostDto> {
    return this.posts.create(user, dto);
  }

  // by-shortcode объявлен раньше :postId; пути разной длины, конфликта нет.
  @Get('by-shortcode/:shortcode')
  @ApiOkResponse({ type: PostDto })
  @ApiForbiddenResponse({ description: 'PRIVATE_ACCOUNT' })
  @ApiNotFoundResponse()
  byShortcode(
    @CurrentUser() user: SessionUser,
    @Param('shortcode') shortcode: string,
  ): Promise<PostDto> {
    return this.posts.getByShortcode(user.id, shortcode);
  }

  @Get(':postId')
  @ApiOkResponse({ type: PostDto })
  @ApiForbiddenResponse({ description: 'PRIVATE_ACCOUNT' })
  @ApiNotFoundResponse()
  get(
    @CurrentUser() user: SessionUser,
    @Param('postId', ParseUuidPipe) postId: string,
  ): Promise<PostDto> {
    return this.posts.getById(user.id, postId);
  }

  @Patch(':postId')
  @ApiOkResponse({ type: PostDto })
  @ApiBadRequestResponse()
  @ApiForbiddenResponse({ description: 'Не автор' })
  @ApiNotFoundResponse()
  update(
    @CurrentUser() user: SessionUser,
    @Param('postId', ParseUuidPipe) postId: string,
    @Body() dto: UpdatePostDto,
  ): Promise<PostDto> {
    return this.posts.update(user, postId, dto);
  }

  @Delete(':postId')
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiForbiddenResponse({ description: 'Не автор и не ADMIN' })
  @ApiNotFoundResponse()
  remove(
    @CurrentUser() user: SessionUser,
    @Param('postId', ParseUuidPipe) postId: string,
  ): Promise<void> {
    return this.posts.remove(user, postId);
  }

  @Put(':postId/archive')
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  archive(
    @CurrentUser() user: SessionUser,
    @Param('postId', ParseUuidPipe) postId: string,
  ): Promise<void> {
    return this.posts.setArchived(user.id, postId, true);
  }

  @Delete(':postId/archive')
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  unarchive(
    @CurrentUser() user: SessionUser,
    @Param('postId', ParseUuidPipe) postId: string,
  ): Promise<void> {
    return this.posts.setArchived(user.id, postId, false);
  }

  @Put(':postId/pin')
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse({ description: 'LIMIT_REACHED — уже закреплено 3 публикации' })
  pin(
    @CurrentUser() user: SessionUser,
    @Param('postId', ParseUuidPipe) postId: string,
  ): Promise<void> {
    return this.posts.setPinned(user.id, postId, true);
  }

  @Delete(':postId/pin')
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  unpin(
    @CurrentUser() user: SessionUser,
    @Param('postId', ParseUuidPipe) postId: string,
  ): Promise<void> {
    return this.posts.setPinned(user.id, postId, false);
  }

  @Post(':postId/collaborators/accept')
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  acceptCollaboration(
    @CurrentUser() user: SessionUser,
    @Param('postId', ParseUuidPipe) postId: string,
  ): Promise<void> {
    return this.posts.acceptCollaboration(user.id, postId);
  }

  @Delete(':postId/collaborators/me')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Отклонить приглашение или выйти из соавторства' })
  @ApiNotFoundResponse()
  leaveCollaboration(
    @CurrentUser() user: SessionUser,
    @Param('postId', ParseUuidPipe) postId: string,
  ): Promise<void> {
    return this.posts.leaveCollaboration(user.id, postId);
  }

  @Put(':postId/like')
  @HttpCode(204)
  @Throttle({ default: { limit: 300, ttl: hours(1) } })
  @ApiNoContentResponse({ description: 'Повторный вызов тоже 204' })
  @ApiForbiddenResponse({ description: 'PRIVATE_ACCOUNT' })
  @ApiNotFoundResponse()
  like(
    @CurrentUser() user: SessionUser,
    @Param('postId', ParseUuidPipe) postId: string,
  ): Promise<void> {
    return this.posts.like(user.id, postId);
  }

  @Delete(':postId/like')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Повторный вызов тоже 204' })
  @ApiNotFoundResponse()
  unlike(
    @CurrentUser() user: SessionUser,
    @Param('postId', ParseUuidPipe) postId: string,
  ): Promise<void> {
    return this.posts.unlike(user.id, postId);
  }

  @Get(':postId/likes')
  @ApiOkResponse({ type: LikerPageDto })
  @ApiForbiddenResponse({ description: 'Автор скрыл число лайков или PRIVATE_ACCOUNT' })
  @ApiNotFoundResponse()
  likes(
    @CurrentUser() user: SessionUser,
    @Param('postId', ParseUuidPipe) postId: string,
    @Query() query: LikesQueryDto,
  ): Promise<LikerPageDto> {
    return this.posts.likes(user.id, postId, query);
  }

  @Post(':postId/plays')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Засчитывается не чаще раза в час на пользователя' })
  @ApiNotFoundResponse()
  play(
    @CurrentUser() user: SessionUser,
    @Param('postId', ParseUuidPipe) postId: string,
  ): Promise<void> {
    return this.posts.registerPlay(user.id, postId);
  }
}
