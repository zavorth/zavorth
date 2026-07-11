---
title: "First use"
description: "A simple guide to install, chat, connect a model, and understand what Zavorth does before changing anything important."
---

# First use

This page is for anyone who wants to start from scratch and use Zavorth without learning its internal architecture.

## First pass (≤4 steps)

Enough to chat usefully. Full platform setup (channels, skills, routines, evals) can wait.

<Steps>
  <Step title="Install">
    ```bash
    npm install -g zavorth@latest
    ```

    Then verify:

    ```bash
    zavorth --version
    ```
  </Step>

  <Step title="Basic setup (prove one provider)">
    ```bash
    zavorth setup
    ```

    Setup asks for the bare minimum: AI model, provider key, language, usage profile, and how Zavorth should act when a task seems sensitive. Provider proven is enough for `chatReady` — you do not need the full 8-step platform checklist.
  </Step>

  <Step title="Open the daily surface">
    ```bash
    zavorth start
    # or
    zavorth open
    ```

    Both open the daily work surface (live via `ops-go`), not a guide-only help page. Chat is the center; configuration, memory, skills, receipts, and channels sit around it.
  </Step>

  <Step title="Send a real message">
    Prefer a safe first win:

    ```text
    In plain language, explain what this project does and suggest three useful things you can help me with today without changing any files.
    ```

    For your first automation:

    ```text
    Organize my tasks for today and tell me what you need me to approve.
    ```
  </Step>
</Steps>

## Full platform setup

Optional after chat works: experience profile, channel proof, runtime profile, learned memory review, tools/skills intake, scheduled routines, and quality evals. See [Daily use trail](/docs/daily-use-trail).

## What to expect from the first conversation

Zavorth can respond in three ways:

- **Direct response**: when it only needs to chat, summarize, or explain.
- **Preview**: when it wants to show the plan before acting.
- **Approval**: when the action involves files, commands, external sends, secrets, channels, providers, or security changes.

If it asks for approval, this is not an error. It is the moment where you see what will happen before allowing it.

## Connecting a model

If setup does not have a model ready yet:

```bash
zavorth readiness
```

Open the providers section in the dashboard and follow the next step shown. Usually, you only need to paste your chosen provider's key and test the connection.

Useful guides:

- [Providers](/docs/product/providers)
- [Gemini](/docs/product/providers/gemini)
- [Anthropic](/docs/product/providers/anthropic)
- [Local model](/docs/product/providers/local)

## Connecting a channel

You can use Zavorth only through the dashboard. Channels like Telegram, Slack, WhatsApp, Signal, Email, and Discord are optional.

Start with one channel, test it, and only then connect others:

- [Telegram](/docs/product/channels/telegram)
- [Slack](/docs/product/channels/slack)
- [WhatsApp](/docs/product/channels/whatsapp)
- [Discord](/docs/product/channels/discord)
- [Email](/docs/product/channels/email)

Each channel should show if it is ready, in preview, or just waiting for credentials. If it is not ready, Zavorth should tell you the reason and the next step.

## Memory without black box

When Zavorth learns something useful, you should be able to see:

- what was learned;
- where it came from;
- what is the confidence;
- when it expires;
- how to edit or forget it.

Simple preferences can be applied silently. Sensitive things require review.

## If something goes wrong

Run:

```bash
zavorth readiness
```

Then check:

- [Guided troubleshooting](/docs/product/help/troubleshooting)
- [ZavorthControl](/docs/product/interfaces/zavorthcontrol)
- [How approvals work](/docs/product/concepts/approvals)

## Rule of thumb

Use Zavorth like a normal assistant. When something requires care, it will show a clear preview, ask for your decision, and leave a receipt for you to review later.
