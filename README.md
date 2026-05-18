<!-- Hero Section -->
<div align="center">
  <img src="assets/brand/zavorth-readme-banner.png" alt="Zavorth Banner" width="100%" style="border-radius: 12px; margin-bottom: 24px;" />

  <h1 align="center">Zavorth</h1>
  
  <p align="center">
    <strong>ASK NATURALLY. EXECUTE SAFELY. KEEP EVIDENCE.</strong>
  </p>

  <p align="center">
    A governed, local-first agent operating system built for secure autonomous command execution, transaction containment, and verifiable evidence.
  </p>

  <!-- Badges -->
  <p align="center">
    <a href="https://github.com/zavorth/zavorth/actions/workflows/security.yml">
      <img alt="Security" src="https://img.shields.io/github/actions/workflow/status/zavorth/zavorth/security.yml?branch=main&label=security&style=for-the-badge&color=0f766e">
    </a>
    <a href="https://www.npmjs.com/package/zavorth">
      <img alt="npm" src="https://img.shields.io/npm/v/zavorth?label=npm&style=for-the-badge&color=0f766e">
    </a>
    <a href="LICENSE">
      <img alt="license" src="https://img.shields.io/badge/license-proprietary-0f766e?style=for-the-badge">
    </a>
    <a href="docs/05-security.md">
      <img alt="local first" src="https://img.shields.io/badge/security-local--first-111827?style=for-the-badge">
    </a>
  </p>

  <!-- Centered Navigation Menu -->
  <p align="center">
    <a href="#-why-zavorth">Why Zavorth</a> ·
    <a href="#-quickstart-first-60-seconds">Quickstart</a> ·
    <a href="#-the-zavorth-ecosystem">Ecosystem</a> ·
    <a href="#-security-model--posture">Security</a> ·
    <a href="docs/README.md">Documentation</a> ·
    <a href="docs/11-roadmap.md">Roadmap</a>
  </p>
</div>

---

<p align="center">
  <b>Supported Surfaces & Channels:</b> Web Dashboard · Satellite Mobile PWA · Telegram · Discord · Terminal CLI
</p>

---

## ✨ Why Zavorth?

Zavorth is not just another chatbot. It is a **governed agent operating system** for operators who need robust AI command-execution and workflow automation without granting silent, infinite control over their machine.

<table width="100%" border="0" cellspacing="0" cellpadding="0" style="border-collapse: collapse; border: none; margin-top: 20px;">
  <tr style="border: none;">
    <td width="50%" valign="top" style="border: none; padding: 15px;">
      <h3>🖥️ Dashboard & Satellite</h3>
      <p>A beautiful web gateway for managing active subagents, reviewing scoped approval queues, and tracking transaction footprints cleanly without terminal clutter.</p>
    </td>
    <td width="50%" valign="top" style="border: none; padding: 15px;">
      <h3>⚖️ Policy Broker</h3>
      <p>One governed decision plane that monitors and scopes tool execution, model consumption costs, network fetches, and local filesystem mutations.</p>
    </td>
  </tr>
  <tr style="border: none;">
    <td width="50%" valign="top" style="border: none; padding: 15px;">
      <h3>📜 Trust Plane</h3>
      <p>Continuous generation of auditable cryptographic receipts, real-time prompt-injection boundaries, and visual transaction rollback cards.</p>
    </td>
    <td width="50%" valign="top" style="border: none; padding: 15px;">
      <h3>🧠 Autonomous Runtime</h3>
      <p>Robust orchestration of persistent episodic memory, multi-agent mesh networks with isolated budgets, and secure offline state recovery.</p>
    </td>
  </tr>
</table>

---

## 🚀 Quickstart (First 60 Seconds)

Zavorth is moving toward a private local runtime/installer. Currently, the npm package is the clean developer install path.

```bash
# 1. Install the global runtime
npm install -g zavorth@latest

# 2. Boot local setup & diagnostic wizard
zavorth start

# 3. Enter the dashboard gateway
zavorth go
```

*(From a cloned repository: `npm install`, `npm run zavorth:start`, `npm run go`)*

Once running, use the dashboard or Telegram like a normal request surface:
> *"Review this repository and tell me what is risky."* <br>
> *"Connect the safest channel for daily approvals."* <br>
> *"Use subagents to inspect this codebase and summarize the findings."*

---

## 🛠️ The Zavorth Ecosystem

Zavorth adapts to your daily routine with a massive suite of governed surfaces. <br>
**Click any component below to expand and inspect details:**

<details>
<summary><b>👤 Experience Profiles & Conversational Setup</b></summary>
<br>

**Experience Profiles:** Zavorth adapts its daily-use language and defaults through five experience profiles: Personal, Creator, Developer, Business and Power. These map the user's intent onto the same governed runtime.

**Conversational Setup:** `zavorth onboard conversation` previews the human first-run calibration. It is read-only by default. Local identity files are only updated after explicit confirmation.
</details>

<details>
<summary><b>🎯 Guided Missions & Capability Store</b></summary>
<br>

**Guided Missions:** `zavorth missions guide` recommends safe mission cards. Each card explains the goal, risk, capabilities, expected artifacts, approval boundary and safe first step before runtime work begins.

**Capability Store:** `zavorth capability-store` is the human-facing view of the Capability Hub. It groups communication, productivity, development, automation, and security capabilities with honest readiness status.
</details>

<details>
<summary><b>🛡️ Trust Panel & Autonomy Slider</b></summary>
<br>

**Trust Panel:** `zavorth trust-panel` explains the current safety boundary in human language: what Zavorth can do alone, what asks first, what is blocked, and what still needs setup.

**Autonomy Slider:** `zavorth autonomy --level conservative|balanced|advanced|business` previews how much freedom Zavorth should have for a profile or mission. It changes defaults and approval language, but never bypasses the Policy Broker.
</details>

<details>
<summary><b>💰 Model Cost Guard & Visual Receipts</b></summary>
<br>

**Model Cost Guard:** `zavorth model-cost` estimates mission size, cost-surprise risk, provider tier and budget posture before live model use. 

**Visual Receipts 2.0:** `zavorth visual-receipts` renders operational receipts as product cards: what happened, what changed, what was blocked, whether rollback exists and what the next safe action is.
</details>

<details>
<summary><b>📱 Satellite Approval & Channel Mesh</b></summary>
<br>

**Satellite Approval Companion:** `zavorth satellite-approvals` projects the mobile approval inbox: scoped approval cards, approve/deny/preview decisions, and receipt previews.

**Channel Mesh:** Telegram, web, CLI and other channels routed through one normalized contract.
</details>

<details>
<summary><b>💻 CLI Experience & Terminal Commands</b></summary>
<br>

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
`zavorth agent-review` is the official governed review surface for patches and PRs.
</details>

---

## 🔒 Security Model & Posture

Zavorth assumes agentic systems fail in subtler ways than classic apps. The runtime is built around defense in depth:

* **Policy First:** Sensitive actions require policy and scoped, auditable approvals.
* **Secrets:** Raw secrets become `SecretRef` metadata, not prompt text.
* **Untrusted Content:** Web, tool and memory content are treated as untrusted.
* **Honest Status:** It favors honest status over false readiness. If a provider is down, it says so.

---

## 📚 Documentation

The public documentation is intentionally small and product-facing. Private audits and old implementation plans are intentionally kept out of the public tree.

* 📖 **[Docs Index](docs/README.md)**
* ⚡ **[Quickstart](docs/02-quickstart.md)**
* 🏗️ **[Architecture](docs/03-architecture.md)**
* 🖥️ **[Web Dashboard](docs/07-web.md)**
* ⌨️ **[CLI Guide](docs/34-zavorth-cli.md)**
* 🌐 **[Channel Mesh](docs/33-channel-mesh.md)**
* 🗺️ **[Roadmap](docs/11-roadmap.md)**

---
<div align="center">
  <sub>Built with security and governance for the age of autonomous work.</sub>
</div>
