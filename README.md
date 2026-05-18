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
zavorth start
zavorth go
zavorth connectors doctor
```

From a cloned repository:

```bash
npm install
npm run zavorth:start
npm run go
npm run zavorth:connectors
```

`go` opens or prints the local dashboard URL at `/dashboard`.
`start` shows the single product path: setup preview, Home, optional browser demo and connector doctor.
`connectors doctor` tells you exactly what is missing for GitHub, Telegram or Discord.
`onboard` is kept as a friendly alias for the setup path; the real first-run command is `setup`.

## First 60 Seconds

```bash
zavorth start
zavorth go
zavorth connectors doctor
zavorth demo browser
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
zavorth agent-review
zavorth daily
zavorth readiness
zavorth receipts
zavorth doctor --simple
```

`zavorth agent-review` is the official governed review surface. It reviews the current diff in read-only mode, reports findings with severity, confidence and file/line when available, and keeps PR comments, patches and live review agents behind explicit approval.

## Product Demo

`zavorth start` is the short product path for a new operator. `zavorth demo` remains optional. The path keeps internal runtime names out of the first screen and shows:

- the 10-minute setup path;
- the visual Home route at `/dashboard`;
- GitHub Governed Review commands;
- Telegram Daily Assistant setup signals;
- Discord minimum native setup;
- receipt and smoke-test proof.

For a cloned repository, the deterministic demo smoke is:

```bash
npm run zavorth:demo:check
```

The smoke uses fixtures for GitHub, Telegram and Discord, so it does not require live tokens. Real GitHub comments, shell execution and channel actions still require approval and receipts.

## Experience Profiles

Zavorth adapts its daily-use language and defaults through five experience profiles:
Personal, Creator, Developer, Business and Power. These profiles do not grant extra authority; they map the user's intent onto the same governed runtime, Policy Broker, approvals and receipts.

## Conversational Setup

`zavorth onboard conversation` previews the human first-run calibration: what the agent should be called, what it should call the user, preferred language, profile, approval surface and first safe mission. It is read-only by default. Local identity files are only updated with `--apply --confirm-local-profile`, and credentials belong in SecretRefs, not setup answers.

## Guided Missions

Zavorth does not start from an empty chat. `zavorth missions guide` recommends safe mission cards for Personal, Creator, Developer, Business and Power users. Each card explains the goal, risk, capabilities, expected artifacts, approval boundary and safe first step before runtime work begins.

## Capability Store

`zavorth capability-store` is the human-facing view of the Capability Hub. It groups communication, productivity, development, automation, security, provider and local runtime capabilities with honest readiness: available, needs setup, needs test, planned or blocked. Store cards guide setup, but they never install, send, write or execute by themselves.

## Do-It-With-Me Mode

`zavorth do-it-with-me` turns setup or work into a guided checklist. It separates what the user must do physically, what Zavorth can check safely, where SecretRefs are needed, and where Policy Broker approval begins. It is projection-only by default and never collects raw secrets.

## Trust Panel

`zavorth trust-panel` explains the current safety boundary in human language: what Zavorth can do alone, what asks first, what is blocked, and what still needs setup. It is powered by Experience Profiles and Capability Store readiness, but it never executes actions. The panel keeps the product simple on the outside while preserving Policy Broker, scoped approvals and receipts underneath.

## Autonomy Slider

`zavorth autonomy --level conservative|balanced|advanced|business` previews how much freedom Zavorth should have for a profile or mission. Conservative asks early, Balanced is the daily default, Advanced exposes deeper runtime workflows, and Business emphasizes evidence and scoped governance. The slider changes defaults and approval language only; it never bypasses Policy Broker or applies a runtime change by itself.

## Model Cost Guard

`zavorth model-cost "review this repository"` estimates mission size, cost-surprise risk, provider tier and budget posture before live model use. It separates local/free, low, standard, premium and unknown-cost routes, treats unknown pricing as approval-required, and keeps hosted model escalation behind readiness, budget and receipts.

## Visual Receipts 2.0

`zavorth visual-receipts` renders operational receipts as product cards: what happened, what changed, what was blocked, whether rollback exists and what the next safe action is. The cards are readable by normal users, exportable for audits, and projection-only; rollback or approval actions stay scoped and approval-gated.

## Satellite Approval Companion

`zavorth satellite-approvals` projects the mobile approval inbox used by `/satellite`: scoped approval cards, approve/deny/preview decisions, receipt previews and the exact `capability.result` envelope the PWA sends back to the governed runtime. Satellite is a companion surface only; it can resolve a decision through the gateway, but it cannot execute the target action inside the browser.

## Natural Runtime Questions

`zavorth ask-runtime "which providers are ready?"` answers operational questions in plain language using the same governed projections as the dashboard, CLI and Satellite. It can explain providers, channels, approvals, receipts, setup gaps and safety boundaries without live network calls or hidden mutations.

## Dashboard Experience Home

`zavorth dashboard-home` describes the gentle `/dashboard` home experience: guided mission starters, natural runtime questions and quiet readiness cues. The page is intentionally simple first; deeper provider, endpoint and tool surfaces stay one click away.

## CLI Experience Parity

`zavorth daily` is the terminal equivalent of the simple Dashboard Home. It shows guided starts, runtime questions, trust, receipts and Satellite approval shortcuts before exposing deeper command references. It is projection-only: mutating work still becomes a governed mission with preview, approval and receipt.

## Runtime Readiness

`zavorth readiness` is the one-command daily operator check. It reports provider, dashboard, Telegram, approvals, transaction plane, skill imports, memory continuity and natural-first gateway status without running hidden live probes or mutations. By default it prints the operator view (`Pronto`, `Atencao`, `Bloqueado`); `--technical` keeps the diagnostic report, and `/readiness` exposes the same safe summary on Telegram.

## Daily-Use Certification

`zavorth experience-certify` verifies the Experience Layer as one package: profiles, conversational setup, guided missions, capability store, do-it-with-me, trust, autonomy, cost guard, receipts, Satellite approvals, runtime questions, Dashboard Home and CLI parity. The certification must pass without granting hidden execution authority.

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
