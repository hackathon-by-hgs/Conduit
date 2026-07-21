import { defaultScheme } from './default.scheme';
import { monnifyScheme } from './monnify.scheme';
import type { SourceScheme } from './source-scheme';

/** Sources whose provider deviates from Conduit's generic scheme. Keys are lowercased. */
const SOURCE_SCHEMES: Record<string, SourceScheme> = {
  monnify: monnifyScheme,
};

/** The scheme for a source, falling back to Conduit's generic HMAC-SHA256 scheme. */
export function schemeFor(source: string): SourceScheme {
  return SOURCE_SCHEMES[source.toLowerCase()] ?? defaultScheme;
}

export { defaultScheme, monnifyScheme };
export type { ParsedEvent, SourceScheme } from './source-scheme';
