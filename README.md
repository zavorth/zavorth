<div align="center">
  <img src="assets/brand/zavorth-readme-banner.png" alt="Zavorth banner" width="100%" />

  <h1>Zavorth</h1>

  <p>
    <strong>Ask naturally. Execute safely. Keep evidence.</strong>
  </p>

  <p>
    A local-first agent operating system for governed automation, code work,
    document understanding, remote approvals, provider routing, and auditable
    autonomous workflows.
  </p>

  <p>
    <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-proprietary-111827?style=for-the-badge"></a>
    <a href="docs/security.md"><img alt="Security" src="https://img.shields.io/badge/security-governed-0f766e?style=for-the-badge"></a>
    <a href="docs/runtime-readiness.md"><img alt="Readiness" src="https://img.shields.io/badge/readiness-operator--first-2563eb?style=for-the-badge"></a>
    <a href="docs/zavorth-cli.md"><img alt="CLI" src="https://img.shields.io/badge/cli-premium-7c3aed?style=for-the-badge"></a>
  </p>

  <p>
    <a href="#start-fast">Start Fast</a> |
    <a href="#what-zavorth-does">What It Does</a> |
    <a href="#product-surface">Product Surface</a> |
    <a href="#daily-operator-flow">Daily Flow</a> |
    <a href="#command-map">Commands</a> |
    <a href="#trust-model">Trust Model</a> |
    <a href="#repo-map">Repo Map</a> |
    <a href="docs/README.md">Docs</a>
  </p>
</div>

---

## What Zavorth Is

Zavorth is not a loose chatbot wrapped around shell commands. It is a governed
runtime that receives natural language, classifies intent, routes work through
approved surfaces, and records evidence for what happened.

It is built for users who want an agent that can be useful every day without
silently taking unlimited control of their machine.

## Start Fast

Install the current CLI:

```bash
npm install -g zavorth@latest
```

For a local checkout:

```bash
npm install
npx zavorth setup
npx zavorth start
npx zavorth open
```

The primary user surface is `/dashboard`: configure with `zavorth setup`, start
the local runtime with `zavorth start`, then open it with `zavorth open` for
readiness, providers, approvals, receipts, skills, review, memory, and daily
operator work.

For terminal-first use:

```bash
npx zavorth chat
npx zavorth providers
npx zavorth providers add
npx zavorth channels telegram
npx zavorth status
npx zavorth ready
npx zavorth trust
```

For the safest first run, open the Dashboard, connect a provider, review the
readiness report, then send one normal request:

```text
Review this repository and tell me what is risky.
```

## Product Surface

The Dashboard is the main operating surface. It is designed around one daily
loop: ask naturally, preview risky work, approve only what needs approval, then
keep the receipt.

<p align="center">
  <img src="assets/brand/zavorth-dashboard-preview.png" alt="Zavorth dashboard preview" width="100%" />
</p>

## What Zavorth Does

| Surface | What it gives you |
| --- | --- |
| Natural First Runtime | Free text enters the agent gateway instead of dying in a shallow command path. |
| Dashboard | Operator home for readiness, approvals, providers, receipts, tasks, skills, and review. |
| CLI/TUI | A terminal surface for status, smart commands, provider state, approvals, and daily checks. |
| Telegram and channels | Remote operation with governed approvals, receipts, and channel-aware responses. |
| Provider Catalog | A large provider and model catalog with readiness, live proof, fallbacks, and safe status. |
| Mnemos | Scoped local memory and universal file understanding for documents, PDFs, images, and archives. |
| Echo | Voice and TTS control surface with clear provider readiness. |
| Nexus | Integration and connector map for the user's local environment. |
| Swarm v2 | Multi-agent work planning with budgets, isolation policies, replay, and synthesis. |
| Agent Review | Read-only code review by default, with patch application separated behind approval. |
| Skill Ecosystem | Zavorth-native skills, routing, curation, quality scoring, and approval-based evolution. |
| Transaction Plane | Transaction preview, mandate checks, approval, ledger, simulation, and live execution gates. |

## Daily Operator Flow

1. Ask naturally in the Dashboard, CLI, Telegram, or API.
2. Zavorth classifies the request as chat, memory, review, skill, tool, provider, approval, or execution.
3. Low-risk work responds quickly. Sensitive work becomes a preview.
4. You approve, reject, defer, or grant a scoped permission.
5. Zavorth executes only through the governed gateway.
6. Receipts, ledger entries, and memory updates explain what happened.
7. You can review, revoke, replay, or roll back where a rollback path exists.

## Command Map

| Command | Purpose |
| --- | --- |
| `zavorth setup` | Guided Setup Studio for provider, model, channels, Mnemos, and safety. |
| `zavorth start` | Start or resume the local runtime and make `/dashboard` available. |
| `zavorth open` | Open the local Dashboard with the current access token. |
| `zavorth ready` | One command operator readiness check. |
| `zavorth status` | Show current health. |
| `zavorth providers` | Show provider and model readiness. |
| `zavorth providers add` | Guided provider/API key/model wizard with redacted secrets. |
| `zavorth providers switch` | Change the default provider/model through the same safe wizard. |
| `zavorth channels telegram` | Guided channel wizard for Telegram token, allowlist and readiness. |
| `zavorth channels discord` | Guided channel wizard for Discord token, guild/channel policy and readiness. |
| `zavorth skills` | Inspect native skill coverage and curator hints. |
| `zavorth review` | Run governed agent review. |
| `zavorth trust` | Inspect approval posture, persistent permissions, and break-glass controls. |
| `zavorth doctor` | Diagnose setup/runtime issues and show the next safe action. |

Maintainers can run the full product gate before publishing:

```bash
npm run release:check
```

## Trust Model

Zavorth is designed to be proactive without becoming reckless.

- Sensitive actions require policy, preview, approval, and receipt.
- Natural approval is supported, but risky grants stay scoped by time, action, channel, and limit.
- Break-glass mode exists for extreme cases, but it is still explicit, audited, revocable, and guarded.
- Secrets are handled as references and must not be serialized into prompts, logs, receipts, or screenshots.
- External agents, providers, sandboxes, and skills are configurable capabilities, not silent dependencies.
- Providers are cataloged honestly: configured and proven routes are marked ready; missing credentials stay "not configured".
- Transaction and execution flows prefer simulation, preview, and audit before any live operation.

## Repo Map

| Path | Role |
| --- | --- |
| `src/` | Core runtime, services, providers, gateways, policy, and dashboard integration. |
| `scripts/` | Operator commands, readiness checks, certification packs, and local tooling. |
| `tests/` | Unit, runtime, security, gateway, provider, dashboard, and skill checks. |
| `docs/` | Product docs, architecture notes, security posture, operations, and roadmap. |
| `skill-library/` | Native skills, governed curation inputs, and approved skill surfaces. |
| `assets/` | Brand, dashboard, social, and repository presentation assets. |
| `agent/` | Runtime-side agent support and voice/media helpers. |
| `apps/` | Application surfaces and companion app code. |
| `data/` | Local evidence, receipts, live proof, state snapshots, and runtime artifacts. |

## Status Honesty

Zavorth can know about a provider, channel, backend, or skill without pretending
it is live. A capability is only treated as ready when its configuration,
policy, and proof allow it.

That means the repo may show many cataloged routes while only a subset is
active on a specific machine. This is intentional: it keeps setup simple, avoids
false readiness, and prevents accidental execution with missing credentials.

## Documentation

- [Documentation index](docs/README.md)
- [Quickstart](docs/quickstart.md)
- [Architecture](docs/architecture.md)
- [Security](docs/security.md)
- [Telegram](docs/telegram.md)
- [Dashboard](docs/web-dashboard.md)
- [CLI guide](docs/zavorth-cli.md)
- [Runtime readiness](docs/runtime-readiness.md)
- [External agent onboarding](docs/external-agent-onboarding.md)
- [External agent gateway](docs/external-agent-gateway.md)
- [Capability mesh](docs/capability-mesh.md)
- [Roadmap](docs/product-direction.md)

---

<div align="center">
  <sub>Zavorth is built for autonomous work with local control, explicit trust, and visible evidence.</sub>
</div>
