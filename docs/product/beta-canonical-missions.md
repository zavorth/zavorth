# Beta canonical missions

Short list of missions that define a successful Zavorth beta day-0 loop.

## Must-pass (hermetic)

| ID | Why it matters |
|----|----------------|
| `dogfood.install.01` | Offline CLI home + version |
| `dogfood.install.02` | `doctor` reports `ready: yes` |
| `dogfood.install.03` | Offline help without network |
| `dogfood.first-run.03` | Code entry smoke |
| `dogfood.first-run.08` | Golden-path honesty classify |
| `dogfood.security.03` | ABAC engine |
| `dogfood.security.05` | Classic Control access/token |
| `dogfood.security.08` | `security:ci` gate |
| `dogfood.channels.06` | Channel factory registry |
| `dogfood.receipts.01` | Trust Loop / receipts golden path |
| `dogfood.update.03` | Update/rollback readiness scripts |

## Full catalog

See [dogfood-missions-100.md](./dogfood-missions-100.md) (110 missions).

## How to run

```bash
npm run dogfood:day0
npm run dogfood:hermetic
npm run dogfood:missions:check
```

## Honesty

- Live chat/channel/provider missions may be **blocked** without credentials.
- Retention **R2** (day-1 return) is calendar-gated and is not recorded on day 0.
