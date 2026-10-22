import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ParseUuidPipe } from '@/common/pipes/parse-uuid.pipe';
import { CurrentUser } from '@/common/session/current-user.decorator';
import type { SessionUser } from '@/common/session/session-user';
import { UserSummaryDto } from '@/users/dto/user-summary.dto';
import {
  AddSearchHistoryDto,
  ClearSearchHistoryQueryDto,
  SearchHistoryEntryDto,
  SearchHistoryPageDto,
  SearchHashtagsPageDto,
  SearchHistoryQueryDto,
  SearchLocationsPageDto,
  SearchQueryDto,
  SearchResultDto,
  SearchUsersPageDto,
  SearchUsersQueryDto,
} from './dto/search.dto';
import { SearchService } from './search.service';

@ApiTags('search')
@Controller()
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get('search')
  @ApiOkResponse({ type: SearchResultDto })
  @ApiBadRequestResponse({ description: 'q пустой или длиннее 50 символов' })
  searchAll(
    @CurrentUser() user: SessionUser,
    @Query() query: SearchQueryDto,
  ): Promise<SearchResultDto> {
    return this.search.searchAll(user.id, query.q);
  }

  @Get('search/users')
  @ApiOkResponse({ type: SearchUsersPageDto })
  @ApiBadRequestResponse()
  searchUsers(
    @CurrentUser() user: SessionUser,
    @Query() query: SearchUsersQueryDto,
  ): Promise<SearchUsersPageDto> {
    return this.search.searchUsers(user.id, query);
  }

  @Get('search/hashtags')
  @ApiOkResponse({ type: SearchHashtagsPageDto })
  @ApiBadRequestResponse()
  searchHashtags(@Query() query: SearchUsersQueryDto): Promise<SearchHashtagsPageDto> {
    return this.search.searchHashtags(query);
  }

  @Get('search/locations')
  @ApiOkResponse({ type: SearchLocationsPageDto })
  @ApiBadRequestResponse()
  searchLocations(@Query() query: SearchUsersQueryDto): Promise<SearchLocationsPageDto> {
    return this.search.searchLocations(query);
  }

  @Get('search/mentions')
  @ApiOkResponse({ type: [UserSummaryDto], description: 'До 10 аккаунтов для подсказки после @' })
  @ApiBadRequestResponse()
  mentions(
    @CurrentUser() user: SessionUser,
    @Query() query: SearchQueryDto,
  ): Promise<UserSummaryDto[]> {
    return this.search.mentions(user.id, query.q);
  }

  @Get('me/search-history')
  @ApiOkResponse({ type: SearchHistoryPageDto })
  listHistory(
    @CurrentUser() user: SessionUser,
    @Query() query: SearchHistoryQueryDto,
  ): Promise<SearchHistoryPageDto> {
    return this.search.listHistory(user.id, query);
  }

  @Post('me/search-history')
  @ApiCreatedResponse({ type: SearchHistoryEntryDto, description: 'Повтор поднимает запись' })
  @ApiBadRequestResponse({ description: 'Тип не поддерживается или нет нужного поля' })
  @ApiNotFoundResponse({ description: 'Пользователь, хэштег или место не найдены' })
  addHistory(
    @CurrentUser() user: SessionUser,
    @Body() dto: AddSearchHistoryDto,
  ): Promise<SearchHistoryEntryDto> {
    return this.search.addHistory(user.id, dto);
  }

  @Delete('me/search-history/:entryId')
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Нет такой записи или она чужая' })
  removeHistoryEntry(
    @CurrentUser() user: SessionUser,
    @Param('entryId', ParseUuidPipe) entryId: string,
  ): Promise<void> {
    return this.search.removeHistoryEntry(user.id, entryId);
  }

  @Delete('me/search-history')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Очищает записи указанного типа или все' })
  clearHistory(
    @CurrentUser() user: SessionUser,
    @Query() query: ClearSearchHistoryQueryDto,
  ): Promise<void> {
    return this.search.clearHistory(user.id, query.type);
  }
}
