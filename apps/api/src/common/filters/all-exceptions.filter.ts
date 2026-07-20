import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { ApiError } from '@conduit/contracts';

/** Every non-2xx response leaves the API in the shared `ApiError` envelope. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const { code, message, details } = this.describe(exception, status);

    const body: ApiError = {
      statusCode: status,
      code,
      message,
      ...(details ? { details } : {}),
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} → ${status}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(status).json(body);
  }

  private describe(
    exception: unknown,
    status: number,
  ): { code: string; message: string; details?: Record<string, unknown> } {
    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      if (typeof res === 'string') {
        return { code: this.codeFor(status), message: res };
      }
      const obj = res as Record<string, unknown>;
      const message = Array.isArray(obj.message)
        ? (obj.message as string[]).join(', ')
        : String(obj.message ?? exception.message);
      const code = typeof obj.code === 'string' ? obj.code : this.codeFor(status);
      const details = Array.isArray(obj.message) ? { errors: obj.message } : undefined;
      return { code, message, details };
    }
    return { code: 'INTERNAL_ERROR', message: 'Internal server error' };
  }

  private codeFor(status: number): string {
    const map: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'RATE_LIMITED',
      500: 'INTERNAL_ERROR',
      501: 'NOT_IMPLEMENTED',
    };
    return map[status] ?? 'ERROR';
  }
}
