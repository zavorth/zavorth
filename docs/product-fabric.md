# Universal Product Fabric

Product Fabric is the **daily-product** plane: first-run trail, public CLI
surface, and hermetic certification of Capability / Reach / Power fabrics.

It turns the monorepo into a product path:

```text
install → setup → start → open → ask safely
         ↘ absorb / reach / power as needed
```

## Thesis

> Zavorth acquires capabilities on demand, expands reach honestly, powers elastic
> work under governance, and proves every sensitive action.

This is **not** a static storefront model. Catalog support is never live readiness.

## First-run trail

```bash
zavorth product first-run
```

Typical path:

1. `npm install -g zavorth@latest` (or `npx zavorth`)
2. `zavorth setup`
3. `zavorth start`
4. `zavorth open`
5. `zavorth ask "Review this repository and tell me what is risky."`

Optional:

- `zavorth reach channels --tier A`
- `zavorth absorb ./pack --preview`
- `zavorth power trusted on`

## Public commands (prefer these)

```bash
zavorth product commands
zavorth product commands --group daily
zavorth product commands --group capability
```

Monorepo `npm run ...` scripts remain internal engineering tools. Daily use
should go through `zavorth <command>`.

## Certification matrix (hermetic)

```bash
zavorth product certify
zavorth product doctor
```

Checks (no live network / no host mutation by default):

| Check | Fabric |
| --- | --- |
| Capability absorb preview | capability |
| Workspace structural import | capability |
| Reach inventory honesty (Tier B not fake-live) | reach |
| Channel synthesis preview | reach |
| Node capability taxonomy | reach |
| Modal/Daytona elastic posture | power |
| Trusted Operator red lane intact | power |
| Learning promote requires consent | power |
| Harness mutation gated | power |
| Context tool budget | power |
| Public command surface | product |
| First-run path defined | product |

## CLI

```bash
zavorth product
zavorth product certify
zavorth product doctor
zavorth product first-run
zavorth product commands
```

## Action Harness

| Action | Purpose |
| --- | --- |
| `product.inventory` | Readiness without full certify |
| `product.certify` | Hermetic matrix |
| `product.doctor` | First-run + fabrics diagnosis |
| `product.commands` | Public command catalog |

## Related

- [Capability Fabric](./capability-fabric.md)
- [Reach Fabric](./reach-fabric.md)
- [Power Fabric](./power-fabric.md)
- [Quickstart](./quickstart.md)
- [Product direction](./product-direction.md)
