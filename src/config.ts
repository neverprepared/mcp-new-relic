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
if (isNaN(accountId) || accountId <= 0) {
  throw new ConfigError(`NEW_RELIC_ACCOUNT_ID must be a positive integer, got: ${accountIdStr}`);
}

const region = process.env['NEW_RELIC_REGION'];
const NERDGRAPH_ENDPOINT =
  region?.toUpperCase() === 'EU'
    ? 'https://api.eu.newrelic.com/graphql'
    : 'https://api.newrelic.com/graphql';

export const CONFIG = {
  NEW_RELIC_API_KEY: apiKey,
  NEW_RELIC_ACCOUNT_ID: accountId,
  NERDGRAPH_ENDPOINT,
} as const;
