# Zavorth Product Principles

This page describes the user-facing direction of Zavorth.

## What Zavorth Optimizes For

- Local-first control over work, memory and credentials.
- Natural requests that become governed actions when they touch real systems.
- Clear readiness for providers, channels, memory and approvals.
- Receipts that make important work reviewable later.
- A small set of daily surfaces: CLI, Zavorth Control, API and connected channels.
- Improve zavorthControl, CLI, Telegram, and API flows around the same governed gateway.

## Product Rules

- Sensitive actions are never silent.
- No silent execution of sensitive actions.
- Secrets are represented as references, not copied into prompts or receipts.
- Catalog support is not the same as live readiness, which requires explicit provider readiness.
- External runtimes are optional adapters, not required dependencies.
- Public documentation should explain how to use Zavorth, not how a feature was built.
- Every important capability should have a stable command or UI surface and be backed by tests or certification evidence before it is marketed as ready.
- Self-improvement starts as a draft, passes checks, and waits for approval before changing behavior.
- Low-resource profiles may reduce boot cost, but they do not increase execution authority.
- External tool packs and MCP sources enter through preview and review hold before tool exposure.
- Product surfaces should say setup, review, approve, undo, learned and history by default. Deeper runtime terms belong in developer, business or power detail modes.

## Product surfaces

Canonical three-way split (Code / Control / Desktop):

| Product | Role |
|---------|------|
| **Zavorth Code** | Coding CLI/TUI — external monorepo `zavorth-code` (`zavorth` / `@zavorth/cli`) |
| **Zavorth Control** | Dashboard / control plane — `/control` and control shell in this monorepo |
| **Zavorth Desktop** | Operator desktop app — `apps/zavorth-desktop` |

Full naming, freeze rules, and bridge policy: [product/surfaces-code-control-desktop.md](./product/surfaces-code-control-desktop.md).

## Stable User Surfaces

- `zavorth` CLI for setup, status, doctors and automation.
- `/control` for operator state, approvals, providers, channels and memory.
- Runtime API for typed integrations.
- Channel Mesh for optional chat surfaces.

## QA Gates

- Data readiness is checked before visual polish: `qa:zavorthControl`, `qa:zavorthControl-real`, `qa:ci:core` and `qa:product` keep the local cockpit, runtime API and product matrix connected.
- `qa:zavorthControl-chat-visual` verifies the chat surface without live sending: no popup "mensagem enviada", não salta para o topo, simple chat has no fake artifact and risky commands show approval cards.
- `qa:zavorthControl-live-chat` is opt-in and requires `zavorth zavorthControl token` or `ZAVORTH_WEB_AUTH_TOKEN`; it checks live send behavior, nao cria artefato falso and nao entra no `qa:zavorthControl` normal.
- `qa:zavorthControl-composer-affordances` keeps attachments, skills, voice, Stop, In progress and first-run setup visible without creating fake artifacts.
- `qa:zavorthControl-live-composer` is opt-in because it may send through a live runtime; it verifies attachment chips, skills popover, voice transcript and runtime send behavior.
- Chat QA must not show a popup "mensagem enviada", must not jump to the top after send, must not create artifact cards for simple chat, and must preserve `overflow: hidden` where the shell needs fixed rails.
- `zavorth:native-evolution-runtime-mcp:check` keeps prompt evolution preview-only, lightweight runtime profiles honest and MCP intake held for review before execution.
- `zavorth:daily-capability-flow:check` keeps the daily improvement/setup/catalog/eval projection simple, reviewable and free of live side effects.
- `zavorth:daily-product-experience:check` keeps first-run setup, the daily loop, review center and quality gates wired together without live side effects or raw secret serialization.
- `zavorth:native-autonomy-spine:check` keeps turn-end learning, Skill Forge, live channel proof, backend proof and review actions connected as one Zavorth-native runtime path.
