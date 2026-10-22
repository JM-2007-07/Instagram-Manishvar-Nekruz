import { Controller, Get, Param } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { HashtagDto } from './dto/tags.dto';
import { TagsService } from './tags.service';

// GET /hashtags/:name/posts лежит в модуле posts (FeedController).
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
