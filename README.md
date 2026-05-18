<!-- Hero Section -->
<div align="center">
  <img src="assets/brand/zavorth-readme-banner.png" alt="Zavorth Banner" width="100%" style="border-radius: 12px; margin-bottom: 24px;" />

  <h1 align="center">Zavorth</h1>
  
  <h3>Local-first agent runtime for governed, auditable daily work.</h3>
  <p>Turn natural-language requests into supervised execution, approvals, artifacts, memory, sessions, channels and operational receipts.</p>

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
</div>

---

<div align="center">
  <strong>Ask naturally, execute safely, keep evidence.</strong>
</div>

---

## ✨ Why Zavorth?

Zavorth is not just another chatbot. It is a **governed agent operating system** for people who want AI to help with real work, without giving it silent, unlimited control over their machine. 

<table width="100%" border="0" cellspacing="0" cellpadding="0">
  <tr>
    <td width="50%" valign="top">
      <h3>🖥️ Dashboard Gateway</h3>
      <p>A beautiful local gateway for tracking requests, status, approvals, and viewing operational artifacts cleanly without terminal clutter.</p>
    </td>
    <td width="50%" valign="top">
      <h3>⚖️ Policy Broker</h3>
      <p>One unified decision plane for tools, providers, web fetches, skills, MCP integrations, and local file writes.</p>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <h3>📜 Trust Plane</h3>
      <p>Continuous generation of operational receipts, strict prompt-injection boundaries, and secure approval envelopes for every action.</p>
    </td>
    <td width="50%" valign="top">
      <h3>🧠 Agent Runtime</h3>
      <p>Robust orchestration of sessions, memory, delegated subagents, skills, scheduled workloads, and reliable state recovery.</p>
    </td>
  </tr>
</table>

---

## 🚀 Quickstart (First 60 Seconds)

Zavorth is moving toward a private local runtime/installer. Currently, the npm package is the clean developer install path.

```bash
# 1. Install globally
npm install -g zavorth@latest

# 2. Initialize the environment
zavorth start

# 3. Open the dashboard gateway
zavorth go
```

*(From a cloned repository: `npm install`, `npm run zavorth:start`, `npm run go`)*

Once running, use the dashboard like a normal request surface:
> *"Review this repository and tell me what is risky."* <br>
> *"Connect the safest channel for daily approvals."* <br>
> *"Use subagents to inspect this codebase and summarize the findings."*

---

## 🛠️ The Zavorth Ecosystem

Zavorth adapts to your workflow with a massive suite of governed surfaces. <br>
**Click any feature below to expand and learn more:**

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
