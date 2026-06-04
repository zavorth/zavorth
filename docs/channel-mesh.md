# Channel Mesh

Channel Mesh is the canonical channel layer for Zavorth. It gives every channel the same operational contract while allowing each surface to render actions in its own native way.

Each channel exposes setup, doctor, pairing, live readiness and safe outbox semantics. Catalog support is not live readiness.

## Goal

Telegram, web, CLI, Discord, WhatsApp, Slack, Signal, iMessage, Teams and email should not become separate products. They should be thin surfaces over the same runtime:

- one session model;
- one policy layer;
- one approval model;
- one channel readiness projection;
- one set of receipts.

## Daily Usage

Users should be able to ask naturally:

```text
connect Zavorth to Discord
show channel status
prepare WhatsApp pairing
which channel is best for approvals?
run a channel doctor for Signal
```

Zavorth should respond with:

- detected channel;
- current mode;
- recommended mode;
- missing variables;
- webhook status when relevant;
- next safe action;
- equivalent CLI/API path for operators.

## Canonical Surfaces

```bash
zavorth channels discord
zavorth connectors doctor discord
```

Protected runtime surfaces:

```text
GET  /api/web/channels
POST /api/web/channels/actions
GET  /api/operations/channels
POST /api/operations/channels/actions
```

## Channel States

Each channel should expose honest readiness:

- `ready`: configured and usable;
- `needs_setup`: known but missing configuration;
- `dry_run`: available for planning only;
- `experimental`: supported with explicit caveats;
- `blocked`: policy prevents use;
- `unsupported`: known but not supported by this runtime.

Readiness is stronger than catalog support. The Runtime API channel projection also exposes:

- `liveReady`: true only when the runtime has health, recent event, or bridge status;
- `readinessSource`: `health`, `live_event`, `bridge`, `configuration`, `catalog`, `none`, or `blocked`;
- `defaultRouteAllowed`: true only when a ready channel has live readiness and an outbound/session path;
- `defaultBlockReason`: the human reason a channel cannot be used as a default live route.

A configured adapter, catalog entry, QR-ready pairing flow, or local stub must not be presented as a live channel until `liveReady` and `defaultRouteAllowed` are both true.

## First-Class Channels

| Channel | Expected posture |
| --- | --- |
| `telegram` | Live channel with policy and approvals |
| `web` | Main ZavorthControl surface |
| `discord` | Native gateway when configured |
| `whatsapp` | Cloud API or local bridge when configured |
| `slack` | Native inbound/outbound when configured |
| `signal` | Local bridge through `signal-cli`/JSON-RPC |
| `imessage` | macOS bridge, read-only by default |
| `teams` | Microsoft Graph/Bot Framework path |
| `email` | SMTP/IMAP fallback for notifications and approvals |

## Actions

Common actions:

- `inspect`;
- `policy`;
- `prepare`;
- `doctor`;
- `repair`;
- `send-test`;
- `broadcast-test`;
- `status`;
- `login-qr`;
- `relink`;
- `logout`.

Actions must be policy-gated. Sending messages, changing recipients, enabling webhooks or using live bridges requires explicit approval when risk is non-trivial.

Sensitive actions such as `broadcast-test`, `send-test`, `relink` and `logout` also require the selected channel to be default-route-ready. If it is only catalogued or configured, Zavorth returns a manual next step instead of touching the bridge.

## Local Bridge Outboxes

When a provider is not live, adapters may persist outbound envelopes locally instead of pretending that a message was sent:

- `data/slack-bridge/outbox`;
- `data/whatsapp-bridge/outbox`;
- `data/signal-bridge/outbox`;
- `data/imessage-bridge/outbox`;
- `data/email-bridge/outbox`.

## Policy

Local channel policy lives in:

```text
.zavorth/channel-policies.json
```

The default stance should be conservative: deny unknown recipients, allow explicit operators, and keep public channels narrow.

## Telegram

Telegram is treated as a first-class Channel Mesh surface. Its native menu should remain short to avoid API overflow, while the full command catalog remains available through `/help`, `/zavorth` and shared runtime commands.

## WhatsApp

WhatsApp should clearly separate Cloud API, local bridge and QR pairing modes. QR visibility belongs in the backend/API projection and the ZavorthControl, with no claim of live readiness until the provider is actually connected.

## Signal

Signal is a local bridge. Use a dedicated account, explicit allowed recipients and closed policy by default. Zavorth should never imply that Signal has an official Bot API.

## iMessage

iMessage is a macOS bridge. It should begin read-only and approval-first. Sending requires explicit trust and recipient policy.
