import { GraphQLClient, ClientError } from 'graphql-request';
import { CONFIG } from './config.js';
import { NerdGraphError } from './errors.js';
import { logger } from './logger.js';

const REQUEST_TIMEOUT_MS = 30_000;

const gqlClient = new GraphQLClient(CONFIG.NERDGRAPH_ENDPOINT, {
  headers: {
    'API-Key': CONFIG.NEW_RELIC_API_KEY,
    'Content-Type': 'application/json',
  },
});

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
      const gqlErrors = err.response?.errors;
      const message =
        gqlErrors?.map((e: { message: string }) => e.message).join('; ') ?? err.message;
      logger.error('nerdgraph request failed', { message, errors: gqlErrors });
      throw new NerdGraphError(message, gqlErrors as unknown[]);
    }
    throw err;
  } finally {
    clearTimeout(timer);
    logger.debug('nerdgraph request completed', { ms: Date.now() - start });
  }
}
