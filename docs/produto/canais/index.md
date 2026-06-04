---
title: "Channels"
description: "Connect Zavorth to Telegram, Discord, WhatsApp, Slack, Signal, iMessage, Teams, Email, and more."
---

Zavorth works from any channel you already use. One runtime, every surface — the same Zavorth whether you are on Telegram or Slack.

## Available channels

| Channel | Status | Notes |
|---|---|---|
| **Telegram** | ✅ Live | Recommended first channel — easiest to set up |
| **Discord** | ✅ Live | Native gateway with slash commands |
| **WhatsApp** | ✅ Live | Cloud API or local bridge (Baileys) |
| **Slack** | ✅ Live | Native bot or stub mode |
| **Signal** | ✅ Live | Via signal-cli local bridge |
| **iMessage** | ✅ Live | macOS bridge, read-only by default |
| **Microsoft Teams** | ✅ Live | Microsoft Graph / Bot Framework |
| **Email** | ✅ Live | SMTP/IMAP for notifications and approvals |
| **ZavorthControl** | ✅ Live | Browser dashboard — always available |
| **CLI** | ✅ Live | Terminal — always available |
| Matrix | Catalogued | Needs setup and credentials |
| Mattermost | Catalogued | Needs setup and credentials |
| Google Chat | Catalogued | Needs setup and credentials |
| Feishu / Lark | Catalogued | Needs setup and credentials |
| WeChat / WeCom / QQ | Catalogued | Needs setup and credentials |
| IRC / LINE / Zalo | Catalogued | Needs setup and credentials |
| Home Assistant | Catalogued | Needs setup and credentials |

**Catalogued** means the channel is planned and supported in the codebase but not yet live-ready — it needs activation and credentials.

## Setting up a channel

Each channel has its own setup command:

```bash
zavorth channels telegram
zavorth channels discord
zavorth channels slack
zavorth channels whatsapp
zavorth channels signal
```

These commands walk you through the required credentials and allowlist setup. They preview everything before writing — no secrets are stored until you confirm.

After setup, check that everything is working:

```bash
zavorth connectors doctor telegram
zavorth connectors doctor discord
```

## Safety by default

Every channel uses the same safety model:

- **Allowlist** — only approved senders can trigger actions
- **Policy** — each channel has its own open/closed/allowlist mode
- **Approval routing** — sensitive tasks ask for your OK regardless of which channel sent them

Channel policy lives in `.zavorth/channel-policies.json`. You can also set it per-channel in `.env`:

```env
ZAVORTH_CHANNEL_POLICY_TELEGRAM_ALLOWED=your_telegram_id
ZAVORTH_CHANNEL_POLICY_WHATSAPP_ALLOWED=+15555550123
```

## Channel guides

<Columns>
  <Card title="Telegram" href="/docs/produto/canais/telegram" icon="send">
    The fastest channel to set up. Just a bot token.
  </Card>
  <Card title="Discord" href="/docs/produto/canais/discord" icon="message-square">
    Native bot with slash commands and server allowlists.
  </Card>
  <Card title="WhatsApp" href="/docs/produto/canais/whatsapp" icon="smartphone">
    Cloud API or local Baileys bridge.
  </Card>
  <Card title="Slack" href="/docs/produto/canais/slack" icon="hash">
    Native Slack bot with channel and workspace allowlists.
  </Card>
  <Card title="Signal" href="/docs/produto/canais/signal" icon="lock">
    Local bridge via signal-cli. Private by default.
  </Card>
  <Card title="Email" href="/docs/produto/canais/email" icon="mail">
    SMTP/IMAP for notifications and approval requests.
  </Card>
</Columns>

## Related

- [Getting started](/docs/produto/start/getting-started)
- [Approvals](/docs/produto/conceitos/aprovacoes)
- [Features](/docs/produto/conceitos/features)
