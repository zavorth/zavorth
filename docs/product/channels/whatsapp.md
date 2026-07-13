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

## Setup — Baileys bridge (local, T2 experimental)

Baileys runs in an **isolated Node process** under `scripts/whatsapp-bridge/`. It is never a core dependency. Core only speaks HTTP (`/health`, `/send`, `/messages`).

```bash
cd scripts/whatsapp-bridge
npm install
cd ../..
```

```env
WHATSAPP_ENABLED=true
WHATSAPP_PROVIDER=baileys
WHATSAPP_BRIDGE_URL=http://127.0.0.1:3910
WHATSAPP_ALLOWED_CHAT_IDS=+15555550123
# optional: push inbound into the host webhook
# ZAVORTH_WHATSAPP_INBOUND_URL=http://127.0.0.1:3000/api/webhooks/whatsapp
```

```bash
npx tsx scripts/zavorth-whatsapp-bridge.ts start
# or pair-only:
npx tsx scripts/zavorth-whatsapp-bridge.ts pair
npx tsx scripts/zavorth-whatsapp-bridge.ts status --json

# Local loop without a public webhook: long-poll inbound into the host process
npx tsx scripts/zavorth-whatsapp-bridge.ts poll
# one-shot:
npx tsx scripts/zavorth-whatsapp-bridge.ts poll-once --json
```

Scan the QR printed by the bridge (**WhatsApp → Linked Devices → Link a Device**).

Boot integration (optional):

```env
WHATSAPP_BRIDGE_AUTOSTART=1   # spawn bridge process with host
WHATSAPP_BRIDGE_POLL=1        # long-poll /messages into WhatsAppGateway
```

Without poll/webhook, the bridge can send outbound via `WHATSAPP_BRIDGE_URL` but will not feed inbound into the agent.

<Warning>
Baileys is **T2 experimental**. Unofficial protocol. Disconnects happen. Prefer **Cloud API (T1)** for production. A bridge crash must not take down the Zavorth core process.
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

- [All channels](/docs/product/channels)
- [Telegram](/docs/product/channels/telegram)
- [Approvals](/docs/product/concepts/approvals)
