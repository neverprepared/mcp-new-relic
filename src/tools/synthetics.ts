import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { nerdgraph } from '../client.js';
import { acct, handle, jsonResult, listResponse, mutationErrorResult } from './utils.js';
import {
  SYNTHETIC_MONITORS_LIST_QUERY,
  SYNTHETIC_MONITOR_GET_QUERY,
  SYNTHETIC_SIMPLE_MONITOR_CREATE_MUTATION,
  SYNTHETIC_SCRIPTED_BROWSER_MONITOR_CREATE_MUTATION,
  SYNTHETIC_SCRIPTED_API_MONITOR_CREATE_MUTATION,
  SYNTHETIC_SIMPLE_MONITOR_UPDATE_MUTATION,
  SYNTHETIC_SCRIPTED_BROWSER_MONITOR_UPDATE_MUTATION,
  SYNTHETIC_SCRIPTED_API_MONITOR_UPDATE_MUTATION,
  SYNTHETIC_MONITOR_DELETE_MUTATION,
  SYNTHETIC_PRIVATE_LOCATIONS_QUERY,
  SYNTHETIC_SECURE_CREDENTIAL_LIST_QUERY,
  SYNTHETIC_SECURE_CREDENTIAL_CREATE_MUTATION,
  SYNTHETIC_SECURE_CREDENTIAL_DELETE_MUTATION,
} from '../queries/synthetics.js';

// ─── Schemas ────────────────────────────────────────────────────────────────

const PeriodEnum = z.enum([
  'EVERY_MINUTE', 'EVERY_5_MINUTES', 'EVERY_10_MINUTES', 'EVERY_15_MINUTES',
  'EVERY_30_MINUTES', 'EVERY_HOUR', 'EVERY_6_HOURS', 'EVERY_12_HOURS', 'EVERY_DAY',
]);

const StatusEnum = z.enum(['ENABLED', 'DISABLED', 'MUTED']);

const LocationsSchema = z.object({
  public: z.array(z.string()).optional(),
  private: z.array(z.string()).optional(),
});

const LocationsRequiredSchema = LocationsSchema.refine(
  (loc) => (loc.public?.length ?? 0) + (loc.private?.length ?? 0) > 0,
  { message: 'At least one location (public or private) is required' }
);

const SyntheticMonitorsListSchema = z.object({ cursor: z.string().optional() });
const SyntheticMonitorGetSchema = z.object({ guid: z.string() });

const SyntheticSimpleMonitorCreateSchema = z.object({
  accountId: z.number().int().optional(),
  name: z.string(),
  uri: z.string(),
  period: PeriodEnum,
  status: StatusEnum,
  locations: LocationsRequiredSchema,
  validationString: z.string().optional(),
  verifySsl: z.boolean().optional(),
  bypassHeadRequest: z.boolean().optional(),
  treatRedirectAsFailure: z.boolean().optional(),
  runtimeType: z.string().optional(),
  runtimeTypeVersion: z.string().optional(),
});

const SyntheticScriptedMonitorCreateSchema = z.object({
  accountId: z.number().int().optional(),
  name: z.string(),
  script: z.string(),
  scriptLanguage: z.string().optional(),
  period: PeriodEnum,
  status: StatusEnum,
  locations: LocationsRequiredSchema,
  type: z.enum(['SCRIPT_BROWSER', 'SCRIPT_API']),
  runtimeType: z.string().optional(),
  runtimeTypeVersion: z.string().optional(),
});

const SyntheticSimpleMonitorUpdateSchema = z.object({
  guid: z.string(),
  name: z.string().optional(),
  uri: z.string().optional(),
  period: PeriodEnum.optional(),
  status: StatusEnum.optional(),
  locations: LocationsSchema.optional(),
  validationString: z.string().optional(),
  verifySsl: z.boolean().optional(),
  bypassHeadRequest: z.boolean().optional(),
  treatRedirectAsFailure: z.boolean().optional(),
});

const SyntheticScriptedMonitorUpdateSchema = z.object({
  guid: z.string(),
  type: z.enum(['SCRIPT_BROWSER', 'SCRIPT_API']),
  name: z.string().optional(),
  script: z.string().optional(),
  period: PeriodEnum.optional(),
  status: StatusEnum.optional(),
  locations: LocationsSchema.optional(),
});

const SyntheticMonitorDeleteSchema = z.object({ guid: z.string() });

const SyntheticPrivateLocationsSchema = z.object({ accountId: z.number().int().optional() });

const SyntheticSecureCredentialListSchema = z.object({
  accountId: z.number().int().optional(),
  cursor: z.string().optional(),
});

const SyntheticSecureCredentialCreateSchema = z.object({
  accountId: z.number().int().optional(),
  key: z.string(),
  value: z.string(),
  description: z.string().optional(),
});

const SyntheticSecureCredentialDeleteSchema = z.object({
  accountId: z.number().int().optional(),
  key: z.string(),
});

// ─── Helpers ────────────────────────────────────────────────────────────────

type SyntheticsResult = {
  monitor: { guid: string; name: string; status: string; period: string } | null;
  errors: { description: string; type: string }[];
};

function buildAdvancedOptions(input: {
  validationString?: string;
  verifySsl?: boolean;
  bypassHeadRequest?: boolean;
  treatRedirectAsFailure?: boolean;
}): Record<string, unknown> | undefined {
  const opts: Record<string, unknown> = {};
  if (input.validationString !== undefined) opts['responseValidationText'] = input.validationString;
  if (input.verifySsl !== undefined) opts['useTlsValidation'] = input.verifySsl;
  if (input.bypassHeadRequest !== undefined) opts['bypassHeadRequest'] = input.bypassHeadRequest;
  if (input.treatRedirectAsFailure !== undefined) opts['treatRedirectAsFailure'] = input.treatRedirectAsFailure;
  return Object.keys(opts).length > 0 ? opts : undefined;
}

function base64Script(script: string): { scriptText: string } {
  return { scriptText: Buffer.from(script).toString('base64') };
}

// ─── Handlers ───────────────────────────────────────────────────────────────

async function handleSyntheticMonitorList(args: unknown): Promise<CallToolResult> {
  return handle(SyntheticMonitorsListSchema, args, async (input) => {
    const data = await nerdgraph<{
      actor: { entitySearch: { results: { entities: unknown[]; nextCursor: string | null }; count: number } };
    }>(SYNTHETIC_MONITORS_LIST_QUERY, { cursor: input.cursor ?? null });
    const { entities, nextCursor } = data.actor.entitySearch.results;
    return listResponse(entities, data.actor.entitySearch.count, nextCursor, 'synthetic monitors');
  });
}

async function handleSyntheticMonitorGet(args: unknown): Promise<CallToolResult> {
  return handle(SyntheticMonitorGetSchema, args, async ({ guid }) => {
    const data = await nerdgraph<{ actor: { entity: unknown } }>(SYNTHETIC_MONITOR_GET_QUERY, { guid });
    return jsonResult(data.actor.entity);
  });
}

async function handleSyntheticSimpleMonitorCreate(args: unknown): Promise<CallToolResult> {
  return handle(SyntheticSimpleMonitorCreateSchema, args, async (input) => {
    const monitor: Record<string, unknown> = {
      name: input.name,
      uri: input.uri,
      period: input.period,
      status: input.status,
      locations: input.locations,
    };
    const advancedOptions = buildAdvancedOptions(input);
    if (advancedOptions) monitor['advancedOptions'] = advancedOptions;
    if (input.runtimeType !== undefined) {
      monitor['runtime'] = { runtimeType: input.runtimeType, runtimeTypeVersion: input.runtimeTypeVersion ?? '' };
    }
    const data = await nerdgraph<{ syntheticsCreateSimpleBrowserMonitor: SyntheticsResult }>(
      SYNTHETIC_SIMPLE_MONITOR_CREATE_MUTATION,
      { accountId: acct(input), monitor }
    );
    const errCheck = mutationErrorResult(data.syntheticsCreateSimpleBrowserMonitor.errors, 'Synthetics');
    if (errCheck) return errCheck;
    return jsonResult(data.syntheticsCreateSimpleBrowserMonitor.monitor, 'Simple browser monitor created');
  });
}

async function handleSyntheticScriptedMonitorCreate(args: unknown): Promise<CallToolResult> {
  return handle(SyntheticScriptedMonitorCreateSchema, args, async (input) => {
    const monitor: Record<string, unknown> = {
      name: input.name,
      period: input.period,
      status: input.status,
      locations: input.locations,
      script: base64Script(input.script),
      ...(input.scriptLanguage !== undefined && { scriptLanguage: input.scriptLanguage }),
      ...(input.runtimeType !== undefined && {
        runtime: { runtimeType: input.runtimeType, runtimeTypeVersion: input.runtimeTypeVersion ?? '' },
      }),
    };

    if (input.type === 'SCRIPT_BROWSER') {
      const data = await nerdgraph<{ syntheticsCreateScriptBrowserMonitor: SyntheticsResult }>(
        SYNTHETIC_SCRIPTED_BROWSER_MONITOR_CREATE_MUTATION,
        { accountId: acct(input), monitor }
      );
      const errCheck = mutationErrorResult(data.syntheticsCreateScriptBrowserMonitor.errors, 'Synthetics');
      if (errCheck) return errCheck;
      return jsonResult(data.syntheticsCreateScriptBrowserMonitor.monitor, 'Scripted browser monitor created');
    } else {
      const data = await nerdgraph<{ syntheticsCreateScriptApiMonitor: SyntheticsResult }>(
        SYNTHETIC_SCRIPTED_API_MONITOR_CREATE_MUTATION,
        { accountId: acct(input), monitor }
      );
      const errCheck = mutationErrorResult(data.syntheticsCreateScriptApiMonitor.errors, 'Synthetics');
      if (errCheck) return errCheck;
      return jsonResult(data.syntheticsCreateScriptApiMonitor.monitor, 'Scripted API monitor created');
    }
  });
}

async function handleSyntheticMonitorUpdate(args: unknown): Promise<CallToolResult> {
  // Determine monitor type from presence of `type` field, then dispatch.
  const raw = args as Record<string, unknown>;
  if (raw['type'] !== undefined) {
    return handle(SyntheticScriptedMonitorUpdateSchema, args, async (input) => {
      const monitor: Record<string, unknown> = {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.period !== undefined && { period: input.period }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.locations !== undefined && { locations: input.locations }),
        ...(input.script !== undefined && { script: base64Script(input.script) }),
      };
      if (input.type === 'SCRIPT_BROWSER') {
        const data = await nerdgraph<{ syntheticsUpdateScriptBrowserMonitor: SyntheticsResult }>(
          SYNTHETIC_SCRIPTED_BROWSER_MONITOR_UPDATE_MUTATION,
          { guid: input.guid, monitor }
        );
        const errCheck = mutationErrorResult(data.syntheticsUpdateScriptBrowserMonitor.errors, 'Synthetics');
        if (errCheck) return errCheck;
        return jsonResult(data.syntheticsUpdateScriptBrowserMonitor.monitor, 'Scripted browser monitor updated');
      } else {
        const data = await nerdgraph<{ syntheticsUpdateScriptApiMonitor: SyntheticsResult }>(
          SYNTHETIC_SCRIPTED_API_MONITOR_UPDATE_MUTATION,
          { guid: input.guid, monitor }
        );
        const errCheck = mutationErrorResult(data.syntheticsUpdateScriptApiMonitor.errors, 'Synthetics');
        if (errCheck) return errCheck;
        return jsonResult(data.syntheticsUpdateScriptApiMonitor.monitor, 'Scripted API monitor updated');
      }
    });
  } else {
    return handle(SyntheticSimpleMonitorUpdateSchema, args, async (input) => {
      const monitor: Record<string, unknown> = {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.uri !== undefined && { uri: input.uri }),
        ...(input.period !== undefined && { period: input.period }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.locations !== undefined && { locations: input.locations }),
      };
      const advancedOptions = buildAdvancedOptions(input);
      if (advancedOptions) monitor['advancedOptions'] = advancedOptions;
      const data = await nerdgraph<{ syntheticsUpdateSimpleBrowserMonitor: SyntheticsResult }>(
        SYNTHETIC_SIMPLE_MONITOR_UPDATE_MUTATION,
        { guid: input.guid, monitor }
      );
      const errCheck = mutationErrorResult(data.syntheticsUpdateSimpleBrowserMonitor.errors, 'Synthetics');
      if (errCheck) return errCheck;
      return jsonResult(data.syntheticsUpdateSimpleBrowserMonitor.monitor, 'Simple browser monitor updated');
    });
  }
}

async function handleSyntheticMonitorDelete(args: unknown): Promise<CallToolResult> {
  return handle(SyntheticMonitorDeleteSchema, args, async ({ guid }) => {
    const data = await nerdgraph<{ syntheticsDeleteMonitor: { deletedGuid: string } }>(
      SYNTHETIC_MONITOR_DELETE_MUTATION,
      { guid }
    );
    return { content: [{ type: 'text', text: `Synthetic monitor deleted. GUID: ${data.syntheticsDeleteMonitor.deletedGuid}` }] };
  });
}

async function handleSyntheticPrivateLocationList(args: unknown): Promise<CallToolResult> {
  return handle(SyntheticPrivateLocationsSchema, args, async (input) => {
    const data = await nerdgraph<{
      actor: { account: { synthetics: { privateLocations: unknown[] } } };
    }>(SYNTHETIC_PRIVATE_LOCATIONS_QUERY, { accountId: acct(input) });
    const { privateLocations } = data.actor.account.synthetics;
    return listResponse(privateLocations, null, null, 'private locations');
  });
}

async function handleSyntheticSecureCredentialList(args: unknown): Promise<CallToolResult> {
  return handle(SyntheticSecureCredentialListSchema, args, async (input) => {
    const data = await nerdgraph<{
      actor: { account: { synthetics: { secureCredentials: { secureCredentials: unknown[]; nextCursor: string | null } } } };
    }>(SYNTHETIC_SECURE_CREDENTIAL_LIST_QUERY, { accountId: acct(input), cursor: input.cursor ?? null });
    const { secureCredentials, nextCursor } = data.actor.account.synthetics.secureCredentials;
    return listResponse(secureCredentials, null, nextCursor, 'secure credentials');
  });
}

async function handleSyntheticSecureCredentialCreate(args: unknown): Promise<CallToolResult> {
  return handle(SyntheticSecureCredentialCreateSchema, args, async (input) => {
    const secureCredential = {
      key: input.key,
      value: input.value,
      ...(input.description !== undefined && { description: input.description }),
    };
    const data = await nerdgraph<{
      syntheticsUpsertSecureCredential: { errors: { description: string; type: string }[] };
    }>(SYNTHETIC_SECURE_CREDENTIAL_CREATE_MUTATION, { accountId: acct(input), secureCredential });
    const errCheck = mutationErrorResult(data.syntheticsUpsertSecureCredential.errors, 'Synthetics');
    if (errCheck) return errCheck;
    return { content: [{ type: 'text', text: `Secure credential '${input.key}' created/updated successfully.` }] };
  });
}

async function handleSyntheticSecureCredentialDelete(args: unknown): Promise<CallToolResult> {
  return handle(SyntheticSecureCredentialDeleteSchema, args, async (input) => {
    const data = await nerdgraph<{
      syntheticsDeleteSecureCredential: { errors: { description: string; type: string }[] };
    }>(SYNTHETIC_SECURE_CREDENTIAL_DELETE_MUTATION, { accountId: acct(input), key: input.key });
    const errCheck = mutationErrorResult(data.syntheticsDeleteSecureCredential.errors, 'Synthetics');
    if (errCheck) return errCheck;
    return { content: [{ type: 'text', text: `Secure credential '${input.key}' deleted.` }] };
  });
}

// ─── Tool Definitions ────────────────────────────────────────────────────────

const periodEnum = PeriodEnum.options;

export const syntheticToolDefinitions = [
  {
    name: 'newrelic_synthetic_monitor_list',
    description: 'List all synthetic monitors.',
    inputSchema: {
      type: 'object' as const,
      properties: { cursor: { type: 'string', description: 'Pagination cursor' } },
    },
  },
  {
    name: 'newrelic_synthetic_monitor_get',
    description: 'Get full details of a synthetic monitor by entity GUID.',
    inputSchema: {
      type: 'object' as const,
      properties: { guid: { type: 'string', description: 'Monitor entity GUID' } },
      required: ['guid'],
    },
  },
  {
    name: 'newrelic_synthetic_monitor_create_simple',
    description: 'Create a simple browser (ping/HTTP) synthetic monitor.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Monitor name' },
        uri: { type: 'string', description: 'URL to monitor' },
        period: { type: 'string', enum: periodEnum, description: 'Check frequency' },
        status: { type: 'string', enum: ['ENABLED', 'DISABLED', 'MUTED'] },
        locations: {
          type: 'object',
          properties: {
            public: { type: 'array', items: { type: 'string' }, description: 'Public location labels (e.g. AWS_US_EAST_1)' },
            private: { type: 'array', items: { type: 'string' }, description: 'Private location GUIDs' },
          },
        },
        validationString: { type: 'string', description: 'String that must appear in response body' },
        verifySsl: { type: 'boolean', description: 'Verify SSL certificate' },
        bypassHeadRequest: { type: 'boolean', description: 'Skip HEAD request; use GET directly' },
        treatRedirectAsFailure: { type: 'boolean', description: 'Treat HTTP redirects as failures' },
        accountId: { type: 'number', description: 'Account ID (uses env default if omitted)' },
        runtimeType: { type: 'string', description: 'e.g. CHROME_BROWSER' },
        runtimeTypeVersion: { type: 'string', description: 'e.g. 100' },
      },
      required: ['name', 'uri', 'period', 'status', 'locations'],
    },
  },
  {
    name: 'newrelic_synthetic_monitor_create_scripted',
    description: 'Create a scripted browser or scripted API synthetic monitor.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Monitor name' },
        type: {
          type: 'string',
          enum: ['SCRIPT_BROWSER', 'SCRIPT_API'],
          description: 'Monitor type: SCRIPT_BROWSER for browser automation, SCRIPT_API for HTTP/API testing',
        },
        script: { type: 'string', description: 'JavaScript script content (plain text, not base64)' },
        period: { type: 'string', enum: periodEnum },
        status: { type: 'string', enum: ['ENABLED', 'DISABLED', 'MUTED'] },
        locations: {
          type: 'object',
          properties: {
            public: { type: 'array', items: { type: 'string' } },
            private: { type: 'array', items: { type: 'string' } },
          },
        },
        accountId: { type: 'number', description: 'Account ID (uses env default if omitted)' },
        runtimeType: { type: 'string' },
        runtimeTypeVersion: { type: 'string' },
      },
      required: ['name', 'type', 'script', 'period', 'status', 'locations'],
    },
  },
  {
    name: 'newrelic_synthetic_monitor_update',
    description: 'Update a synthetic monitor. Include "type" (SCRIPT_BROWSER or SCRIPT_API) for scripted monitors; omit for simple browser monitors.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        guid: { type: 'string', description: 'Monitor entity GUID' },
        type: { type: 'string', enum: ['SCRIPT_BROWSER', 'SCRIPT_API'], description: 'Include for scripted monitors' },
        name: { type: 'string' },
        uri: { type: 'string', description: 'For simple monitors' },
        script: { type: 'string', description: 'For scripted monitors (plain text)' },
        period: { type: 'string', enum: periodEnum },
        status: { type: 'string', enum: ['ENABLED', 'DISABLED', 'MUTED'] },
        locations: { type: 'object' },
        validationString: { type: 'string', description: 'For simple monitors: response body validation string' },
        verifySsl: { type: 'boolean', description: 'For simple monitors: verify SSL certificate' },
        bypassHeadRequest: { type: 'boolean', description: 'For simple monitors: skip HEAD request' },
        treatRedirectAsFailure: { type: 'boolean', description: 'For simple monitors: treat redirects as failures' },
      },
      required: ['guid'],
    },
  },
  {
    name: 'newrelic_synthetic_monitor_delete',
    description: 'Delete a synthetic monitor by entity GUID.',
    inputSchema: {
      type: 'object' as const,
      properties: { guid: { type: 'string', description: 'Monitor entity GUID' } },
      required: ['guid'],
    },
  },
  {
    name: 'newrelic_synthetic_private_location_list',
    description: 'List private synthetic monitoring locations available in the account.',
    inputSchema: {
      type: 'object' as const,
      properties: { accountId: { type: 'number', description: 'Account ID (uses env default if omitted)' } },
    },
  },
  {
    name: 'newrelic_synthetic_secure_credential_list',
    description: 'List secure credentials available for use in synthetic monitor scripts.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        accountId: { type: 'number', description: 'Account ID (uses env default if omitted)' },
        cursor: { type: 'string', description: 'Pagination cursor' },
      },
    },
  },
  {
    name: 'newrelic_synthetic_secure_credential_create',
    description: 'Create or update a secure credential for use in synthetic monitor scripts (referenced as $secure.KEY).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        key: { type: 'string', description: 'Credential key name' },
        value: { type: 'string', description: 'Secret value' },
        description: { type: 'string', description: 'Optional description' },
        accountId: { type: 'number', description: 'Account ID (uses env default if omitted)' },
      },
      required: ['key', 'value'],
    },
  },
  {
    name: 'newrelic_synthetic_secure_credential_delete',
    description: 'Delete a secure credential by key.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        key: { type: 'string', description: 'Credential key to delete' },
        accountId: { type: 'number', description: 'Account ID (uses env default if omitted)' },
      },
      required: ['key'],
    },
  },
];

export const syntheticHandlers: Record<string, (args: unknown) => Promise<CallToolResult>> = {
  newrelic_synthetic_monitor_list: handleSyntheticMonitorList,
  newrelic_synthetic_monitor_get: handleSyntheticMonitorGet,
  newrelic_synthetic_monitor_create_simple: handleSyntheticSimpleMonitorCreate,
  newrelic_synthetic_monitor_create_scripted: handleSyntheticScriptedMonitorCreate,
  newrelic_synthetic_monitor_update: handleSyntheticMonitorUpdate,
  newrelic_synthetic_monitor_delete: handleSyntheticMonitorDelete,
  newrelic_synthetic_private_location_list: handleSyntheticPrivateLocationList,
  newrelic_synthetic_secure_credential_list: handleSyntheticSecureCredentialList,
  newrelic_synthetic_secure_credential_create: handleSyntheticSecureCredentialCreate,
  newrelic_synthetic_secure_credential_delete: handleSyntheticSecureCredentialDelete,
};
