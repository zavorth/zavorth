---
title: "What is Zavorth?"
description: "What Zavorth is and who it is for."
---

## The short answer

Zavorth is a personal AI assistant that runs on your own computer.

You message it from Desktop, Control, Telegram, Discord, WhatsApp, Slack, or a browser tab. It does real work — reads files, runs code, reviews pull requests, searches the web, manages tasks — and shows you what it did. Before anything sensitive happens, it asks you first.

It does not live in a cloud you do not control. Your conversations, your files, and your settings stay on your machine.

## Value order

1. **Useful intelligence** — multi-step work and tools that actually help.
2. **Daily habit** — open, ask, finish something; come back tomorrow.
3. **Trust** — approvals, receipts, and honest readiness (catalog is not Live).

Governance supports usefulness; it is not the whole product story.

## The longer version

Most AI tools are chatbots. They answer questions well but struggle with anything that requires doing actual work over time.

Zavorth is different. It is built to be your **daily operator** — the thing that handles the boring, complex, or repetitive work while you focus on what matters.

### It gets work done

Zavorth plans multi-step jobs, uses tools when needed, and recovers when a step fails. Intelligence is measured with hermetic gates (`agent:smartness:check`), not only marketing claims.

### It fits a daily loop

Open Desktop (or Control), ask in plain language, approve only when risk is real. Full platform setup is optional after chat works.

### It asks before it acts

Other AI tools just do things. Zavorth shows you what it plans to do first, waits for your approval on anything risky, and logs everything it did with a receipt. You can review, undo, or ask why at any point.

### It works from your existing apps

You do not need to change your whole workflow. Zavorth can connect to apps you already use — Telegram, Discord, WhatsApp, Slack — after each channel is proven Live.

### It is not locked to one AI model

You choose which AI model powers Zavorth. Google Gemini, Claude, GPT, DeepSeek, a local model running on your own hardware — or several, with routing based on the task.

### It grows with you

You can install ready-made skills to give Zavorth new abilities, or teach it your own workflows. Learned memory stays draft-only until you promote it.

## Who is Zavorth for?

| Audience | Path |
|----------|------|
| **Personal** | Private daily operator — short answers, low friction. First-run Desktop audience **Personal**. |
| **Developers** | Code, repo review, step-by-step plans. First-run audience **Developer**. |
| **Business / ops** | Evidence-first summaries, stricter approvals. First-run audience **Business**. |
| **Power users** | Deeper surfaces after setup; profile `power` from settings when needed. |
| **Privacy-minded people** | Local-first by default; no hosted chat required. |

### Non-developer path (no CLI required)

1. **Setup app** — install/repair the local runtime (`apps/zavorth-setup` / packaged Setup).
2. **Desktop** — open Zavorth Desktop; complete first-run (audience → provider → trust → first ask).
3. **Chat** — send a safe first request; approve only when Review asks.

CLI (`zavorth setup`, `zavorth start`) remains available for operators and developers. See [daily-use-trail.md](../../daily-use-trail.md) and [zavorth-desktop-setup.md](../../zavorth-desktop-setup.md).

## Related

- [Getting started](/docs/product/start/getting-started)
- [Full feature list](/docs/product/concepts/features)
- [How approvals work](/docs/product/concepts/approvals)
- [Product story](/docs/product-story)
