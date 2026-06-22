<div align="center">

  <img src="assets/brand/zavorth-readme-banner.png" alt="Zavorth" width="100%" />

  <h1>Zavorth</h1>

  <p><strong>Your AI that does things — and proves it.</strong></p>

  <p>
    Ask naturally. Watch it plan. Approve only real risk.<br/>
    Get receipts for everything that happened.
  </p>

  <p>
    <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-proprietary-red?style=for-the-badge"></a>
    <a href="docs/security.md"><img alt="Security" src="https://img.shields.io/badge/security-governed-0f766e?style=for-the-badge"></a>
    <a href="#start-fast"><img alt="Quick Start" src="https://img.shields.io/badge/quickstart-30_seconds-00e88f?style=for-the-badge"></a>
  </p>

  <p>
    <a href="#what-zavorth-does">What It Does</a> ·
    <a href="#start-fast">Quick Start</a> ·
    <a href="#daily-flow">Daily Flow</a> ·
    <a href="#features">Features</a> ·
    <a href="#commands">Commands</a> ·
    <a href="#trust-model">Trust</a> ·
    <a href="docs/README.md">Docs</a>
  </p>

</div>

---

> *"Talk to it like a colleague. It listens, plans, asks before acting, and keeps proof of everything."*

---

## What Zavorth Is

Zavorth is an AI agent that actually does things — safely.

You describe what you want in plain language. Zavorth plans the work, shows you what it's about to do, waits for your approval on anything risky, and then executes. Afterward, you get a receipt: a clear, auditable record of what happened.

No silent takeovers. No surprise commands. No "trust me."

**Think of it as:** your personal AI operator that works with local control, explicit trust, and visible receipts.

---

## Start Fast

```bash
npm install -g zavorth@latest
```

Then:

```bash
npx zavorth setup    # guided setup (30 seconds)
npx zavorth start    # start the runtime
npx zavorth open     # open the dashboard
```

Or just chat:

```bash
npx zavorth chat
```

**First safe request:**
```
Review this repository and tell me what is risky.
```

Zavorth will read the code, think about it, and give you a structured answer. No side effects. No changes. Just analysis.

---

## Daily Flow

```
    ┌─────────────┐
    │  You speak  │  "Summarize my inbox and draft a reply"
    └──────┬──────┘
           │
    ┌──────▼──────┐
    │  Zavorth    │  Classifies intent, picks tools, plans steps
    │  plans      │
    └──────┬──────┘
           │
    ┌──────▼──────┐
    │  Preview    │  Shows what it will do before doing it
    └──────┬──────┘
           │
    ┌──────▼──────┐
    │  You approve│  "Go ahead" or "Change this part"
    └──────┬──────┘
           │
    ┌──────▼──────┐
    │  Execution  │  Runs through governed gateway only
    └──────┬──────┘
           │
    ┌──────▼──────┐
    │  Receipt    │  Clear record: what, when, result, who approved
    └─────────────┘
```

1. **Ask naturally** — in the Dashboard, CLI, Telegram, or API
2. **Zavorth plans** — classifies intent, picks the right tools
3. **Preview** — low-risk work runs fast; sensitive work shows a plan first
4. **You approve** — accept, reject, defer, or grant scoped permissions
5. **Execution** — runs only through the governed gateway
6. **Receipt** — you get proof: what happened, when, and why

---

## Features

<table>
<tr>
<td width="50%">

### Daily Assistant
Ask questions, get answers, manage reminders, organize files.

### Code Review
Read-only by default. Patches only after your approval.

### Memory
Learns what matters. Forgets what doesn't. Scoped to your workspace.

</td>
<td width="50%">

### Multi-Channel
Telegram, Discord, WhatsApp, Slack, and 25+ more.

### Skills
88+ built-in skills. Install from marketplace. Custom skills welcome.

### Voice
Talk to it. It listens, thinks, and responds.

</td>
</tr>
<tr>
<td>

### Provider Flexibility
OpenAI, Anthropic, Gemini, Ollama, OpenRouter, and more.

### Swarm
Multiple agents working together with budgets and isolation.

</td>
<td>

### Transaction Plane
Simulation before execution. Receipts after.

### Self-Modification
Controlled self-evolution with approval gates.

</td>
</tr>
</table>

---

## Commands

| Command | What it does |
|---------|-------------|
| `zavorth setup` | Guided setup for providers, channels, and safety |
| `zavorth start` | Start the local runtime |
| `zavorth open` | Open the Dashboard |
| `zavorth chat` | Terminal chat session |
| `zavorth ask "..."` | One-shot governed request |
| `zavorth providers` | Show provider readiness |
| `zavorth providers add` | Add a new provider with guided wizard |
| `zavorth channels telegram` | Connect Telegram |
| `zavorth channels discord` | Connect Discord |
| `zavorth skills` | Browse available skills |
| `zavorth marketplace list` | Browse skill marketplace |
| `zavorth trajectory --stats` | Export training data stats |
| `zavorth trust` | Inspect approval posture |
| `zavorth doctor` | Diagnose issues |

---

## Trust Model

Zavorth is proactive without being reckless.

- **Preview before execute** — sensitive actions show a plan first
- **Approval gates** — you decide what needs your OK
- **Receipts** — every action gets a clear audit trail
- **Scoped permissions** — approvals expire, are limited by time/action/channel
- **Break-glass mode** — for emergencies, still audited and revocable
- **No secret leaks** — credentials stay local, never serialized to prompts or logs
- **Status honesty** — tells you when something isn't ready instead of pretending

---

## What Makes Zavorth Different

| | Zavorth | Typical AI Agent |
|---|---|---|
| **Execution** | Governed with receipts | Run and hope |
| **Approvals** | Per-action, scoped, auditable | All or nothing |
| **Memory** | Scoped, with consent | Global, uncontrolled |
| **Self-modification** | Preview → approve → apply | Immediate or not available |
| **Status** | Honest about what's ready | Pretends everything works |
| **Multi-agent** | Budgeted, isolated, replayable | Free-for-all |

---

## Documentation

- [Quickstart](docs/quickstart.md)
- [Capabilities](docs/capabilities.md)
- [Architecture](docs/architecture.md)
- [Security](docs/security.md)
- [Channels](docs/telegram.md)
- [Dashboard](docs/web-dashboard.md)
- [CLI Guide](docs/zavorth-cli.md)
- [Skills](docs/skills.md)
- [Self-Modification](docs/self-modification.md)
- [Operations](docs/operations.md)

---

<div align="center">

  <sub>Built with local control, explicit trust, and visible receipts.</sub>

</div>
