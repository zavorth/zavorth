# Gateway Control API

Gateway Control API is the structured control surface for runtime state that
should be shared by CLI, ZavorthControl and integrations.

## Purpose

The API should expose readable, redacted state for:

- providers and models;
- channel readiness;
- gateway health;
- cache and rate-limit posture;
- operations that require approval;
- diagnostics and receipts.

## Safety Rules

- read routes may expose redacted state;
- write routes require policy and approval;
- secrets must not be returned;
- delegated operations need timeout, receipt and redaction;
- unsupported actions should say so explicitly.

## Product Direction

The API should converge with the same readiness language used by Operations and
ZavorthControl: ready, needs setup, needs approval, dry-run, outbox-only,
blocked or unsupported.

## Related

- [Operations](/docs/operations.md)
- [Provider Mesh](/docs/provider-mesh.md)
- [Channel Mesh](/docs/channel-mesh.md)
