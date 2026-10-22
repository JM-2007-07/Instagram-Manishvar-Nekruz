import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
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
import { ParseUuidPipe } from '@/common/pipes/parse-uuid.pipe';
import { CurrentUser } from '@/common/session/current-user.decorator';
import type { SessionUser } from '@/common/session/session-user';
import {
  CreateLocationDto,
  LocationDetailsDto,
  LocationDto,
  LocationPageDto,
  LocationsQueryDto,
  UpdateLocationDto,
} from './dto/locations.dto';
import { LocationsService } from './locations.service';

// GET /locations/{id}/posts лежит в модуле posts (FeedController).
@ApiTags('locations')
@Controller('locations')
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Get()
  @ApiOkResponse({ type: LocationPageDto })
  @ApiBadRequestResponse()
  list(@Query() query: LocationsQueryDto): Promise<LocationPageDto> {
    return this.locations.search(query);
  }

  @Get(':locationId')
  @ApiOkResponse({ type: LocationDetailsDto })
  @ApiNotFoundResponse()
  get(@Param('locationId', ParseUuidPipe) id: string): Promise<LocationDetailsDto> {
    return this.locations.findById(id);
  }

  @Post()
  @ApiCreatedResponse({ type: LocationDto })
  @ApiBadRequestResponse()
  @ApiForbiddenResponse({ description: 'Только ADMIN' })
  @ApiConflictResponse({ description: 'Такое место уже есть' })
  create(@CurrentUser() user: SessionUser, @Body() dto: CreateLocationDto): Promise<LocationDto> {
    return this.locations.create(user.role, dto);
  }

  @Patch(':locationId')
  @ApiOkResponse({ type: LocationDto })
  @ApiBadRequestResponse()
  @ApiForbiddenResponse({ description: 'Только ADMIN' })
  @ApiNotFoundResponse()
  @ApiConflictResponse()
  update(
    @CurrentUser() user: SessionUser,
    @Param('locationId', ParseUuidPipe) id: string,
    @Body() dto: UpdateLocationDto,
  ): Promise<LocationDto> {
    return this.locations.update(user.role, id, dto);
  }

  @Delete(':locationId')
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiForbiddenResponse({ description: 'Только ADMIN' })
  @ApiNotFoundResponse()
  remove(
    @CurrentUser() user: SessionUser,
    @Param('locationId', ParseUuidPipe) id: string,
  ): Promise<void> {
    return this.locations.remove(user.role, id);
  }
}
