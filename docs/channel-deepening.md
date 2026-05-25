# Zavorth Channel Deepening

Phase 2 turns every known Zavorth communication surface into a governed Channel Mesh entry. The goal is not to pretend every channel is live. The goal is to make every channel predictable, inspectable and activation-ready.

Every channel now has the same public contract:

- setup command;
- doctor command;
- pairing or allowlist command;
- live proof command;
- safe outbox fallback when direct send is not proven;
- policy and receipt requirements;
- explicit missing configuration;
- honest status.

## Status Vocabulary

- `live_ready`: credentials, allowlist and a redacted live proof receipt exist.
- `native_ready`: configuration is present, but live proof is not stored yet.
- `outbox_ready`: direct live send is not configured, but Zavorth can safely stage messages locally.
- `setup_ready`: setup and doctor exist, but live operation is not configured.
- `requires_credentials`: credentials or recipient allowlists are missing.
- `requires_bridge`: a local or relay bridge must be installed/configured.
- `cataloged`: the surface is known and planned, but not live-ready.
- `blocked`: policy or runtime state prevents use.

Catalog is not live proof. A channel can appear in setup, onboarding and docs while still being blocked from live routing until credentials, pairing or allowlists, and proof receipts exist.

Short rule: catalog is not live proof.

## Covered Surfaces

The Phase 2 map covers internal surfaces and every channel family currently known to Zavorth:

- CLI, web and API;
- Telegram, Discord, Slack;
- WhatsApp umbrella, WhatsApp Cloud and WhatsApp Baileys;
- Signal, iMessage and BlueBubbles;
- Email and Microsoft Teams;
- Matrix, Mattermost and Nextcloud Talk;
- Feishu, Lark and Google Chat;
- IRC, LINE, Zalo and Zalo Personal;
- WeCom, Weixin, QQ Bot, Twitch and Nostr;
- Synology Chat, Tlon, ClickClack and generic webhooks;
- Yuanbao, SMS and Home Assistant.

## Activation Model

The canonical flow is:

```text
setup -> doctor -> pair/allowlist -> live proof -> receipt -> default route
```

Examples:

```bash
zavorth channels telegram setup
zavorth channels telegram doctor
zavorth channels telegram pair
zavorth channels telegram proof --live
zavorth channels telegram outbox
```

When a channel is not live-ready, outbound work must either be blocked or written to a safe outbox. This prevents the CLI, Dashboard or Telegram surface from implying that a real message was delivered when only a draft or catalog entry exists.

## Safety Guarantees

The Phase 2 check verifies:

- all channels have setup, doctor, pairing and live proof commands;
- external channels expose policy and receipts;
- non-live senders use safe outbox or block;
- secrets are never serialized;
- checks perform no external IO;
- checks perform no workspace mutation beyond repository files intentionally changed by development.

## Commands

```bash
npm run zavorth:channel-deepening
npm run zavorth:channel-deepening:json
npm run zavorth:channel-deepening:check --silent
```

The next architectural phase is Phase 3 - Learning Loop.
