---
title: "WhatsApp"
description: "Connect Zavorth to WhatsApp via the official Cloud API or a local bridge."
---

Zavorth connects to WhatsApp in two modes: the **official Cloud API** (requires a Meta developer account) or a **local Baileys bridge** (no official account needed, runs on your phone's WhatsApp session).

## Modes at a glance

| Mode | Requirements | Best for |
|---|---|---|
| **Cloud API** | Meta Business account + phone number | Production use, stable |
| **Baileys bridge** | Existing WhatsApp account, QR scan | Personal use, no business account |
| **Stub** | Nothing | Testing locally without a real connection |

## Setup — Cloud API

<Steps>
  <Step title="Create a Meta app">
    1. Go to [developers.facebook.com](https://developers.facebook.com)
    2. Create a new app → choose **Business**
    3. Add the **WhatsApp** product
    4. Get a **Phone Number ID** and a **Permanent Access Token**
  </Step>

  <Step title="Configure Zavorth">
    ```env
    WHATSAPP_ENABLED=true
    WHATSAPP_PROVIDER=cloud-api
    WHATSAPP_CLOUD_API_VERSION=v20.0
    WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
    WHATSAPP_ACCESS_TOKEN=your_access_token
    WHATSAPP_WEBHOOK_VERIFY_TOKEN=choose_any_secret_string
    WHATSAPP_ALLOWED_CHAT_IDS=+15555550123
    ```
  </Step>

  <Step title="Configure the webhook">
    WhatsApp sends incoming messages to a webhook URL. You need a publicly accessible URL pointing to your Zavorth instance.

    For local testing, use a tunnel:
    ```bash
    cloudflared tunnel --url http://localhost:3000
    ```

    Set the webhook URL in the Meta Developer Portal:
    `https://your-tunnel-url.trycloudflare.com/api/channels/whatsapp/webhook`
  </Step>

  <Step title="Verify and start">
    ```bash
    zavorth connectors doctor whatsapp
    zavorth start
    ```
  </Step>
</Steps>

## Setup — Baileys bridge (local)

The Baileys bridge connects Zavorth to your personal WhatsApp account via a local QR scan — no Meta account needed.

```env
WHATSAPP_ENABLED=true
WHATSAPP_PROVIDER=baileys
WHATSAPP_ALLOWED_CHAT_IDS=+15555550123
```

```bash
zavorth channels whatsapp --prepare   # shows QR code to scan
```

Scan the QR with your WhatsApp app (**Settings → Linked Devices → Link a Device**).

<Warning>
Baileys is a reverse-engineered bridge. WhatsApp may occasionally disconnect linked sessions. This mode is suitable for personal use, not for production.
</Warning>

## Allowlist

WhatsApp should only respond to numbers you trust:

```env
WHATSAPP_ALLOWED_CHAT_IDS=+15555550123,+44207946000
```

Or set it in channel policy:

```env
ZAVORTH_CHANNEL_POLICY_WHATSAPP_ALLOWED=+15555550123
```

Messages from numbers not on the allowlist are silently ignored.

## Environment variables reference

| Variable | Required | Description |
|---|---|---|
| `WHATSAPP_ENABLED` | Yes | Set to `true` to enable |
| `WHATSAPP_PROVIDER` | Yes | `cloud-api`, `baileys`, or `stub` |
| `WHATSAPP_PHONE_NUMBER_ID` | Cloud API only | From Meta Developer Portal |
| `WHATSAPP_ACCESS_TOKEN` | Cloud API only | From Meta Developer Portal |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Cloud API only | Any secret string |
| `WHATSAPP_ALLOWED_CHAT_IDS` | Recommended | Comma-separated phone numbers |

## Troubleshooting

**No messages received (Cloud API)**
Check the webhook URL is publicly accessible and matches what's in the Meta portal. Run `zavorth connectors doctor whatsapp`.

**QR code expired (Baileys)**
Re-run `zavorth channels whatsapp --prepare` to generate a fresh QR.

**Messages sent but not delivered**
Check that `WHATSAPP_PHONE_NUMBER_ID` and `WHATSAPP_ACCESS_TOKEN` are correct in Cloud API mode.

## Related

- [All channels](/docs/produto/canais)
- [Telegram](/docs/produto/canais/telegram)
- [Approvals](/docs/produto/conceitos/aprovacoes)
