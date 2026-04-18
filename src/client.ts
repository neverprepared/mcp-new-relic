import { GraphQLClient, ClientError } from 'graphql-request';
import { CONFIG } from './config.js';
import { NerdGraphError, type NerdGraphGqlError } from './errors.js';
import { logger } from './logger.js';

const REQUEST_TIMEOUT_MS = 30_000;

const gqlClient = new GraphQLClient(CONFIG.NERDGRAPH_ENDPOINT, {
  headers: {
    'API-Key': CONFIG.NEW_RELIC_API_KEY,
    'Content-Type': 'application/json',
  },
});

/**
 * Execute a NerdGraph GraphQL request and return the typed response body.
 *
 * TRUST BOUNDARY: The generic parameter T is asserted by the caller — this
 * function performs no runtime validation of the response shape. Callers
 * should validate critical fields before accessing them, especially when
 * consuming nested or optional properties from the NerdGraph response.
 */
export async function nerdgraph<T>(
  document: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const start = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new NerdGraphError(`NerdGraph request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`)),
      REQUEST_TIMEOUT_MS
    );
  });

  try {
    const result = await Promise.race([gqlClient.request<T>(document, variables), timeoutPromise]);
    return result;
  } catch (err) {
    if (err instanceof ClientError) {
      const rawErrors = err.response?.errors;
      // Map the graphql-request error objects to our typed NerdGraphGqlError shape.
      const gqlErrors: NerdGraphGqlError[] | undefined = rawErrors?.map(
        (e: { message: string; extensions?: Record<string, unknown> }) => ({
          message: e.message,
          ...(e.extensions !== undefined && { extensions: e.extensions }),
        })
      );
      const message = gqlErrors?.map((e) => e.message).join('; ') ?? err.message;
      logger.error('nerdgraph request failed', { message, errors: gqlErrors });
      throw new NerdGraphError(message, gqlErrors);
    }
    throw err;
  } finally {
    clearTimeout(timer);
    logger.debug('nerdgraph request completed', { ms: Date.now() - start });
  }
}
