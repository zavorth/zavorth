---
title: "Telegram"
description: "Connect Zavorth to Telegram in a few minutes. Just a bot token and your user ID."
---

Telegram is the fastest channel to set up and the most reliable for daily use. Once connected, you can chat with Zavorth, approve tasks, and get notifications — all from your phone or desktop app.

## What you need

- A Telegram account
- Your Telegram user ID (a number, not your username)

## Setup

<Steps>
  <Step title="Create a bot">
    1. Open Telegram and search for **@BotFather**
    2. Send `/newbot`
    3. Choose a name and a username for your bot (username must end in `bot`)
    4. BotFather gives you a **bot token** — copy it

    <Note>
    Keep this token private. Anyone with it can control your bot.
    </Note>
  </Step>

  <Step title="Find your user ID">
    Search for **@userinfobot** on Telegram and send it any message. It replies with your user ID (a number like `123456789`).
  </Step>

  <Step title="Run the Telegram wizard">
    ```bash
    zavorth channels telegram
    ```

    The wizard walks you through entering your bot token and user ID. It previews the configuration and only writes it when you confirm.

    Or set it directly in `.env`:
    ```env
    TELEGRAM_BOT_TOKEN=your_bot_token_here
    TELEGRAM_ALLOWED_USER_IDS=123456789
    ```
  </Step>

  <Step title="Apply and verify">
    ```bash
    zavorth channels telegram --apply --allowed-users 123456789
    zavorth connectors doctor telegram
    ```

    The doctor command tells you if the channel is live-ready or what is still missing.
  </Step>

  <Step title="Start and test">
    ```bash
    zavorth start
    ```

    Open your bot in Telegram and send a message. You should get a response from Zavorth.
  </Step>
</Steps>

## Daily use

Once connected, Telegram is a full interface for Zavorth:

```
# Ask anything
What files changed in the last git commit?

# Run a task
Review the PR and summarize the changes.

# Approve a pending action
approve abc123

# Check status
zavorth status
```

Approval requests from any channel appear in Telegram automatically if it is your configured notification channel.

## Multiple users

To allow more than one person to use your Zavorth:

```env
TELEGRAM_ALLOWED_USER_IDS=123456789,987654321
```

Each user gets their own session. Zavorth does not mix context between users.

## Roles

You can assign roles per user:

```env
TELEGRAM_USER_ROLES=123456789:admin|operator;987654321:viewer
```

- `admin` — full access including sensitive actions
- `operator` — can run tasks and approve
- `viewer` — read-only, can ask questions

## Group chats

Zavorth can join a Telegram group and respond when mentioned:

1. Add your bot to the group
2. Add the group chat ID to your allowed list
3. Mention `@yourbot` in the group to trigger Zavorth

In groups, Zavorth responds when directly addressed and stays quiet otherwise.

## Environment variables reference

| Variable | Required | Description |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Yes | Your BotFather token |
| `TELEGRAM_ALLOWED_USER_IDS` | Yes | Comma-separated user IDs |
| `TELEGRAM_USER_ROLES` | No | Role mapping per user |

## Troubleshooting

**Bot does not respond**
Run `zavorth connectors doctor telegram` — it tells you exactly what is missing or misconfigured.

**"Unauthorized" errors**
Your user ID is not in `TELEGRAM_ALLOWED_USER_IDS`. Check it with @userinfobot.

**Bot responds but actions do not run**
Run `zavorth ready` to check if the runtime and provider are configured correctly.

## Related

- [All channels](/docs/produto/canais)
- [Approvals](/docs/produto/conceitos/aprovacoes)
- [Getting started](/docs/produto/start/getting-started)
