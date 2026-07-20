import { IsIn, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { CHANNEL, type Channel, type CreateSendRequest } from '@conduit/contracts';

/**
 * Body of POST /sends. Mirrors `createSendSchema` in the contracts package — the zod schema
 * is what the SDK validates against client-side, this is what Nest's ValidationPipe enforces
 * server-side.
 */
export class CreateSendBodyDto implements CreateSendRequest {
  @IsIn([...CHANNEL])
  channel!: Channel;

  @IsString()
  @MinLength(1)
  to!: string;

  /** → EventDto.id. Required: a send with no cause could never be reconciled. */
  @IsString()
  @MinLength(1)
  causedBy!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  template?: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  idempotencyKey?: string;
}
