// Client
export { Conduit, createConduit, type ReconcileOptions } from './client';

// Types
export type {
  ConduitOptions,
  HandleInput,
  HandleOptions,
  SendInput,
} from './types';

// Errors
export { ConduitError, ConduitSignatureError, ConduitTransportError } from './errors';

// Framework adapters
export { fromExpressRequest, type ExpressLikeRequest } from './adapters/express';
export { fromFetchRequest, type FetchLikeRequest } from './adapters/fetch';

// Signature scheme — the canonical implementation, shared with the API.
export { signPayload, verifyPayload } from './signature';

// HTTP escape hatch, for callers supplying their own fetch.
export type { FetchLike } from './http';

// Re-export the wire contract so consumers need only one dependency.
export type {
  ApiError,
  AttemptDto,
  Channel,
  EventDetailDto,
  EventDto,
  EventStatus,
  GapDto,
  GapType,
  Paginated,
  ReconcileReportDto,
  SendDto,
  SendStatus,
  SendWithAttemptsDto,
  StatsDto,
  StreamEvent,
  WebhookIngestResponse,
} from '@conduit/contracts';
