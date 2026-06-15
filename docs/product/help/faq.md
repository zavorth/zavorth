---
title: "FAQ"
description: "Common questions about Zavorth — how it works, what it costs, and what it can and cannot do."
---

## General

### What is Zavorth?

Zavorth is a personal AI assistant that runs on your own machine and connects to the apps you already use — Telegram, Discord, WhatsApp, Slack, and more. It does real work (reads files, runs code, manages tasks) and always asks before anything sensitive happens.

### Is it free?

Zavorth itself is free and open source. The AI model that powers it is not — you pay your chosen provider (Gemini, OpenAI, Anthropic, etc.) for API usage. Many providers have a free tier that covers personal use.

Running a local model (Ollama, LM Studio) is completely free — no API, no usage costs.

### Does it need an internet connection?

Only to talk to your AI provider. If you run a local model with Ollama or LM Studio, Zavorth works fully offline.

### Is my data private?

Yes. Zavorth runs on your machine. Your conversations and files never go anywhere except to the AI provider you choose (for generating responses). If you use a local model, nothing leaves your machine at all.

---

## Setup

### What do I need to get started?

- Node.js 18 or newer
- An API key from any AI provider (or Ollama installed for local models)
- About 5 minutes

See [Getting started](/docs/product/start/getting-started).

### Can I use it on Windows?

Yes — Zavorth runs natively on Windows. WSL2 is optional but recommended for the full experience (especially for shell commands and Docker-based sandboxing).

### Can I change the AI model after setup?

Anytime, without restarting:
```bash
zavorth providers switch
```

### Can I use multiple AI models?

Yes. You can configure multiple providers and Zavorth switches between them based on availability and task type. The Capability Mesh can route specific tasks to specific models.

---

## Channels

### What channels does Zavorth support?

Telegram, Discord, WhatsApp, Slack, Signal, iMessage, Microsoft Teams, Email — and 20+ more that are catalogued for activation. See [Channels](/docs/product/channels).

### Do I need to set up a channel, or can I just use the dashboard?

The ZavorthControl browser dashboard is always available — no channel setup required. Channels are optional extras for using Zavorth from your phone or existing chat apps.

### Can multiple people use the same Zavorth?

Yes. Configure `TELEGRAM_ALLOWED_USER_IDS` (or the equivalent for each channel) with multiple IDs. Each user gets their own session — context is not shared between users.

---

## Skills and memory

### What is a skill?

A skill is a Markdown file that teaches Zavorth how to do a specific task — like reviewing a PR, booking a calendar slot, or running a deployment. See [Skills](/docs/product/skills).

### Can Zavorth learn from my habits?

Yes. When Zavorth notices repeated patterns, it suggests a skill. You approve or reject the suggestion. See [Creating skills](/docs/product/skills/create).

### How long does Zavorth remember things?

Until you delete them. Memory is stored locally in `.zavorth/` as SQLite (for fast search) and Markdown files (for readability). There is no expiry.

### Can I import my setup from another compatible runtime?

Yes:
```bash
zavorth migrate --from compatible-runtime --path ~/.agent-runtime --consent
```

---

## Safety

### What does "approval" mean?

Before Zavorth does anything sensitive — writing files, running commands, sending messages — it shows you a preview and waits. You approve or reject. See [Approvals](/docs/product/concepts/approvals).

### Can Zavorth do things silently?

Reading files, searching the web, and answering questions happen without approval — these are read-only and safe. Anything that changes something always prompts.

### What if Zavorth does something I didn't want?

Check the receipts:
```bash
zavorth receipts
```

For reversible actions, roll back:
```bash
zavorth rollback <receipt-id>
```

Then tighten your approval settings:
```bash
zavorth setup --safety
```

### Is my API key safe?

Yes. API keys are stored in your local `.env` file — never in plain text in memory, never logged, never sent anywhere except to the provider's API endpoint. Zavorth never prints raw keys.

---

## Related

- [Getting started](/docs/product/start/getting-started)
- [Troubleshooting](/docs/product/help/troubleshooting)
- [Approvals](/docs/product/concepts/approvals)
