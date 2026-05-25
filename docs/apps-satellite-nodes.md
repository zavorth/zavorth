# Zavorth Apps / Satellite Nodes

Phase 7 turns the existing companion, satellite and node-host pieces into one
governed product surface:

```txt
pairing code / QR -> allowlist -> companion health -> offline queue -> push plan -> receipt
```

The goal is not to pretend native mobile or desktop binaries already exist. The
goal is to make every app-like surface explicit, configurable and ready to be
activated without bypassing policy.

## Surfaces

| Surface | Status Meaning | Notes |
| --- | --- | --- |
| Satellite PWA | Ready when PWA assets exist | Browser-first companion with pairing, heartbeat and approval cards. |
| Mobile companion | Spec-ready | iOS/Android wrapper requirements are defined, but no app-store binary is claimed. |
| Desktop tray | Spec-ready/configurable | Tray notifications and quick actions require explicit owner opt-in. |
| Desktop companion | Ready when companion bootstrap code exists | Publishes heartbeat and local capability reports after pairing. |
| Node host | Ready when Node Mesh invocation/heartbeat services exist | Headless worker path with offline assignment queue. |
| Approval companion | Ready when action-card bridge exists | Shows scoped approvals and receipts across surfaces. |

## Pairing QR / Setup Code

```bash
npm run zavorth:apps-satellite-nodes -- --action pairing.qr
npm run zavorth:apps-satellite-nodes -- --action pairing.qr --surface mobile-companion
```

By default this is a preview only. A claimable pairing draft is created only
after approval:

```bash
npm run zavorth:apps-satellite-nodes -- --action pairing.qr --materialize --approval-id <id>
```

Pairing rules:

- setup codes are short-lived;
- QR payloads contain opaque setup codes, not shared secrets;
- remote surfaces still need allowlists before tools can be reached;
- every materialized pairing emits a receipt.

## Offline Queue

The offline queue is exposed as a durable local-state capability. It lets paired
satellite nodes receive assignments on the next heartbeat instead of dropping
work when a phone, tray or companion is offline.

Rules:

- queue storage stays in local state;
- retries are bounded;
- dead-letter counts are visible;
- replayed work must still pass policy and receipts.

## Push Notifications

```bash
npm run zavorth:apps-satellite-nodes -- --action push.plan
```

Push is a plan until a provider and user consent are configured. Supported
routes in the contract are:

- Web Push;
- mobile push provider;
- desktop tray notification;
- Telegram fallback notification.

The snapshot never performs a live send. Live delivery must be handled by a
channel/provider adapter with consent, credentials and receipt proof.

## Mobile And Tray Specs

```bash
npm run zavorth:apps-satellite-nodes -- --action mobile.spec
npm run zavorth:apps-satellite-nodes -- --action tray.spec
```

The specs define the capabilities a future signed wrapper or tray app must
support:

- pairing QR/setup code;
- approval cards;
- offline queue replay;
- push notification consent;
- camera/location/device-confirm permissions;
- receipt-first sensitive actions.

No native binary is treated as live until it exists, is configured and has proof
receipts.

## QA

```bash
npm run zavorth:apps-satellite-nodes:check --silent
npm run qa:zavorth-apps-satellite-nodes --silent
npm run zavorth:product-readiness:check --silent
```
