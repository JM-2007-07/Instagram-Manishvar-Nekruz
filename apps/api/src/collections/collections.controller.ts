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
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CursorQueryDto } from '@/common/pagination/cursor-query.dto';
import { ParseUuidPipe } from '@/common/pipes/parse-uuid.pipe';
import { CurrentUser } from '@/common/session/current-user.decorator';
import type { SessionUser } from '@/common/session/session-user';
import { PostDto, PostPageDto } from '@/posts/dto/posts.dto';
import { CollectionsService } from './collections.service';
import { CollectionDto, CreateCollectionDto, UpdateCollectionDto } from './dto/collections.dto';

@ApiTags('collections')
@Controller()
export class CollectionsController {
  constructor(private readonly collections: CollectionsService) {}

  @Put('posts/:postId/save')
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Пост недоступен' })
  save(
    @CurrentUser() user: SessionUser,
    @Param('postId', ParseUuidPipe) postId: string,
  ): Promise<void> {
    return this.collections.save(user.id, postId);
  }

  @Delete('posts/:postId/save')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Пост убран из «Сохранённого» и из всех подборок' })
  unsave(
    @CurrentUser() user: SessionUser,
    @Param('postId', ParseUuidPipe) postId: string,
  ): Promise<void> {
    return this.collections.unsave(user.id, postId);
  }

  @Get('me/saved')
  @ApiOkResponse({ type: PostPageDto })
  listSaved(
    @CurrentUser() user: SessionUser,
    @Query() query: CursorQueryDto,
  ): Promise<{ items: PostDto[]; nextCursor: string | null }> {
    return this.collections.listSaved(user.id, query);
  }

  @Get('me/collections')
  @ApiOkResponse({ type: [CollectionDto] })
  list(@CurrentUser() user: SessionUser): Promise<CollectionDto[]> {
    return this.collections.listCollections(user.id);
  }

  @Post('me/collections')
  @ApiCreatedResponse({ type: CollectionDto })
  @ApiBadRequestResponse()
  @ApiNotFoundResponse({ description: 'Один из postIds недоступен' })
  create(
    @CurrentUser() user: SessionUser,
    @Body() dto: CreateCollectionDto,
  ): Promise<CollectionDto> {
    return this.collections.create(user.id, dto);
  }

  @Patch('me/collections/:collectionId')
  @ApiOkResponse({ type: CollectionDto })
  @ApiBadRequestResponse()
  @ApiNotFoundResponse()
  update(
    @CurrentUser() user: SessionUser,
    @Param('collectionId', ParseUuidPipe) collectionId: string,
    @Body() dto: UpdateCollectionDto,
  ): Promise<CollectionDto> {
    return this.collections.update(user.id, collectionId, dto);
  }

  @Delete('me/collections/:collectionId')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Посты остаются в «Сохранённом»' })
  @ApiNotFoundResponse()
  remove(
    @CurrentUser() user: SessionUser,
    @Param('collectionId', ParseUuidPipe) collectionId: string,
  ): Promise<void> {
    return this.collections.remove(user.id, collectionId);
  }

  @Get('me/collections/:collectionId/posts')
  @ApiOkResponse({ type: PostPageDto })
  @ApiNotFoundResponse()
  listPosts(
    @CurrentUser() user: SessionUser,
    @Param('collectionId', ParseUuidPipe) collectionId: string,
    @Query() query: CursorQueryDto,
  ): Promise<{ items: PostDto[]; nextCursor: string | null }> {
    return this.collections.listPosts(user.id, collectionId, query);
  }

  @Put('me/collections/:collectionId/posts/:postId')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Пост сохраняется, если ещё не сохранён' })
  @ApiNotFoundResponse()
  addPost(
    @CurrentUser() user: SessionUser,
    @Param('collectionId', ParseUuidPipe) collectionId: string,
    @Param('postId', ParseUuidPipe) postId: string,
  ): Promise<void> {
    return this.collections.addPost(user.id, collectionId, postId);
  }

  @Delete('me/collections/:collectionId/posts/:postId')
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  removePost(
    @CurrentUser() user: SessionUser,
    @Param('collectionId', ParseUuidPipe) collectionId: string,
    @Param('postId', ParseUuidPipe) postId: string,
  ): Promise<void> {
    return this.collections.removePost(user.id, collectionId, postId);
  }
}
