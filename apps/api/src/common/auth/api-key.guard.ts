import {
  CanActivate,
  type ExecutionContext,
  Injectable,
  Logger,
  type OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { API_KEY_HEADER, AUTH_HEADER, AUTH_SCHEME, UNAUTHORIZED_CODE } from '@conduit/contracts';
import { AppConfigService } from '../../config/config.service';
import { IS_PUBLIC_KEY } from './public.decorator';

/**
 * Compare without leaking length or content through timing. Different-length inputs are
 * rejected up front because `timingSafeEqual` throws on a length mismatch.
 */
function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Global API-key guard.
 *
 * Applied to every route; individual routes opt out with `@Public()`. That direction matters
 * — a forgotten guard is a silent hole, whereas a forgotten `@Public()` fails loudly the
 * first time anyone calls the route.
 *
 * The key is accepted as `Authorization: Bearer <key>` or, for clients that reserve the
 * Authorization header, `x-api-key: <key>`. It is deliberately NOT read from the query
 * string: URLs end up in access logs, browser history and Referer headers.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate, OnModuleInit {
  private readonly logger = new Logger(ApiKeyGuard.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly reflector: Reflector,
  ) {}

  onModuleInit(): void {
    if (this.config.apiKey) {
      this.logger.log('API key authentication is ENABLED.');
    } else {
      this.logger.warn(
        'CONDUIT_API_KEY is not set — authentication is DISABLED and every endpoint is open. ' +
          'Fine for local development; set it for anything reachable beyond localhost.',
      );
    }
  }

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.apiKey;
    // No key configured → auth is off (warned about at boot).
    if (!expected) return true;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const provided = this.extractKey(context.switchToHttp().getRequest<Request>());
    if (!provided) {
      throw new UnauthorizedException({
        code: UNAUTHORIZED_CODE,
        message: `Missing API key. Send "${AUTH_HEADER}: ${AUTH_SCHEME} <key>" or "${API_KEY_HEADER}: <key>".`,
      });
    }
    if (!constantTimeEquals(provided, expected)) {
      throw new UnauthorizedException({
        code: UNAUTHORIZED_CODE,
        message: 'Invalid API key.',
      });
    }
    return true;
  }

  private extractKey(request: Request): string | undefined {
    const authorization = request.headers[AUTH_HEADER];
    const header = Array.isArray(authorization) ? authorization[0] : authorization;
    if (header) {
      const [scheme, ...rest] = header.split(' ');
      // Accept the scheme case-insensitively, per RFC 7235.
      if (scheme?.toLowerCase() === AUTH_SCHEME.toLowerCase() && rest.length > 0) {
        return rest.join(' ').trim() || undefined;
      }
    }

    const alternative = request.headers[API_KEY_HEADER];
    const key = Array.isArray(alternative) ? alternative[0] : alternative;
    return key?.trim() || undefined;
  }
}
