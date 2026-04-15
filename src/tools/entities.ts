import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { nerdgraph } from '../client.js';
import { acct, handle, jsonResult, listResponse } from './utils.js';
import {
  ACCOUNTS_LIST_QUERY,
  ENTITY_SEARCH_QUERY,
  ENTITY_GET_QUERY,
  ENTITY_TAGS_ADD_MUTATION,
  ENTITY_TAGS_DELETE_MUTATION,
  ENTITY_TAGS_REPLACE_MUTATION,
  NRQL_QUERY,
  DEPLOYMENT_RECORD_MUTATION,
  DEPLOYMENT_LIST_QUERY,
} from '../queries/entities.js';

// ─── Schemas ────────────────────────────────────────────────────────────────

const EntitySearchSchema = z.object({
  name: z.string().optional(),
  type: z.string().optional(),
  domain: z.string().optional(),
  accountId: z.number().int().optional(),
  tags: z.record(z.string()).optional(),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(200).optional(),
});

const EntityGetSchema = z.object({ guid: z.string() });

const TagInputSchema = z.object({
  key: z.string(),
  values: z.array(z.string()),
});

const EntityTagsAddSchema = z.object({
  guid: z.string(),
  tags: z.array(TagInputSchema),
});

const EntityTagsDeleteSchema = z.object({
  guid: z.string(),
  tagKeys: z.array(z.string()),
});

const EntityTagsReplaceSchema = z.object({
  guid: z.string(),
  tags: z.array(TagInputSchema),
});

const NrqlQuerySchema = z.object({
  accountId: z.number().int().optional(),
  query: z.string(),
  timeout: z.number().int().optional(),
});

const DeploymentRecordSchema = z.object({
  entityGuid: z.string(),
  version: z.string(),
  changelog: z.string().optional(),
  description: z.string().optional(),
  deploymentType: z.enum(['BASIC', 'BLUE_GREEN', 'CANARY', 'OTHER', 'ROLLING', 'SHADOW']).optional(),
  user: z.string().optional(),
  timestamp: z.string().optional(),
  groupId: z.string().optional(),
});

const DeploymentListSchema = z.object({
  entityGuid: z.string(),
  limit: z.number().int().min(1).max(100).optional(),
});

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Escapes backslashes and single quotes in a string value before interpolating
 * it into a NerdGraph entity search query, preventing injection attacks.
 */
function escapeNerdGraphString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function buildEntitySearchQuery(input: z.infer<typeof EntitySearchSchema>): string {
  const parts: string[] = [];
  if (input.name) parts.push(`name LIKE '%${escapeNerdGraphString(input.name)}%'`);
  if (input.type) parts.push(`type = '${escapeNerdGraphString(input.type)}'`);
  if (input.domain) parts.push(`domain = '${escapeNerdGraphString(input.domain)}'`);
  if (input.accountId !== undefined) parts.push(`accountId = ${input.accountId}`);
  if (input.tags) {
    for (const [k, v] of Object.entries(input.tags)) {
      parts.push(`tags.${escapeNerdGraphString(k)} = '${escapeNerdGraphString(v)}'`);
    }
  }
  return parts.length > 0 ? parts.join(' AND ') : "name LIKE '%'";
}

// ─── Handlers ───────────────────────────────────────────────────────────────

async function handleAccountsList(_args: unknown): Promise<CallToolResult> {
  return handle(z.object({}), _args, async () => {
    const data = await nerdgraph<{ actor: { accounts: { id: number; name: string }[] } }>(
      ACCOUNTS_LIST_QUERY
    );
    const accounts = data.actor.accounts;
    const lines = accounts.map((a) => `  [${a.id}] ${a.name}`).join('\n');
    const text =
      `Found ${accounts.length} accessible accounts:\n\n${lines}\n\n` +
      'Pass any account ID to other tools via the "accountId" parameter to target that account.';
    return { content: [{ type: 'text', text }] };
  });
}

async function handleEntitySearch(args: unknown): Promise<CallToolResult> {
  return handle(EntitySearchSchema, args, async (input) => {
    const query = buildEntitySearchQuery(input);
    const data = await nerdgraph<{
      actor: {
        entitySearch: {
          results: { entities: unknown[]; nextCursor: string | null };
          count: number;
        };
      };
    }>(ENTITY_SEARCH_QUERY, { query, cursor: input.cursor ?? null, limit: input.limit ?? 25 });
    const { entities, nextCursor } = data.actor.entitySearch.results;
    return listResponse(entities, data.actor.entitySearch.count, nextCursor, 'entities');
  });
}

async function handleEntityGet(args: unknown): Promise<CallToolResult> {
  return handle(EntityGetSchema, args, async ({ guid }) => {
    const data = await nerdgraph<{ actor: { entity: unknown } }>(ENTITY_GET_QUERY, { guid });
    return jsonResult(data.actor.entity);
  });
}

async function handleEntityTagsAdd(args: unknown): Promise<CallToolResult> {
  return handle(EntityTagsAddSchema, args, async ({ guid, tags }) => {
    const data = await nerdgraph<{
      taggingAddTagsToEntity: { errors: { message: string; type: string }[] };
    }>(ENTITY_TAGS_ADD_MUTATION, { guid, tags });
    const { errors } = data.taggingAddTagsToEntity;
    if (errors && errors.length > 0) {
      return { content: [{ type: 'text', text: `Errors: ${errors.map((e) => e.message).join('; ')}` }], isError: true };
    }
    return { content: [{ type: 'text', text: `Tags successfully added to entity ${guid}.` }] };
  });
}

async function handleEntityTagsDelete(args: unknown): Promise<CallToolResult> {
  return handle(EntityTagsDeleteSchema, args, async ({ guid, tagKeys }) => {
    const data = await nerdgraph<{
      taggingDeleteTagFromEntity: { errors: { message: string; type: string }[] };
    }>(ENTITY_TAGS_DELETE_MUTATION, { guid, tagKeys });
    const { errors } = data.taggingDeleteTagFromEntity;
    if (errors && errors.length > 0) {
      return { content: [{ type: 'text', text: `Errors: ${errors.map((e) => e.message).join('; ')}` }], isError: true };
    }
    return { content: [{ type: 'text', text: `Tag keys [${tagKeys.join(', ')}] deleted from entity ${guid}.` }] };
  });
}

async function handleEntityTagsReplace(args: unknown): Promise<CallToolResult> {
  return handle(EntityTagsReplaceSchema, args, async ({ guid, tags }) => {
    const data = await nerdgraph<{
      taggingReplaceTagsOnEntity: { errors: { message: string; type: string }[] };
    }>(ENTITY_TAGS_REPLACE_MUTATION, { guid, tags });
    const { errors } = data.taggingReplaceTagsOnEntity;
    if (errors && errors.length > 0) {
      return { content: [{ type: 'text', text: `Errors: ${errors.map((e) => e.message).join('; ')}` }], isError: true };
    }
    return { content: [{ type: 'text', text: `Tags replaced on entity ${guid}.` }] };
  });
}

async function handleNrqlQuery(args: unknown): Promise<CallToolResult> {
  return handle(NrqlQuerySchema, args, async (input) => {
    const data = await nerdgraph<{
      actor: {
        account: {
          nrql: { results: unknown[]; metadata: unknown; totalResult: unknown };
        };
      };
    }>(NRQL_QUERY, {
      accountId: acct(input),
      query: input.query,
      timeout: input.timeout ?? null,
    });
    const { results, metadata, totalResult } = data.actor.account.nrql;
    let text = `NRQL Results (${results.length} rows):\n\n${JSON.stringify(results, null, 2)}`;
    text += `\n\nMetadata:\n${JSON.stringify(metadata, null, 2)}`;
    if (totalResult != null) text += `\n\nTotal: ${JSON.stringify(totalResult)}`;
    return { content: [{ type: 'text', text }] };
  });
}

async function handleDeploymentRecord(args: unknown): Promise<CallToolResult> {
  return handle(DeploymentRecordSchema, args, async (input) => {
    const deployment: Record<string, unknown> = {
      entityGuid: input.entityGuid,
      version: input.version,
      ...(input.changelog !== undefined && { changelog: input.changelog }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.deploymentType !== undefined && { deploymentType: input.deploymentType }),
      ...(input.user !== undefined && { user: input.user }),
      ...(input.timestamp !== undefined && { timestamp: input.timestamp }),
      ...(input.groupId !== undefined && { groupId: input.groupId }),
    };
    const data = await nerdgraph<{ changeTrackingCreateDeployment: unknown }>(
      DEPLOYMENT_RECORD_MUTATION,
      { deployment }
    );
    return jsonResult(data.changeTrackingCreateDeployment, 'Deployment recorded');
  });
}

async function handleDeploymentList(args: unknown): Promise<CallToolResult> {
  return handle(DeploymentListSchema, args, async (input) => {
    const data = await nerdgraph<{ actor: { entity: unknown } }>(DEPLOYMENT_LIST_QUERY, {
      guid: input.entityGuid,
      limit: input.limit ?? 25,
    });
    return jsonResult(data.actor.entity);
  });
}

// ─── Tool Definitions ────────────────────────────────────────────────────────

export const entityToolDefinitions = [
  {
    name: 'newrelic_accounts_list',
    description: "List all New Relic accounts accessible with the current API key. Use the returned account IDs with other tools' \"accountId\" parameter to operate across multiple accounts.",
    inputSchema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'newrelic_entity_search',
    description: 'Search for New Relic entities by name, type, domain, account, or tags. Returns GUIDs and metadata.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Filter by name substring' },
        type: { type: 'string', description: 'Entity type (e.g. APPLICATION, MONITOR, DASHBOARD, HOST)' },
        domain: { type: 'string', description: 'Entity domain (e.g. APM, SYNTH, INFRA, BROWSER)' },
        accountId: { type: 'number', description: 'Account ID filter' },
        tags: { type: 'object', description: 'Key-value tag filters', additionalProperties: { type: 'string' } },
        cursor: { type: 'string', description: 'Pagination cursor from previous response' },
        limit: { type: 'number', description: 'Max results per page (1–200, default 25)' },
      },
    },
  },
  {
    name: 'newrelic_entity_get',
    description: 'Get full details of a New Relic entity by its GUID, including tags and type-specific fields.',
    inputSchema: {
      type: 'object' as const,
      properties: { guid: { type: 'string', description: 'Entity GUID' } },
      required: ['guid'],
    },
  },
  {
    name: 'newrelic_entity_tags_add',
    description: 'Add tags to a New Relic entity. Tags are key-value pairs used for grouping and filtering.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        guid: { type: 'string', description: 'Entity GUID' },
        tags: {
          type: 'array',
          description: 'Tags to add',
          items: {
            type: 'object',
            properties: {
              key: { type: 'string' },
              values: { type: 'array', items: { type: 'string' } },
            },
            required: ['key', 'values'],
          },
        },
      },
      required: ['guid', 'tags'],
    },
  },
  {
    name: 'newrelic_entity_tags_delete',
    description: 'Delete tag keys from a New Relic entity.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        guid: { type: 'string', description: 'Entity GUID' },
        tagKeys: { type: 'array', items: { type: 'string' }, description: 'Tag keys to delete' },
      },
      required: ['guid', 'tagKeys'],
    },
  },
  {
    name: 'newrelic_entity_tags_replace',
    description: 'Replace all tags on a New Relic entity with a new set of tags.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        guid: { type: 'string', description: 'Entity GUID' },
        tags: {
          type: 'array',
          description: 'New complete set of tags',
          items: {
            type: 'object',
            properties: {
              key: { type: 'string' },
              values: { type: 'array', items: { type: 'string' } },
            },
            required: ['key', 'values'],
          },
        },
      },
      required: ['guid', 'tags'],
    },
  },
  {
    name: 'newrelic_nrql_query',
    description: 'Execute a NRQL (New Relic Query Language) query and return the results.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'NRQL query string (e.g. SELECT count(*) FROM Transaction SINCE 1 hour ago)' },
        accountId: { type: 'number', description: 'Account ID (uses env default if omitted)' },
        timeout: { type: 'number', description: 'Query timeout in seconds (max 120)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'newrelic_deployment_record',
    description: 'Record a deployment (change tracking) event for a New Relic entity. Appears as a marker on charts.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        entityGuid: { type: 'string', description: 'Entity GUID to associate the deployment with' },
        version: { type: 'string', description: 'Version/build number being deployed' },
        changelog: { type: 'string', description: 'Changelog or commit message' },
        description: { type: 'string', description: 'Human-readable description of the change' },
        deploymentType: {
          type: 'string',
          enum: ['BASIC', 'BLUE_GREEN', 'CANARY', 'OTHER', 'ROLLING', 'SHADOW'],
          description: 'Type of deployment',
        },
        user: { type: 'string', description: 'User who triggered the deployment' },
        timestamp: { type: 'string', description: 'ISO 8601 timestamp (defaults to now)' },
        groupId: { type: 'string', description: 'Group ID to correlate multiple deployments' },
      },
      required: ['entityGuid', 'version'],
    },
  },
  {
    name: 'newrelic_deployment_list',
    description: 'List recent deployments recorded for a New Relic entity.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        entityGuid: { type: 'string', description: 'Entity GUID' },
        limit: { type: 'number', description: 'Max number of deployments to return (1-100, default 25)' },
      },
      required: ['entityGuid'],
    },
  },
];

export const entityHandlers: Record<string, (args: unknown) => Promise<CallToolResult>> = {
  newrelic_accounts_list: handleAccountsList,
  newrelic_entity_search: handleEntitySearch,
  newrelic_entity_get: handleEntityGet,
  newrelic_entity_tags_add: handleEntityTagsAdd,
  newrelic_entity_tags_delete: handleEntityTagsDelete,
  newrelic_entity_tags_replace: handleEntityTagsReplace,
  newrelic_nrql_query: handleNrqlQuery,
  newrelic_deployment_record: handleDeploymentRecord,
  newrelic_deployment_list: handleDeploymentList,
};
