# Universal Reach Fabric

Zavorth expands **reach** without pretending every surface is live.

- **Channels** are tiered honestly.
- **Protocol packs** share a common doctor/allowlist/outbox base.
- **Synthesis** can draft new channel packs on demand.
- **Nodes** extend reach to companion devices under capability policy.

Catalog support is never live readiness.

## Channel tiers

| Tier | Meaning | Live by default? |
| --- | --- | --- |
| **A** | Native deep first-class surfaces (CLI, Web/Control, Telegram, Discord, WhatsApp, Slack, Signal, iMessage, Teams, Email) | Only local surfaces (CLI/Web) without external credentials. Others need doctor + live proof. |
| **B** | Protocol packs (webhook / bot-http / relay / graph / mail) with shared doctor base | Never from catalog/config alone |
| **C** | Synthesized packs generated from notes/docs | Never until doctor + live proof |

## CLI

```bash
# Inventory
zavorth reach
zavorth reach channels
zavorth reach channels --tier B

# Doctor (does not invent live-ready)
zavorth reach doctor matrix
zavorth reach doctor telegram

# Synthesize a new channel pack (Tier C)
zavorth reach synthesize ops-chat --notes "webhook based ops channel" --preview
zavorth reach synthesize ops-chat --notes "webhook based ops channel" --apply --consent

# Nodes
zavorth reach nodes
zavorth reach capabilities
zavorth reach pair --node-id desktop-1 --profile desktop-companion
zavorth reach invoke-preview --node desktop-1 --capability files.read
```

## Action Harness

| Action | Purpose |
| --- | --- |
| `reach.inventory` | Channel tiers + nodes snapshot |
| `reach.doctor` | Channel doctor without false live claims |
| `reach.synthesize` | Generate Tier C pack (preview ÔåÆ approve ÔåÆ quarantine) |
| `reach.nodes` | List nodes / reapproval state |
| `reach.pair` | Create pairing draft + bootstrap commands |
| `reach.invoke.preview` | Preview governed node capability invoke |

## Node capability families

`files` ┬À `shell` ┬À `camera` ┬À `screen` ┬À `location` ┬À `notify` ┬À `voice` ┬À `canvas` ┬À `clipboard` ┬À `device` ┬À `browser` ┬À `maintenance`

New capabilities declared by a node require **reapproval** before more work is delivered.

## Safety invariants

1. Catalog Ôëá live.
2. Tier C never live without proof.
3. Tier B doctor can report configuration, never default-route live.
4. Pairing and invoke are governed; secrets stay as refs.
5. Brand-agnostic: no third-party product profile required.
6. Preview before mutate for synthesis and pairing apply.

## Related

- [Channel Mesh](./channel-mesh.md)
- [Capability Fabric](./capability-fabric.md)
- [Node mesh live native](./node-mesh-live-native.md)
- [Desktop surface parity](./product/desktop-surface-parity.md)

## First-class completeness + live densification (all factory channels)

Product policy: **every factory-registered channel is first-class**. Missing credentials demote *live readiness*, never product class. Historical long-tail activation remains a **setup/credentials catalog**, not a permanent second-class quality tier.

### Shared base (current + future)

| Layer | Applies to | Module |
|-------|------------|--------|
| Completeness bar | every `WebhookGateway` subclass | doctor / mock I/O / command deck / outbox / redaction |
| Live transport densification | **all 29 factory ids + future ids** | `ChannelLiveTransportRegistry` |
| Inventory | all factory ids | `ChannelCompletenessService` |

**All current factory channels** (telegram, discord, slack, whatsapp, signal, teams, matrix, line, qq, nostr, email, imessage, instagram, feishu, wecom, mattermost, …) share the **same densified live planner**. No channel is left on a thinner architectural base.

**Future channels:** register in `ChannelGatewayFactory` (extend `WebhookGateway`) and either add an explicit registry case **or** use env convention:

- `CHANNEL_ID_WEBHOOK_URL`
- `CHANNEL_ID_BRIDGE_URL` (+ `/send`)
- `CHANNEL_ID_SEND_URL` (+ optional `_ACCESS_TOKEN` / `_BOT_TOKEN`)

| Capability | Required for all |
|------------|------------------|
| Inbound parse | yes |
| Outbound send / outbox fallback | yes |
| Densified live transport plan | yes (credentials optional) |
| Allowlist / policy gate | yes |
| Doctor snapshot | yes |
| Mock inbound/outbound | yes |
| Secret redaction | yes |
| Command deck | yes |
| Continuity session key | yes |
| Install scaffold command | yes |

```bash
npx jest tests/gateways/ChannelCompletenessService.test.ts \
  tests/gateways/WebhookGateway.completeness.test.ts \
  tests/gateways/ChannelLiveTransportRegistry.test.ts \
  tests/gateways/ChannelLiveDensification.test.ts --runInBand
```

Factory list: `ChannelGatewayFactory.listSupportedChannelIds()`.

## CI / release packaging

- Standalone binaries: `zavorth-<platform>.tar.gz` (includes **windows-x64**).
- Code TUI prebuilts: `code-tui-<platform>.tar.gz` (consumed by `npm run code:ensure`).
- CI runs channels + completeness; monorepo grouped suite on main/tags/`workflow_dispatch`.
