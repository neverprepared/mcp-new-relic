import { ConfigError } from './errors.js';

const apiKey = process.env['NEW_RELIC_API_KEY'];
const accountIdStr = process.env['NEW_RELIC_ACCOUNT_ID'];

if (!apiKey) {
  throw new ConfigError('NEW_RELIC_API_KEY environment variable is required');
}
if (!accountIdStr) {
  throw new ConfigError('NEW_RELIC_ACCOUNT_ID environment variable is required');
}

const accountId = parseInt(accountIdStr, 10);
if (isNaN(accountId)) {
  throw new ConfigError(`NEW_RELIC_ACCOUNT_ID must be a valid integer, got: ${accountIdStr}`);
}

export const CONFIG = {
  NEW_RELIC_API_KEY: apiKey,
  NEW_RELIC_ACCOUNT_ID: accountId,
  NERDGRAPH_ENDPOINT: 'https://api.newrelic.com/graphql',
} as const;
