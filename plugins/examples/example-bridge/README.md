# example-bridge

Generic Zavorth Plugin OS **bridge** example (`zavorth.plugin-os.v1`).

## Modes

| mode             | Required input                                        | Soft-fail when missing                |
| ---------------- | ----------------------------------------------------- | ------------------------------------- |
| `http` (default) | `url` / `endpoint` or `ZAVORTH_BRIDGE_ENDPOINT`       | `endpoint_missing` / `https_required` |
| `cli`            | `command` / `cli` or `ZAVORTH_BRIDGE_CLI`             | `cli_missing`                         |
| `mcp`            | `mcpServer` / `server` or `ZAVORTH_BRIDGE_MCP_SERVER` | `mcp_server_missing`                  |

Scaffold returns **planned** responses only — no outbound HTTP, process spawn, or MCP wire by default.

## Try

```bash
zavorth plugins new my-bridge --kind bridge --enable --smoke --yes
zavorth plugins test ./plugins/examples/example-bridge
```

## Related

- `docs/plugin-os.md` — authoring one-shot path
- `create-zavorth-plugin --kind bridge`
