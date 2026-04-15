import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { nerdgraph } from '../client.js';
import { acct, handle, listResponse, mutationErrorResult } from './utils.js';
import {
  DASHBOARDS_LIST_QUERY,
  DASHBOARD_GET_QUERY,
  DASHBOARD_CREATE_MUTATION,
  DASHBOARD_UPDATE_MUTATION,
  DASHBOARD_DELETE_MUTATION,
} from '../queries/dashboards.js';

// ─── Schemas ────────────────────────────────────────────────────────────────

const DashboardListSchema = z.object({
  cursor: z.string().optional(),
});

const DashboardGetSchema = z.object({ guid: z.string() });

const WidgetLayoutSchema = z.object({
  row: z.number().int(),
  column: z.number().int(),
  height: z.number().int(),
  width: z.number().int(),
});

const DashboardWidgetSchema = z.object({
  title: z.string(),
  layout: WidgetLayoutSchema,
  rawConfiguration: z.record(z.unknown()),
});

const DashboardPageSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  widgets: z.array(DashboardWidgetSchema).optional(),
});

const DashboardCreateSchema = z.object({
  accountId: z.number().int().optional(),
  name: z.string(),
  description: z.string().optional(),
  permissions: z.enum(['PUBLIC_READ_WRITE', 'PUBLIC_READ_ONLY', 'PRIVATE']).default('PUBLIC_READ_WRITE'),
  pages: z.array(DashboardPageSchema).optional(),
});

const DashboardUpdateSchema = z.object({
  guid: z.string(),
  name: z.string(),
  description: z.string().optional(),
  permissions: z.enum(['PUBLIC_READ_WRITE', 'PUBLIC_READ_ONLY', 'PRIVATE']).default('PUBLIC_READ_WRITE'),
  pages: z.array(DashboardPageSchema).optional(),
});

const DashboardDeleteSchema = z.object({ guid: z.string() });

// ─── Handlers ───────────────────────────────────────────────────────────────

async function handleDashboardList(args: unknown): Promise<CallToolResult> {
  return handle(DashboardListSchema, args, async (input) => {
    const data = await nerdgraph<{
      actor: {
        entitySearch: {
          results: { entities: unknown[]; nextCursor: string | null };
          count: number;
        };
      };
    }>(DASHBOARDS_LIST_QUERY, { cursor: input.cursor ?? null });
    const { entities, nextCursor } = data.actor.entitySearch.results;
    return listResponse(entities, data.actor.entitySearch.count, nextCursor, 'dashboards');
  });
}

async function handleDashboardGet(args: unknown): Promise<CallToolResult> {
  return handle(DashboardGetSchema, args, async ({ guid }) => {
    const data = await nerdgraph<{ actor: { entity: unknown } }>(DASHBOARD_GET_QUERY, { guid });
    return { content: [{ type: 'text', text: JSON.stringify(data.actor.entity, null, 2) }] };
  });
}

async function handleDashboardCreate(args: unknown): Promise<CallToolResult> {
  return handle(DashboardCreateSchema, args, async (input) => {
    const dashboard = {
      name: input.name,
      permissions: input.permissions,
      ...(input.description !== undefined && { description: input.description }),
      ...(input.pages !== undefined && { pages: input.pages }),
    };
    const data = await nerdgraph<{
      dashboardCreate: {
        entityResult: { guid: string; name: string; createdAt: string; updatedAt: string } | null;
        errors: { description: string; type: string }[];
      };
    }>(DASHBOARD_CREATE_MUTATION, { accountId: acct(input), dashboard });
    const errCheck = mutationErrorResult(data.dashboardCreate.errors, 'Dashboard create');
    if (errCheck) return errCheck;
    return { content: [{ type: 'text', text: `Dashboard created:\n\n${JSON.stringify(data.dashboardCreate.entityResult, null, 2)}` }] };
  });
}

async function handleDashboardUpdate(args: unknown): Promise<CallToolResult> {
  return handle(DashboardUpdateSchema, args, async (input) => {
    const dashboard = {
      name: input.name,
      permissions: input.permissions,
      ...(input.description !== undefined && { description: input.description }),
      ...(input.pages !== undefined && { pages: input.pages }),
    };
    const data = await nerdgraph<{
      dashboardUpdate: {
        entityResult: { guid: string; name: string; updatedAt: string } | null;
        errors: { description: string; type: string }[];
      };
    }>(DASHBOARD_UPDATE_MUTATION, { guid: input.guid, dashboard });
    const errCheck = mutationErrorResult(data.dashboardUpdate.errors, 'Dashboard update');
    if (errCheck) return errCheck;
    return { content: [{ type: 'text', text: `Dashboard updated:\n\n${JSON.stringify(data.dashboardUpdate.entityResult, null, 2)}` }] };
  });
}

async function handleDashboardDelete(args: unknown): Promise<CallToolResult> {
  return handle(DashboardDeleteSchema, args, async ({ guid }) => {
    const data = await nerdgraph<{
      dashboardDelete: { status: string; errors: { description: string; type: string }[] };
    }>(DASHBOARD_DELETE_MUTATION, { guid });
    const errCheck = mutationErrorResult(data.dashboardDelete.errors, 'Dashboard delete');
    if (errCheck) return errCheck;
    return { content: [{ type: 'text', text: `Dashboard ${guid} deleted. Status: ${data.dashboardDelete.status}` }] };
  });
}

// ─── Tool Definitions ────────────────────────────────────────────────────────

export const dashboardToolDefinitions = [
  {
    name: 'newrelic_dashboard_list',
    description: 'List all dashboards in the New Relic account.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        cursor: { type: 'string', description: 'Pagination cursor from previous response' },
      },
    },
  },
  {
    name: 'newrelic_dashboard_get',
    description: 'Get full details of a New Relic dashboard by GUID, including all pages and widgets.',
    inputSchema: {
      type: 'object' as const,
      properties: { guid: { type: 'string', description: 'Dashboard entity GUID' } },
      required: ['guid'],
    },
  },
  {
    name: 'newrelic_dashboard_create',
    description: 'Create a new New Relic dashboard with optional pages and widgets.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Dashboard name' },
        accountId: { type: 'number', description: 'Account ID (uses env default if omitted)' },
        description: { type: 'string', description: 'Dashboard description' },
        permissions: {
          type: 'string',
          enum: ['PUBLIC_READ_WRITE', 'PUBLIC_READ_ONLY', 'PRIVATE'],
          description: 'Dashboard visibility permissions (default: PUBLIC_READ_WRITE)',
        },
        pages: {
          type: 'array',
          description: 'Dashboard pages',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              description: { type: 'string' },
              widgets: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    layout: {
                      type: 'object',
                      properties: {
                        row: { type: 'number' },
                        column: { type: 'number' },
                        height: { type: 'number' },
                        width: { type: 'number' },
                      },
                      required: ['row', 'column', 'height', 'width'],
                    },
                    rawConfiguration: { type: 'object', description: 'Widget configuration JSON' },
                  },
                  required: ['title', 'layout', 'rawConfiguration'],
                },
              },
            },
            required: ['name'],
          },
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'newrelic_dashboard_update',
    description: 'Update an existing New Relic dashboard. Provide the full desired state (name, pages, widgets).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        guid: { type: 'string', description: 'Dashboard entity GUID' },
        name: { type: 'string', description: 'New dashboard name' },
        description: { type: 'string', description: 'New description' },
        permissions: {
          type: 'string',
          enum: ['PUBLIC_READ_WRITE', 'PUBLIC_READ_ONLY', 'PRIVATE'],
        },
        pages: {
          type: 'array',
          description: 'Updated pages (replaces existing)',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              description: { type: 'string' },
              widgets: { type: 'array', items: { type: 'object' } },
            },
            required: ['name'],
          },
        },
      },
      required: ['guid', 'name'],
    },
  },
  {
    name: 'newrelic_dashboard_delete',
    description: 'Permanently delete a New Relic dashboard by GUID.',
    inputSchema: {
      type: 'object' as const,
      properties: { guid: { type: 'string', description: 'Dashboard entity GUID' } },
      required: ['guid'],
    },
  },
];

export const dashboardHandlers: Record<string, (args: unknown) => Promise<CallToolResult>> = {
  newrelic_dashboard_list: handleDashboardList,
  newrelic_dashboard_get: handleDashboardGet,
  newrelic_dashboard_create: handleDashboardCreate,
  newrelic_dashboard_update: handleDashboardUpdate,
  newrelic_dashboard_delete: handleDashboardDelete,
};
