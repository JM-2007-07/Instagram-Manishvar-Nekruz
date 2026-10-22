import { Controller, Get, Param } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { HashtagDto } from './dto/tags.dto';
import { TagsService } from './tags.service';

// TODO(T1.B4): GET /hashtags/:name/posts?tab=TOP|RECENT — выдача появится вместе с моделью Post.
@ApiTags('tags')
@Controller('hashtags')
export class TagsController {
  constructor(private readonly tags: TagsService) {}

  @Get(':name')
  @ApiOkResponse({ type: HashtagDto })
  @ApiNotFoundResponse({ description: 'Хэштег не найден' })
  info(@Param('name') name: string): Promise<HashtagDto> {
    return this.tags.getInfo(name);
  }
}
