# Channel live proof

Honest channel readiness: **catalog ≠ configured ≠ doctor ≠ live**.

## Commands

```bash
zavorth channels live-matrix
zavorth channels live-matrix --json
zavorth channels live-matrix --channel telegram --strict
zavorth channels live-matrix --live --channel telegram
zavorth channels completeness [--smoke]
zavorth gateway panel
```

## Dogfood live (with credentials)

1. Configure the channel (`zavorth connect <id>` or env tokens).
2. `zavorth channels <id> doctor`
3. `zavorth channels <id> proof --live`
4. `zavorth channels live-matrix --live --channel <id>`
5. Env token presence is shown as a **config signal only** — never as live proof.

## Rules

- Live send requires mesh `liveReady` and proof in `{health, live_event, bridge}`.
- Control/API must not treat catalog support as live proof.
- Prefer `zavorth channels <id> doctor` and `proof --live` before opening default routing.
- `--live` / `--live-doctor` enables network-capable provider doctor enrichment.

## Gates

```bash
npm run qa:channel-live
zavorth surfaces doctor --quick
```

## Related

- Day surfaces: [day-to-day-surfaces.md](./day-to-day-surfaces.md)
- Product scale: [product-scale-surfaces.md](./product-scale-surfaces.md)
- Channel mesh: [../channel-mesh.md](../channel-mesh.md)
