import { IsIn, IsISO8601, IsOptional } from 'class-validator';
import { GAP_FILTER, type GapFilter, type ReconcileQuery } from '@conduit/contracts';

export class ReconcileQueryDto implements ReconcileQuery {
  /** Inclusive lower bound on `detectedAt`. Validated as ISO-8601 so `new Date()` can't NaN. */
  @IsOptional()
  @IsISO8601()
  from?: string;

  /** Inclusive upper bound on `detectedAt`. */
  @IsOptional()
  @IsISO8601()
  to?: string;

  /** `open` (still violating), `resolved` (history), or `all` — the default. */
  @IsOptional()
  @IsIn([...GAP_FILTER])
  status?: GapFilter;
}
