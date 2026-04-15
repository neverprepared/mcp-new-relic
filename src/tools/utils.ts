import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { CONFIG } from '../config.js';

// ─── Error result ────────────────────────────────────────────────────────────

export function errResult(err: unknown): CallToolResult {
  if (err instanceof z.ZodError) {
    const issues = err.errors.map((e) => `  ${e.path.join('.')}: ${e.message}`).join('\n');
    return {
      content: [{ type: 'text', text: `Validation error:\n${issues}` }],
      isError: true,
    };
  }
  return {
    content: [{ type: 'text', text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
    isError: true,
  };
}

// ─── Account ID resolution ───────────────────────────────────────────────────

export function acct(input: { accountId?: number }): number {
  return input.accountId ?? CONFIG.NEW_RELIC_ACCOUNT_ID;
}

// ─── Paginated list response ─────────────────────────────────────────────────

export function listResponse(
  items: unknown[],
  total: number | null,
  nextCursor: string | null | undefined,
  label = 'items'
): CallToolResult {
  const countStr = total !== null ? `Found ${total} ${label} (showing ${items.length})` : `Found ${items.length} ${label}`;
  let text = `${countStr}:\n\n${JSON.stringify(items, null, 2)}`;
  if (nextCursor) text += `\n\nnextCursor: ${nextCursor}`;
  return { content: [{ type: 'text', text }] };
}

// ─── Inline error list (NerdGraph mutation errors) ───────────────────────────

interface TypedError {
  description: string;
  type: string;
}

export function mutationErrorResult(errors: TypedError[] | null | undefined, source = 'Operation'): CallToolResult | null {
  if (!errors || errors.length === 0) return null;
  return {
    content: [{ type: 'text', text: `${source} errors:\n${errors.map((e) => `[${e.type}] ${e.description}`).join('\n')}` }],
    isError: true,
  };
}

// ─── Handler wrapper ─────────────────────────────────────────────────────────

export function withErrorHandling(
  operation: () => Promise<CallToolResult>
): Promise<CallToolResult> {
  return operation().catch((err: unknown) => errResult(err));
}

export function handle<T extends z.ZodTypeAny>(
  schema: T,
  args: unknown,
  fn: (input: z.infer<T>) => Promise<CallToolResult>
): Promise<CallToolResult> {
  return withErrorHandling(async () => {
    const input = schema.parse(args);
    return fn(input);
  });
}
