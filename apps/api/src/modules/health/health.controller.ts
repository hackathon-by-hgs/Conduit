import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/auth/public.decorator';

/** Exempt from the API key: liveness probes must work without credentials. */
@Public()
@Controller('health')
export class HealthController {
  @Get()
  check(): { status: 'ok'; uptime: number; timestamp: string } {
    return { status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() };
  }
}
