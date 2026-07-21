import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'conduit:isPublic';

/**
 * Exempt a route from the API-key guard.
 *
 * Deliberately opt-OUT: the guard is global, so a new endpoint is protected by default and
 * only becomes reachable without a key when someone explicitly says so here. Forgetting to
 * add auth is a silent hole; forgetting to add `@Public()` is an immediate 401.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
