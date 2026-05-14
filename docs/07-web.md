# Web Dashboard

The official web surface is the gateway dashboard at `/dashboard`.

## What It Is For

The dashboard is the operator gateway for:

- chatting with the runtime;
- seeing sessions, approvals and artifacts;
- checking channel and provider readiness;
- reviewing blocked or pending actions;
- continuing work without losing context.

## How To Open It

From an installed CLI:

```bash
zavorth go
```

From a cloned repo:

```bash
npm run go
```

Use the URL printed by the command. Local access and tokens should be handled by
the runtime and doctor flow rather than by asking users to inspect secrets
manually.

## What It Should Show Honestly

- ready capabilities;
- missing setup;
- approvals waiting for the user;
- dry-run previews;
- outbox-only channel state;
- blocked actions and the reason;
- artifacts and receipts.

## Legacy Surfaces

Older web shells may exist for maintenance or fallback. New user-facing product
work should target `/dashboard` or the Runtime API. Maintenance shells are not
final-user product surfaces and should not appear in normal onboarding. In
short, maintenance shells are not final-user surfaces.

## Mobile Companion

`/satellite` is the optional mobile/PWA companion surface. It should stay thin:
show chat, approval cards, receipts and safe runtime status from the same
contracts used by `/dashboard`. It must not become a separate agent or bypass
the Policy Broker.

## Related

- [Quickstart](/docs/02-quickstart.md)
- [CLI](/docs/34-zavorth-cli.md)
- [Security](/docs/05-security.md)
- [Roadmap](/docs/11-roadmap.md)
