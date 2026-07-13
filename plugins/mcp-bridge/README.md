# mcp-bridge

First-party Plugin OS control surface for MCP servers.

## Capabilities

- `mcp.list` — list servers from `config/mcp-servers.json`
- `mcp.materialize` — `{ serverId }` write `.zavorth/plugins/mcp-<id>/`
- `mcp.status` — `{ serverId? }` configuration status

## CLI

```bash
zavorth plugins mcp list
zavorth plugins mcp materialize filesystem --yes
```
