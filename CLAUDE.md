# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Overview

`@neverprepared/mcp-new-relic` is a **stdio MCP server** that exposes New Relic's
NerdGraph GraphQL API as MCP tools. TypeScript, ESM (`"type": "module"`),
Node >= 18. Published to npm; the `mcp-new-relic` bin maps to `dist/index.js`.

No HTTP server, no database, no runtime state — every tool call is a single
GraphQL request to NerdGraph.

## Commands

```bash
npm install          # install deps
npm run dev          # run from source via tsx (no build)
npm run build        # tsc -> dist/
npm run typecheck    # tsc --noEmit  <- primary verification gate
npm start            # node dist/index.js (requires a prior build)
```

There is **no test suite and no linter** in this repo. `npm run typecheck` (and
`npm run build`) is the only automated check; CI runs `npm ci && npm run build`
only. Do not invent `npm test` / `npm run lint` — they do not exist. If you add
behaviour, adding tests means also adding a runner and wiring it into
`.github/workflows/ci.yml`.

Running the server requires credentials in the process environment; nothing in
the code loads a `.env` file (no `dotenv`, no `--env-file`), so export the vars
inline:

```bash
NEW_RELIC_API_KEY=NRAK-... NEW_RELIC_ACCOUNT_ID=1234567 npm run dev
```

## Configuration (env vars, read in `src/config.ts` and `src/logger.ts`)

| Var | Required | Notes |
|---|---|---|
| `NEW_RELIC_API_KEY` | yes | User API key; sent as the `API-Key` header |
| `NEW_RELIC_ACCOUNT_ID` | yes | Positive integer; default account when a tool omits `accountId` |
| `NEW_RELIC_REGION` | no | `EU` (case-insensitive) selects `api.eu.newrelic.com`; anything else uses US |
| `LOG_LEVEL` | no | `debug` \| `info` (default) \| `warn` \| `error` |

`src/config.ts` throws `ConfigError` at **module load** if a required var is
missing or malformed — the process dies on import, not on first tool call.

## Architecture

```
src/index.ts       #!/usr/bin/env node entry — calls startServer(), exits 1 on failure
src/server.ts      MCP Server + StdioServerTransport; ListTools/CallTool handlers; SIGINT/SIGTERM shutdown
src/config.ts      env parsing -> CONFIG (key, account id, NerdGraph endpoint)
src/client.ts      nerdgraph<T>() — GraphQLClient wrapper, 30s timeout, ClientError -> NerdGraphError
src/errors.ts      NerdGraphError / ConfigError / ValidationError
src/logger.ts      JSON lines to **stderr only** (stdout is the JSON-RPC channel)
src/queries/*.ts   GraphQL document strings, one file per domain
src/tools/*.ts     zod input schemas + tool definitions + handlers, one file per domain
src/tools/index.ts aggregates definitions and handlers; unknown tool -> isError result
src/tools/utils.ts shared helpers: AccountSchema, acct(), handle(), errResult(), listResponse(), jsonResult(), mutationErrorResult()
```

Each domain file exports a `<domain>ToolDefinitions` array and a
`<domain>Handlers` record, both spread into `src/tools/index.ts`. Adding a tool
means: add the GraphQL doc in `src/queries/`, then the zod schema + definition +
handler in the matching `src/tools/` file. Nothing else needs touching.

## Tools exposed (39, all prefixed `newrelic_`)

- **Entities / accounts (9)** — `accounts_list`, `entity_search`, `entity_get`,
  `entity_tags_add`, `entity_tags_delete`, `entity_tags_replace`, `nrql_query`,
  `deployment_record`, `deployment_list`
- **Dashboards (5)** — `dashboard_list|get|create|update|delete`
- **Alerts (13)** — `alert_policy_list|get|create|update|delete`,
  `alert_condition_list|create|update|delete` (NRQL static conditions),
  `alert_muting_rule_list|create|update|delete`
- **Synthetics (10)** — `synthetic_monitor_list|get|create_simple|create_scripted|update|delete`,
  `synthetic_private_location_list`,
  `synthetic_secure_credential_list|create|delete`

No MCP resources or prompts are exposed — `capabilities` declares `tools` only.

## Conventions

- **Never write to stdout.** It carries the MCP JSON-RPC stream. All diagnostics
  go through `logger` (stderr).
- **Validate with zod at the handler boundary.** Wrap handlers in
  `handle(Schema, args, fn)`; it parses and routes both zod and thrown errors
  through `errResult`, so failures come back as `isError` results rather than
  crashing the server.
- **Account resolution** goes through `acct(input)` — never read
  `CONFIG.NEW_RELIC_ACCOUNT_ID` directly in a handler; every account-scoped
  schema extends `AccountSchema` so callers can override per call.
- `nerdgraph<T>()` performs **no runtime validation** of the response — `T` is a
  caller assertion. Guard optional/nested fields before dereferencing.
- NerdGraph mutations return inline typed errors; funnel them through
  `mutationErrorResult()` before treating a mutation as successful.
- Strict TypeScript: `strict`, `noUnusedLocals`, `noUnusedParameters`,
  `noImplicitReturns`, `isolatedModules`. Module resolution is `Node16` — **all
  relative imports must carry the `.js` extension**.
- Releases are automated by release-please (`.github/workflows/release-please.yml`);
  use Conventional Commits. Do not hand-edit `CHANGELOG.md` or the `version` in
  `package.json`.
- `CLAUDE.md` is covered by a global gitignore — commit it with `git add -f CLAUDE.md`.
