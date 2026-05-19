# Zavorth Documentation

This is the official public documentation set for Zavorth. It is intentionally
small: daily-use guides, stable architecture notes and integration contracts.

## Start Here

| Doc | Use it for |
| --- | --- |
| [Overview](/docs/overview.md) | Product and runtime summary |
| [Quickstart](/docs/quickstart.md) | First local setup |
| [Web Dashboard](/docs/web-dashboard.md) | Using `/dashboard` |
| [CLI](/docs/zavorth-cli.md) | Terminal operation and JSON output |
| [Troubleshooting](/docs/troubleshooting.md) | Fixing common runtime issues |

## Architecture

| Doc | Use it for |
| --- | --- |
| [Architecture](/docs/architecture.md) | Runtime shape and major planes |
| [Executors](/docs/execution.md) | Execution providers and supervised work |
| [Security](/docs/security.md) | Policy, approvals, egress and receipts |
| [Provider Mesh](/docs/provider-mesh.md) | Provider selection and live readiness |
| [Self Modification](/docs/self-modification.md) | How Zavorth changes its own repo safely |

## Product Surfaces

| Doc | Use it for |
| --- | --- |
| [Channel Mesh](/docs/channel-mesh.md) | Multi-channel status and setup |
| [Telegram](/docs/telegram.md) | Telegram-specific operation |
| [Capability Plugins](/docs/capability-plugins.md) | Capability packs and governed extension |
| [Capabilities And Plugins](/docs/capabilities-and-plugins.md) | Product-level plugin overview |
| [Gateway Control API](/docs/gateway-control-api.md) | Control-plane HTTP surface |

## Operator And Developer Guides

| Doc | Use it for |
| --- | --- |
| [Operator Cockpit](/docs/product/operator-cockpit.md) | Daily operator view |
| [Operator Quickstart](/docs/product/quickstart-operator.md) | Operator setup flow |
| [Developer Quickstart](/docs/product/quickstart-developer.md) | Contributor setup flow |
| [Guided Troubleshooting](/docs/product/troubleshooting-guiado.md) | Operator troubleshooting |

## Protocols

| Doc | Use it for |
| --- | --- |
| [REST v1](/docs/protocol/rest-v1.md) | Public REST contract |
| [Runtime API v1](/docs/protocol/runtime-api-v1.md) | GUI/API runtime contract |
| [WebSocket v1](/docs/protocol/websocket-v1.md) | Experimental WebSocket notes |
| [SDK Usage](/docs/protocol/sdk-usage.md) | TypeScript and Python client usage |

## Planning

| Doc | Use it for |
| --- | --- |
| [Roadmap](/docs/product-direction.md) | Small public roadmap |
| [Product Pitch](/docs/product-story.md) | Positioning and narrative |

## Certification Notes

- Provider, channel, speech and media checks are explicit readiness gates.
- Live I/O requires configured credentials, provider capability, owner approval
  and a receipt.
- Preview-only and certification commands must not perform external sends,
  payments, installs or secret access unless the command name and operator
  confirmation make that live behavior explicit.

## Documentation Rules

- Public docs describe real current behavior or clearly marked roadmap.
- Private audits, implementation scratchpads and temporary planning notes do not belong here.
- Commands in docs should exist in `package.json` or be plain installed CLI commands.
- Local links should resolve before docs are committed.
- No external action, install, deploy, secret access, or shell execution is implied by documentation, certification gates, or preview-only operational cycles.

Before publishing documentation changes, run the public documentation audit from
the repository root:

```bash
node scripts/docs-public-repo-audit.mjs
```

Use `--write` only when you want to save the report under `.tmp/repo-audit`.
