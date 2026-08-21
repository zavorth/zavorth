<p align="center">
  <img src="assets/brand/zavorth-banner.svg" alt="Zavorth" width="100%">
</p>

# Zavorth 🛡️

<p align="center">
  <a href="docs/quickstart.md">Quickstart</a> •
  <a href="docs/desktop.md">Desktop Guide</a> •
  <a href="docs/web-zavorthControl.md">Control Dashboard</a> •
  <a href="docs/zavorth-cli.md">CLI Reference</a> •
  <a href="docs/security.md">Security Model</a>
</p>

<p align="center">
  <a href="docs/quickstart.md"><img src="https://img.shields.io/badge/Docs-zavorth.ai-00FFA3?style=for-the-badge&logoColor=000000" alt="Documentation"></a>
  <img src="https://img.shields.io/badge/Node-%3E%3D20.0.0-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js 20+">
  <img src="https://img.shields.io/badge/TypeScript-Strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript Strict">
  <a href="docs/security.md"><img src="https://img.shields.io/badge/Security-Governed-0F766E?style=for-the-badge" alt="Governed Security"></a>
  <img src="https://img.shields.io/badge/Architecture-Local--First-6366F1?style=for-the-badge" alt="Local-First">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-2563EB?style=for-the-badge" alt="License: MIT"></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Lang-English-22C55E?style=for-the-badge" alt="English">
  <img src="https://img.shields.io/badge/Lang-Português-3B82F6?style=for-the-badge" alt="Português">
</p>

**The dependable autonomous AI agent runtime built for real work.** Zavorth connects the same governed agent seamlessly across **Native Desktop**, **Native Mobile (Android, iOS & watchOS)**, **Web Control**, **Browser Extensions**, **Terminal (CLI/TUI)**, and **Messaging Gateways (Telegram & WhatsApp)**. It introduces human approvals for sensitive actions, runs tasks in protected sandboxes, and keeps verified receipts for every completed run.

Use any AI model you prefer — **OpenAI**, **Anthropic**, **Google Gemini**, **Ollama**, **OpenRouter**, or custom local endpoints. Switch seamlessly with `zavorth providers` — zero code changes, zero vendor lock-in.

---

<table>
<tr><td width="30%"><b>🛡️ Governed Execution</b></td><td>Automatic safety checks and clear, timed approvals before the agent can modify files or run sensitive system commands.</td></tr>
<tr><td><b>📜 Verifiable Receipts</b></td><td>Every completed action creates a permanent receipt file (<code>receipts/</code>) recording exactly what ran, when it ran, and what changed.</td></tr>
<tr><td><b>📱 Everywhere You Are</b></td><td>Unified agent truth across Desktop, Android, iOS, watchOS, Web Control, CLI, Telegram, and WhatsApp.</td></tr>
<tr><td><b>🧠 Transparent Memory</b></td><td>Clean, project-specific memory and personality files (<code>SOUL.md</code>, <code>IDENTITY.md</code>, <code>MEMORY.md</code>) that you can inspect, edit, or reset anytime.</td></tr>
<tr><td><b>🔄 Safe Self-Improvement</b></td><td>The agent can propose improvements to its own skills, but never applies changes without your visual diff preview and 1-click rollback.</td></tr>
<tr><td><b>🔌 Pluggable Tools</b></td><td>Easily connect web browsers, developer tools, MCP servers, and custom skills with modular plug-and-play adapters.</td></tr>
<tr><td><b>⚡ 100% Local & Private</b></td><td>Runs directly on your machine. API keys and personal files stay in your local vault and are never leaked to external servers.</td></tr>
</table>

---

## ⚡ Start Fast

Requires Node.js 18 or newer (Node.js 20+ LTS recommended).

```bash
# Global installation
npm install -g zavorth@latest

# Bootstrap runtime & open Control dashboard
zavorth setup
zavorth start
zavorth open
```

`zavorth open` launches the official Control dashboard in your browser at `/control` (`/zavorthControl` remains supported as a legacy route).

Start an interactive terminal conversation at any time:

```bash
zavorth chat
```

For setting up a fresh workspace, follow the [BOOTSTRAP.md](BOOTSTRAP.md) guide. For every CLI command and TUI workflow, see [docs/zavorth-cli.md](docs/zavorth-cli.md).

---

## 🛡️ Governed Execution Lifecycle

```mermaid
graph TD
    subgraph Step1["1. Ask & Plan"]
        User["💬 You ask from any app, terminal or chat"] --> Planner["🧠 Zavorth creates a visible plan"]
    end

    subgraph Step2["2. Check & Approve"]
        Planner --> Risk{"⚠️ Does it modify files or run sensitive actions?"}
        Risk -->|Yes| Approval["✋ Asks for your approval first"]
        Risk -->|No / Safe| Execute["⚡ Executes safely in isolated sandbox"]
        Approval -->|Approved| Execute
        Approval -->|Denied| Cancel["🔄 Cancels & reverts changes"]
    end

    subgraph Step3["3. Proof & Universal Sync"]
        Execute --> Receipt["📜 Generates verifiable execution receipt"]
        Receipt --> Surfaces["📱 Slices across Desktop, Android, iOS, Web & Chat"]
    end
```

---

## 🔍 Why Zavorth? (Governed Runtime vs Generic Agents)

| Capability | Generic AI Agents (Raw Shell / Wrappers) | 🛡️ Zavorth Governed Runtime |
| :--- | :--- | :--- |
| **Command Execution** | Unrestricted shell access with blind execution | **Protected sandboxes with automatic safety rules** |
| **Sensitive Actions** | Executes mutations without human oversight | **Clear, timed human approvals before modifying files** |
| **Auditability & Proof** | Ephemeral, lost terminal stdout | **Permanent verifiable receipts (<code>receipts/</code>)** |
| **Memory Management** | Global uncurated prompt dumping | **Project-specific, transparent, and easy to edit** |
| **Unified Surfaces** | Fragmented CLI scripts | **Synchronized Desktop, Mobile, Web & Chat Gateways** |
| **Self-Evolution** | Uncontrolled overwrites | **Preview-first updates with instant 1-click rollback** |

---

## 🖥️ Surfaces, Apps & Gateways

Zavorth connects the same central intelligence across a full ecosystem of dedicated client surfaces:

| Client / Surface | Platform | Key Capabilities |
|---|---|---|
| **🖥️ Desktop App** | Windows, macOS, Linux | Full workspace view, file workboard, visual diffs, real-time approvals, receipts, and settings. |
| **📱 Native Mobile** | Android & iOS | Native mobile companion for conversational tasks, voice memos, on-the-go approvals, and notifications. |
| **⌚ Apple Watch** | watchOS | Quick voice queries, instant run approval prompts, and status complications directly on your wrist. |
| **🌐 Zavorth Control** | Web Browser (`/control`) | Comprehensive operations hub for node mesh management, live provider telemetry, channels, and sessions. |
| **🧩 Companion Extension** | Chrome, Brave, Edge | One-click web page extraction, canvas ingestion, and context clipping directly into your agent workspace. |
| **⌨️ CLI & TUI** | Windows Terminal, Linux, macOS | Keyboard-first terminal experience with multi-line editing, command autocompletion, and script automation. |
| **💬 Messaging Gateways** | Telegram & WhatsApp | Full conversational access, audio voice note transcription, and remote task dispatch from your favorite chat apps. |

---

## 🔒 Trust & Security

Zavorth never trusts unvalidated external data. High-risk tasks run in isolated environments and pause if safety cannot be guaranteed. Your API keys and secrets stay securely on your local computer — never leaked in prompts or sent to third-party clouds.

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

## 🔄 Controlled Self-Modification

All runtime modifications and agent self-improvements are **preview-first**. A proposed change is never written to disk until an authorized user explicitly reviews and applies it.

```text
/selfmod <relative_file> -- <instruction>
/selfmod goal -- <goal>
/selfmod apply <preview_id>
/selfmod rollback <change_id>
```

See [docs/self-modification.md](docs/self-modification.md) for authorization, safety bounds, rollback mechanics, and audit behavior.

---

## 📚 Documentation Index

- 🚀 [Quickstart Guide](docs/quickstart.md)
- 🖥️ [Desktop Experience Guide](docs/desktop.md)
- 🎛️ [Zavorth Control Architecture](docs/web-zavorthControl.md)
- ⌨️ [CLI & TUI Reference](docs/zavorth-cli.md)
- 🛡️ [Security & Governance Model](docs/security.md)
- 🏛️ [Core Architecture](docs/architecture.md)
- 🧭 [Product Direction & Roadmap](docs/product-direction.md)
- 🔧 [Operations & Maintenance](docs/operations.md)
- 🤝 [Contributing Guidelines](CONTRIBUTING.md)

---

## 🛠️ Local Development & Testing

```bash
# Install dependencies
npm install

# Run complete test suite (typecheck, security gates, unit, integration)
npm test
```

The repository enforces dedicated type, architecture, security, visual, accessibility, and cross-surface gates before any change is merged.

---

## 📄 License

MIT — see [LICENSE](LICENSE) for full details.
