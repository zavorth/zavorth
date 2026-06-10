---
title: "Channels"
description: "Connect Zavorth to Telegram, Discord, WhatsApp, Slack, Signal, iMessage, Teams, Email, and more."
---

Zavorth works from the channels you already use. One runtime, every surface: the same Zavorth whether you are in the browser dashboard, Telegram, Slack, WhatsApp, Discord, Signal, Email, or another configured route.

Live-ready means this local installation has passed its own doctor/live proof with your credentials, allowlists, and channel policy. A channel being catalogued or scaffolded does not mean it can send or receive live messages yet.

## Available channels

| Channel | Default status | Notes |
|---|---|---|
| **ZavorthControl** | Local ready | Browser dashboard; available without external channel credentials |
| **CLI** | Local ready | Terminal; available without external channel credentials |
| **Telegram** | Fast setup, proof-gated | Recommended first phone channel; bot token plus allowlist |
| **Discord** | Setup + doctor required | Native gateway with slash commands after bot token, guild policy, and proof |
| **WhatsApp** | Setup + live proof required | Cloud API or local Baileys bridge; webhook/QR is not live proof by itself |
| **Slack** | Setup + live proof required | Native bot or outbox/stub until token, signing secret, allowlist, and proof pass |
| **Signal** | Local bridge required | signal-cli/JSON-RPC bridge with a dedicated account and allowlist |
| **iMessage** | macOS bridge required | Read-only by default; sending needs allowlist and explicit proof |
| **Microsoft Teams** | Setup + live proof required | Microsoft Graph / Bot Framework credentials and tenant policy |
| **Email** | Outbox first, SMTP/IMAP proof required | Notifications and approvals after recipients and mail transport are proven |
| Matrix | Catalogued | Needs setup and credentials |
| Mattermost | Catalogued | Needs setup and credentials |
| Google Chat | Catalogued | Needs setup and credentials |
| Feishu / Lark | Catalogued | Needs setup and credentials |
| WeChat / WeCom / QQ | Catalogued | Needs setup and credentials |
| IRC / LINE / Zalo | Catalogued | Needs setup and credentials |
| Home Assistant | Catalogued | Needs setup and credentials |

**Catalogued** means the channel is known by Zavorth but is not live-ready. It needs activation, credentials, allowlists, and a successful doctor/live proof before it can become a default route.

## Setting up a channel

Each channel has its own setup command:

```bash
zavorth channels telegram
zavorth channels discord
zavorth channels slack
zavorth channels whatsapp
zavorth channels signal
```

These commands walk you through the required credentials and allowlist setup. They preview everything before writing; no secrets are stored until you confirm.

After setup, check that everything is working:

```bash
zavorth connectors doctor telegram
zavorth connectors doctor discord
npm run zavorth:channel-connection-playbook -- --channel slack
npm run zavorth:channel-connection-playbook -- --channel whatsapp --mode cloud-api
```

## Safety by default

Every channel uses the same safety model:

- **Allowlist** - only approved senders can trigger actions
- **Policy** - each channel has its own open/closed/allowlist mode
- **Approval routing** - sensitive tasks ask for your OK regardless of which channel sent them
- **Live proof** - default routes require a successful doctor/live proof in this installation

Channel policy lives in `.zavorth/channel-policies.json`. You can also set it per-channel in `.env`:

```env
ZAVORTH_CHANNEL_POLICY_TELEGRAM_ALLOWED=your_telegram_id
ZAVORTH_CHANNEL_POLICY_WHATSAPP_ALLOWED=+15555550123
```

## Channel guides

<Columns>
  <Card title="Telegram" href="/docs/produto/canais/telegram" icon="send">
    The fastest channel to set up. Just a bot token and an allowlist.
  </Card>
  <Card title="Discord" href="/docs/produto/canais/discord" icon="message-square">
    Native bot with slash commands, server allowlists, and doctor proof.
  </Card>
  <Card title="WhatsApp" href="/docs/produto/canais/whatsapp" icon="smartphone">
    Cloud API or local Baileys bridge, both proof-gated before live use.
  </Card>
  <Card title="Slack" href="/docs/produto/canais/slack" icon="hash">
    Native Slack bot or outbox/stub while setup is incomplete.
  </Card>
  <Card title="Signal" href="/docs/produto/canais/signal" icon="lock">
    Local bridge via signal-cli. Dedicated account strongly recommended.
  </Card>
  <Card title="Email" href="/docs/produto/canais/email" icon="mail">
    SMTP/IMAP for notifications and approval requests after recipient proof.
  </Card>
</Columns>

## Related

- [Getting started](/docs/produto/start/getting-started)
- [Approvals](/docs/produto/conceitos/aprovacoes)
- [Features](/docs/produto/conceitos/features)
