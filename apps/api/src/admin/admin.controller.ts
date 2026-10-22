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
import { AdminService } from './admin.service';
import {
  CreateReportDto,
  ReportDto,
  ReportIdDto,
  ReportPageDto,
  ReportsQueryDto,
  ResolveReportDto,
} from './dto/admin.dto';

@ApiTags('admin')
@Controller()
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Post('reports')
  @Throttle({ default: { limit: 30, ttl: hours(1) } })
  @ApiCreatedResponse({ type: ReportIdDto })
  @ApiBadRequestResponse({ description: 'Жалоба на себя или своё' })
  @ApiNotFoundResponse()
  @ApiTooManyRequestsResponse()
  createReport(
    @CurrentUser() user: SessionUser,
    @Body() dto: CreateReportDto,
  ): Promise<ReportIdDto> {
    return this.admin.createReport(user.id, dto);
  }

  @Get('admin/reports')
  @ApiOkResponse({ type: ReportPageDto })
  @ApiForbiddenResponse({ description: 'Только ADMIN' })
  list(@CurrentUser() user: SessionUser, @Query() query: ReportsQueryDto): Promise<ReportPageDto> {
    return this.admin.listReports(user, query);
  }

  @Get('admin/reports/:reportId')
  @ApiOkResponse({ type: ReportDto })
  @ApiForbiddenResponse({ description: 'Только ADMIN' })
  @ApiNotFoundResponse()
  get(
    @CurrentUser() user: SessionUser,
    @Param('reportId', ParseUuidPipe) reportId: string,
  ): Promise<ReportDto> {
    return this.admin.getReport(user, reportId);
  }

  @Patch('admin/reports/:reportId')
  @ApiOkResponse({ type: ReportDto })
  @ApiBadRequestResponse()
  @ApiForbiddenResponse({ description: 'Только ADMIN' })
  @ApiNotFoundResponse()
  resolve(
    @CurrentUser() user: SessionUser,
    @Param('reportId', ParseUuidPipe) reportId: string,
    @Body() dto: ResolveReportDto,
  ): Promise<ReportDto> {
    return this.admin.resolveReport(user, reportId, dto);
  }

  @Put('admin/users/:userId/verified')
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiForbiddenResponse({ description: 'Только ADMIN' })
  @ApiNotFoundResponse()
  verify(
    @CurrentUser() user: SessionUser,
    @Param('userId', ParseUuidPipe) userId: string,
  ): Promise<void> {
    return this.admin.setVerified(user, userId, true);
  }

  @Delete('admin/users/:userId/verified')
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiForbiddenResponse({ description: 'Только ADMIN' })
  @ApiNotFoundResponse()
  unverify(
    @CurrentUser() user: SessionUser,
    @Param('userId', ParseUuidPipe) userId: string,
  ): Promise<void> {
    return this.admin.setVerified(user, userId, false);
  }

  // Необязательное тело { reason? } из контракта игнорируется: причина нигде не хранится.
  @Put('admin/users/:userId/ban')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Все сессии пользователя завершены' })
  @ApiBadRequestResponse()
  @ApiForbiddenResponse({ description: 'Только ADMIN' })
  @ApiNotFoundResponse()
  ban(
    @CurrentUser() user: SessionUser,
    @Param('userId', ParseUuidPipe) userId: string,
  ): Promise<void> {
    return this.admin.ban(user, userId);
  }

  @Delete('admin/users/:userId/ban')
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiForbiddenResponse({ description: 'Только ADMIN' })
  @ApiNotFoundResponse()
  unban(
    @CurrentUser() user: SessionUser,
    @Param('userId', ParseUuidPipe) userId: string,
  ): Promise<void> {
    return this.admin.unban(user, userId);
  }

  // #50: немедленное удаление чужого аккаунта.
  @Delete('admin/users/:userId')
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiBadRequestResponse()
  @ApiForbiddenResponse({ description: 'Только ADMIN' })
  @ApiNotFoundResponse()
  deleteUser(
    @CurrentUser() user: SessionUser,
    @Param('userId', ParseUuidPipe) userId: string,
  ): Promise<void> {
    return this.admin.deleteUser(user, userId);
  }
}
