import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { nerdgraph } from '../client.js';
import { acct, handle, listResponse } from './utils.js';
import {
  ALERT_POLICIES_LIST_QUERY,
  ALERT_POLICY_GET_QUERY,
  ALERT_POLICY_CREATE_MUTATION,
  ALERT_POLICY_UPDATE_MUTATION,
  ALERT_POLICY_DELETE_MUTATION,
  ALERT_NRQL_CONDITIONS_LIST_QUERY,
  ALERT_NRQL_CONDITION_CREATE_MUTATION,
  ALERT_NRQL_CONDITION_UPDATE_MUTATION,
  ALERT_NRQL_CONDITION_DELETE_MUTATION,
  ALERT_MUTING_RULES_LIST_QUERY,
  ALERT_MUTING_RULE_CREATE_MUTATION,
  ALERT_MUTING_RULE_UPDATE_MUTATION,
  ALERT_MUTING_RULE_DELETE_MUTATION,
} from '../queries/alerts.js';

// ─── Schemas ────────────────────────────────────────────────────────────────

const AccountSchema = z.object({ accountId: z.number().int().optional() });

const AlertPoliciesListSchema = AccountSchema.extend({ cursor: z.string().optional() });
const AlertPolicyGetSchema = AccountSchema.extend({ id: z.string() });
const AlertPolicyCreateSchema = AccountSchema.extend({
  name: z.string(),
  incidentPreference: z.enum(['PER_POLICY', 'PER_CONDITION', 'PER_CONDITION_AND_TARGET']),
});
const AlertPolicyUpdateSchema = AccountSchema.extend({
  id: z.string(),
  name: z.string(),
  incidentPreference: z.enum(['PER_POLICY', 'PER_CONDITION', 'PER_CONDITION_AND_TARGET']),
});
const AlertPolicyDeleteSchema = AccountSchema.extend({ id: z.string() });
const AlertConditionsListSchema = AccountSchema.extend({
  policyId: z.string(),
  cursor: z.string().optional(),
});

const AlertTermSchema = z.object({
  operator: z.enum(['ABOVE', 'ABOVE_OR_EQUALS', 'BELOW', 'BELOW_OR_EQUALS', 'EQUALS', 'NOT_EQUALS']),
  priority: z.enum(['CRITICAL', 'WARNING']),
  threshold: z.number(),
  thresholdDuration: z.number().int(),
  thresholdOccurrences: z.enum(['ALL', 'AT_LEAST_ONCE']),
});

// Shared signal/expiration fields used in both create and update
const NrqlConditionSignalFields = {
  evaluationOffset: z.number().int().optional(),
  expirationDuration: z.number().int().optional(),
  openViolationOnExpiration: z.boolean().optional(),
  closeViolationsOnExpiration: z.boolean().optional(),
};

const AlertNrqlConditionCreateSchema = AccountSchema.extend({
  policyId: z.string(),
  name: z.string(),
  nrqlQuery: z.string(),
  terms: z.array(AlertTermSchema).min(1),
  enabled: z.boolean().optional().default(true),
  violationTimeLimitSeconds: z.number().int().optional(),
  ...NrqlConditionSignalFields,
});

const AlertNrqlConditionUpdateSchema = AccountSchema.extend({
  conditionId: z.string(),
  name: z.string(),
  nrqlQuery: z.string(),
  terms: z.array(AlertTermSchema).min(1),
  enabled: z.boolean().optional(),
  violationTimeLimitSeconds: z.number().int().optional(),
  ...NrqlConditionSignalFields,
});

const AlertConditionDeleteSchema = AccountSchema.extend({ conditionId: z.string() });

const MutingConditionSchema = z.object({
  attribute: z.string(),
  operator: z.enum(['ANY', 'CONTAINS', 'ENDS_WITH', 'EQUALS', 'IN', 'IS_BLANK', 'IS_NOT_BLANK', 'NOT_CONTAINS', 'NOT_ENDS_WITH', 'NOT_EQUALS', 'NOT_IN', 'NOT_STARTS_WITH', 'STARTS_WITH']),
  values: z.array(z.string()),
});

const MutingRuleConditionGroupSchema = z.object({
  operator: z.enum(['AND', 'OR']),
  conditions: z.array(MutingConditionSchema),
});

const MutingRuleScheduleSchema = z.object({
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  timeZone: z.string(),
  repeat: z.enum(['DAILY', 'MONTHLY', 'WEEKLY']).optional(),
  repeatCount: z.number().int().optional(),
  endRepeat: z.string().optional(),
  weeklyRepeatDays: z.array(z.enum(['FRIDAY', 'MONDAY', 'SATURDAY', 'SUNDAY', 'THURSDAY', 'TUESDAY', 'WEDNESDAY'])).optional(),
});

const AlertMutingRuleCreateSchema = AccountSchema.extend({
  name: z.string(),
  description: z.string().optional(),
  enabled: z.boolean().optional().default(true),
  condition: MutingRuleConditionGroupSchema,
  schedule: MutingRuleScheduleSchema.optional(),
});

const AlertMutingRuleUpdateSchema = AccountSchema.extend({
  id: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  enabled: z.boolean().optional(),
  condition: MutingRuleConditionGroupSchema.optional(),
  schedule: MutingRuleScheduleSchema.optional(),
});

const AlertMutingRuleDeleteSchema = AccountSchema.extend({ id: z.string() });

// ─── Shared condition builder ────────────────────────────────────────────────

function buildNrqlConditionInput(input: {
  name: string;
  nrqlQuery: string;
  terms: z.infer<typeof AlertTermSchema>[];
  enabled?: boolean;
  violationTimeLimitSeconds?: number;
  evaluationOffset?: number;
  expirationDuration?: number;
  openViolationOnExpiration?: boolean;
  closeViolationsOnExpiration?: boolean;
}): Record<string, unknown> {
  const condition: Record<string, unknown> = {
    name: input.name,
    nrql: { query: input.nrqlQuery },
    terms: input.terms,
  };
  if (input.enabled !== undefined) condition['enabled'] = input.enabled;
  if (input.violationTimeLimitSeconds !== undefined) {
    condition['violationTimeLimitSeconds'] = input.violationTimeLimitSeconds;
  }
  if (input.evaluationOffset !== undefined) {
    condition['signal'] = { evaluationOffset: input.evaluationOffset };
  }
  if (
    input.expirationDuration !== undefined ||
    input.openViolationOnExpiration !== undefined ||
    input.closeViolationsOnExpiration !== undefined
  ) {
    condition['expiration'] = {
      ...(input.expirationDuration !== undefined && { expirationDuration: input.expirationDuration }),
      ...(input.openViolationOnExpiration !== undefined && { openViolationOnExpiration: input.openViolationOnExpiration }),
      ...(input.closeViolationsOnExpiration !== undefined && { closeViolationsOnExpiration: input.closeViolationsOnExpiration }),
    };
  }
  return condition;
}

// ─── Handlers ───────────────────────────────────────────────────────────────

async function handleAlertPoliciesList(args: unknown): Promise<CallToolResult> {
  return handle(AlertPoliciesListSchema, args, async (input) => {
    const data = await nerdgraph<{
      actor: { account: { alerts: { policiesSearch: { policies: unknown[]; nextCursor: string | null; totalCount: number } } } };
    }>(ALERT_POLICIES_LIST_QUERY, { accountId: acct(input), cursor: input.cursor ?? null });
    const { policies, nextCursor, totalCount } = data.actor.account.alerts.policiesSearch;
    return listResponse(policies, totalCount, nextCursor, 'alert policies');
  });
}

async function handleAlertPolicyGet(args: unknown): Promise<CallToolResult> {
  return handle(AlertPolicyGetSchema, args, async (input) => {
    const data = await nerdgraph<{
      actor: { account: { alerts: { policiesSearch: { policies: unknown[] } } } };
    }>(ALERT_POLICY_GET_QUERY, { accountId: acct(input), id: input.id });
    const { policies } = data.actor.account.alerts.policiesSearch;
    if (policies.length === 0) {
      return { content: [{ type: 'text', text: `No alert policy found with ID ${input.id}` }], isError: true };
    }
    return { content: [{ type: 'text', text: JSON.stringify(policies[0], null, 2) }] };
  });
}

async function handleAlertPolicyCreate(args: unknown): Promise<CallToolResult> {
  return handle(AlertPolicyCreateSchema, args, async (input) => {
    const data = await nerdgraph<{ alertsPolicyCreate: unknown }>(ALERT_POLICY_CREATE_MUTATION, {
      accountId: acct(input),
      policy: { name: input.name, incidentPreference: input.incidentPreference },
    });
    return { content: [{ type: 'text', text: `Alert policy created:\n\n${JSON.stringify(data.alertsPolicyCreate, null, 2)}` }] };
  });
}

async function handleAlertPolicyUpdate(args: unknown): Promise<CallToolResult> {
  return handle(AlertPolicyUpdateSchema, args, async (input) => {
    const data = await nerdgraph<{ alertsPolicyUpdate: unknown }>(ALERT_POLICY_UPDATE_MUTATION, {
      accountId: acct(input),
      id: input.id,
      policy: { name: input.name, incidentPreference: input.incidentPreference },
    });
    return { content: [{ type: 'text', text: `Alert policy updated:\n\n${JSON.stringify(data.alertsPolicyUpdate, null, 2)}` }] };
  });
}

async function handleAlertPolicyDelete(args: unknown): Promise<CallToolResult> {
  return handle(AlertPolicyDeleteSchema, args, async (input) => {
    const data = await nerdgraph<{ alertsPolicyDelete: { id: string } }>(ALERT_POLICY_DELETE_MUTATION, {
      accountId: acct(input),
      id: input.id,
    });
    return { content: [{ type: 'text', text: `Alert policy ${data.alertsPolicyDelete.id} deleted.` }] };
  });
}

async function handleAlertConditionList(args: unknown): Promise<CallToolResult> {
  return handle(AlertConditionsListSchema, args, async (input) => {
    const data = await nerdgraph<{
      actor: { account: { alerts: { nrqlConditionsSearch: { nrqlConditions: unknown[]; nextCursor: string | null; totalCount: number } } } };
    }>(ALERT_NRQL_CONDITIONS_LIST_QUERY, {
      accountId: acct(input),
      policyId: input.policyId,
      cursor: input.cursor ?? null,
    });
    const { nrqlConditions, nextCursor, totalCount } = data.actor.account.alerts.nrqlConditionsSearch;
    return listResponse(nrqlConditions, totalCount, nextCursor, 'NRQL conditions');
  });
}

async function handleAlertConditionCreate(args: unknown): Promise<CallToolResult> {
  return handle(AlertNrqlConditionCreateSchema, args, async (input) => {
    const condition = buildNrqlConditionInput({ ...input, enabled: input.enabled ?? true });
    const data = await nerdgraph<{ alertsNrqlConditionStaticCreate: unknown }>(
      ALERT_NRQL_CONDITION_CREATE_MUTATION,
      { accountId: acct(input), policyId: input.policyId, condition }
    );
    return { content: [{ type: 'text', text: `NRQL alert condition created:\n\n${JSON.stringify(data.alertsNrqlConditionStaticCreate, null, 2)}` }] };
  });
}

async function handleAlertConditionUpdate(args: unknown): Promise<CallToolResult> {
  return handle(AlertNrqlConditionUpdateSchema, args, async (input) => {
    const condition = buildNrqlConditionInput(input);
    const data = await nerdgraph<{ alertsNrqlConditionStaticUpdate: unknown }>(
      ALERT_NRQL_CONDITION_UPDATE_MUTATION,
      { accountId: acct(input), conditionId: input.conditionId, condition }
    );
    return { content: [{ type: 'text', text: `NRQL alert condition updated:\n\n${JSON.stringify(data.alertsNrqlConditionStaticUpdate, null, 2)}` }] };
  });
}

async function handleAlertConditionDelete(args: unknown): Promise<CallToolResult> {
  return handle(AlertConditionDeleteSchema, args, async (input) => {
    const data = await nerdgraph<{ alertsConditionDelete: { id: string } }>(
      ALERT_NRQL_CONDITION_DELETE_MUTATION,
      { accountId: acct(input), conditionId: input.conditionId }
    );
    return { content: [{ type: 'text', text: `Alert condition ${data.alertsConditionDelete.id} deleted.` }] };
  });
}

async function handleAlertMutingRuleList(args: unknown): Promise<CallToolResult> {
  return handle(AccountSchema, args, async (input) => {
    const data = await nerdgraph<{
      actor: { account: { alerts: { mutingRules: unknown[] } } };
    }>(ALERT_MUTING_RULES_LIST_QUERY, { accountId: acct(input) });
    const { mutingRules } = data.actor.account.alerts;
    return listResponse(mutingRules, null, null, 'muting rules');
  });
}

async function handleAlertMutingRuleCreate(args: unknown): Promise<CallToolResult> {
  return handle(AlertMutingRuleCreateSchema, args, async (input) => {
    const rule = {
      name: input.name,
      enabled: input.enabled ?? true,
      condition: input.condition,
      ...(input.description !== undefined && { description: input.description }),
      ...(input.schedule !== undefined && { schedule: input.schedule }),
    };
    const data = await nerdgraph<{ alertsMutingRuleCreate: unknown }>(
      ALERT_MUTING_RULE_CREATE_MUTATION,
      { accountId: acct(input), rule }
    );
    return { content: [{ type: 'text', text: `Muting rule created:\n\n${JSON.stringify(data.alertsMutingRuleCreate, null, 2)}` }] };
  });
}

async function handleAlertMutingRuleUpdate(args: unknown): Promise<CallToolResult> {
  return handle(AlertMutingRuleUpdateSchema, args, async (input) => {
    const rule = {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.enabled !== undefined && { enabled: input.enabled }),
      ...(input.condition !== undefined && { condition: input.condition }),
      ...(input.schedule !== undefined && { schedule: input.schedule }),
    };
    const data = await nerdgraph<{ alertsMutingRuleUpdate: unknown }>(
      ALERT_MUTING_RULE_UPDATE_MUTATION,
      { accountId: acct(input), id: input.id, rule }
    );
    return { content: [{ type: 'text', text: `Muting rule updated:\n\n${JSON.stringify(data.alertsMutingRuleUpdate, null, 2)}` }] };
  });
}

async function handleAlertMutingRuleDelete(args: unknown): Promise<CallToolResult> {
  return handle(AlertMutingRuleDeleteSchema, args, async (input) => {
    await nerdgraph(ALERT_MUTING_RULE_DELETE_MUTATION, { accountId: acct(input), id: input.id });
    return { content: [{ type: 'text', text: `Muting rule ${input.id} deleted.` }] };
  });
}

// ─── Tool Definitions ────────────────────────────────────────────────────────

const signalExpirationProps = {
  evaluationOffset: { type: 'number', description: 'Evaluation offset in minutes for data delay' },
  expirationDuration: { type: 'number', description: 'Seconds before signal expiration is detected' },
  openViolationOnExpiration: { type: 'boolean' },
  closeViolationsOnExpiration: { type: 'boolean' },
};

export const alertToolDefinitions = [
  {
    name: 'newrelic_alert_policy_list',
    description: 'List all alert policies in a New Relic account.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        accountId: { type: 'number', description: 'Account ID (uses env default if omitted)' },
        cursor: { type: 'string', description: 'Pagination cursor' },
      },
    },
  },
  {
    name: 'newrelic_alert_policy_get',
    description: 'Get a single alert policy by ID.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'Alert policy ID' },
        accountId: { type: 'number', description: 'Account ID (uses env default if omitted)' },
      },
      required: ['id'],
    },
  },
  {
    name: 'newrelic_alert_policy_create',
    description: 'Create a new alert policy.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Policy name' },
        incidentPreference: {
          type: 'string',
          enum: ['PER_POLICY', 'PER_CONDITION', 'PER_CONDITION_AND_TARGET'],
          description: 'When to create incidents',
        },
        accountId: { type: 'number', description: 'Account ID (uses env default if omitted)' },
      },
      required: ['name', 'incidentPreference'],
    },
  },
  {
    name: 'newrelic_alert_policy_update',
    description: 'Update an existing alert policy name or incident preference.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'Policy ID' },
        name: { type: 'string', description: 'New policy name' },
        incidentPreference: {
          type: 'string',
          enum: ['PER_POLICY', 'PER_CONDITION', 'PER_CONDITION_AND_TARGET'],
        },
        accountId: { type: 'number', description: 'Account ID (uses env default if omitted)' },
      },
      required: ['id', 'name', 'incidentPreference'],
    },
  },
  {
    name: 'newrelic_alert_policy_delete',
    description: 'Delete an alert policy by ID.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'Policy ID' },
        accountId: { type: 'number', description: 'Account ID (uses env default if omitted)' },
      },
      required: ['id'],
    },
  },
  {
    name: 'newrelic_alert_condition_list',
    description: 'List NRQL alert conditions for a given alert policy.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        policyId: { type: 'string', description: 'Alert policy ID' },
        accountId: { type: 'number', description: 'Account ID (uses env default if omitted)' },
        cursor: { type: 'string', description: 'Pagination cursor' },
      },
      required: ['policyId'],
    },
  },
  {
    name: 'newrelic_alert_condition_create',
    description: 'Create a NRQL static alert condition on an alert policy.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        policyId: { type: 'string', description: 'Alert policy ID' },
        name: { type: 'string', description: 'Condition name' },
        nrqlQuery: { type: 'string', description: 'NRQL query string' },
        terms: {
          type: 'array',
          description: 'Alert thresholds',
          items: {
            type: 'object',
            properties: {
              operator: { type: 'string', enum: ['ABOVE', 'ABOVE_OR_EQUALS', 'BELOW', 'BELOW_OR_EQUALS', 'EQUALS', 'NOT_EQUALS'] },
              priority: { type: 'string', enum: ['CRITICAL', 'WARNING'] },
              threshold: { type: 'number' },
              thresholdDuration: { type: 'number', description: 'Duration in seconds' },
              thresholdOccurrences: { type: 'string', enum: ['ALL', 'AT_LEAST_ONCE'] },
            },
            required: ['operator', 'priority', 'threshold', 'thresholdDuration', 'thresholdOccurrences'],
          },
        },
        enabled: { type: 'boolean', description: 'Enable the condition (default: true)' },
        accountId: { type: 'number', description: 'Account ID (uses env default if omitted)' },
        violationTimeLimitSeconds: { type: 'number', description: 'Force close incidents after this many seconds' },
        ...signalExpirationProps,
      },
      required: ['policyId', 'name', 'nrqlQuery', 'terms'],
    },
  },
  {
    name: 'newrelic_alert_condition_update',
    description: 'Update an existing NRQL alert condition.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        conditionId: { type: 'string', description: 'Alert condition ID' },
        name: { type: 'string', description: 'New condition name' },
        nrqlQuery: { type: 'string', description: 'NRQL query string' },
        terms: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              operator: { type: 'string', enum: ['ABOVE', 'ABOVE_OR_EQUALS', 'BELOW', 'BELOW_OR_EQUALS', 'EQUALS', 'NOT_EQUALS'] },
              priority: { type: 'string', enum: ['CRITICAL', 'WARNING'] },
              threshold: { type: 'number' },
              thresholdDuration: { type: 'number' },
              thresholdOccurrences: { type: 'string', enum: ['ALL', 'AT_LEAST_ONCE'] },
            },
            required: ['operator', 'priority', 'threshold', 'thresholdDuration', 'thresholdOccurrences'],
          },
        },
        enabled: { type: 'boolean' },
        accountId: { type: 'number', description: 'Account ID (uses env default if omitted)' },
        violationTimeLimitSeconds: { type: 'number' },
        ...signalExpirationProps,
      },
      required: ['conditionId', 'name', 'nrqlQuery', 'terms'],
    },
  },
  {
    name: 'newrelic_alert_condition_delete',
    description: 'Delete a NRQL alert condition by ID.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        conditionId: { type: 'string', description: 'Alert condition ID' },
        accountId: { type: 'number', description: 'Account ID (uses env default if omitted)' },
      },
      required: ['conditionId'],
    },
  },
  {
    name: 'newrelic_alert_muting_rule_list',
    description: 'List all muting rules for an account (muting rules suppress alert notifications).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        accountId: { type: 'number', description: 'Account ID (uses env default if omitted)' },
      },
    },
  },
  {
    name: 'newrelic_alert_muting_rule_create',
    description: 'Create a muting rule to suppress alert notifications matching specified conditions.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Muting rule name' },
        description: { type: 'string' },
        enabled: { type: 'boolean', description: 'Enable the rule (default: true)' },
        condition: {
          type: 'object',
          description: 'Condition group that defines which alerts to mute',
          properties: {
            operator: { type: 'string', enum: ['AND', 'OR'] },
            conditions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  attribute: { type: 'string', description: 'e.g. policyName, conditionName, tag.team' },
                  operator: { type: 'string', enum: ['ANY', 'CONTAINS', 'ENDS_WITH', 'EQUALS', 'IN', 'IS_BLANK', 'IS_NOT_BLANK', 'NOT_CONTAINS', 'NOT_ENDS_WITH', 'NOT_EQUALS', 'NOT_IN', 'NOT_STARTS_WITH', 'STARTS_WITH'] },
                  values: { type: 'array', items: { type: 'string' } },
                },
                required: ['attribute', 'operator', 'values'],
              },
            },
          },
          required: ['operator', 'conditions'],
        },
        schedule: {
          type: 'object',
          description: 'Optional schedule for time-bounded muting',
          properties: {
            startTime: { type: 'string', description: 'ISO 8601 datetime' },
            endTime: { type: 'string', description: 'ISO 8601 datetime' },
            timeZone: { type: 'string', description: 'IANA timezone (e.g. America/New_York)' },
            repeat: { type: 'string', enum: ['DAILY', 'MONTHLY', 'WEEKLY'] },
            repeatCount: { type: 'number' },
          },
          required: ['timeZone'],
        },
        accountId: { type: 'number', description: 'Account ID (uses env default if omitted)' },
      },
      required: ['name', 'condition'],
    },
  },
  {
    name: 'newrelic_alert_muting_rule_update',
    description: 'Update an existing muting rule.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'Muting rule ID' },
        name: { type: 'string' },
        description: { type: 'string' },
        enabled: { type: 'boolean' },
        condition: { type: 'object' },
        schedule: { type: 'object' },
        accountId: { type: 'number', description: 'Account ID (uses env default if omitted)' },
      },
      required: ['id'],
    },
  },
  {
    name: 'newrelic_alert_muting_rule_delete',
    description: 'Delete a muting rule by ID.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'Muting rule ID' },
        accountId: { type: 'number', description: 'Account ID (uses env default if omitted)' },
      },
      required: ['id'],
    },
  },
];

export const alertHandlers: Record<string, (args: unknown) => Promise<CallToolResult>> = {
  newrelic_alert_policy_list: handleAlertPoliciesList,
  newrelic_alert_policy_get: handleAlertPolicyGet,
  newrelic_alert_policy_create: handleAlertPolicyCreate,
  newrelic_alert_policy_update: handleAlertPolicyUpdate,
  newrelic_alert_policy_delete: handleAlertPolicyDelete,
  newrelic_alert_condition_list: handleAlertConditionList,
  newrelic_alert_condition_create: handleAlertConditionCreate,
  newrelic_alert_condition_update: handleAlertConditionUpdate,
  newrelic_alert_condition_delete: handleAlertConditionDelete,
  newrelic_alert_muting_rule_list: handleAlertMutingRuleList,
  newrelic_alert_muting_rule_create: handleAlertMutingRuleCreate,
  newrelic_alert_muting_rule_update: handleAlertMutingRuleUpdate,
  newrelic_alert_muting_rule_delete: handleAlertMutingRuleDelete,
};
