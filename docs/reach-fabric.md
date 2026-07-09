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
| `reach.synthesize` | Generate Tier C pack (preview → approve → quarantine) |
| `reach.nodes` | List nodes / reapproval state |
| `reach.pair` | Create pairing draft + bootstrap commands |
| `reach.invoke.preview` | Preview governed node capability invoke |

## Node capability families

`files` · `shell` · `camera` · `screen` · `location` · `notify` · `voice` · `canvas` · `clipboard` · `device` · `browser` · `maintenance`

New capabilities declared by a node require **reapproval** before more work is delivered.

## Safety invariants

1. Catalog ≠ live.
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
