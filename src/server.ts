import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { getToolDefinitions, handleToolCall } from './tools/index.js';
import { logger } from './logger.js';

export async function startServer(): Promise<void> {
  const server = new Server(
    { name: 'mcp-new-relic', version: '0.1.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, () => {
    const tools = getToolDefinitions();
    logger.info(`Listing ${tools.length} tools`);
    return { tools };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    logger.debug(`Tool call: ${name}`, { args });
    const result = await handleToolCall(name, args ?? {});
    return result;
  });

  const transport = new StdioServerTransport();

  process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down');
    await server.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down');
    await server.close();
    process.exit(0);
  });

  await server.connect(transport);
  logger.info('mcp-new-relic server started');
}
