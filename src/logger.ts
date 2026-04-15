// All output goes to stderr — stdout is reserved for MCP JSON-RPC protocol messages.

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const VALID_LOG_LEVELS = new Set<string>(['debug', 'info', 'warn', 'error']);
const rawLevel = process.env['LOG_LEVEL'];
const currentLevel: LogLevel = (rawLevel && VALID_LOG_LEVELS.has(rawLevel) ? rawLevel : 'info') as LogLevel;

function log(level: LogLevel, message: string, data?: unknown): void {
  if (LEVELS[level] < LEVELS[currentLevel]) return;
  const entry: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    msg: message,
  };
  if (data !== undefined) entry['data'] = data;
  process.stderr.write(JSON.stringify(entry) + '\n');
}

export const logger = {
  debug: (msg: string, data?: unknown) => log('debug', msg, data),
  info: (msg: string, data?: unknown) => log('info', msg, data),
  warn: (msg: string, data?: unknown) => log('warn', msg, data),
  error: (msg: string, data?: unknown) => log('error', msg, data),
};
