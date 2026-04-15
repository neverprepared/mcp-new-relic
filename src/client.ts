import { GraphQLClient, ClientError } from 'graphql-request';
import { CONFIG } from './config.js';
import { NerdGraphError } from './errors.js';
import { logger } from './logger.js';

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
  try {
    const result = await gqlClient.request<T>(document, variables);
    logger.debug('nerdgraph request completed', { ms: Date.now() - start });
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
  }
}
