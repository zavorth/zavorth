# Zavorth Documentation

This is the official public documentation set for Zavorth. It is intentionally
small: daily-use guides, stable architecture notes and integration contracts.

## Start Here

| Doc | Use it for |
| --- | --- |
| [Overview](/docs/00-overview.md) | Product and runtime summary |
| [Quickstart](/docs/02-quickstart.md) | First local setup |
| [Web Dashboard](/docs/07-web.md) | Using `/dashboard` |
| [CLI](/docs/34-zavorth-cli.md) | Terminal operation and JSON output |
| [Troubleshooting](/docs/10-troubleshooting.md) | Fixing common runtime issues |

## Architecture

| Doc | Use it for |
| --- | --- |
| [Architecture](/docs/03-architecture.md) | Runtime shape and major planes |
| [Executors](/docs/04-executors.md) | Execution providers and supervised work |
| [Security](/docs/05-security.md) | Policy, approvals, egress and receipts |
| [Provider Mesh](/docs/provider-mesh.md) | Provider selection and live readiness |
| [Self Modification](/docs/self-modification.md) | How Zavorth changes its own repo safely |

## Product Surfaces

| Doc | Use it for |
| --- | --- |
| [Channel Mesh](/docs/33-channel-mesh.md) | Multi-channel status and setup |
| [Telegram](/docs/06-telegram.md) | Telegram-specific operation |
| [Capability Plugins](/docs/capability-plugins.md) | Capability packs and governed extension |
| [Capabilities And Plugins](/docs/08-capabilities-plugins.md) | Product-level plugin overview |
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
| [Roadmap](/docs/11-roadmap.md) | Small public roadmap |
| [Product Pitch](/docs/01-product-pitch.md) | Positioning and narrative |

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
