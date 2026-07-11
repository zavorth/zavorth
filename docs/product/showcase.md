# Product showcase (empty / first chat)

What a new operator should see on first open — honesty-first.

## Empty state

- Clear product name and version
- Single primary action: start chat or run setup
- Explicit note when no provider is configured (no fake “online” model)

## First chat

- Composer available offline
- Missing-provider path points to `doctor` / providers setup
- No invented completions without a configured backend

## Surfaces

| Surface | Empty / first-run focus |
|---------|-------------------------|
| CLI (`zavorth`) | home, help, doctor, setup |
| Zavorth Control | classic dashboard + chat entry |
| Desktop | product version + soft-fail bridge to code/host |

See also: [honesty-readiness.md](./honesty-readiness.md), [surfaces-code-control-desktop.md](./surfaces-code-control-desktop.md).
