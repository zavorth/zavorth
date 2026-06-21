---
title: "First use"
description: "A simple guide to install, chat, connect a model, and understand what Zavorth does before changing anything important."
---

# First use

This page is for anyone who wants to start from scratch and use Zavorth without learning its internal architecture.

## The happy path

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

  <Step title="Basic setup">
    ```bash
    zavorth setup
    ```

    Setup asks for the bare minimum: AI model, provider key, language, usage profile, and how Zavorth should act when a task seems sensitive.
  </Step>

  <Step title="Open the dashboard">
    ```bash
    zavorth start
    zavorth open
    ```

    The dashboard opens directly in the chat. Configuration, memory, skills, receipts, and channels are placed around it, so they won't interrupt your conversation.
  </Step>

  <Step title="Send a real message">
    Start with something simple:

    ```text
    Review this folder and tell me what this project does. Do not modify files.
    ```

    For your first automation:

    ```text
    Organize my tasks for today and tell me what you need me to approve.
    ```
  </Step>
</Steps>

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
