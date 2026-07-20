import type { AttemptDto } from '@conduit/contracts';
import type { AttemptRow } from './sends.repository';

export const AttemptsMapper = {
  toDto(row: AttemptRow): AttemptDto {
    return {
      id: row.id,
      sendId: row.sendId,
      attemptNo: row.attemptNo,
      statusCode: row.statusCode ?? null,
      providerId: row.providerId ?? null,
      error: row.error ?? null,
      durationMs: row.durationMs,
      at: row.at.toISOString(),
      nextRetryAt: row.nextRetryAt?.toISOString() ?? null,
    };
  },
};
