# Zavorth

![Zavorth banner](assets/brand/zavorth-readme-banner.png)

<p align="center">
  <strong>Local-first agent runtime for governed, auditable daily work.</strong>
</p>

<p align="center">
  Turn natural-language requests into supervised execution, approvals, artifacts,
  memory, sessions, channels and operational receipts.
</p>

<p align="center">
  <a href="https://github.com/zavorth/zavorth/actions/workflows/security.yml"><img alt="Security" src="https://img.shields.io/github/actions/workflow/status/zavorth/zavorth/security.yml?branch=main&label=security&style=for-the-badge"></a>
  <a href="https://www.npmjs.com/package/zavorth"><img alt="npm" src="https://img.shields.io/npm/v/zavorth?label=npm&style=for-the-badge"></a>
  <a href="LICENSE"><img alt="license" src="https://img.shields.io/badge/license-proprietary-0f766e?style=for-the-badge"></a>
  <a href="docs/05-security.md"><img alt="local first" src="https://img.shields.io/badge/security-local--first-111827?style=for-the-badge"></a>
</p>

---

## Why Zavorth

Zavorth is not just a chatbot. It is a **governed agent operating system** for people who want AI to help with real work without giving it silent, unlimited control over their machine.

It combines:

- **Dashboard**: a local gateway for requests, status, approvals and artifacts.
- **Policy Broker**: one decision plane for tools, providers, web fetch, channels, skills, MCP and local writes.
- **Trust Plane**: receipts, redaction, prompt-injection boundaries and approval envelopes.
- **Agent Runtime**: sessions, memory, subagents, skills, scheduled work and recovery.
- **Channel Mesh**: Telegram, web, CLI and other channels through one normalized contract.

The product goal is simple: **ask naturally, execute safely, keep evidence.**

## Install

Official product direction: Zavorth is moving toward a private local
runtime/installer as the main daily-use path. The npm package is the clean developer install path while the protected installer is prepared.

Published package:

```bash
npm install -g zavorth@latest
zavorth onboard
zavorth go
```

From a cloned repository:

```bash
npm install
npm run setup
npm run go
```

`go` opens or prints the local dashboard URL at `/dashboard`.

## First 60 Seconds

```bash
zavorth onboard
zavorth doctor --simple
zavorth go
zavorth templates
```

Then use the dashboard like a normal request surface:

```text
Review this repository and tell me what is risky.
Connect the safest channel for daily approvals.
Use subagents to inspect this codebase and summarize the findings.
Check whether my local runtime is ready for real use.
```

If you prefer terminal-only operation:

```bash
zavorth chat
zavorth run "review this repo"
zavorth missions
zavorth receipts
zavorth status --json
zavorth doctor --json
```

## Core Surfaces

| Surface | Purpose |
| --- | --- |
| `/dashboard` | Main web gateway for daily use |
| `/satellite` | Mobile/PWA companion when configured |
| CLI | Onboarding, diagnostics, templates, missions, receipts and terminal chat |
| Runtime API | Local integrations and SDK clients |
| Channel Mesh | Telegram, web, Discord, WhatsApp, Signal, iMessage and other surfaces through one contract |
| Skills | Governed instruction packs, imported with provenance and policy |
| Subagents | Delegated workers with budgets, receipts and policy gates |

## Security Model

Zavorth assumes agentic systems fail in subtler ways than classic apps. The runtime is built around defense in depth:

- sensitive actions require policy and approval;
- approvals are scoped and auditable;
- raw secrets should become `SecretRef` metadata, not prompt text;
- web, tool and memory content are treated as untrusted unless proven otherwise;
- scheduled work and subagents do not bypass the same execution gates;
- security checks run locally and in CI.

Start here: [Security](docs/05-security.md), [Operations](docs/09-operations.md), [Troubleshooting](docs/10-troubleshooting.md).

## Documentation

The public documentation is intentionally small and product-facing:

- [Docs Index](docs/README.md)
- [Quickstart](docs/02-quickstart.md)
- [Architecture](docs/03-architecture.md)
- [Web Dashboard](docs/07-web.md)
- [CLI](docs/34-zavorth-cli.md)
- [Channel Mesh](docs/33-channel-mesh.md)
- [Roadmap](docs/11-roadmap.md)

Private audits and old implementation plans are intentionally kept out of the public docs tree.

## Development

```bash
npm install
npm run runtime:check
npm run security:secrets
npm run zavorth:productization-protected-runtime:check
npm run workspace:check
```

Useful local checks:

```bash
node scripts/docs-public-repo-audit.mjs --write
npm run test:channels:smoke
npm run test:web:smoke
npm run test:nodes:smoke
```

## Project Posture

Zavorth is a protected local runtime with a serious security posture. It is proprietary software, not an open-source project. It favors honest status over false readiness: when a provider, channel, credential or bridge is not configured, the product should say so clearly instead of pretending to be live.

## Roadmap

The compact public roadmap lives in [docs/11-roadmap.md](docs/11-roadmap.md). The near-term focus is:

- live readiness by channel and provider;
- better `SecretRef` UX;
- transport discovery inside Channel Mesh;
- public documentation that stays small, useful and current.
