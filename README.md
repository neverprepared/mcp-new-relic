# mcp-new-relic

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server that exposes New Relic's [NerdGraph GraphQL API](https://docs.newrelic.com/docs/apis/nerdgraph/get-started/introduction-new-relic-nerdgraph/) as tools for AI assistants. Query data, manage dashboards, configure alerts, and control synthetic monitors — all from Claude or any MCP-compatible client.

## Prerequisites

- Node.js >= 18
- A New Relic [User API Key](https://docs.newrelic.com/docs/apis/intro-apis/new-relic-api-keys/) (`NRAK-...`)
- Your New Relic Account ID

## Installation

### npx (no install required)

```bash
NEW_RELIC_API_KEY=NRAK-... NEW_RELIC_ACCOUNT_ID=1234567 npx @neverprepared/mcp-new-relic
```

### Global install

```bash
npm install -g @neverprepared/mcp-new-relic
NEW_RELIC_API_KEY=NRAK-... NEW_RELIC_ACCOUNT_ID=1234567 mcp-new-relic
```

### Claude Desktop

Add to your `claude_desktop_config.json`:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "new-relic": {
      "command": "npx",
      "args": ["@neverprepared/mcp-new-relic"],
      "env": {
        "NEW_RELIC_API_KEY": "NRAK-...",
        "NEW_RELIC_ACCOUNT_ID": "1234567"
      }
    }
  }
}
```

Or if installed globally:

```json
{
  "mcpServers": {
    "new-relic": {
      "command": "mcp-new-relic",
      "env": {
        "NEW_RELIC_API_KEY": "NRAK-...",
        "NEW_RELIC_ACCOUNT_ID": "1234567"
      }
    }
  }
}
```

## Configuration

| Environment Variable | Required | Description |
|---------------------|----------|-------------|
| `NEW_RELIC_API_KEY` | Yes | New Relic User API Key (`NRAK-...`) |
| `NEW_RELIC_ACCOUNT_ID` | Yes | Default account ID (integer). Used when `accountId` is omitted from a tool call. |
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

# Copy and fill in your credentials
cp .env.example .env

# Run without building
npm run dev

# Type check
npm run typecheck

# Build
npm run build
```

## License

MIT
