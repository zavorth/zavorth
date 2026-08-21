<p align="center">
  <img src="assets/brand/zavorth-readme-banner.png" alt="Zavorth — governed AI agent runtime" width="100%">
</p>

<p align="center">
  <img src="assets/brand/zavorth-mascot.svg" alt="Zavorth mascot" width="96" height="96">
</p>

<h1 align="center">Zavorth</h1>

<p align="center">
  <strong>Your AI that does things — and proves it.</strong><br>
  Ask naturally. Approve only real risk. Keep cryptographic receipts for every completed run.
</p>

<p align="center">
  <a href="https://github.com/zavorth/zavorth/actions"><img src="https://img.shields.io/github/actions/workflow/status/zavorth/zavorth/ci.yml?branch=main&style=flat-square&label=CI" alt="CI"></a>
  <img src="https://img.shields.io/badge/node-%3E%3D20.0.0-339933?style=flat-square&logo=node.js" alt="Node.js 20+">
  <img src="https://img.shields.io/badge/typescript-strict-3178c6?style=flat-square&logo=typescript" alt="TypeScript Strict">
  <a href="docs/security.md"><img src="https://img.shields.io/badge/security-governed-0f766e?style=flat-square" alt="Governed security"></a>
  <img src="https://img.shields.io/badge/architecture-local--first-6366f1?style=flat-square" alt="Local-First">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-2563eb?style=flat-square" alt="MIT License"></a>
</p>

---

Zavorth is a local-first agent runtime designed for high-stakes, dependable work with visible plans, scoped approvals, controlled memory, and verifiable execution. It connects the same governed agent across Desktop, Zavorth Control, CLI/TUI, and remote channels without turning natural language into hidden shell shortcuts or unmonitored scripts.

---

## Quick Start

Requires Node.js 18 or newer (Node.js 20+ LTS recommended).

```bash
# Global installation
npm install -g zavorth@latest

# Bootstrap and launch
zavorth setup
zavorth start
zavorth open
```

`zavorth open` launches the official Control dashboard in your default browser. The runtime also exposes it at `/control` (`/zavorthControl` remains supported as a legacy route).

Start an interactive terminal conversation at any time:

```bash
zavorth chat
```

For setting up a brand-new workspace, follow the [BOOTSTRAP.md](BOOTSTRAP.md) guide. For every CLI command and TUI workflow, see [docs/zavorth-cli.md](docs/zavorth-cli.md).

---

## Governed Execution Lifecycle

```mermaid
graph TD
    subgraph Ingestion["1. Intent & Planning"]
        User["User Request (Natural Language)"] --> Planner["Zavorth Planner"]
    end

    subgraph Governance["2. Policy & Sensitivity Gate"]
        Planner --> Schema["Schema & Boundary Policy Gate"]
        Schema --> Risk{"Sensitivity Check"}
        Risk -->|Sensitive Mutation| Approval["Explicit Scoped Approval"]
        Risk -->|Safe / Read-only| Sandbox["MicroVM / Sandboxed Execution"]
        Approval -->|User Grants| Sandbox
        Approval -->|User Denies| Rollback["Surgical Rollback"]
    end

    subgraph Verification["3. Proof & Unified Delivery"]
        Sandbox --> Proof["Immutable Cryptographic Receipt"]
        Proof --> Surfaces["Unified Surfaces<br/>(Desktop • Web Control • CLI/TUI • Telegram)"]
    end
```

---

## Why Zavorth? (Governed Runtime vs Generic Agents)

| Capability | Generic AI Agents (Raw Shell / Wrappers) | Zavorth Governed Runtime |
| :--- | :--- | :--- |
| **Command Execution** | Unrestricted shell access with blind execution | **Strict MicroVM isolation & Schema policy gates** |
| **Sensitive Actions** | Executes mutations without human oversight | **Explicit, scoped, expiring human approvals** |
| **Auditability & Proof** | Ephemeral, lost terminal stdout | **Immutable cryptographic receipts (`receipts/`)** |
| **Memory Management** | Global uncurated prompt dumping | **Workspace-scoped, consent-aware, inspectable** |
| **Unified Surfaces** | Fragmented CLI scripts | **Synchronized Desktop, Web Control, CLI, & Telegram** |
| **Self-Evolution** | Uncontrolled overwrites | **Preview-first self-modification with instant rollback** |

---

## Surfaces & Interfaces

| Surface | Focus & Best For |
|---|---|
| **Desktop App** | Daily chat, file navigation, workboard, automations, live approvals, receipts, and settings. |
| **Zavorth Control** | Operations center, provider telemetry, active channels, node orchestration, and diagnostics. |
| **CLI / TUI** | High-speed setup, keyboard-first development, system repair, and background scripting. |
| **Remote Channels** | Governed interaction through Telegram and supported enterprise communication channels. |

The Desktop keeps terminal output and execution logs inside a deliberate, structured workspace rail rather than floating over unrelated windows.

---

## Trust & Security Architecture

Zavorth treats model output, tool output, retrieved web content, and channel messages as untrusted until validated through boundary schemas. High-risk execution uses the strongest available sandbox and fails closed when isolation is unavailable. Secrets remain exclusively in secure local configuration, never in prompts, receipts, or client bundles.

Essential operational commands:

```bash
zavorth status        # Inspect runtime health and provider statuses
zavorth doctor        # Run automated environment diagnostics and repairs
zavorth providers     # Manage pluggable LLM backends (OpenAI, Anthropic, Ollama, etc.)
zavorth capabilities  # List active tools, skills, and sandboxes
zavorth approvals     # Audit pending and past permission requests
zavorth receipts      # Inspect verifiable execution proofs
```

---

## Controlled Self-Modification

All runtime modifications and agent self-improvements are **preview-first**. A proposed change is never written to disk until an authorized user explicitly reviews and applies it.

```text
/selfmod <relative_file> -- <instruction>
/selfmod goal -- <goal>
/selfmod apply <preview_id>
/selfmod rollback <change_id>
```

See [docs/self-modification.md](docs/self-modification.md) for authorization, safety bounds, rollback mechanics, and audit behavior.

---

## Documentation Index

- [Quickstart Guide](docs/quickstart.md)
- [CLI & TUI Reference](docs/zavorth-cli.md)
- [Desktop Experience Guide](docs/desktop.md)
- [Zavorth Control Architecture](docs/web-zavorthControl.md)
- [Security & Governance Model](docs/security.md)
- [Core Architecture](docs/architecture.md)
- [Product Direction & Roadmap](docs/product-direction.md)
- [Operations & Maintenance](docs/operations.md)
- [Contributing Guidelines](CONTRIBUTING.md)

---

## Local Development & Testing

```bash
# Install dependencies
npm install

# Run complete test suite (typecheck, security gates, unit, integration)
npm test
```

The repository enforces dedicated type, architecture, security, visual, accessibility, and cross-surface gates before any change is merged.

---

## License

MIT — see [LICENSE](LICENSE) for full details.
