---
title: "Slack"
description: "Connect Zavorth to Slack as a native bot with channel and workspace allowlists."
---

Zavorth connects to Slack as a native bot that listens to messages, runs tasks, and routes approvals — across private channels, DMs, or wherever you configure it.

## What you need

- A Slack workspace where you have admin access (or can request a bot install)

## Setup

<Steps>
  <Step title="Create a Slack app">
    1. Go to [api.slack.com/apps](https://api.slack.com/apps)
    2. Click **Create New App** → **From scratch**
    3. Give it a name and choose your workspace
    4. Go to **OAuth & Permissions** → add these **Bot Token Scopes**:
       - `chat:write`
       - `im:history`
       - `im:read`
       - `channels:history`
       - `channels:read`
    5. Click **Install to Workspace** → copy the **Bot User OAuth Token**
    6. Under **Basic Information** → copy the **Signing Secret**
  </Step>

  <Step title="Configure Zavorth">
    ```env
    SLACK_ENABLED=true
    SLACK_TRANSPORT=native
    SLACK_BOT_TOKEN=xoxb-your-token-here
    SLACK_SIGNING_SECRET=your_signing_secret
    SLACK_ALLOWED_CHANNEL_IDS=C0123456789
    ```
  </Step>

  <Step title="Configure the webhook (for incoming messages)">
    Slack sends events to a webhook URL. You need a public URL:

    ```bash
    cloudflared tunnel --url http://localhost:3000
    ```

    In your Slack app settings → **Event Subscriptions** → enable and set:
    `https://your-tunnel-url.trycloudflare.com/api/channels/slack/events`

    Subscribe to these bot events: `message.im`, `message.channels`
  </Step>

  <Step title="Verify and start">
    ```bash
    zavorth connectors doctor slack
    zavorth start
    ```

    Send a DM to your bot in Slack to test it.
  </Step>
</Steps>

## Allowlisting channels

Zavorth only responds in channels you explicitly allow:

```env
SLACK_ALLOWED_CHANNEL_IDS=C0123456789,C0987654321
```

To find a channel ID: right-click the channel in Slack → **Copy link** — the ID is the last part (`C0123456789`).

## DM support

Zavorth responds to direct messages from users in your workspace by default. To disable:

```env
SLACK_ALLOW_DMS=false
```

## Transport modes

| Mode | Description |
|---|---|
| `native` | Full Slack bot with real-time events (recommended) |
| `stub` | Local outbox only — for testing without a live connection |
| `auto` | Use native if token is present, otherwise stub |

```env
SLACK_TRANSPORT=auto
```

## Environment variables reference

| Variable | Required | Description |
|---|---|---|
| `SLACK_ENABLED` | Yes | Set to `true` |
| `SLACK_TRANSPORT` | No | `auto` (default), `native`, or `stub` |
| `SLACK_BOT_TOKEN` | Yes (native) | `xoxb-...` token from OAuth page |
| `SLACK_SIGNING_SECRET` | Yes (native) | From Basic Information page |
| `SLACK_ALLOWED_CHANNEL_IDS` | Recommended | Comma-separated channel IDs |
| `SLACK_WORKSPACE_ID` | No | Your Slack workspace ID |

## Troubleshooting

**Bot is in the workspace but does not respond**
Check `SLACK_ALLOWED_CHANNEL_IDS` includes the channel you are messaging in. Run `zavorth connectors doctor slack`.

**Events not arriving**
Verify the Event Subscriptions URL in your Slack app settings is correct and publicly accessible. Check that the bot events (`message.im`, `message.channels`) are subscribed.

**"not_in_channel" errors**
Invite the bot to the channel: in Slack, type `/invite @yourbot`.

## Related

- [All channels](/docs/produto/canais)
- [Approvals](/docs/produto/conceitos/aprovacoes)
- [Getting started](/docs/produto/start/getting-started)
