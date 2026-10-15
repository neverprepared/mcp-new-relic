# mcp-new-relic

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server that exposes New Relic's [NerdGraph GraphQL API](https://docs.newrelic.com/docs/apis/nerdgraph/get-started/introduction-new-relic-nerdgraph/) as tools for AI assistants. Query data, manage dashboards, configure alerts, and control synthetic monitors — all from Claude or any MCP-compatible client.

## Prerequisites

- Node.js >= 18
- A New Relic [User API Key](https://docs.newrelic.com/docs/apis/intro-apis/new-relic-api-keys/) (`NRAK-...`)
- Your New Relic Account ID

## Installation

This is a **stdio** server: you don't install it as a service, you point an MCP
client at a command it spawns. `npx` is the usual choice; a global install
(`npm install -g @neverprepared/mcp-new-relic`) lets you use the bare
`mcp-new-relic` command instead.

Run it by hand first to confirm your credentials work — it should start and wait
on stdin rather than exiting with a `ConfigError`:

```bash
NEW_RELIC_API_KEY=NRAK-... NEW_RELIC_ACCOUNT_ID=1234567 npx -y @neverprepared/mcp-new-relic
```

Every client below needs those same two variables (see
[Configuration](#configuration)). Prefer your client's secret-prompt or
passthrough mechanism over pasting `NRAK-...` into a config file — each section
notes which one it has.

### Claude Code

```bash
claude mcp add new-relic \
  --env NEW_RELIC_API_KEY=NRAK-... \
  --env NEW_RELIC_ACCOUNT_ID=1234567 \
  -- npx -y @neverprepared/mcp-new-relic
```

Add `--scope project` to write it to the repo's `.mcp.json` instead of your user
config. Verify with `claude mcp list`.

### Claude Desktop

Edit `claude_desktop_config.json` —
**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`,
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json` — then restart the app:

```json
{
  "mcpServers": {
    "new-relic": {
      "command": "npx",
      "args": ["-y", "@neverprepared/mcp-new-relic"],
      "env": {
        "NEW_RELIC_API_KEY": "NRAK-...",
        "NEW_RELIC_ACCOUNT_ID": "1234567"
      }
    }
  }
}
```

With a global install, drop `args` and use `"command": "mcp-new-relic"`.

### Codex

```bash
codex mcp add new-relic \
  --env NEW_RELIC_API_KEY=NRAK-... \
  --env NEW_RELIC_ACCOUNT_ID=1234567 \
  -- npx -y @neverprepared/mcp-new-relic
```

Equivalent entry in `~/.codex/config.toml`:

```toml
[mcp_servers.new-relic]
command = "npx"
args = ["-y", "@neverprepared/mcp-new-relic"]
env = { NEW_RELIC_API_KEY = "NRAK-...", NEW_RELIC_ACCOUNT_ID = "1234567" }
```

Verify with `codex mcp list`. Note that the TOML table is literal — Codex does
**not** expand `${VAR}` there, so the key is stored in plaintext. If that's a
problem, point `command` at a small wrapper script that pulls the key from your
keychain and `exec`s the server.

### VS Code (Copilot agent mode)

Workspace-scoped config goes in `.vscode/mcp.json`; user-scoped config goes in
the file opened by **MCP: Open User Configuration** in the command palette. Same
schema either way:

```json
{
  "inputs": [
    {
      "id": "nr-key",
      "type": "promptString",
      "description": "New Relic User API Key",
      "password": true
    }
  ],
  "servers": {
    "new-relic": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@neverprepared/mcp-new-relic"],
      "env": {
        "NEW_RELIC_API_KEY": "${input:nr-key}",
        "NEW_RELIC_ACCOUNT_ID": "1234567"
      }
    }
  }
}
```

The `inputs` block is worth the extra lines: VS Code prompts once and keeps the
value in secret storage, so nothing sensitive lands in a file you might commit.
Then open Copilot Chat in **Agent** mode and look for the `newrelic_*` tools in
the tools picker.

### GitHub Copilot CLI

Run `/mcp add` inside the CLI and fill in the wizard (name `new-relic`, type
`Local`, command `npx`, args `-y @neverprepared/mcp-new-relic`), or write
`~/.copilot/mcp-config.json` directly:

```json
{
  "mcpServers": {
    "new-relic": {
      "type": "local",
      "command": "npx",
      "args": ["-y", "@neverprepared/mcp-new-relic"],
      "tools": ["*"],
      "env": {
        "NEW_RELIC_API_KEY": "$NEW_RELIC_API_KEY",
        "NEW_RELIC_ACCOUNT_ID": "$NEW_RELIC_ACCOUNT_ID"
      }
    }
  }
}
```

Two things to get right here. `tools` is **required** — omit it and the server
connects while exposing zero tools, which looks exactly like a broken server.
And values of the form `$VAR` are substituted from your shell, so export the key
rather than inlining it.

### GitHub Copilot coding agent

Repo → **Settings → Code & automation → Copilot → Coding agent → MCP
configuration**. Same shape as the CLI, but secrets must be referenced, not
inlined:

```json
{
  "mcpServers": {
    "new-relic": {
      "type": "local",
      "command": "npx",
      "args": ["-y", "@neverprepared/mcp-new-relic"],
      "tools": ["*"],
      "env": {
        "NEW_RELIC_API_KEY": "$COPILOT_MCP_NEW_RELIC_API_KEY",
        "NEW_RELIC_ACCOUNT_ID": "$COPILOT_MCP_NEW_RELIC_ACCOUNT_ID"
      }
    }
  }
}
```

Only variables named `COPILOT_MCP_*` are injected, and they must live in the
repo's **`copilot` environment** (Settings → Environments → copilot → Secrets),
not the plain repo secrets list. Get either wrong and the variable arrives
empty: the server starts, then every tool call fails on auth.

### Any other MCP client

Give it the command `npx -y @neverprepared/mcp-new-relic` (or `mcp-new-relic`
when installed globally), transport **stdio**, and the two variables. Nothing
else is required — there is no HTTP endpoint to configure.

### When the server won't start

Config is validated at import time and the process exits immediately on a bad
value, so a client will usually report only that the server disconnected. Run
the bare `npx` command in a terminal to see the real error on stderr.

- `ConfigError` on startup — a required variable is missing or empty. In VS Code
  and the Copilot coding agent this usually means the secret reference didn't
  resolve.
- Auth failures on every tool call — the key is probably an **Ingest** license
  key rather than a User API key. Only `NRAK-...` keys work with NerdGraph.
- Empty results for an account you can see in the UI — the default account id is
  wrong. Call `newrelic_accounts_list` to see what the key can actually reach,
  and pass `accountId` explicitly.

## Configuration

| Environment Variable | Required | Description |
|---------------------|----------|-------------|
| `NEW_RELIC_API_KEY` | Yes | New Relic User API Key (`NRAK-...`) |
| `NEW_RELIC_ACCOUNT_ID` | Yes | Default account ID (integer). Used when `accountId` is omitted from a tool call. |
| `NEW_RELIC_REGION` | No | Set to `EU` to use the EU NerdGraph endpoint (`api.eu.newrelic.com`) |
| `LOG_LEVEL` | No | Log verbosity: `debug`, `info` (default), `warn`, `error` |

### Multi-account usage

Every tool accepts an optional `accountId` parameter to override the default. Use `newrelic_accounts_list` to discover all accounts your API key can access.

## Tools

### Accounts & Entities

| Tool | Description |
|------|-------------|
| `newrelic_accounts_list` | List all accounts accessible with the current API key |
| `newrelic_entity_search` | Search entities by name, type, domain, account, or tags |
| `newrelic_entity_get` | Get full entity details by GUID |
| `newrelic_entity_tags_add` | Add tags to an entity |
| `newrelic_entity_tags_delete` | Delete tag keys from an entity |
| `newrelic_entity_tags_replace` | Replace all tags on an entity |

### NRQL & Change Tracking

| Tool | Description |
|------|-------------|
| `newrelic_nrql_query` | Execute a NRQL query and return results |
| `newrelic_deployment_record` | Record a deployment (change tracking) event |
| `newrelic_deployment_list` | List recent deployments for an entity |

### Dashboards

| Tool | Description |
|------|-------------|
| `newrelic_dashboard_list` | List all dashboards |
| `newrelic_dashboard_get` | Get a dashboard with all pages and widgets |
| `newrelic_dashboard_create` | Create a dashboard |
| `newrelic_dashboard_update` | Update a dashboard |
| `newrelic_dashboard_delete` | Delete a dashboard |

### Alerts

| Tool | Description |
|------|-------------|
| `newrelic_alert_policy_list` | List alert policies |
| `newrelic_alert_policy_get` | Get an alert policy by ID |
| `newrelic_alert_policy_create` | Create an alert policy |
| `newrelic_alert_policy_update` | Update an alert policy |
| `newrelic_alert_policy_delete` | Delete an alert policy |
| `newrelic_alert_condition_list` | List NRQL conditions for a policy |
| `newrelic_alert_condition_create` | Create a NRQL alert condition |
| `newrelic_alert_condition_update` | Update a NRQL alert condition |
| `newrelic_alert_condition_delete` | Delete a NRQL alert condition |
| `newrelic_alert_muting_rule_list` | List muting rules |
| `newrelic_alert_muting_rule_create` | Create a muting rule |
| `newrelic_alert_muting_rule_update` | Update a muting rule |
| `newrelic_alert_muting_rule_delete` | Delete a muting rule |

### Synthetic Monitors

| Tool | Description |
|------|-------------|
| `newrelic_synthetic_monitor_list` | List all synthetic monitors |
| `newrelic_synthetic_monitor_get` | Get a monitor by GUID |
| `newrelic_synthetic_monitor_create_simple` | Create a simple browser (ping/HTTP) monitor |
| `newrelic_synthetic_monitor_create_scripted` | Create a scripted browser or API monitor |
| `newrelic_synthetic_monitor_update` | Update a monitor |
| `newrelic_synthetic_monitor_delete` | Delete a monitor |
| `newrelic_synthetic_private_location_list` | List private locations |
| `newrelic_synthetic_secure_credential_list` | List secure credentials |
| `newrelic_synthetic_secure_credential_create` | Create or update a secure credential |
| `newrelic_synthetic_secure_credential_delete` | Delete a secure credential |

## Development

```bash
git clone https://github.com/neverprepared/mcp-new-relic.git
cd mcp-new-relic
npm install

npm run typecheck   # tsc --noEmit — the only automated check in this repo
npm run build       # tsc -> dist/
```

Nothing in the code reads a `.env` file, so credentials have to be in the
process already. Copy `.env.example` to `.env`, fill it in, and export it for
the run:

```bash
cp .env.example .env
set -a; source .env; set +a
npm run dev         # run from source via tsx, no build step
```

## License

MIT
