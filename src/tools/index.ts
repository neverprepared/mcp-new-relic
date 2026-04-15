import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { entityToolDefinitions, entityHandlers } from './entities.js';
import { dashboardToolDefinitions, dashboardHandlers } from './dashboards.js';
import { alertToolDefinitions, alertHandlers } from './alerts.js';
import { syntheticToolDefinitions, syntheticHandlers } from './synthetics.js';

export function getToolDefinitions() {
  return [
    ...entityToolDefinitions,
    ...dashboardToolDefinitions,
    ...alertToolDefinitions,
    ...syntheticToolDefinitions,
  ];
}

const handlers: Record<string, (args: unknown) => Promise<CallToolResult>> = {
  ...entityHandlers,
  ...dashboardHandlers,
  ...alertHandlers,
  ...syntheticHandlers,
};

export async function handleToolCall(
  name: string,
  args: unknown
): Promise<CallToolResult> {
  const handler = handlers[name];
  if (!handler) {
    return {
      content: [{ type: 'text', text: `Unknown tool: ${name}` }],
      isError: true,
    };
  }
  return handler(args);
}
