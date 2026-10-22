import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { Prisma } from '@/generated/prisma/client';
import type { RequestWithId } from '../request/request-id';

// Код ошибки по HTTP-статусу (API_CONTRACT §1.2). Сервис может задать свой code через { code, message }.
const CODE_BY_STATUS: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  429: 'RATE_LIMITED',
};

const BODY_ERROR_MESSAGES: Record<number, string> = {
  400: 'Malformed request body',
  413: 'Request body is too large',
  415: 'Unsupported content type',
};

interface ErrorBody {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
  requestId?: string;
}

// Единый формат ошибки для всего API. Stack trace и SQL в ответ не попадают никогда.
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') return;
    const http = host.switchToHttp();
    const req = http.getRequest<RequestWithId>();
    const res = http.getResponse<Response>();

    const body = this.toBody(exception);
    body.requestId = req.requestId;
    if (body.statusCode >= 500) {
      // Стек — только в лог сервера
      this.logger.error(
        `[${req.requestId}] ${req.method} ${req.path}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }
    res.status(body.statusCode).json(body);
  }

  private toBody(exception: unknown): ErrorBody {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      const custom = typeof response === 'object' ? (response as Record<string, unknown>) : {};
      const fallbackCode =
        CODE_BY_STATUS[status] ?? (status >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST');
      // Текст 5xx-ошибок клиенту не показываем: он может содержать внутренние детали.
      if (status >= 500) {
        return { statusCode: status, code: fallbackCode, message: 'Internal server error' };
      }
      // Nest превращает SyntaxError/URIError парсера в BadRequestException с текстом парсера;
      // этот текст (например, «Unexpected end of JSON input») клиенту не показываем.
      if (status === 400 && /JSON|URI malformed/.test(exception.message)) {
        return { statusCode: 400, code: 'BAD_REQUEST', message: BODY_ERROR_MESSAGES[400] };
      }
      return {
        statusCode: status,
        code: typeof custom.code === 'string' ? custom.code : fallbackCode,
        message: typeof custom.message === 'string' ? custom.message : exception.message,
        ...(custom.details !== undefined && { details: custom.details }),
      };
    }

    // Нарушение уникальности / запись не найдена в БД — на случай, если сервис не проверил заранее.
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002')
        return { statusCode: 409, code: 'CONFLICT', message: 'Resource already exists' };
      if (exception.code === 'P2025')
        return { statusCode: 404, code: 'NOT_FOUND', message: 'Resource not found' };
    }

    // Ошибки body-parser (битый JSON, слишком большое тело): http-errors с expose === true.
    const parserError = exception as { status?: unknown; expose?: unknown; type?: unknown } | null;
    const status = parserError?.status;
    if (
      typeof status === 'number' &&
      status >= 400 &&
      status < 500 &&
      (parserError?.expose === true || typeof parserError?.type === 'string')
    ) {
      return {
        statusCode: status,
        code: CODE_BY_STATUS[status] ?? 'BAD_REQUEST',
        message: BODY_ERROR_MESSAGES[status] ?? 'Bad request',
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    };
  }
}
